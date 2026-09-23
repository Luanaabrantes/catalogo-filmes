const jwt = require('jsonwebtoken');
const db = require('./database');

async function verificarAutenticacao(req, res, next) {
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ mensagem: 'Token não informado.' });
    }
    const token = authorization.substring('Bearer '.length).trim();
    if (!token) return res.status(401).json({ mensagem: 'Token não informado.' });

    let dadosToken;
    try {
        dadosToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
    }
    if (!Number.isInteger(dadosToken.id) || dadosToken.id <= 0) {
        return res.status(401).json({ mensagem: 'Token com usuário inválido.' });
    }
    try {
        const [usuarios] = await db.execute(
            'SELECT id, nome, email, role FROM usuarios WHERE id = ?',
            [dadosToken.id]
        );
        if (usuarios.length === 0) {
            return res.status(401).json({ mensagem: 'Usuário não encontrado.' });
        }
        const { id, nome, email, role } = usuarios[0];
        req.usuario = { id, nome, email, role };
    } catch {
        console.error('Erro ao validar usuário.');
        return res.status(500).json({ mensagem: 'Erro interno do servidor.' });
    }
    next();
}

module.exports = verificarAutenticacao;
