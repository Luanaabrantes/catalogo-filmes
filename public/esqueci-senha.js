const formEsqueciSenha =
    document.getElementById('formEsqueciSenha');

const mensagem =
    document.getElementById('mensagem');


formEsqueciSenha.addEventListener(
    'submit',
    async (evento) => {

        evento.preventDefault();

        const email =
            document
                .getElementById('email')
                .value
                .trim();

        mensagem.textContent =
            'Enviando link de recuperação...';

        mensagem.className = '';


        try {

            const resposta = await fetch(
                '/api/auth/esqueci-senha',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        email
                    })
                }
            );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                mensagem.textContent =
                    dados.mensagem ||
                    'Não foi possível solicitar a recuperação.';

                mensagem.className =
                    'mensagem-erro';

                return;
            }


            mensagem.textContent =
                dados.mensagem ||
                'Se o e-mail estiver cadastrado, você receberá um link de recuperação.';

            mensagem.className =
                'mensagem-sucesso';


            formEsqueciSenha.reset();

        } catch (erro) {

            console.error(
                'Erro ao solicitar recuperação de senha:',
                erro
            );

            mensagem.textContent =
                'Não foi possível conectar ao servidor.';

            mensagem.className =
                'mensagem-erro';
        }

    }
);