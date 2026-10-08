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
/**
 * @openapi
 * /api/perfil/fotos/{usuarioId}/{arquivo}:
 *   get:
 *     tags:
 *       - Perfil e upload
 *     summary: Ler foto publicamente
 *     description: >-
 *       Sem autenticação. Só aceita chave perfis/ID/UUID.(jpg|png|webp). Leitura pública via catálogo; escrita
 *       restrita ao backend.
 *     operationId: get_api_perfil_fotos_usuarioId_arquivo
 *     security: []
 *     responses:
 *       '200':
 *         description: Foto; Cache-Control public, max-age=86400 e X-Content-Type-Options nosniff.
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: Chave inválida ou foto não encontrada
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Not Found
 *       '503':
 *         description: Armazenamento indisponível ou resposta inválida
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Service Unavailable
 *     parameters:
 *       - name: usuarioId
 *         in: path
 *         required: true
 *         description: Dígitos decimais positivos, sem zero à esquerda (validado no caminho da chave).
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *       - name: arquivo
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^[0-9a-f-]{36}\.(jpg|png|webp)$
 *           example: 00000000-0000-0000-0000-000000000000.jpg
 */
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
/**
 * @openapi
 * /api/perfil/me:
 *   get:
 *     tags:
 *       - Perfil e upload
 *     summary: Consultar perfil
 *     description: >-
 *       Perfil próprio (me) ou de outro usuário, incluindo IDs dos favoritos. Não exige propriedade para
 *       leitura. Cache-Control no-store. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_perfil_me
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Perfil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 perfil:
 *                   $ref: '#/components/schemas/Perfil'
 *               required:
 *                 - perfil
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '404':
 *         description: Perfil não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Perfil não encontrado.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Não foi possível consultar o perfil. / Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Não foi possível consultar o perfil.
 *               '1':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 */
router.get('/me', consultar);
/**
 * @openapi
 * /api/perfil/{id}:
 *   get:
 *     tags:
 *       - Perfil e upload
 *     summary: Consultar perfil
 *     description: >-
 *       Perfil próprio (me) ou de outro usuário, incluindo IDs dos favoritos. Não exige propriedade para
 *       leitura. Cache-Control no-store. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_perfil_id
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Perfil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 perfil:
 *                   $ref: '#/components/schemas/Perfil'
 *               required:
 *                 - perfil
 *       '400':
 *         description: ID de usuário inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID de usuário inválido.
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '404':
 *         description: Perfil não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Perfil não encontrado.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Não foi possível consultar o perfil. / Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Não foi possível consultar o perfil.
 *               '1':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Inteiro positivo seguro JavaScript.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 */
router.get('/:id', idValido, consultar);
/**
 * @openapi
 * /api/perfil/{id}:
 *   patch:
 *     tags:
 *       - Perfil e upload
 *     summary: Atualizar bio própria
 *     description: >-
 *       Somente proprietário, inclusive para administradores. ID comparado à sessão; ACAO_NEGADA em recusa. Bio
 *       limitada a 300 pontos de código após trim. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: patch_api_perfil_id
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Bio atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                 bio:
 *                   type: string
 *               required:
 *                 - mensagem
 *                 - bio
 *       '400':
 *         description: >-
 *           ID de usuário inválido. / A bio deve ter no máximo 300 caracteres. JSON malformado ou corpo inválido
 *           para express.json (resposta padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID de usuário inválido.
 *               '1':
 *                 value:
 *                   mensagem: A bio deve ter no máximo 300 caracteres.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '403':
 *         description: Você só pode editar o próprio perfil.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Você só pode editar o próprio perfil.
 *       '413':
 *         description: Corpo acima do limite padrão de 100 KiB de express.json/urlencoded (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '415':
 *         description: Charset ou Content-Encoding não suportado pelo parser (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Não foi possível atualizar a bio. / Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Não foi possível atualizar a bio.
 *               '1':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Inteiro positivo.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Bio'
 */
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
/**
 * @openapi
 * /api/perfil/{id}/foto:
 *   post:
 *     tags:
 *       - Perfil e upload
 *     summary: Atualizar foto própria
 *     description: >-
 *       Somente proprietário (admin não pode alterar outra conta). Uma foto estática validada, redimensionada e
 *       reencodificada; MariaDB armazena a chave do objeto. Sem campos adicionais no multipart. Requer sessão
 *       autenticada (cookie HttpOnly token).
 *     operationId: post_api_perfil_id_foto
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Foto atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                 foto_chave:
 *                   type: string
 *                 foto_url:
 *                   type: string
 *               required:
 *                 - mensagem
 *                 - foto_chave
 *                 - foto_url
 *       '400':
 *         description: >-
 *           ID de usuário inválido. / Envie somente uma imagem JPEG, PNG ou WebP no campo foto. / Envie uma foto
 *           JPEG, PNG ou WebP. / Imagem inválida. Use JPEG, PNG ou WebP estático de até 25 megapixels.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID de usuário inválido.
 *               '1':
 *                 value:
 *                   mensagem: Envie somente uma imagem JPEG, PNG ou WebP no campo foto.
 *               '2':
 *                 value:
 *                   mensagem: Envie uma foto JPEG, PNG ou WebP.
 *               '3':
 *                 value:
 *                   mensagem: Imagem inválida. Use JPEG, PNG ou WebP estático de até 25 megapixels.
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '403':
 *         description: Você só pode editar o próprio perfil.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Você só pode editar o próprio perfil.
 *       '404':
 *         description: Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '413':
 *         description: A foto deve ter no máximo 5 MB.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: A foto deve ter no máximo 5 MB.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: >-
 *           Armazenamento de fotos indisponível. Tente novamente. / Não foi possível confirmar a foto.
 *           Recarregue o perfil antes de tentar novamente. / Não foi possível atualizar a foto. / Serviço de
 *           autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Armazenamento de fotos indisponível. Tente novamente.
 *               '1':
 *                 value:
 *                   mensagem: Não foi possível confirmar a foto. Recarregue o perfil antes de tentar novamente.
 *               '2':
 *                 value:
 *                   mensagem: Não foi possível atualizar a foto.
 *               '3':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Inteiro positivo.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Foto'
 */
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
