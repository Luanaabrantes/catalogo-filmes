require('dotenv').config();

const express = require('express');

const app = express();

const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        servico: 'auth-service',
        status: 'ok'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth service rodando na porta ${PORT}`);
});