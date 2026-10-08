require('dotenv').config();

const express = require('express');
const redis = require('./redis');

const app = express();
const PORT = process.env.PORT || 3002;

app.use('/eventos', require('./eventos'));

const { readiness, limitar, http } = require('./saude');
app.get('/live', (req, res) => res.json({ servico: 'log-service', status: 'ok' }));
app.get('/health', readiness('log-service', {
    redis: async () => {
        if (!redis.isReady || await limitar(() => redis.ping(), 1500) !== 'PONG') throw new Error('indisponivel');
    },
    autenticacao: () => http(`${process.env.AUTH_SERVICE_URL}/health`)
}));

redis.connect().catch(() => {
    console.error('Não foi possível iniciar a conexão com Redis.');
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Log service rodando na porta ${PORT}`);
});

function encerrar() {
    server.close(() => {
        if (redis.isOpen) redis.destroy();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
