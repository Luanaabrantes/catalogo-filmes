const redis = require('./redis');

async function consultarEventos(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new RangeError('limit deve ser um inteiro entre 1 e 100.');
    }
    if (!redis.isReady) throw new Error('Redis indisponível');
    const registros = await redis.xRevRange('auditoria', '+', '-', { COUNT: limit });
    return registros.reverse().map(({ id, message }) => {
        const evento = { id, usuario_id: message.usuario_id, acao: message.acao, timestamp: message.timestamp };
        if (message.ip !== undefined) evento.ip = message.ip;
        if (message.detalhes !== undefined) {
            try {
                const detalhes = JSON.parse(message.detalhes);
                evento.detalhes = detalhes && typeof detalhes === 'object' && !Array.isArray(detalhes) ? detalhes : {};
            } catch {
                evento.detalhes = {};
            }
        }
        return evento;
    });
}

module.exports = consultarEventos;
