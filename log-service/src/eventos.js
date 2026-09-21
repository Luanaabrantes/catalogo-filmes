const express = require('express');
const { registrarEvento, EventoInvalido } = require('./evento');

const router = express.Router();

router.post('/', express.json({ limit: '32kb' }), async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            throw new EventoInvalido('Envie um objeto JSON.');
        }
        const eventoId = await registrarEvento({
            ...req.body,
            ip: req.body.ip ?? req.ip
        });
        res.status(201).json({
            mensagem: 'Evento de auditoria registrado.',
            evento_id: eventoId
        });
    } catch (erro) {
        if (erro instanceof EventoInvalido) {
            return res.status(400).json({ mensagem: erro.message });
        }
        console.error('Não foi possível gravar evento de auditoria no Redis.');
        res.status(503).json({
            mensagem: 'Serviço de auditoria temporariamente indisponível.'
        });
    }
});

router.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
        return res.status(400).json({ mensagem: 'JSON inválido.' });
    }
    if (erro.type === 'entity.too.large') {
        return res.status(413).json({ mensagem: 'Evento excede o tamanho permitido.' });
    }
    next(erro);
});

module.exports = router;
