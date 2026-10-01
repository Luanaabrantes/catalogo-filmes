const express = require('express');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const db = require('./database');
const autenticar = require('./middlewareAuth');
const auditar = require('./auditoria');
const storage = require('./minio');
const listarFavoritos = require('./listarFavoritos');
const { receberFoto, atualizarFoto, ErroFoto } = require('./fotoPerfil');
const router = express.Router();

// Leitura pública, sem credenciais, com caminho estritamente limitado a fotos.
router.get('/fotos/:usuarioId/:arquivo', async (req, res) => {
    const chave = `perfis/${req.params.usuarioId}/${req.params.arquivo}`;
    try { storage.url(chave); } catch { return res.sendStatus(404); }
    try {
        const resposta = await storage.lerPublico(chave);
        if (resposta.status === 404) return res.sendStatus(404);
        if (!resposta.ok || !/^image\/(jpeg|png|webp)$/.test(resposta.headers.get('content-type') || '')) {
            await resposta.body?.cancel();
            return res.sendStatus(503);
        }
        res.set({ 'Content-Type': resposta.headers.get('content-type'),
            'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
        await pipeline(Readable.fromWeb(resposta.body), res);
    } catch { if (!res.headersSent) res.sendStatus(503); else res.destroy(); }
});
router.use(autenticar);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function idValido(req, res, next) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ mensagem: 'ID de usuário inválido.' });
    next();
}
function proprietario(operacao) {
    return async (req, res, next) => {
        if (Number(req.params.id) !== Number(req.usuario.id)) {
            await auditar({ usuarioId: req.usuario.id, acao: 'ACAO_NEGADA', ip: req.ip,
                detalhes: { recurso: 'PERFIL', usuario_alvo: Number(req.params.id), operacao } });
            return res.status(403).json({ mensagem: 'Você só pode editar o próprio perfil.' });
        }
        next();
    };
}
async function consultar(req, res) {
    try {
        const id = req.params.id ? Number(req.params.id) : Number(req.usuario.id);
        const [usuarios] = await db.execute(`SELECT u.id, u.nome, p.bio, p.foto_chave
            FROM usuarios u LEFT JOIN perfis p ON p.usuario_id = u.id WHERE u.id = ?`, [id]);
        if (!usuarios.length) return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
        const perfil = usuarios[0];
        res.json({ perfil: { ...perfil, bio: perfil.bio || '', foto_url: storage.url(perfil.foto_chave),
            favoritos: await listarFavoritos(id), proprio: id === Number(req.usuario.id) } });
    } catch { res.status(503).json({ mensagem: 'Não foi possível consultar o perfil.' }); }
}
router.get('/me', consultar);
router.get('/:id', idValido, consultar);
router.patch('/:id', idValido, proprietario('ATUALIZAR_BIO'), async (req, res) => {
    if (typeof req.body?.bio !== 'string' || Array.from(req.body.bio.trim()).length > 300) {
        return res.status(400).json({ mensagem: 'A bio deve ter no máximo 300 caracteres.' });
    }
    const bio = req.body.bio.trim();
    try {
        await db.execute('INSERT INTO perfis (usuario_id, bio) VALUES (?, ?) ON DUPLICATE KEY UPDATE bio = VALUES(bio)', [req.usuario.id, bio]);
        await auditar({ usuarioId: req.usuario.id, acao: 'PERFIL_ATUALIZADO', ip: req.ip,
            detalhes: { recurso: 'PERFIL', operacao: 'ATUALIZAR_BIO' } });
        res.json({ mensagem: 'Bio atualizada.', bio });
    } catch { res.status(503).json({ mensagem: 'Não foi possível atualizar a bio.' }); }
});
router.post('/:id/foto', idValido, proprietario('ALTERAR_FOTO'), (req, res, next) => {
    receberFoto(req, res, erro => {
        if (erro) return res.status(erro.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
            mensagem: erro.code === 'LIMIT_FILE_SIZE' ? 'A foto deve ter no máximo 5 MB.' : 'Envie somente uma imagem JPEG, PNG ou WebP no campo foto.'
        });
        next();
    });
}, async (req, res) => {
    try {
        const foto = await atualizarFoto(req.usuario.id, req.file);
        await auditar({ usuarioId: req.usuario.id, acao: 'FOTO_PERFIL_ATUALIZADA', ip: req.ip,
            detalhes: { recurso: 'PERFIL', operacao: 'ALTERAR_FOTO' } });
        res.json({ mensagem: 'Foto atualizada.', ...foto });
    } catch (erro) {
        res.status(erro instanceof ErroFoto ? erro.status : 503).json({
            mensagem: erro instanceof ErroFoto ? erro.message : 'Não foi possível atualizar a foto.'
        });
    }
});
module.exports = router;
