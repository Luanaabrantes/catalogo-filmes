const formCadastro =
    document.getElementById('formCadastro');

const mensagem =
    document.getElementById('mensagem');


formCadastro.addEventListener(
    'submit',
    async (evento) => {

        evento.preventDefault();


        const nome =
            document
                .getElementById('nome')
                .value
                .trim();


        const email =
            document
                .getElementById('email')
                .value
                .trim();


        const senha =
            document
                .getElementById('senha')
                .value;


        mensagem.textContent =
            'Criando sua conta...';

        mensagem.className = '';


        try {

            const resposta =
                await fetch(
                    '/api/auth/cadastro',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                nome,
                                email,
                                senha
                            })
                    }
                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                mensagem.textContent =
                    dados.mensagem ||
                    'Não foi possível criar a conta.';

                mensagem.className =
                    'mensagem-erro';

                return;
            }


            mensagem.textContent =
                'Conta criada com sucesso! Redirecionando...';

            mensagem.className =
                'mensagem-sucesso';


            formCadastro.reset();


            setTimeout(
                () => {

                    window.location.href = '/';

                },
                1200
            );


        } catch (erro) {

            console.error(
                'Erro ao criar conta:',
                erro
            );


            mensagem.textContent =
                'Não foi possível conectar ao servidor.';

            mensagem.className =
                'mensagem-erro';
        }

    }
);