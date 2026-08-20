const jwt = require('jsonwebtoken');

function verificarAutenticacao(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            mensagem: 'Usuário não autenticado.'
        });
    }

    try {
        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.usuario = usuario;

        next();

    } catch (erro) {
        return res.status(401).json({
            mensagem: 'Sessão inválida ou expirada.'
        });
    }
}

module.exports = verificarAutenticacao;