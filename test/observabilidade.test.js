const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { readiness, limitar, http } = require('../src/saude');
const { criarMetricas } = require('../src/metricas');
async function servidor(t, app) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return `http://127.0.0.1:${server.address().port}`;
}
test('readiness: falha real de HTTP, status 503, liveness independente e recuperação', async t => {
    let falha = false;
    const dependency = express(); dependency.get('/health', (_, res) => res.sendStatus(falha ? 503 : 200));
    const dep = await servidor(t, dependency);
    const app = express();
    app.get('/live', (_, res) => res.json({status:'ok'}));
    app.get('/health', readiness('teste', { dependencia: () => http(dep+'/health') }));
    const url = await servidor(t, app);
    assert.equal((await fetch(url+'/health')).status, 200);
    falha = true;
    const bad = await fetch(url+'/health'); assert.equal(bad.status, 503);
    assert.deepEqual(await bad.json(), {servico:'teste',status:'indisponivel',dependencias:{dependencia:'indisponivel'}});
    assert.equal((await fetch(url+'/live')).status, 200);
    falha = false; assert.equal((await fetch(url+'/health')).status, 200);
});
test('probes expiram e nunca incluem erro, senha ou host no JSON', async t => {
    await assert.rejects(limitar(() => new Promise(() => {}), 20));
    const app=express();
    app.get('/health', readiness('teste', { banco: () => { throw new Error('senha=segredo host=privado'); } }));
    const url=await servidor(t,app); const r=await fetch(url+'/health');
    assert.equal(r.status,503); assert.doesNotMatch(await r.text(),/segredo|privado|senha|host/);
});
test('métricas agregam IDs e queries, incluem 403, 500, 404 e JSON inválido sem dupla contagem', async t => {
    const app=express(), m=criarMetricas(); app.use(m.middleware); app.use(express.json());
    const router=express.Router(); router.get('/:id', (req,res) => res.status(req.params.id==='2'?403:200).json({ok:true}));
    app.use('/filmes',router);
    app.get('/erro', () => { throw new Error('privado'); });
    app.post('/json', (_,res)=>res.sendStatus(200)); app.get('/metrics',m.endpoint);
    app.use((err,req,res,next)=>res.sendStatus(err.status || 500));
    const url=await servidor(t,app);
    await fetch(url+'/filmes/1?q=a'); await fetch(url+'/filmes/2?q=b'); await fetch(url+'/filmes/3');
    await fetch(url+'/erro'); await fetch(url+'/inexistente/123');
    await fetch(url+'/json',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
    const r=await fetch(url+'/metrics'); assert.match(r.headers.get('content-type'),/text\/plain/);
    const text=await r.text();
    assert.match(text,/http_requisicoes_total\{metodo="GET",rota="\/filmes\/:id",status="200"\} 2/);
    assert.match(text,/rota="\/filmes\/:id",status="403"\} 1/);
    assert.match(text,/rota="\/erro",status="500"\} 1/);
    assert.match(text,/rota="\/nao-mapeada",status="404"\} 1/);
    assert.match(text,/status="400"\} 1/);
    assert.match(text,/http_requisicao_duracao_segundos_bucket/);
    assert.doesNotMatch(text,/q=|\/filmes\/1|\/filmes\/2|privado/);
});

test('respostas negadas antes da rota usam o contrato fixo sem IDs ou query', async t => {
    const app=express(), m=criarMetricas({rotas:[['get','/perfil/{id}']]}); app.use(m.middleware);
    app.use('/perfil', (_,res)=>res.sendStatus(401)); app.get('/metrics',m.endpoint);
    const url=await servidor(t,app); await fetch(url+'/perfil/123?q=privado'); await fetch(url+'/perfil/456');
    const text=await (await fetch(url+'/metrics')).text();
    assert.match(text,/rota="\/perfil\/:id",status="401"\} 2/);
    assert.doesNotMatch(text,/123|456|privado/);
});
