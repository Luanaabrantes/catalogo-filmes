const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');

// Nenhuma conexão com MySQL: regressões usam respostas locais controladas.
const dbPath = require.resolve('../src/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    async execute(sql) {
        if (sql.includes('INSERT')) return [{ insertId: 7 }];
        if (sql.includes('DELETE')) return [{ affectedRows: 1 }];
        if (sql.includes('FROM favoritos')) return [[{ tmdb_movie_id: 42 }]];
        if (sql.includes('FROM comentarios')) return [[{ id: 7, usuario_id: 1, texto: 'Teste', tmdb_movie_id: 42 }]];
        throw new Error('SQL inesperado');
    }
} };

test('proxy administrativo e regressão das rotas do catálogo', async t => {
    const env = { AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL, LOG_SERVICE_URL: process.env.LOG_SERVICE_URL };
    process.env.AUTH_SERVICE_URL = 'http://auth.test';
    process.env.LOG_SERVICE_URL = 'http://logs.test';
    const originalFetch = global.fetch;
    const originalError = console.error;
    const consoleMessages = [];
    console.error = (...args) => consoleMessages.push(args.join(' '));
    const token = 'token-apenas-para-teste';
    const usuario = { id: 1, nome: 'Ana', email: 'ana@example.invalid', role: 'admin' };
    let role, chamadas, eventos, status, payload, falha, etapa, falhaAuditoria;
    const json = (status, dados) => ({ status, ok: status >= 200 && status < 300, json: async () => dados });
    global.fetch = async (url, options = {}) => {
        const caminho = new URL(url).pathname;
        chamadas.push({ url: String(url), ...options });
        if (caminho === '/eventos' && options.method === 'POST') {
            if (falhaAuditoria) throw new Error('Indisponível');
            eventos.push(JSON.parse(options.body));
            return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
        }
        if (caminho === '/auth/validar' || caminho.startsWith('/auth/admin')) {
            assert.equal(options.headers.Authorization, `Bearer ${token}`);
            assert.ok(options.signal instanceof AbortSignal);
            if (falha && (etapa === 'validar' ? caminho === '/auth/validar' : caminho.startsWith('/auth/admin'))) {
                if (falha === 'rede') throw new Error('ECONNREFUSED');
                if (falha === 'json') return { status: 200, json: async () => { throw new SyntaxError('JSON inválido'); } };
                // Aguarda o AbortSignal real para verificar o timeout configurado.
                return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
            }
        }
        if (caminho === '/auth/validar') return json(200, { usuario: { ...usuario, role } });
        if (caminho.startsWith('/auth/admin')) return json(status, payload);
        if (caminho === '/auth/login') return json(200, { token, usuario, mensagem: 'Login realizado' });
        if (caminho === '/eventos') return json(200, { eventos: [] });
        throw new Error('Destino inesperado');
    };
    const app = express(); app.use(express.json()); app.use(cookieParser());
    for (const nome of ['admin', 'auth', 'favoritos', 'comentarios', 'logs']) app.use(`/api/${nome}`, require(`../src/${nome}`));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(method, path, sessao = true, body) {
        const r = await originalFetch(base + path, { method, headers: {
            'Content-Type': 'application/json', ...(sessao ? { Cookie: `token=${token}` } : {})
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const dados = await r.json();
        assert.equal(JSON.stringify(dados).includes(token), false, 'Token não pode aparecer na resposta');
        return { status: r.status, body: dados, cookie: r.headers.get('set-cookie') };
    }
    const get = (sessao = true) => request('GET', '/api/admin/usuarios', sessao);
    const patch = (sessao = true, body = { role: 'admin' }, id = '42') => request('PATCH', `/api/admin/usuarios/${id}/role`, sessao, body);
    async function caso(nome, fn) {
        await t.test(nome, async () => {
            role = 'admin'; chamadas = []; eventos = []; status = 200; payload = { usuarios: [usuario] };
            falha = null; etapa = 'admin'; falhaAuditoria = false;
            await fn();
            for (const c of chamadas) {
                assert.equal(c.url.includes(token), false);
                assert.equal((c.body || '').includes(token), false);
            }
        });
    }
    try {
        await caso('GET e PATCH sem sessão retornam 401 sem chamadas internas', async () => {
            assert.equal((await get(false)).status, 401); assert.equal((await patch(false)).status, 401);
            assert.equal(chamadas.length, 0);
        });
        await caso('usuário comum: um ACAO_NEGADA por operação e nenhum encaminhamento administrativo', async () => {
            role = 'usuario';
            assert.equal((await get()).status, 403); assert.equal(eventos.length, 1);
            assert.equal((await patch()).status, 403); assert.equal(eventos.length, 2);
            assert.equal(chamadas.filter(c => c.url.includes('/auth/admin')).length, 0);
            assert.deepEqual(eventos.map(e => e.detalhes.operacao), ['LISTAR_USUARIOS', 'ALTERAR_ROLE']);
            for (const e of eventos) {
                assert.equal(e.usuario_id, 1); assert.equal(e.acao, 'ACAO_NEGADA'); assert.ok(e.ip);
                assert.equal(e.detalhes.recurso, 'GESTAO_USUARIOS'); assert.equal(e.detalhes.motivo, 'role_insuficiente');
            }
        });
        await caso('admin GET preserva JSON, usa Bearer e não encaminha query', async () => {
            const r = await request('GET', '/api/admin/usuarios?ignorar=1');
            assert.equal(r.status, 200); assert.deepEqual(r.body, payload);
            assert.equal(chamadas[1].url, 'http://auth.test/auth/admin/usuarios');
            assert.equal(chamadas[1].method, 'GET'); assert.equal(chamadas[1].body, undefined);
            assert.equal(eventos.length, 0);
        });
        await caso('admin PATCH encaminha apenas role e ID correto', async () => {
            payload = { mensagem: 'Atualizado', usuario };
            const r = await patch(true, { role: 'admin', id: 999, senha: 'ignorar', nome: 'ignorar' });
            assert.equal(r.status, 200); assert.deepEqual(r.body, payload);
            assert.equal(chamadas[1].url, 'http://auth.test/auth/admin/usuarios/42/role');
            assert.equal(chamadas[1].method, 'PATCH'); assert.equal(chamadas[1].headers['Content-Type'], 'application/json');
            assert.deepEqual(JSON.parse(chamadas[1].body), { role: 'admin' }); assert.equal(eventos.length, 0);
        });
        await caso('preserva status e mensagem de 400, 401, 403, 404, 409 e 500', async () => {
            for (const codigo of [400, 401, 403, 404, 409, 500]) {
                status = codigo; payload = { mensagem: 'Resposta segura do auth-service.' };
                for (const chamada of [get, patch]) {
                    const r = await chamada(); assert.equal(r.status, codigo); assert.deepEqual(r.body, payload);
                }
            }
            assert.equal(eventos.length, 0);
        });
        await caso('rede ou JSON inválido retornam 503 seguro', async () => {
            for (const ponto of ['validar', 'admin']) for (const erro of ['rede', 'json']) {
                etapa = ponto; falha = erro;
                const r = await get(); assert.equal(r.status, 503);
                assert.deepEqual(r.body, { mensagem: 'Serviço de autenticação indisponível.' });
            }
        });
        await caso('timeout real na validação e no proxy retorna 503', async () => {
            falha = 'timeout';
            for (const ponto of ['validar', 'admin']) {
                etapa = ponto; const inicio = Date.now(); assert.equal((await patch()).status, 503);
                assert.ok(Date.now() - inicio < 5000);
            }
        });
        await caso('indisponibilidade da auditoria mantém 403 sem encaminhar administração', async () => {
            role = 'usuario'; falhaAuditoria = true; assert.equal((await get()).status, 403);
            assert.equal(chamadas.filter(c => c.url.includes('/auth/admin')).length, 0);
        });
        await caso('regressão: login HttpOnly, logout, favoritos, comentários e consulta de logs', async () => {
            const login = await request('POST', '/api/auth/login', false, { email: usuario.email, senha: 'teste' });
            assert.equal(login.status, 200); assert.match(login.cookie, /HttpOnly/);
            assert.equal((await request('POST', '/api/auth/logout')).status, 200);
            assert.equal(eventos.at(-1).acao, 'LOGOUT');
            assert.deepEqual((await request('GET', '/api/favoritos')).body, { favoritos: [42] });
            assert.equal((await request('POST', '/api/favoritos/42')).status, 201);
            assert.equal(eventos.at(-1).acao, 'FILME_FAVORITADO');
            assert.equal((await request('DELETE', '/api/favoritos/42')).status, 200);
            assert.equal(eventos.at(-1).acao, 'FILME_DESFAVORITADO');
            assert.equal((await request('GET', '/api/comentarios')).status, 200);
            assert.equal((await request('POST', '/api/comentarios/42', true, { texto: 'Teste' })).status, 201);
            assert.equal(eventos.at(-1).acao, 'COMENTARIO_CRIADO');
            assert.equal((await request('DELETE', '/api/comentarios/7')).status, 200);
            assert.equal(eventos.at(-1).acao, 'COMENTARIO_APAGADO');
            assert.deepEqual((await request('GET', '/api/logs?limit=4')).body, { eventos: [] });
            assert.ok(chamadas.some(c => c.url === 'http://logs.test/eventos?limit=4'));
        });
        assert.equal(consoleMessages.some(m => m.includes(token)), false);
    } finally {
        global.fetch = originalFetch; console.error = originalError;
        for (const [chave, valor] of Object.entries(env)) {
            if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor;
        }
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});
