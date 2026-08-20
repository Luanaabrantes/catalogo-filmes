const express = require('express');
const db = require('./database');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();


// ========================================
// LISTAR TODOS OS COMENTÁRIOS
// DO USUÁRIO LOGADO
// ========================================

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

router.delete('/:id', verificarAutenticacao, async (req, res) => {
    try {

        const comentarioId = Number(req.params.id);

        if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
            return res.status(400).json({
                mensagem: 'ID do comentário inválido.'
            });
        }

        const [resultado] = await db.execute(
            `
            DELETE FROM comentarios
            WHERE id = ?
              AND usuario_id = ?
            `,
            [
                comentarioId,
                req.usuario.id
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Comentário não encontrado.'
            });
        }

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