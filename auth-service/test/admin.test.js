const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Banco inteiramente em memória: nenhum módulo MySQL ou .env é carregado.
let usuarios, eventos, updates, commits, rollbacks, liberacoes, abertas;
let falharUpdate, falharCommit, falharAuditoria, falharBanco, antesDoBloqueio;
let fila = Promise.resolve();
let hashSenha;
const publico = u => ({ id: u.id, nome: u.nome, email: u.email, role: u.role });
const db = {
    async execute(sql, args = []) {
        if (falharBanco) throw new Error('Banco indisponível');
        if (sql.includes('ORDER BY nome ASC, id ASC')) {
            return [[...usuarios].sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id).map(publico)];
        }
        if (sql.includes('WHERE id = ?')) return [usuarios.filter(u => u.id === args[0]).map(publico)];
        if (sql.includes('WHERE email = ?')) return [usuarios.filter(u => u.email === args[0]).map(u => ({ ...u }))];
        if (sql.includes('INSERT INTO usuarios')) {
            const id = Math.max(...usuarios.map(u => u.id), 0) + 1;
            usuarios.push({ id, nome: args[0], email: args[1], senha_hash: args[2], role: args[3] });
            return [{ insertId: id }];
        }
        throw new Error('SQL inesperado');
    },
    async getConnection() {
        let soltar, copia;
        return {
            async beginTransaction() { abertas++; },
            async execute(sql, args) {
                if (sql.endsWith('ORDER BY id ASC FOR UPDATE')) {
                    const anterior = fila;
                    fila = new Promise(resolve => { soltar = resolve; });
                    await anterior;
                    if (antesDoBloqueio) { antesDoBloqueio(); antesDoBloqueio = null; }
                    copia = usuarios.map(u => ({ ...u }));
                    return [copia.map(publico)];
                }
                assert.equal(sql, 'UPDATE usuarios SET role = ? WHERE id = ?');
                assert.ok(copia, 'UPDATE exige bloqueio anterior');
                if (falharUpdate) throw new Error('Erro simulado no UPDATE');
                updates++;
                copia.find(u => u.id === args[1]).role = args[0];
                return [{ affectedRows: 1 }];
            },
            async commit() {
                if (falharCommit) throw new Error('Erro simulado no commit');
                commits++; usuarios = copia; abertas--; soltar(); soltar = null;
            },
            async rollback() { rollbacks++; abertas--; if (soltar) { soltar(); soltar = null; } },
            release() { liberacoes++; }
        };
    }
};
const dbPath = require.resolve('../src/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

function reset() {
    usuarios = [
        { id: 1, nome: 'Ana', email: 'ana@example.invalid', role: 'admin', senha_hash: hashSenha },
        { id: 2, nome: 'Bia', email: 'bia@example.invalid', role: 'admin', senha_hash: hashSenha },
        { id: 3, nome: 'Caio', email: 'caio@example.invalid', role: 'usuario', senha_hash: hashSenha }
    ];
    eventos = []; updates = commits = rollbacks = liberacoes = abertas = 0;
    falharUpdate = falharCommit = falharAuditoria = falharBanco = false;
    antesDoBloqueio = null; fila = Promise.resolve();
}

// Testes sequenciais compartilham somente fixtures locais, JWT e HTTP reais.
test('gestão administrativa e regressão da autenticação', async t => {
    const secretAnterior = process.env.JWT_SECRET;
    const urlAnterior = process.env.LOG_SERVICE_URL;
    process.env.JWT_SECRET = randomUUID();
    process.env.LOG_SERVICE_URL = 'http://auditoria.test';
    const senha = randomUUID();
    hashSenha = await bcrypt.hash(senha, 4);
    const originalFetch = global.fetch;
    const originalError = console.error;
    console.error = () => {};
    global.fetch = async (url, options) => {
        assert.equal(String(url), 'http://auditoria.test/eventos');
        assert.equal(abertas, 0, 'Não pode chamar auditoria durante transação');
        if (falharAuditoria) throw new Error('Auditoria indisponível');
        eventos.push(JSON.parse(options.body));
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
    };
    const app = express(); app.use(express.json());
    app.use('/auth', require('../src/auth'));
    app.use('/auth/admin', require('../src/admin'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = (id, role = 'admin', options = {}) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
    const request = async (method, path, bearer, body) => {
        const resposta = await originalFetch(base + path, {
            method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        return { status: resposta.status, body: await resposta.json() };
    };
    const get = bearer => request('GET', '/auth/admin/usuarios', bearer);
    const patch = (bearer, id, role) => request('PATCH', `/auth/admin/usuarios/${id}/role`, bearer, { role });
    async function caso(nome, executar) { await t.test(nome, async () => { reset(); await executar(); assert.equal(abertas, 0); }); }
    try {
        await caso('GET/PATCH sem token, inválido, expirado, id inválido e usuário ausente: 401 sem auditoria', async () => {
            for (const bearer of [undefined, 'invalido', token(1, 'admin', { expiresIn: -1 }), token(0), token('1'), token(999)]) {
                assert.equal((await get(bearer)).status, 401);
                assert.equal((await patch(bearer, 3, 'admin')).status, 401);
            }
            assert.equal(eventos.length, 0);
        });
        await caso('role atual do banco prevalece: GET/PATCH usuário recebem 403 e ACAO_NEGADA', async () => {
            const bearer = token(3, 'admin');
            assert.equal((await get(bearer)).status, 403);
            assert.equal((await patch(bearer, 2, 'usuario')).status, 403);
            assert.deepEqual(eventos.map(e => e.detalhes.operacao), ['LISTAR_USUARIOS', 'ALTERAR_ROLE']);
            for (const e of eventos) { assert.equal(e.acao, 'ACAO_NEGADA'); assert.equal(e.usuario_id, 3); assert.equal(e.detalhes.recurso, 'GESTAO_USUARIOS'); assert.equal(e.detalhes.motivo, 'role_insuficiente'); }
        });
        await caso('admin lista campos permitidos em ordem previsível mesmo com role antiga no JWT', async () => {
            usuarios[2].nome = 'Ana';
            const r = await get(token(1, 'usuario')); assert.equal(r.status, 200);
            assert.deepEqual(r.body.usuarios.map(u => u.id), [1, 3, 2]);
            for (const u of r.body.usuarios) assert.deepEqual(Object.keys(u).sort(), ['email', 'id', 'nome', 'role']);
            assert.equal(JSON.stringify(r.body).includes('senha_hash'), false);
        });
        await caso('IDs e roles inválidos: 400 sem transação ou auditoria', async () => {
            for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992', '1e0']) assert.equal((await patch(token(1), id, 'admin')).status, 400);
            for (const role of ['ADMIN', 'user', 'administrador', 'superadmin', null, '', {}, undefined]) assert.equal((await patch(token(1), 3, role)).status, 400);
            assert.equal(updates + eventos.length + liberacoes, 0);
        });
        await caso('usuário inexistente: 404 e rollback', async () => {
            assert.equal((await patch(token(1), 999, 'admin')).status, 404);
            assert.equal(rollbacks, 1); assert.equal(liberacoes, 1);
        });
        await caso('autoalteração: 409 inclusive pedido idempotente', async () => {
            assert.equal((await patch(token(1), 1, 'usuario')).status, 409);
            assert.equal((await patch(token(1), 1, 'admin')).status, 409);
            assert.equal(updates, 0); assert.equal(eventos.length, 0);
        });
        await caso('último admin: 409 preserva administrador', async () => {
            usuarios[1].role = 'usuario';
            const r = await patch(token(1), 1, 'usuario'); assert.equal(r.status, 409);
            assert.match(r.body.mensagem, /último administrador/); assert.equal(usuarios[0].role, 'admin');
        });
        await caso('promoção e rebaixamento auditados após commit; repetição não faz UPDATE nem evento', async () => {
            const bearer = token(1);
            const r = await patch(bearer, 3, 'admin'); assert.equal(r.status, 200); assert.equal(r.body.usuario.role, 'admin');
            assert.deepEqual(Object.keys(r.body.usuario).sort(), ['email', 'id', 'nome', 'role']);
            assert.equal((await patch(bearer, 3, 'admin')).status, 200); assert.equal(updates, 1); assert.equal(eventos.length, 1);
            assert.equal((await patch(bearer, 3, 'usuario')).status, 200); assert.equal(updates, 2);
            assert.deepEqual(eventos.map(e => e.detalhes), [
                { usuario_alvo_id: 3, role_anterior: 'usuario', role_nova: 'admin' },
                { usuario_alvo_id: 3, role_anterior: 'admin', role_nova: 'usuario' }
            ]);
            for (const e of eventos) { assert.equal(e.usuario_id, 1); assert.equal(e.acao, 'ROLE_ALTERADA'); assert.ok(e.ip); }
            assert.equal(commits, 3); assert.equal(liberacoes, 3);
        });
        await caso('falha de auditoria não desfaz commit nem altera 403', async () => {
            falharAuditoria = true;
            assert.equal((await patch(token(1), 3, 'admin')).status, 200);
            assert.equal(usuarios[2].role, 'admin'); assert.equal(commits, 1); assert.equal(rollbacks, 0);
            usuarios[2].role = 'usuario'; assert.equal((await get(token(3))).status, 403);
        });
        await caso('falhas de UPDATE/commit: rollback, release, sem ROLE_ALTERADA', async () => {
            falharUpdate = true; assert.equal((await patch(token(1), 3, 'admin')).status, 500);
            falharUpdate = false; falharCommit = true; assert.equal((await patch(token(1), 3, 'admin')).status, 500);
            assert.equal(usuarios[2].role, 'usuario'); assert.equal(rollbacks, 2); assert.equal(liberacoes, 2); assert.equal(eventos.length, 0);
        });
        await caso('revalida executor no bloqueio se role mudou após middleware', async () => {
            antesDoBloqueio = () => { usuarios[0].role = 'usuario'; };
            assert.equal((await patch(token(1), 3, 'admin')).status, 403);
            assert.equal(updates, 0); assert.equal(eventos[0].acao, 'ACAO_NEGADA');
        });
        await caso('duas tentativas simultâneas de rebaixamento cruzado preservam um admin', async () => {
            const respostas = await Promise.all([patch(token(1), 2, 'usuario'), patch(token(2), 1, 'usuario')]);
            assert.deepEqual(respostas.map(r => r.status).sort(), [200, 403]);
            assert.equal(usuarios.filter(u => u.role === 'admin').length, 1);
            assert.equal(updates, 1);
        });
        await caso('cadastro ignora role admin; login e validar preservados', async () => {
            const c = await request('POST', '/auth/cadastro', null, { nome: 'Novo', email: 'novo@example.invalid', senha, role: 'admin' });
            assert.equal(c.status, 201); assert.equal(c.body.usuario.role, 'usuario');
            const login = await request('POST', '/auth/login', null, { email: 'novo@example.invalid', senha });
            assert.equal(login.status, 200); assert.ok(login.body.token); assert.equal(login.body.usuario.role, 'usuario');
            assert.equal(eventos[0].acao, 'LOGIN');
            const bearer = login.body.token;
            usuarios.find(u => u.id === c.body.usuario.id).role = 'admin';
            const validacao = await request('GET', '/auth/validar', bearer); assert.equal(validacao.status, 200); assert.equal(validacao.body.usuario.role, 'admin');
            assert.deepEqual(Object.keys(validacao.body.usuario).sort(), ['email', 'id', 'nome', 'role']);
            assert.equal((await request('POST', '/auth/login', null, { email: 'novo@example.invalid', senha: 'errada' })).status, 401);
            assert.equal((await request('POST', '/auth/cadastro', null, {})).status, 400);
            assert.equal((await request('GET', '/auth/validar')).status, 401);
            assert.equal(eventos.length, 1);
        });
        await caso('erro do banco retorna mensagem genérica sem detalhes internos', async () => {
            falharBanco = true;
            const r = await get(token(1)); assert.equal(r.status, 500); assert.deepEqual(r.body, { mensagem: 'Erro interno do servidor.' });
        });
    } finally {
        global.fetch = originalFetch; console.error = originalError;
        if (secretAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretAnterior;
        if (urlAnterior === undefined) delete process.env.LOG_SERVICE_URL; else process.env.LOG_SERVICE_URL = urlAnterior;
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});
