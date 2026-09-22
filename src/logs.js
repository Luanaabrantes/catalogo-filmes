const express = require('express');
const verificarAutenticacao = require('./middlewareAuth');
const registrarEventoAuditoria = require('./auditoria');

const router = express.Router();

router.get('/', verificarAutenticacao, async (req, res) => {
    if (req.usuario.role !== 'admin') {
        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'ACAO_NEGADA',
            ip: req.ip,
            detalhes: { recurso: 'CONSULTA_LOGS_ADMIN', motivo: 'role_insuficiente' }
        });
        return res.status(403).json({ mensagem: 'Acesso permitido somente a administradores.' });
    }

    try {
        const destino = new URL(`${process.env.LOG_SERVICE_URL}/eventos`);
        const parametros = new URL(req.originalUrl, 'http://catalogo').searchParams;
        for (const valor of parametros.getAll('limit')) {
            destino.searchParams.append('limit', valor);
        }
        const resposta = await fetch(destino, {
            headers: { Authorization: `Bearer ${req.cookies.token}` },
            signal: AbortSignal.timeout(2000)
        });
        if (![200, 400, 401, 403, 503].includes(resposta.status)) {
            throw new Error('Resposta inesperada da auditoria');
        }
        const dados = await resposta.json();
        return res.status(resposta.status).json(dados);
    } catch {
        console.error('Falha ao consultar serviço de auditoria.');
        return res.status(503).json({ mensagem: 'Serviço de auditoria indisponível.' });
    }
});

module.exports = router;
