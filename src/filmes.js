const express = require('express');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

/**
 * @openapi
 * /api/filmes:
 *   get:
 *     tags:
 *       - Filmes
 *     summary: Consultar filmes de Tom Hanks
 *     description: >-
 *       Busca pessoa Tom Hanks e depois créditos de elenco na TMDB, em pt-BR. Sem parâmetros de consulta. Requer
 *       sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_filmes
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Créditos da TMDB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pessoa:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       minimum: 1
 *                       example: 1
 *                     nome:
 *                       type: string
 *                       example: Tom Hanks
 *                   required:
 *                     - id
 *                     - nome
 *                 filmes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Filme'
 *               required:
 *                 - pessoa
 *                 - filmes
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
 *         description: Tom Hanks não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Tom Hanks não encontrado.
 *       '500':
 *         description: Não foi possível buscar os filmes da TMDB. / Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Não foi possível buscar os filmes da TMDB.
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