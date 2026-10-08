const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { gerar } = require('../src/openapi');

const rotas = {
    catalogo: {
        'src/server.js': '',
        'src/auth.js': '/api/auth', 'src/filmes.js': '/api/filmes',
        'src/favoritos.js': '/api/favoritos', 'src/comentarios.js': '/api/comentarios',
        'src/logs.js': '/api/logs', 'src/admin.js': '/api/admin', 'src/perfil.js': '/api/perfil',
    },
    auth: {
        'auth-service/src/auth.js': '/auth', 'auth-service/src/admin.js': '/auth/admin',
        'auth-service/src/recuperacaoSenha.js': '/auth', 'auth-service/src/server.js': '',
    },
};

for (const servico of ['catalogo', 'auth']) {
    test(`${servico}: OpenAPI válido, exportação atual e cobertura exata das rotas`, async () => {
        const spec = gerar(servico);
        await SwaggerParser.validate(structuredClone(spec));
        const salvo = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/openapi', `${servico}.json`)));
        assert.deepEqual(spec, salvo, 'Execute npm run docs:generate após editar as anotações');
        const reais = [];
        for (const [arquivo, base] of Object.entries(rotas[servico])) {
            const codigo = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
            for (const match of codigo.matchAll(/(?:router|app)\.(get|post|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
                const rota = (base + (match[2] === '/' ? '' : match[2])).replace(/:([\w]+)/g, '{$1}');
                reais.push(`${match[1]} ${rota}`);
            }
        }
        const documentadas = Object.entries(spec.paths).flatMap(([rota, item]) => Object.keys(item).map(m => `${m} ${rota}`));
        assert.deepEqual(documentadas.sort(), reais.sort());
        for (const [rota, item] of Object.entries(spec.paths)) {
            for (const op of Object.values(item)) {
                const parametros = (op.parameters || []).filter(p => p.in === 'path');
                assert.deepEqual(parametros.map(p => p.name).sort(), [...rota.matchAll(/\{([^}]+)\}/g)].map(m => m[1]).sort());
                assert.ok(parametros.every(p => p.required));
                assert.ok(Object.keys(op.responses).some(c => c.startsWith('2')));
                for (const security of op.security) {
                    for (const name of Object.keys(security)) assert.ok(spec.components.securitySchemes[name]);
                }
            }
        }
    });
}

test('Swagger separado, JSON de leitura, upload e mecanismos de autenticação reais', async t => {
    const app = express();
    require('../src/documentacao')(app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const catalogo = await (await fetch(`${origin}/openapi/catalogo.json`)).json();
    const auth = await (await fetch(`${origin}/openapi/auth.json`)).json();
    assert.equal(catalogo.components.securitySchemes.sessao.name, 'token');
    assert.equal(catalogo.servers[0].url, '/');
    assert.equal(auth.paths['/auth/validar'].get['x-public-proxy'], 'GET /api/auth/me');
    assert.equal(auth.paths['/health'].get['x-public-proxy'], undefined);
    assert.ok(catalogo.paths['/api/perfil/{id}/foto'].post.requestBody.content['multipart/form-data']);
    assert.equal(catalogo.components.schemas.Foto.properties.foto.format, 'binary');
    assert.equal(catalogo.paths['/api/comentarios/{id}'].delete.responses['403'].content['application/json'].examples['0'].value.mensagem,
        'Você não tem permissão para excluir este comentário.');
    for (const rota of ['/apidocs/', '/apidocs/auth/']) {
        const r = await fetch(origin + rota);
        assert.equal(r.status, 200);
        assert.match(await r.text(), /swagger-ui/);
    }
    const interno = await (await fetch(`${origin}/apidocs/auth/swagger-ui-init.js`)).text();
    const publico = await (await fetch(`${origin}/apidocs/swagger-ui-init.js`)).text();
    assert.match(interno, /Auth-service — API interna/);
    assert.match(interno, /"supportedSubmitMethods": \[\]/);
    assert.match(publico, /Catálogo de filmes — API pública/);
    assert.doesNotMatch(publico, /"supportedSubmitMethods": \[\]/);
});
