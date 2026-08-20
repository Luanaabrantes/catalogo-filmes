const express = require('express');
const db = require('./database');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();


// ========================================
// LISTAR FAVORITOS DO USUÁRIO LOGADO
// ========================================

router.get('/', verificarAutenticacao, async (req, res) => {
    try {

        const [favoritos] = await db.execute(
            `
            SELECT tmdb_movie_id
            FROM favoritos
            WHERE usuario_id = ?
            ORDER BY criado_em DESC
            `,
            [req.usuario.id]
        );

        res.json({
            favoritos: favoritos.map(
                favorito => favorito.tmdb_movie_id
            )
        });

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