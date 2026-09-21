// Executar com os containers ativos:
// Get-Content log-service/test/eventos.js -Raw | docker compose exec -T log-service node
const assert = require('node:assert/strict');
const { createClient } = require('redis');

(async () => {
    const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    redis.on('error', () => {});
    await redis.connect();
    const url = 'http://127.0.0.1:3002/eventos';
    const enviar = body => fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(5000)
    });
    try {
        const antes = await redis.xLen('auditoria');
        const valido = { usuario_id: 999, acao: 'TESTE_AUDITORIA', detalhes: { origem: 'teste_etapa_3' } };
        const resposta = await enviar(valido);
        assert.equal(resposta.status, 201);
        const { evento_id } = await resposta.json();
        assert.match(evento_id, /^\d+-\d+$/);
        const registros = await redis.xRange('auditoria', evento_id, evento_id);
        assert.equal(registros.length, 1);
        assert.equal(registros[0].message.usuario_id, '999');
        assert.equal(registros[0].message.acao, valido.acao);
        assert.equal(JSON.parse(registros[0].message.detalhes).origem, 'teste_etapa_3');
        assert.ok(Number.isFinite(Date.parse(registros[0].message.timestamp)));
        assert.ok(registros[0].message.ip);
        console.log('201 evento válido; XRANGE:', JSON.stringify(registros));

        const invalidos = [
            ['sem usuário', { acao: 'TESTE' }],
            ['usuário inválido', { usuario_id: {}, acao: 'TESTE' }],
            ['usuário zero', { usuario_id: 0, acao: 'TESTE' }],
            ['usuário fracionário', { usuario_id: 1.5, acao: 'TESTE' }],
            ['sem ação', { usuario_id: 1 }],
            ['ação vazia', { usuario_id: 1, acao: '  ' }],
            ['ação não string', { usuario_id: 1, acao: 12 }],
            ['detalhes inválidos', { ...valido, detalhes: 'texto' }],
            ['timestamp inválido', { ...valido, timestamp: 'ontem' }],
            ['data inexistente', { ...valido, timestamp: '2026-02-30T12:00:00.000Z' }],
            ['campo sensível', { ...valido, detalhes: { token: 'nao-deve-ser-gravado' } }],
            ['campo sensível aninhado', { ...valido, detalhes: { itens: [{ Senha_Hash: 'nao-deve-ser-gravado' }] } }]
        ];
        for (const [nome, evento] of invalidos) {
            const r = await enviar(evento);
            assert.equal(r.status, 400, nome);
            console.log('400', nome);
        }
        const malformado = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
        });
        assert.equal(malformado.status, 400);
        console.log('400 JSON malformado');
        assert.equal(await redis.xLen('auditoria'), antes + 1, 'Eventos inválidos não podem ser gravados');

        const informado = await enviar({ usuario_id: '999', acao: 'TESTE_TIMESTAMP', timestamp: '2026-09-21T19:00:00-03:00' });
        assert.equal(informado.status, 201);
        const idInformado = (await informado.json()).evento_id;
        const [registro] = await redis.xRange('auditoria', idInformado, idInformado);
        assert.equal(registro.message.timestamp, '2026-09-21T22:00:00.000Z');
        assert.equal(registro.message.detalhes, undefined);
        console.log('201 timestamp informado normalizado e detalhes opcionais');
        assert.equal((await fetch(url)).status, 404);
        console.log('404 GET /eventos não implementado');
    } finally {
        await redis.close();
    }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
