const express = require('express');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

router.get('/', verificarAutenticacao, async (req, res) => {
    try {

        // 1. Procurar Tom Hanks
        const respostaPessoa = await fetch(
            'https://api.themoviedb.org/3/search/person?query=Tom%20Hanks&language=pt-BR',
            {
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
                    Accept: 'application/json'
                }
            }
        );

        if (!respostaPessoa.ok) {
            throw new Error(
                `Erro ao buscar Tom Hanks: ${respostaPessoa.status}`
            );
        }

        const dadosPessoa = await respostaPessoa.json();

        const tomHanks = dadosPessoa.results.find(
            pessoa => pessoa.name === 'Tom Hanks'
        );

        if (!tomHanks) {
            return res.status(404).json({
                mensagem: 'Tom Hanks não encontrado.'
            });
        }

        // 2. Buscar créditos de filmes
        const respostaFilmes = await fetch(
            `https://api.themoviedb.org/3/person/${tomHanks.id}/movie_credits?language=pt-BR`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
                    Accept: 'application/json'
                }
            }
        );

        if (!respostaFilmes.ok) {
            throw new Error(
                `Erro ao buscar filmes: ${respostaFilmes.status}`
            );
        }

        const dadosFilmes = await respostaFilmes.json();

        // 3. Preparar resposta
        const filmes = dadosFilmes.cast.map(filme => ({
            id: filme.id,
            titulo: filme.title,
            sinopse: filme.overview,
            data_lancamento: filme.release_date,

            poster_url: filme.poster_path
                ? `https://image.tmdb.org/t/p/w500${filme.poster_path}`
                : null
        }));

        res.json({
            pessoa: {
                id: tomHanks.id,
                nome: tomHanks.name
            },
            filmes
        });

    } catch (erro) {

        console.error('Erro TMDB:', erro);

        res.status(500).json({
            mensagem: 'Não foi possível buscar os filmes da TMDB.'
        });
    }
});

module.exports = router;