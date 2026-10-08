const express = require('express');
const db = require('./database');
const listarFavoritos = require('./listarFavoritos');
const registrarEventoAuditoria = require('./auditoria');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();


// ========================================
// LISTAR FAVORITOS DO USUÁRIO LOGADO
// ========================================

/**
 * @openapi
 * /api/favoritos:
 *   get:
 *     tags:
 *       - Favoritos
 *     summary: Listar favoritos próprios
 *     description: Retorna somente IDs TMDB, na ordem criado_em DESC. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_favoritos
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: IDs favoritos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favoritos:
 *                   type: array
 *                   items:
 *                     type: integer
 *                     minimum: 1
 *                     example: 1
 *               required:
 *                 - favoritos
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
 *         description: Erro ao buscar favoritos. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao buscar favoritos.
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

        res.json({ favoritos: await listarFavoritos(req.usuario.id) });

    } catch (erro) {

        console.error('Erro ao listar favoritos:', erro);

        res.status(500).json({
            mensagem: 'Erro ao buscar favoritos.'
        });
    }
});


// ========================================
// ADICIONAR FAVORITO
// ========================================

/**
 * @openapi
 * /api/favoritos/{movieId}:
 *   post:
 *     tags:
 *       - Favoritos
 *     summary: Adicionar favorito
 *     description: >-
 *       Opera somente na conta autenticada. Sucesso: Filme adicionado aos favoritos! Requer sessão autenticada
 *       (cookie HttpOnly token).
 *     operationId: post_api_favoritos_movieId
 *     security:
 *       - sessao: []
 *     responses:
 *       '201':
 *         description: Filme adicionado aos favoritos!
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Filme adicionado aos favoritos!
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
 *       '409':
 *         description: Este filme já está nos favoritos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Este filme já está nos favoritos.
 *       '500':
 *         description: Erro ao adicionar favorito. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao adicionar favorito.
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
router.post('/:movieId', verificarAutenticacao, async (req, res) => {
    try {

        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId) || movieId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do filme inválido.'
            });
        }

        await db.execute(
            `
            INSERT INTO favoritos
                (usuario_id, tmdb_movie_id)
            VALUES (?, ?)
            `,
            [
                req.usuario.id,
                movieId
            ]
        );

        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'FILME_FAVORITADO',
            ip: req.ip,
            detalhes: { tmdb_movie_id: movieId }
        });

        res.status(201).json({
            mensagem: 'Filme adicionado aos favoritos!'
        });

    } catch (erro) {

        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                mensagem: 'Este filme já está nos favoritos.'
            });
        }

        console.error('Erro ao favoritar:', erro);

        res.status(500).json({
            mensagem: 'Erro ao adicionar favorito.'
        });
    }
});


// ========================================
// REMOVER FAVORITO
// ========================================

/**
 * @openapi
 * /api/favoritos/{movieId}:
 *   delete:
 *     tags:
 *       - Favoritos
 *     summary: Remover favorito
 *     description: >-
 *       Opera somente na conta autenticada. Sucesso: Favorito removido com sucesso! Requer sessão autenticada
 *       (cookie HttpOnly token).
 *     operationId: delete_api_favoritos_movieId
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Favorito removido com sucesso!
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Favorito removido com sucesso!
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
 *       '404':
 *         description: Favorito não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Favorito não encontrado.
 *       '500':
 *         description: Erro ao remover favorito. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro ao remover favorito.
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
router.delete('/:movieId', verificarAutenticacao, async (req, res) => {
    try {

        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId) || movieId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do filme inválido.'
            });
        }

        const [resultado] = await db.execute(
            `
            DELETE FROM favoritos
            WHERE usuario_id = ?
              AND tmdb_movie_id = ?
            `,
            [
                req.usuario.id,
                movieId
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Favorito não encontrado.'
            });
        }

        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'FILME_DESFAVORITADO',
            ip: req.ip,
            detalhes: { tmdb_movie_id: movieId }
        });

        res.json({
            mensagem: 'Favorito removido com sucesso!'
        });

    } catch (erro) {

        console.error('Erro ao remover favorito:', erro);

        res.status(500).json({
            mensagem: 'Erro ao remover favorito.'
        });
    }
});


module.exports = router;