const test = require('node:test');
const assert = require('node:assert/strict');
let chamadas=[],falhar=false;
const path=require.resolve('minio');
require.cache[path]={exports:{Client:class{
    constructor(config){chamadas.push(['config',config]);}
    setRequestOptions(options){chamadas.push(['timeout',options]);}
    async bucketExists(){return false;}
    async makeBucket(bucket){chamadas.push(['bucket',bucket]);if(falhar)throw new Error('offline');}
    async setBucketPolicy(bucket,policy){chamadas.push(['policy',JSON.parse(policy)]);}
    async putObject(bucket,key,buffer,size,meta){chamadas.push(['put',bucket,key,size,meta]);}
    async removeObject(bucket,key){chamadas.push(['remove',bucket,key]);}
}}};
const {criarStorage}=require('../src/minio');
test('MinIO: bucket único, política somente GET, UUID e URL sem segredo',async()=>{
    chamadas=[];
    const s=criarStorage({MINIO_ACCESS_KEY:'teste',MINIO_SECRET_KEY:'segredo-teste'});
    const key=await s.enviar(5,Buffer.from('image'),'jpeg');
    assert.match(key,/^perfis\/5\/[0-9a-f-]{36}\.jpg$/);
    assert.equal(s.url(key),'/api/perfil/fotos/'+key.slice(7));
    const policy=chamadas.find(c=>c[0]==='policy')[1];
    assert.deepEqual(policy.Statement[0].Action,['s3:GetObject']);
    assert.deepEqual(policy.Statement[0].Resource,['arn:aws:s3:::perfil-fotos/perfis/*']);
    const second=await s.enviar(5,Buffer.from('other'),'png');assert.notEqual(second,key);
    assert.equal(chamadas.filter(c=>c[0]==='bucket').length,1);
    await s.remover(key);assert.equal(chamadas.at(-1)[2],key);
    assert.throws(()=>s.url('perfis/../../segredo'));assert.equal(s.url(null),null);
});
test('MinIO: falha de inicialização permite nova tentativa',async()=>{
    const s=criarStorage({MINIO_ACCESS_KEY:'teste',MINIO_SECRET_KEY:'teste'});
    falhar=true;await assert.rejects(s.preparar());falhar=false;await s.preparar();
});
test('MinIO: leitura pública é anônima e valida caminho antes da rede',async()=>{
    const original=global.fetch;let options,url;
    global.fetch=async(u,o)=>{url=u;options=o;return new Response('foto');};
    try{
        const s=criarStorage({MINIO_ENDPOINT:'minio',MINIO_PORT:'9000'});
        await s.lerPublico('perfis/1/00000000-0000-4000-8000-000000000000.png');
        assert.match(url,/^http:\/\/minio:9000\/perfil-fotos\//);assert.equal(options.headers,undefined);
        assert.equal(options.redirect,'error');await assert.rejects(s.lerPublico('../outro'));
    }finally{global.fetch=original;}
});
