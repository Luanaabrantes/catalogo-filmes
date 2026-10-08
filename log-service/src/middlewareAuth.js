async function verificarAutenticacao(req, res, next) {
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) {
        return res.status(401).json({ mensagem: 'Token não informado ou inválido.' });
    }
    try {
        const token = authorization.replace(/^Bearer\s+/i, '');
        const resposta = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/validar`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(2000)
        });
        if (resposta.status === 401) {
            return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
        }
        if (!resposta.ok) throw new Error('Falha na validação');
        const dados = await resposta.json();
        if (!dados.usuario || !Number.isInteger(dados.usuario.id) || dados.usuario.id <= 0 || typeof dados.usuario.role !== 'string') {
            throw new Error('Resposta inválida da autenticação');
        }
        req.usuario = dados.usuario;
    } catch {
        console.error('Serviço de autenticação indisponível para consulta de logs.');
        return res.status(503).json({ mensagem: 'Serviço de autenticação indisponível.' });
    }
    next();
}

module.exports = verificarAutenticacao;
