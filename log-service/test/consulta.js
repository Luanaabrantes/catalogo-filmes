const assert = require('node:assert/strict');
const test = require('node:test');
const redisPath = require.resolve('../src/redis');
const redis = { isReady: true, xRevRange: async () => [] };
require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: redis };
const consultar = require('../src/consulta');
const autenticar = require('../src/middlewareAuth');

test('consulta usa COUNT, inverte os selecionados e tolera detalhes antigos inválidos', async () => {
    redis.xRevRange = async (...args) => {
        assert.deepEqual(args, ['auditoria', '+', '-', { COUNT: 4 }]);
        return [
            { id: '4-0', message: { detalhes: '{' } },
            { id: '3-0', message: { detalhes: 'null' } },
            { id: '2-0', message: { detalhes: '{"filme":13}' } },
            { id: '1-0', message: { acao: 'LOGIN' } }
        ];
    };
    const eventos = await consultar(4);
    assert.deepEqual(eventos.map(e => e.id), ['1-0', '2-0', '3-0', '4-0']);
    assert.equal(eventos[0].detalhes, undefined);
    assert.deepEqual(eventos[1].detalhes, { filme: 13 });
    assert.deepEqual(eventos[2].detalhes, {});
    assert.deepEqual(eventos[3].detalhes, {});
    for (const limite of [0, -1, 101, 2.5, '4']) await assert.rejects(consultar(limite), RangeError);
    redis.isReady = false;
    await assert.rejects(consultar(4), /Redis/);
    redis.isReady = true;
});

test('autenticação falha fechada em erro de rede, timeout ou resposta inválida', async () => {
    const originalFetch = global.fetch;
    const originalError = console.error;
    console.error = () => {};
    try {
        for (const resposta of [
            async () => { throw new Error('rede'); },
            async () => { throw new DOMException('timeout', 'TimeoutError'); },
            async () => ({ ok: false, status: 500 }),
            async () => ({ ok: true, json: async () => ({}) })
        ]) {
            global.fetch = resposta;
            let status;
            const res = { status(n) { status = n; return this; }, json() {} };
            await autenticar({ headers: { authorization: 'Bearer teste' } }, res, () => assert.fail('Não deve autorizar'));
            assert.equal(status, 503);
        }
    } finally { global.fetch = originalFetch; console.error = originalError; }
});
