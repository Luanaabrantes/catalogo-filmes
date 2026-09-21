const redis = require('./redis');

class EventoInvalido extends Error {}

const camposSensiveis = new Set([
    'senha', 'password', 'senhahash', 'token', 'jwt', 'cookie',
    'authorization', 'resettoken', 'accesstoken', 'refreshtoken'
]);

function validarDetalhes(valor) {
    if (!valor || typeof valor !== 'object') return;

    for (const [chave, conteudo] of Object.entries(valor)) {
        const normalizada = chave.toLowerCase().replace(/[_\-\s]/g, '');
        if (camposSensiveis.has(normalizada)) {
            throw new EventoInvalido('detalhes não pode conter campos sensíveis.');
        }
        validarDetalhes(conteudo);
    }
}

async function registrarEvento(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        throw new EventoInvalido('O evento deve ser um objeto JSON.');
    }

    const { usuario_id, acao, timestamp, ip, detalhes } = dados;
    const idValido = typeof usuario_id === 'number'
        ? Number.isSafeInteger(usuario_id) && usuario_id > 0
        : typeof usuario_id === 'string' && /^[1-9]\d*$/.test(usuario_id);

    if (!idValido) {
        throw new EventoInvalido('usuario_id deve ser um inteiro positivo ou sua representação em string.');
    }
    if (typeof acao !== 'string' || !acao.trim()) {
        throw new EventoInvalido('acao deve ser uma string não vazia.');
    }

    let data = new Date().toISOString();
    if (timestamp !== undefined) {
        // Exige data/hora ISO com fuso; o armazenamento é normalizado para UTC.
        const formato = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
        const instante = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
        const dia = typeof timestamp === 'string' ? timestamp.slice(0, 10) : '';
        const diaValido = !Number.isNaN(Date.parse(dia)) && new Date(dia).toISOString().slice(0, 10) === dia;
        if (typeof timestamp !== 'string' || !formato.test(timestamp) || !Number.isFinite(instante) || !diaValido) {
            throw new EventoInvalido('timestamp deve ser uma data/hora ISO 8601 válida com fuso.');
        }
        data = new Date(instante).toISOString();
    }

    const campos = { usuario_id: String(usuario_id), acao: acao.trim(), timestamp: data };
    if (ip !== undefined) {
        if (typeof ip !== 'string' || !ip.trim()) {
            throw new EventoInvalido('ip deve ser uma string não vazia.');
        }
        campos.ip = ip.trim();
    }
    if (detalhes !== undefined) {
        if (!detalhes || typeof detalhes !== 'object' || Array.isArray(detalhes)) {
            throw new EventoInvalido('detalhes deve ser um objeto JSON.');
        }
        validarDetalhes(detalhes);
        campos.detalhes = JSON.stringify(detalhes);
    }

    if (!redis.isReady) throw new Error('Redis indisponível');
    return redis.xAdd('auditoria', '*', campos);
}

module.exports = { registrarEvento, EventoInvalido };
