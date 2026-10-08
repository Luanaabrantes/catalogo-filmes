const express = require('express');
const { registrarEvento, EventoInvalido } = require('./evento');

const verificarAutenticacao = require('./middlewareAuth');
const consultarEventos = require('./consulta');

const router = express.Router();

router.get('/', verificarAutenticacao, async (req, res) => {
    if (req.usuario.role !== 'admin') {
        try {
            await registrarEvento({
                usuario_id: req.usuario.id,
                acao: 'ACAO_NEGADA',
                ip: req.ip,
                detalhes: { recurso: 'CONSULTA_LOGS_INTERNA', motivo: 'role_insuficiente' }
            });
        } catch {
            console.error('Falha ao registrar acesso negado à consulta interna.');
        }
        return res.status(403).json({ mensagem: 'Acesso permitido somente a administradores.' });
    }
    const valor = req.query.limit;
    if (valor !== undefined && (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || Number(valor) > 100)) {
        return res.status(400).json({ mensagem: 'limit deve ser um inteiro entre 1 e 100.' });
    }
    try {
        const eventos = await consultarEventos(valor === undefined ? 50 : Number(valor));
        res.json({ quantidade: eventos.length, eventos });
    } catch {
        console.error('Falha ao consultar eventos no Redis.');
        res.status(503).json({ mensagem: 'Serviço de auditoria temporariamente indisponível.' });
    }
});

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
