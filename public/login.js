const formLogin = document.getElementById('formLogin');
const mensagem = document.getElementById('mensagem');

formLogin.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const email =
        document.getElementById('email').value.trim();

    const senha =
        document.getElementById('senha').value;

    mensagem.textContent = 'Entrando...';
    mensagem.className = '';

    try {

        const resposta = await fetch(
            '/api/auth/login',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    email,
                    senha
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {

            mensagem.textContent =
                dados.mensagem ||
                'E-mail ou senha inválidos.';

            mensagem.className = 'mensagem-erro';

            return;
        }

        mensagem.textContent =
            'Login realizado com sucesso!';

        mensagem.className =
            'mensagem-sucesso';

        window.location.href =
            '/catalogo.html';

    } catch (erro) {

        console.error(
            'Erro ao realizar login:',
            erro
        );

        mensagem.textContent =
            'Não foi possível conectar ao servidor.';

        mensagem.className =
            'mensagem-erro';
    }

});