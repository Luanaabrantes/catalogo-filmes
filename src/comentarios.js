const express = require('express');
const db = require('./database');
const registrarEventoAuditoria = require('./auditoria');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();


// ========================================
// LISTAR TODOS OS COMENTÁRIOS
// DO USUÁRIO LOGADO
// ========================================

/**
 * @openapi
 * /api/comentarios:
 *   get:
 *     tags:
 *       - Comentários
 *     summary: Listar comentários próprios
 *     description: >-
 *       Somente comentários do usuário autenticado; mesmo admin não lista comentários de outras contas. Ordem
 *       criado_em DESC. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_comentarios
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Comentários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comentarios:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comentario'
 *               required:
 *                 - comentarios
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
 *       '500':
 *         description: Erro ao buscar comentários. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao buscar comentários.
 *               '1':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 */
router.get('/', verificarAutenticacao, async (req, res) => {
    try {

        const [comentarios] = await db.execute(
            `
            SELECT
                id,
                tmdb_movie_id,
                texto,
                criado_em
            FROM comentarios
            WHERE usuario_id = ?
            ORDER BY criado_em DESC
            `,
            [req.usuario.id]
        );

        res.json({
            comentarios
        });

    } catch (erro) {

        console.error(
            'Erro ao buscar comentários:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro ao buscar comentários.'
        });
    }
});


// ========================================
// LISTAR COMENTÁRIOS DE UM FILME
// DO USUÁRIO LOGADO
// ========================================

/**
 * @openapi
 * /api/comentarios/{movieId}:
 *   get:
 *     tags:
 *       - Comentários
 *     summary: Listar comentários próprios
 *     description: >-
 *       Somente comentários do usuário autenticado; mesmo admin não lista comentários de outras contas. Ordem
 *       criado_em DESC. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_comentarios_movieId
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Comentários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comentarios:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comentario'
 *               required:
 *                 - comentarios
 *       '400':
 *         description: ID do filme inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID do filme inválido.
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
 *       '500':
 *         description: Erro ao buscar comentários. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao buscar comentários.
 *               '1':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: movieId
 *         in: path
 *         required: true
 *         description: Inteiro positivo.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 */
router.get('/:movieId', verificarAutenticacao, async (req, res) => {
    try {

        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId) || movieId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do filme inválido.'
            });
        }

        const [comentarios] = await db.execute(
            `
            SELECT
                id,
                tmdb_movie_id,
                texto,
                criado_em
            FROM comentarios
            WHERE usuario_id = ?
              AND tmdb_movie_id = ?
            ORDER BY criado_em DESC
            `,
            [
                req.usuario.id,
                movieId
            ]
        );

        res.json({
            comentarios
        });

    } catch (erro) {

        console.error(
            'Erro ao buscar comentários:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro ao buscar comentários.'
        });
    }
});


// ========================================
// CRIAR COMENTÁRIO
// ========================================

/**
 * @openapi
 * /api/comentarios/{movieId}:
 *   post:
 *     tags:
 *       - Comentários
 *     summary: Publicar comentário
 *     description: >-
 *       Texto é salvo após trim. Valor não string pode gerar 500, pois a implementação chama trim diretamente.
 *       Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: post_api_comentarios_movieId
 *     security:
 *       - sessao: []
 *     responses:
 *       '201':
 *         description: Comentário salvo com sucesso!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                 comentario:
 *                   $ref: '#/components/schemas/Comentario'
 *               required:
 *                 - mensagem
 *                 - comentario
 *       '400':
 *         description: >-
 *           ID do filme inválido. / O comentário não pode estar vazio. JSON malformado ou corpo inválido para
 *           express.json (resposta padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID do filme inválido.
 *               '1':
 *                 value:
 *                   mensagem: O comentário não pode estar vazio.
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
 *         description: Erro ao salvar comentário. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao salvar comentário.
 *               '1':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: movieId
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
 *             $ref: '#/components/schemas/NovoComentario'
 */
router.post('/:movieId', verificarAutenticacao, async (req, res) => {
    try {

        const movieId = Number(req.params.movieId);
        const { texto } = req.body;

        if (!Number.isInteger(movieId) || movieId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do filme inválido.'
            });
        }

        if (!texto || !texto.trim()) {
            return res.status(400).json({
                mensagem: 'O comentário não pode estar vazio.'
            });
        }

        const [resultado] = await db.execute(
            `
            INSERT INTO comentarios (
                usuario_id,
                tmdb_movie_id,
                texto
            )
            VALUES (?, ?, ?)
            `,
            [
                req.usuario.id,
                movieId,
                texto.trim()
            ]
        );

        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'COMENTARIO_CRIADO',
            ip: req.ip,
            detalhes: { comentario_id: resultado.insertId, tmdb_movie_id: movieId }
        });

        res.status(201).json({
            mensagem: 'Comentário salvo com sucesso!',
            comentario: {
                id: resultado.insertId,
                tmdb_movie_id: movieId,
                texto: texto.trim()
            }
        });

    } catch (erro) {

        console.error(
            'Erro ao salvar comentário:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro ao salvar comentário.'
        });
    }
});


// ========================================
// EXCLUIR COMENTÁRIO
// ========================================

/**
 * @openapi
 * /api/comentarios/{id}:
 *   delete:
 *     tags:
 *       - Comentários
 *     summary: Excluir comentário
 *     description: >-
 *       Somente autor ou admin. A permissão é conferida no backend; negação gera ACAO_NEGADA. Requer sessão
 *       autenticada (cookie HttpOnly token).
 *     operationId: delete_api_comentarios_id
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Comentário removido com sucesso!
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Comentário removido com sucesso!
 *       '400':
 *         description: ID do comentário inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID do comentário inválido.
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
 *         description: Você não tem permissão para excluir este comentário.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Você não tem permissão para excluir este comentário.
 *       '404':
 *         description: Comentário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Comentário não encontrado.
 *       '500':
 *         description: Erro ao excluir comentário. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao excluir comentário.
 *               '1':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
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
 */
router.delete('/:id', verificarAutenticacao, async (req, res) => {
    try {

        const comentarioId = Number(req.params.id);

        if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do comentário inválido.'
            });
        }

        const [comentarios] = await db.execute(
            `
            SELECT
                id,
                usuario_id
            FROM comentarios
            WHERE id = ?
            `,
            [comentarioId]
        );

        if (comentarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Comentário não encontrado.'
            });
        }

        const comentario = comentarios[0];

        const usuarioEhDono =
            comentario.usuario_id === req.usuario.id;

        const usuarioEhAdmin =
            req.usuario.role === 'admin';

        if (!usuarioEhDono && !usuarioEhAdmin) {
            await registrarEventoAuditoria({
                usuarioId: req.usuario.id,
                acao: 'ACAO_NEGADA',
                ip: req.ip,
                detalhes: {
                    recurso: 'EXCLUSAO_COMENTARIO',
                    motivo: 'sem_permissao',
                    comentario_id: comentarioId,
                    proprietario_id: comentario.usuario_id
                }
            });

            return res.status(403).json({
                mensagem: 'Você não tem permissão para excluir este comentário.'
            });
        }

        const [resultado] = await db.execute(
            `
            DELETE FROM comentarios
            WHERE id = ?
            `,
            [comentarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Comentário não encontrado.'
            });
        }

        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'COMENTARIO_APAGADO',
            ip: req.ip,
            detalhes: {
                comentario_id: comentarioId,
                proprietario_id: comentario.usuario_id,
                moderacao: usuarioEhAdmin && !usuarioEhDono
            }
        });

        res.json({
            mensagem: 'Comentário removido com sucesso!'
        });

    } catch (erro) {

        console.error(
            'Erro ao excluir comentário:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro ao excluir comentário.'
        });
    }
});


module.exports = router;
