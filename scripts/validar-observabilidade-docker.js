// Teste somente no projeto Docker observabilidade-qa. Nunca usa a stack de produção.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const args = ['compose', '--env-file', 'tmp/observabilidade/.env', '-p', 'observabilidade-qa', '-f', 'docker-compose.observabilidade-test.yml'];
const compose = (...a) => execFileSync('docker', [...args, ...a], { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function inspect(service) {
    const id = compose('ps', '-aq', service);
    return JSON.parse(execFileSync('docker', ['inspect', id], { encoding: 'utf8' }))[0];
}
async function health(service, expected, ms=90000) {
    const deadline = Date.now()+ms;
    while (Date.now()<deadline) {
        if (inspect(service).State.Health?.Status===expected) return;
        await sleep(2000);
    }
    throw new Error(service+' não alcançou '+expected);
}
function api(service, port, path) {
    const code = `fetch('http://127.0.0.1:${port}${path}', {signal:AbortSignal.timeout(4000)}).then(async r=>console.log(JSON.stringify({status:r.status,body:await r.text()}))).catch(()=>process.exit(1))`;
    return JSON.parse(compose('exec', '-T', service, 'node', '-e', code));
}
(async () => {
    for(const service of ['catalogo','auth-service','log-service','redis','minio','mariadb']) {
        await health(service,'healthy'); console.log(service+': healthy');
    }
    for(const [service,port] of [['catalogo',3000],['auth-service',3001],['log-service',3002]]) {
        assert.equal(api(service,port,'/health').status,200);
        assert.equal(api(service,port,'/live').status,200);
    }
    const started = inspect('log-service').State.StartedAt;
    let stopped=false;
    try {
        compose('stop','-t','3','redis'); stopped=true;
        await health('log-service','unhealthy',60000);
        assert.equal(api('log-service',3002,'/health').status,503);
        assert.equal(api('log-service',3002,'/live').status,200);
        assert.equal(api('catalogo',3000,'/health').status,200);
        console.log('Redis parado: log-service unhealthy; /health 503; /live 200');
    } finally { if(stopped) compose('start','redis'); }
    await health('redis','healthy'); await health('log-service','healthy');
    assert.equal(inspect('log-service').State.StartedAt,started);
    assert.equal(api('log-service',3002,'/health').status,200);
    console.log('Redis restaurado: log-service healthy, sem reinício');
    assert.equal(api('catalogo',3000,'/api/perfil/123').status,401);
    assert.equal(api('catalogo',3000,'/api/perfil/456').status,401);
    assert.equal(api('catalogo',3000,'/rota-inexistente').status,404);
    const m=api('catalogo',3000,'/metrics'); assert.equal(m.status,200);
    assert.match(m.body,/rota="\/api\/perfil\/:id",status="401"/);
    assert.match(m.body,/http_requisicao_duracao_segundos_bucket/);
    assert.doesNotMatch(m.body,/perfil\/123|perfil\/456/);
    console.log('Métricas reais: contador, histograma, erros e template /api/perfil/:id');
    fs.writeFileSync('tmp/observabilidade/validacao.json',JSON.stringify({healthy:true,redisUnhealthy:true,health503:true,live200:true,recuperacaoSemReinicio:true,metricas:true},null,2));
})().catch(() => { console.error('Validação Docker falhou; confira os estados de saúde sem imprimir credenciais.'); process.exitCode=1; });
