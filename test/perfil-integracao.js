// Executar somente dentro do catálogo em um banco DESCARTÁVEL chamado catalogo_qa.
// Requer MinIO, auth-service, log-service, Redis e Mailpit (mail-qa:8025).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const sharp = require('sharp');
const db = require('../src/database');
if (process.env.DB_NAME !== 'catalogo_qa') throw new Error('Use exclusivamente o banco isolado catalogo_qa.');
const base = 'http://127.0.0.1:3000';
async function main() {
    // Esquema das atividades anteriores, somente para a instância isolada.
    for (const sql of [
        'CREATE TABLE IF NOT EXISTS usuarios (id INT AUTO_INCREMENT PRIMARY KEY,nome VARCHAR(100) NOT NULL,email VARCHAR(150) NOT NULL UNIQUE,senha_hash VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL DEFAULT "usuario",criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE IF NOT EXISTS favoritos (id INT AUTO_INCREMENT PRIMARY KEY,usuario_id INT NOT NULL,tmdb_movie_id INT NOT NULL,criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(usuario_id,tmdb_movie_id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)',
        'CREATE TABLE IF NOT EXISTS comentarios (id INT AUTO_INCREMENT PRIMARY KEY,usuario_id INT NOT NULL,tmdb_movie_id INT NOT NULL,texto TEXT NOT NULL,criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)',
        fs.readFileSync('database/migracao-atividade3.sql', 'utf8').split(';').slice(1).join(';').trim(),
        fs.readFileSync('database/migracao-atividade6.sql', 'utf8')
    ]) if(sql) await db.query(sql);
    const senha = crypto.randomBytes(18).toString('hex');
    const sufixo = Date.now();
    const email = `ana-${sufixo}@example.invalid`, emailB = `bia-${sufixo}@example.invalid`;
    let cookie;
    async function api(path, method = 'GET', body, sessao = cookie) {
        const form = body instanceof FormData;
        const r = await fetch(base + path, { method, headers: {
            ...(sessao ? { Cookie: sessao } : {}), ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {})
        }, ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
        return {status:r.status, dados:await r.json(), cookie:r.headers.get('set-cookie')?.split(';')[0]};
    }
    const a=await api('/api/auth/cadastro','POST',{nome:'Ana Cinema',email,senha},null);
    const b=await api('/api/auth/cadastro','POST',{nome:'Bia Filmes',email:emailB,senha},null);
    assert.equal(a.status,201);assert.equal(b.status,201);const id=a.dados.usuario.id,idB=b.dados.usuario.id;
    const login=await api('/api/auth/login','POST',{email,senha},null);assert.equal(login.status,200);cookie=login.cookie;
    fs.writeFileSync('/tmp/perfil-qa.json',JSON.stringify({id,idB,email,senha,cookie}));
    console.log('OK cadastro, login e cookie');
    assert.equal((await api('/api/perfil/me', 'GET', undefined, null)).status,401);
    assert.equal((await api('/api/admin/usuarios')).status,403);
    await db.execute('UPDATE usuarios SET role = ? WHERE id = ?', ['admin',id]);
    assert.equal((await api('/api/admin/usuarios')).status,200);
    assert.equal((await api(`/api/admin/usuarios/${idB}/role`,'PATCH',{role:'admin'})).status,200);
    assert.equal((await api(`/api/admin/usuarios/${idB}/role`,'PATCH',{role:'usuario'})).status,200);
    console.log('OK RBAC, gestão de usuários e papel atual');
    const filmes=await api('/api/filmes');assert.equal(filmes.status,200);assert.ok(filmes.dados.filmes.length);
    const ids=[...new Set(filmes.dados.filmes.filter(f=>f.poster_url).map(f=>f.id))].slice(0,4);
    for(const movie of ids)assert.equal((await api('/api/favoritos/'+movie,'POST')).status,201);
    const comentario=await api('/api/comentarios/'+ids[0],'POST',{texto:'Uma história para revisitar.'});assert.equal(comentario.status,201);
    assert.equal((await api('/api/comentarios')).status,200);
    assert.equal((await api('/api/comentarios/'+comentario.dados.comentario.id,'DELETE')).status,200);
    console.log('OK TMDB, favoritos e comentários');
    assert.equal((await api('/api/perfil/'+id,'PATCH',{bio:'Colecionando histórias, uma sessão de cinema por vez. 🎬',usuario_id:idB})).status,200);
    const negada=await api('/api/perfil/'+idB,'PATCH',{bio:'proibido'});assert.equal(negada.status,403);
    const svg=Buffer.from('<svg width="256" height="256"><rect width="256" height="256" fill="#254e75"/><circle cx="128" cy="96" r="45" fill="#c3d8ee"/><ellipse cx="128" cy="242" rx="89" ry="92" fill="#c3d8ee"/></svg>');
    const png=await sharp(svg).png().toBuffer();
    function form(buffer,mime='image/png'){const f=new FormData();f.append('foto',new Blob([buffer],{type:mime}),'avatar.png');return f;}
    assert.equal((await api(`/api/perfil/${idB}/foto`,'POST',form(png))).status,403);
    assert.equal((await api(`/api/perfil/${id}/foto`,'POST',form(Buffer.from('falso')))).status,400);
    assert.equal((await api(`/api/perfil/${id}/foto`,'POST',form(Buffer.alloc(5*1024*1024+1)))).status,413);
    let foto=await api(`/api/perfil/${id}/foto`,'POST',form(png));assert.equal(foto.status,200,JSON.stringify(foto.dados));
    const primeira=foto.dados;
    const simultaneas=await Promise.all([api(`/api/perfil/${id}/foto`,'POST',form(png)),api(`/api/perfil/${id}/foto`,'POST',form(png))]);
    for(const resultado of simultaneas)assert.equal(resultado.status,200);
    const atual=(await api('/api/perfil/me')).dados.perfil;
    foto={dados:{foto_chave:atual.foto_chave,foto_url:atual.foto_url}};
    assert.equal((await fetch(base+primeira.foto_url)).status,404);
    assert.equal((await fetch(base+atual.foto_url)).status,200);
    console.log('OK uploads concorrentes preservam a referência final e removem a anterior');
    const perfil=await api('/api/perfil/me');assert.equal(perfil.dados.perfil.foto_chave,foto.dados.foto_chave);
    assert.deepEqual([...perfil.dados.perfil.favoritos].sort(),[...ids].sort());
    assert.deepEqual((await api('/api/perfil/'+idB)).dados.perfil.favoritos,[]);
    const imagem=await fetch(base+foto.dados.foto_url);assert.equal(imagem.status,200);assert.equal(imagem.headers.get('content-type'),'image/png');assert.ok((await imagem.arrayBuffer()).byteLength);
    await db.query(fs.readFileSync('database/migracao-atividade6.sql','utf8'));
    assert.equal((await api('/api/perfil/me')).dados.perfil.foto_chave,foto.dados.foto_chave);
    console.log('OK migração idempotente, perfil, bio, upload, foto pública, propriedade e favoritos por usuário');
    const minio=require('../src/minio');
    const url='http://minio:9000/'+(process.env.MINIO_BUCKET||'perfil-fotos')+'/'+foto.dados.foto_chave;
    assert.equal((await fetch(url)).status,200);
    assert.equal((await fetch(url,{method:'PUT',body:png})).status,403);
    assert.equal((await fetch(url,{method:'DELETE'})).status,403);
    console.log('OK bucket permite GET anônimo e bloqueia PUT/DELETE anônimos');
    const logs=await api('/api/logs?limit=100');assert.equal(logs.status,200);
    for(const acao of ['PERFIL_ATUALIZADO','FOTO_PERFIL_ATUALIZADA','ACAO_NEGADA','ROLE_ALTERADA'])assert.ok(logs.dados.eventos.some(e=>e.acao===acao));
    console.log('OK auditoria real no Redis Stream');
    assert.equal((await api('/api/auth/esqueci-senha','POST',{email},null)).status,200);
    const mails=await(await fetch('http://mail-qa:8025/api/v1/messages')).json();assert.ok(mails.messages.length);
    const [tokens]=await db.execute('SELECT token FROM reset_tokens WHERE usuario_id = ? ORDER BY id DESC',[id]);assert.ok(tokens.length);
    assert.equal((await api('/api/auth/redefinir-senha','POST',{token:tokens[0].token,senha},null)).status,200);
    assert.equal((await api('/api/auth/redefinir-senha','POST',{token:tokens[0].token,senha},null)).status,400);
    console.log('OK recuperação de senha com SMTP local e token de uso único');
    fs.writeFileSync('/tmp/perfil-qa.json',JSON.stringify({id,idB,email,senha,cookie,foto:foto.dados.foto_url,chave:foto.dados.foto_chave}));
    assert.equal((await api('/api/auth/logout','POST')).status,200);
    console.log('OK logout. Dados de demonstração preservados somente no banco QA.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.end());
