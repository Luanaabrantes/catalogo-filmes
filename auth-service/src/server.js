require('dotenv').config();

const express = require('express');

const authRoutes = require('./auth');
const recuperacaoSenhaRoutes = require('./recuperacaoSenha');

const app = express();

const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        servico: 'auth-service',
        status: 'ok'
    });
});

app.use('/auth', authRoutes);
app.use('/auth', recuperacaoSenhaRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth service rodando na porta ${PORT}`);
});
