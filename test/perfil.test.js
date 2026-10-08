const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const sharp = require('sharp');
let estado, eventos, ordem, falha, consultas;
const antiga = 'perfis/1/00000000-0000-4000-8000-000000000000.png';
const nova = 'perfis/1/11111111-1111-4111-8111-111111111111.png';
function mock(modulo, exports) {
    const p = require.resolve(modulo); require.cache[p] = { id: p, filename: p, loaded: true, exports };
}
const db = {
    async execute(sql, args) {
        consultas.push({sql, args});
        if (falha === 'banco' && sql.includes('INSERT')) throw new Error('DB privado');
        if (sql.includes('LEFT JOIN')) return [Number(args[0]) === 404 ? [] : [{id:Number(args[0]),nome:'Ana',bio:estado.bio,foto_chave:estado.foto_chave}]];
        if (sql.includes('FROM favoritos')) return [[{tmdb_movie_id: Number(args[0]) === 1 ? 42 : 99}]];
        if (sql.includes('SELECT id FROM usuarios')) return [[{id:args[0]}]];
        if (sql.includes('SELECT foto_chave')) return [[{foto_chave:estado.foto_chave}]];
        if (sql.includes('INSERT INTO perfis')) {
            ordem.push('persistir');
            if (sql.includes('(usuario_id, bio)')) estado.bio=args[1]; else estado.foto_chave=args[1];
            return [{affectedRows:1}];
        }
        throw new Error('SQL inesperado: '+sql);
    },
    async getConnection() {
        const salvo={...estado};
        return { execute:db.execute, async beginTransaction(){ordem.push('begin');},
            async commit(){ordem.push('commit'); if(falha==='commit')throw new Error('resposta perdida');},
            async rollback(){ordem.push('rollback'); if(falha!=='commit')estado=salvo;}, release(){ordem.push('release');} };
    }
};
mock('../src/database', db);
mock('../src/minio', {
    url(k){if(!k)return null; if(!/^perfis\/[1-9]\d*\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(k))throw new Error('chave'); return '/api/perfil/fotos/'+k.slice(7);},
    async enviar(id,buffer,formato){ordem.push('enviar');assert.equal(id,1);assert.ok(buffer.length);assert.ok(['png','jpeg','webp'].includes(formato));if(falha==='minio')throw new Error('segredo');return nova;},
    async remover(k){ordem.push('remover:'+k);if(falha==='remover')throw new Error('erro');},
    async lerPublico(){return new Response(Buffer.from('imagem'),{headers:{'Content-Type':'image/png'}});}
});
test('perfil, propriedade, upload e falhas', async t => {
    const originalFetch=global.fetch;
    global.fetch=async(url,options={})=>{
        if(String(url).endsWith('/auth/validar'))return new Response(JSON.stringify({usuario:{id:1,nome:'Ana',role:'admin'}}));
        if(String(url).endsWith('/eventos')){
            if(falha==='auditoria')throw new Error('offline');
            eventos.push(JSON.parse(options.body));return new Response('{}',{status:201});
        }
        throw new Error('Destino inesperado');
    };
    const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/perfil',require('../src/perfil'));
    const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/perfil`;
    const png=await sharp({create:{width:8,height:8,channels:3,background:'#2563eb'}}).png().toBuffer();
    async function request(path,method='GET',body,auth=true){
        const form=body instanceof FormData;
        return originalFetch(base+path,{method,headers:{...(auth?{Cookie:'token=teste'}:{}),...(!form&&body!==undefined?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:form?body:JSON.stringify(body)})});
    }
    function upload(buffer=png,mime='image/png',field='foto'){
        const form=new FormData();form.append(field,new Blob([buffer],{type:mime}),'../../nome-original.exe');return form;
    }
    async function caso(nome,fn){await t.test(nome,async()=>{estado={bio:'Cinema',foto_chave:antiga};eventos=[];ordem=[];consultas=[];falha=null;await fn();});}
    try{
        await caso('consulta o próprio perfil com URL e favoritos corretos',async()=>{
            const r=await request('/me');assert.equal(r.status,200);const {perfil}=await r.json();
            assert.equal(perfil.id,1);assert.equal(perfil.proprio,true);assert.deepEqual(perfil.favoritos,[42]);assert.equal(perfil.foto_url,'/api/perfil/fotos/'+antiga.slice(7));assert.equal(perfil.email,undefined);
        });
        await caso('outro perfil usa favoritos do alvo e é somente leitura',async()=>{
            const {perfil}=await (await request('/2')).json();assert.deepEqual(perfil.favoritos,[99]);assert.equal(perfil.proprio,false);
        });
        await caso('perfil sem foto/bio e usuário inexistente',async()=>{
            estado={};const {perfil}=await(await request('/me')).json();assert.equal(perfil.bio,'');assert.equal(perfil.foto_url,null);assert.equal((await request('/404')).status,404);
        });
        await caso('sem autenticação: consulta, bio e upload retornam 401',async()=>{
            for(const [path,method,body]of [['/me','GET'],['/1','PATCH',{bio:'x'}],['/1/foto','POST',upload()]])assert.equal((await request(path,method,body,false)).status,401);
            assert.equal(consultas.length,0);assert.equal(eventos.length,0);
        });
        await caso('edita própria bio e ignora ID e foto no body',async()=>{
            const r=await request('/1','PATCH',{bio:'  Filmes!  ',usuario_id:2,foto_chave:'malicioso'});assert.equal(r.status,200);assert.equal(estado.bio,'Filmes!');assert.equal(estado.foto_chave,antiga);
            assert.equal(consultas[0].args[0],1);assert.equal(eventos[0].acao,'PERFIL_ATUALIZADO');assert.equal(JSON.stringify(eventos).includes('Filmes!'),false);
        });
        await caso('bio vazia permitida; tipo ou limite inválido retorna 400',async()=>{
            assert.equal((await request('/1','PATCH',{bio:''})).status,200);
            for(const bio of [null,123,'x'.repeat(301)])assert.equal((await request('/1','PATCH',{bio})).status,400);
        });
        await caso('mesmo admin não edita outro perfil: 403 e ACAO_NEGADA antes de ler arquivo',async()=>{
            assert.equal((await request('/2','PATCH',{bio:'x',usuario_id:1})).status,403);
            assert.equal((await request('/2/foto','POST',upload(Buffer.alloc(6*1024*1024)))).status,403);
            assert.equal(consultas.length,0);assert.equal(ordem.length,0);assert.equal(eventos.length,2);
            assert.deepEqual(eventos.map(e=>e.detalhes.operacao),['ATUALIZAR_BIO','ALTERAR_FOTO']);
            for(const e of eventos){assert.equal(e.acao,'ACAO_NEGADA');assert.equal(e.usuario_id,1);assert.equal(e.detalhes.usuario_alvo,2);}
        });
        await caso('IDs inválidos retornam 400',async()=>{for(const id of ['abc','0','-1','1.5'])assert.equal((await request('/'+id,'PATCH',{bio:'x'})).status,400);});
        await caso('upload sem foto, MIME proibido, falso PNG, MIME divergente e campo extra: 400',async()=>{
            const extra=upload();extra.append('usuario_id','2');
            for(const form of [new FormData(),upload(Buffer.from('txt'),'text/plain'),upload(Buffer.from('falso')),upload(png,'image/jpeg'),upload(png,'image/png','arquivo'),extra])assert.equal((await request('/1/foto','POST',form)).status,400);
            assert.equal(ordem.length,0);
        });
        await caso('arquivo maior que 5 MB retorna 413 sem MinIO',async()=>{assert.equal((await request('/1/foto','POST',upload(Buffer.alloc(5*1024*1024+1)))).status,413);assert.equal(ordem.length,0);});
        await caso('upload válido grava chave e remove antiga só após commit',async()=>{
            const r=await request('/1/foto','POST',upload());assert.equal(r.status,200);assert.equal((await r.json()).foto_chave,nova);assert.equal(estado.foto_chave,nova);
            assert.ok(ordem.indexOf('enviar')<ordem.indexOf('persistir'));assert.ok(ordem.indexOf('commit')<ordem.indexOf('remover:'+antiga));assert.equal(eventos[0].acao,'FOTO_PERFIL_ATUALIZADA');
            assert.equal(JSON.stringify(eventos).includes(nova),false);
        });
        await caso('JPEG e WebP reais aceitos',async()=>{for(const formato of ['jpeg','webp']){const b=await sharp(png).toFormat(formato).toBuffer();assert.equal((await request('/1/foto','POST',upload(b,'image/'+formato))).status,200);}});
        await caso('falha MinIO retorna 503 e preserva antiga',async()=>{falha='minio';assert.equal((await request('/1/foto','POST',upload())).status,503);assert.equal(estado.foto_chave,antiga);assert.equal(consultas.length,0);assert.equal(eventos.length,0);});
        await caso('falha SQL faz rollback e remove só a nova',async()=>{falha='banco';assert.equal((await request('/1/foto','POST',upload())).status,503);assert.equal(estado.foto_chave,antiga);assert.ok(ordem.includes('remover:'+nova));assert.equal(ordem.includes('remover:'+antiga),false);});
        await caso('commit incerto preserva ambas as imagens',async()=>{falha='commit';assert.equal((await request('/1/foto','POST',upload())).status,503);assert.equal(ordem.some(x=>x.startsWith('remover:')),false);});
        await caso('falha na remoção antiga não invalida foto nova',async()=>{falha='remover';assert.equal((await request('/1/foto','POST',upload())).status,200);assert.equal(estado.foto_chave,nova);});
        await caso('auditoria indisponível não desfaz bio/upload nem negação',async()=>{falha='auditoria';assert.equal((await request('/1','PATCH',{bio:'ok'})).status,200);assert.equal((await request('/1/foto','POST',upload())).status,200);assert.equal((await request('/2','PATCH',{bio:'x'})).status,403);});
        await caso('foto pública acessível sem sessão e sem caminho arbitrário',async()=>{
            const r=await request('/fotos/'+antiga.slice(7),'GET',undefined,false);assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
            assert.equal((await request('/fotos/1/segredo.txt','GET',undefined,false)).status,404);
        });
    }finally{global.fetch=originalFetch;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
