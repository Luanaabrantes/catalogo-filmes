require('dotenv').config();

const express = require('express');

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const recuperacaoSenhaRoutes = require('./recuperacaoSenha');

const app = express();

const PORT = process.env.PORT || 3001;

app.use(express.json());

const { readiness } = require('./saude');
/**
 * @openapi
 * /live:
 *   get:
 *     tags: [Auth-service]
 *     summary: Verificar somente o processo
 *     operationId: get_live
 *     security: []
 *     responses:
 *       '200':
 *         description: Processo responde
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Saude'
 */
app.get('/live', (req, res) => res.json({ servico: 'auth-service', status: 'ok' }));
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Auth-service]
 *     summary: "Readiness: MariaDB e SMTP"
 *     operationId: get_health
 *     security: []
 *     responses:
 *       '200':
 *         description: Serviço pronto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Saude'
 *       '503':
 *         description: Dependência indisponível ou timeout; resposta sem detalhes sensíveis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Saude'
 */
app.get('/health', readiness('auth-service', {
    mariadb: require('./saudeBanco'),
    smtp: async () => {
        const transporter = require('nodemailer').createTransport({ host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT), secure: false, connectionTimeout: 700,
            greetingTimeout: 700, socketTimeout: 700,
            auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } });
        try { await transporter.verify(); } finally { transporter.close(); }
    }
}));

app.use('/auth', authRoutes);
app.use('/auth/admin', adminRoutes);
app.use('/auth', recuperacaoSenhaRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth service rodando na porta ${PORT}`);
});
