require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;

app.get('/health', (req, res) => {
    res.json({ servico: 'log-service', status: 'ok' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Log service rodando na porta ${PORT}`);
});

function encerrar() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
