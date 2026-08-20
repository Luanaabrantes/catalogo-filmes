const listaFilmes =
    document.getElementById('listaFilmes');

const mensagemCarregamento =
    document.getElementById('mensagemCarregamento');

const nomeUsuario =
    document.getElementById('nomeUsuario');

const btnLogout =
    document.getElementById('btnLogout');


// =====================================================
// VERIFICAR USUÁRIO LOGADO
// =====================================================

async function verificarUsuario() {

    try {

        const resposta =
            await fetch('/api/auth/me');


        if (!resposta.ok) {

            window.location.href = '/';

            return;
        }


        const dados =
            await resposta.json();


        nomeUsuario.textContent =
            `Olá, ${dados.usuario.nome}`;


    } catch (erro) {

        console.error(
            'Erro ao verificar usuário:',
            erro
        );


        window.location.href = '/';
    }

}


// =====================================================
// CARREGAR FILMES
// =====================================================

async function carregarFilmes() {

    try {

        const resposta =
            await fetch('/api/filmes');


        if (resposta.status === 401) {

            window.location.href = '/';

            return;
        }


        if (!resposta.ok) {

            throw new Error(
                'Erro ao buscar filmes.'
            );
        }


        const dados =
            await resposta.json();


        mensagemCarregamento.style.display =
            'none';


        criarCards(
            dados.filmes
        );


        // Primeiro os cards existem.
        // Depois carregamos os dados do banco.
        await carregarFavoritos();

        await carregarComentarios();


    } catch (erro) {

        console.error(
            'Erro ao carregar filmes:',
            erro
        );


        mensagemCarregamento.textContent =
            'Não foi possível carregar os filmes.';
    }

}


// =====================================================
// CRIAR CARDS
// =====================================================

function criarCards(filmes) {

    listaFilmes.innerHTML = '';


    filmes.forEach(
        filme => {

            const card =
                document.createElement('article');


            card.className =
                'filme-card';


            // ==========================================
            // PÔSTER
            // ==========================================

            if (filme.poster_url) {

                const imagem =
                    document.createElement('img');


                imagem.src =
                    filme.poster_url;


                imagem.alt =
                    `Pôster de ${filme.titulo}`;


                imagem.loading =
                    'lazy';


                card.appendChild(imagem);

            } else {

                const semPoster =
                    document.createElement('div');


                semPoster.className =
                    'sem-poster';


                semPoster.textContent =
                    'Pôster não disponível';


                card.appendChild(
                    semPoster
                );

            }


            // ==========================================
            // CONTEÚDO
            // ==========================================

            const conteudo =
                document.createElement('div');


            conteudo.className =
                'filme-conteudo';


            // TÍTULO

            const titulo =
                document.createElement('h2');


            titulo.textContent =
                filme.titulo;


            // ANO

            const ano =
                document.createElement('p');


            ano.className =
                'ano';


            ano.textContent =
                filme.data_lancamento
                    ? filme.data_lancamento.substring(0, 4)
                    : 'Data não disponível';


            // SINOPSE

            const sinopse =
                document.createElement('p');


            sinopse.className =
                'sinopse';


            sinopse.textContent =
                filme.sinopse ||
                'Sinopse não disponível.';


            // ==========================================
            // FAVORITO
            // ==========================================

            const btnFavorito =
                document.createElement('button');


            btnFavorito.type =
                'button';


            btnFavorito.className =
                'btn-favorito';


            btnFavorito.dataset.id =
                filme.id;


            btnFavorito.textContent =
                '♡ Favoritar';


            // ==========================================
            // COMENTÁRIO SALVO
            // ==========================================

            const listaComentarios =
                document.createElement('div');


            listaComentarios.className =
                'lista-comentarios';


            listaComentarios.dataset.listaComentarios =
                filme.id;


            // ==========================================
            // NOVO COMENTÁRIO
            // ==========================================

            const comentarioArea =
                document.createElement('div');


            comentarioArea.className =
                'comentario-area';


            const textarea =
                document.createElement('textarea');


            textarea.placeholder =
                'Escreva um comentário...';


            textarea.dataset.comentario =
                filme.id;


            textarea.maxLength =
                1000;


            const btnComentar =
                document.createElement('button');


            btnComentar.type =
                'button';


            btnComentar.className =
                'btn-comentar';


            btnComentar.dataset.id =
                filme.id;


            btnComentar.textContent =
                'Comentar';


            comentarioArea.appendChild(
                textarea
            );


            comentarioArea.appendChild(
                btnComentar
            );


            // ==========================================
            // MONTAGEM
            // ==========================================

            conteudo.appendChild(
                titulo
            );


            conteudo.appendChild(
                ano
            );


            conteudo.appendChild(
                sinopse
            );


            conteudo.appendChild(
                btnFavorito
            );


            /*
                Comentários que já estão no banco
                aparecem antes da caixa de novo comentário.
            */

            conteudo.appendChild(
                listaComentarios
            );


            conteudo.appendChild(
                comentarioArea
            );


            card.appendChild(
                conteudo
            );


            listaFilmes.appendChild(
                card
            );

        }
    );

}


// =====================================================
// CARREGAR FAVORITOS
// =====================================================

async function carregarFavoritos() {

    try {

        const resposta =
            await fetch(
                '/api/favoritos'
            );


        if (resposta.status === 401) {

            window.location.href = '/';

            return;
        }


        if (!resposta.ok) {

            throw new Error(
                'Erro ao carregar favoritos.'
            );
        }


        const dados =
            await resposta.json();


        dados.favoritos.forEach(
            movieId => {

                const botao =
                    document.querySelector(
                        `.btn-favorito[data-id="${movieId}"]`
                    );


                if (botao) {

                    botao.textContent =
                        '♥ Favoritado';


                    botao.classList.add(
                        'favoritado'
                    );

                }

            }
        );


    } catch (erro) {

        console.error(
            'Erro ao carregar favoritos:',
            erro
        );

    }

}


// =====================================================
// FAVORITAR / DESFAVORITAR
// =====================================================

listaFilmes.addEventListener(
    'click',
    async (evento) => {

        const botao =
            evento.target.closest(
                '.btn-favorito'
            );


        if (!botao) {
            return;
        }


        const movieId =
            botao.dataset.id;


        const estaFavoritado =
            botao.classList.contains(
                'favoritado'
            );


        botao.disabled =
            true;


        try {

            const resposta =
                await fetch(
                    `/api/favoritos/${movieId}`,
                    {
                        method:
                            estaFavoritado
                                ? 'DELETE'
                                : 'POST'
                    }
                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                throw new Error(
                    dados.mensagem ||
                    'Erro ao alterar favorito.'
                );

            }


            if (estaFavoritado) {

                botao.textContent =
                    '♡ Favoritar';


                botao.classList.remove(
                    'favoritado'
                );

            } else {

                botao.textContent =
                    '♥ Favoritado';


                botao.classList.add(
                    'favoritado'
                );

            }


        } catch (erro) {

            console.error(
                'Erro ao alterar favorito:',
                erro
            );


            alert(
                erro.message ||
                'Não foi possível alterar o favorito.'
            );


        } finally {

            botao.disabled =
                false;

        }

    }
);


// =====================================================
// CARREGAR COMENTÁRIOS
// =====================================================

async function carregarComentarios() {

    try {

        const resposta =
            await fetch(
                '/api/comentarios'
            );


        if (resposta.status === 401) {

            window.location.href = '/';

            return;
        }


        if (!resposta.ok) {

            throw new Error(
                'Erro ao carregar comentários.'
            );

        }


        const dados =
            await resposta.json();


        // Limpar antes de preencher novamente

        document
            .querySelectorAll(
                '.lista-comentarios'
            )
            .forEach(
                lista => {

                    lista.innerHTML = '';

                }
            );


        // Colocar cada comentário no card correto

        dados.comentarios.forEach(
            comentario => {

                const lista =
                    document.querySelector(
                        `[data-lista-comentarios="${comentario.tmdb_movie_id}"]`
                    );


                if (!lista) {
                    return;
                }


                const item =
                    document.createElement('div');


                item.className =
                    'comentario-item';


                const label =
                    document.createElement('span');


                label.className =
                    'comentario-label';


                label.textContent =
                    'Seu comentário';


                const texto =
                    document.createElement('p');


                texto.textContent =
                    comentario.texto;


                const excluir =
                    document.createElement('button');


                excluir.type =
                    'button';


                excluir.className =
                    'btn-excluir-comentario';


                excluir.dataset.comentarioId =
                    comentario.id;


                excluir.textContent =
                    'Excluir';


                item.appendChild(
                    label
                );


                item.appendChild(
                    texto
                );


                item.appendChild(
                    excluir
                );


                lista.appendChild(
                    item
                );

            }
        );


    } catch (erro) {

        console.error(
            'Erro ao carregar comentários:',
            erro
        );

    }

}


// =====================================================
// SALVAR COMENTÁRIO
// =====================================================

listaFilmes.addEventListener(
    'click',
    async (evento) => {

        const botao =
            evento.target.closest(
                '.btn-comentar'
            );


        if (!botao) {
            return;
        }


        const movieId =
            botao.dataset.id;


        const textarea =
            document.querySelector(
                `textarea[data-comentario="${movieId}"]`
            );


        const texto =
            textarea.value.trim();


        if (!texto) {

            alert(
                'Digite um comentário.'
            );

            return;
        }


        botao.disabled =
            true;


        botao.textContent =
            'Salvando...';


        try {

            const resposta =
                await fetch(
                    `/api/comentarios/${movieId}`,
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                texto
                            })
                    }
                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                throw new Error(
                    dados.mensagem ||
                    'Erro ao salvar comentário.'
                );

            }


            textarea.value = '';


            // Faz o comentário aparecer sem F5

            await carregarComentarios();


        } catch (erro) {

            console.error(
                'Erro ao salvar comentário:',
                erro
            );


            alert(
                erro.message ||
                'Não foi possível salvar o comentário.'
            );


        } finally {

            botao.disabled =
                false;


            botao.textContent =
                'Comentar';

        }

    }
);


// =====================================================
// EXCLUIR COMENTÁRIO
// =====================================================

listaFilmes.addEventListener(
    'click',
    async (evento) => {

        const botao =
            evento.target.closest(
                '.btn-excluir-comentario'
            );


        if (!botao) {
            return;
        }


        const comentarioId =
            botao.dataset.comentarioId;


        botao.disabled =
            true;


        try {

            const resposta =
                await fetch(
                    `/api/comentarios/${comentarioId}`,
                    {
                        method:
                            'DELETE'
                    }
                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                throw new Error(
                    dados.mensagem ||
                    'Erro ao excluir comentário.'
                );

            }


            await carregarComentarios();


        } catch (erro) {

            console.error(
                'Erro ao excluir comentário:',
                erro
            );


            alert(
                erro.message ||
                'Não foi possível excluir o comentário.'
            );


        } finally {

            botao.disabled =
                false;

        }

    }
);


// =====================================================
// LOGOUT
// =====================================================

btnLogout.addEventListener(
    'click',
    async () => {

        try {

            await fetch(
                '/api/auth/logout',
                {
                    method:
                        'POST'
                }
            );

        } catch (erro) {

            console.error(
                'Erro ao realizar logout:',
                erro
            );

        } finally {

            window.location.href =
                '/';

        }

    }
);


// =====================================================
// INICIAR
// =====================================================

verificarUsuario();

carregarFilmes();