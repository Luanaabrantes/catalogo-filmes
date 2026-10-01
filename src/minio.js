const { Client } = require('minio');
const { randomUUID } = require('node:crypto');

function criarStorage(env = process.env) {
    const bucket = env.MINIO_BUCKET || 'perfil-fotos';
    const ssl = env.MINIO_USE_SSL === 'true';
    const endpoint = env.MINIO_ENDPOINT || 'minio';
    const port = Number(env.MINIO_PORT || 9000);
    let client;
    let preparando;
    const obterCliente = () => {
        if (!env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) throw new Error('MinIO não configurado');
        if (!client) {
            client = new Client({ endPoint: endpoint, port, useSSL: ssl,
                accessKey: env.MINIO_ACCESS_KEY, secretKey: env.MINIO_SECRET_KEY });
            client.setRequestOptions({ timeout: 10000 });
        }
        return client;
    };
    async function preparar() {
        if (!preparando) preparando = (async () => {
            const c = obterCliente();
            if (!await c.bucketExists(bucket)) {
                try { await c.makeBucket(bucket); } catch (e) {
                    if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(e.code)) throw e;
                }
            }
            // Somente leitura anônima dos objetos de perfil, sem listagem/escrita.
            await c.setBucketPolicy(bucket, JSON.stringify({ Version: '2012-10-17', Statement: [{
                Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/perfis/*`]
            }] }));
        })().catch(e => { preparando = null; throw e; });
        return preparando;
    }
    function validarChave(chave) {
        if (!/^perfis\/[1-9]\d*\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(chave)) throw new Error('Chave inválida');
        return chave;
    }
    return {
        preparar,
        url(chave) { return chave ? `/api/perfil/fotos/${validarChave(chave).slice(7)}` : null; },
        async enviar(usuarioId, buffer, formato) {
            if (!Number.isSafeInteger(Number(usuarioId)) || Number(usuarioId) <= 0 || !['jpeg', 'png', 'webp'].includes(formato)) throw new Error('Imagem inválida');
            await preparar();
            const chave = `perfis/${Number(usuarioId)}/${randomUUID()}.${formato === 'jpeg' ? 'jpg' : formato}`;
            await obterCliente().putObject(bucket, chave, buffer, buffer.length, {
                'Content-Type': `image/${formato}`, 'Cache-Control': 'public, max-age=86400'
            });
            return chave;
        },
        async remover(chave) { await obterCliente().removeObject(bucket, validarChave(chave)); },
        async lerPublico(chave) {
            validarChave(chave);
            // GET anônimo: o acesso depende da política pública do bucket.
            return fetch(`${ssl ? 'https' : 'http'}://${endpoint}:${port}/${encodeURIComponent(bucket)}/${chave}`, {
                signal: AbortSignal.timeout(10000), redirect: 'error'
            });
        }
    };
}
module.exports = criarStorage();
module.exports.criarStorage = criarStorage;
