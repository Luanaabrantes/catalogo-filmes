async function verificarAutenticacao(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            mensagem: 'Usuário não autenticado.'
        });
    }

    try {
        const resposta = await fetch(
            `${process.env.AUTH_SERVICE_URL}/auth/validar`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            return res.status(resposta.status).json({
                mensagem:
                    dados.mensagem ||
                    'Sessão inválida ou expirada.'
            });
        }

        req.usuario = dados.usuario;

        next();

    } catch (erro) {
        console.error(
            'Erro ao consultar auth-service:',
            erro
        );

        return res.status(503).json({
            mensagem:
                'Serviço de autenticação indisponível.'
        });
    }
}

module.exports = verificarAutenticacao;
