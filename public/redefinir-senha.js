const formRedefinirSenha =
    document.getElementById('formRedefinirSenha');

const mensagem =
    document.getElementById('mensagem');

const parametros =
    new URLSearchParams(window.location.search);

const token =
    parametros.get('token');


if (!token) {

    mensagem.textContent =
        'Link de recuperação inválido. Solicite um novo link.';

    mensagem.className =
        'mensagem-erro';

    formRedefinirSenha.style.display =
        'none';
}


formRedefinirSenha.addEventListener(
    'submit',
    async (evento) => {

        evento.preventDefault();


        const senha =
            document
                .getElementById('senha')
                .value;


        const confirmarSenha =
            document
                .getElementById('confirmarSenha')
                .value;


        if (senha !== confirmarSenha) {

            mensagem.textContent =
                'As senhas não coincidem.';

            mensagem.className =
                'mensagem-erro';

            return;
        }


        mensagem.textContent =
            'Alterando senha...';

        mensagem.className = '';


        try {

            const resposta =
                await fetch(
                    '/api/auth/redefinir-senha',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                token,
                                senha
                            })
                    }
                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                mensagem.textContent =
                    dados.mensagem ||
                    'Não foi possível alterar a senha.';

                mensagem.className =
                    'mensagem-erro';

                return;
            }


            mensagem.textContent =
                'Senha alterada com sucesso! Redirecionando para o login...';

            mensagem.className =
                'mensagem-sucesso';


            formRedefinirSenha.reset();


            setTimeout(
                () => {

                    window.location.href = '/';

                },
                1500
            );


        } catch (erro) {

            console.error(
                'Erro ao redefinir senha:',
                erro
            );


            mensagem.textContent =
                'Não foi possível conectar ao servidor.';

            mensagem.className =
                'mensagem-erro';
        }

    }
);