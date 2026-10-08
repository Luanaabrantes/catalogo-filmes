require('dotenv').config();

const express = require('express');

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const recuperacaoSenhaRoutes = require('./recuperacaoSenha');

const app = express();

const PORT = process.env.PORT || 3001;

app.use(express.json());

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Auth-service
 *     summary: Verificar processo auth-service
 *     description: Não testa a disponibilidade do banco. Rota interna sem proxy público.
 *     operationId: get_health
 *     security: []
 *     responses:
 *       '200':
 *         description: Processo ativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 servico:
 *                   type: string
 *                   enum:
 *                     - auth-service
 *                 status:
 *                   type: string
 *                   enum:
 *                     - ok
 *               required:
 *                 - servico
 *                 - status
 */
app.get('/health', (req, res) => {
    res.json({
        servico: 'auth-service',
        status: 'ok'
    });
});

app.use('/auth', authRoutes);
app.use('/auth/admin', adminRoutes);
app.use('/auth', recuperacaoSenhaRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth service rodando na porta ${PORT}`);
});
