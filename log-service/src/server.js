require('dotenv').config();

const express = require('express');
const redis = require('./redis');

const app = express();
const PORT = process.env.PORT || 3002;

app.get('/health', async (req, res) => {
    let timeout;

    try {
        if (!redis.isReady) {
            throw new Error('Redis indisponível');
        }

        const resposta = await Promise.race([
            redis.ping(),
            new Promise((resolve, reject) => {
                timeout = setTimeout(() => reject(new Error('Timeout Redis')), 1500);
            })
        ]);

        if (resposta !== 'PONG') {
            throw new Error('Resposta inesperada do Redis');
        }

        res.json({ servico: 'log-service', status: 'ok', redis: 'ok' });
    } catch {
        res.status(503).json({
            servico: 'log-service',
            status: 'indisponivel',
            redis: 'indisponivel'
        });
    } finally {
        clearTimeout(timeout);
    }
});

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
