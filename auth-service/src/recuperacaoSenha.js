const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./database');
const mailer = require('./mailer');

const router = express.Router();

/**
 * @openapi
 * /auth/esqueci-senha:
 *   post:
 *     tags:
 *       - Auth-service
 *     summary: Solicitar recuperação de senha
 *     description: >-
 *       Resposta genérica mesmo se a conta não existir; se existir, envia e-mail com link e token de 30 minutos.
 *       Sucesso: Se o e-mail estiver cadastrado, você receberá um link de recuperação. Proxy público existente:
 *       POST /api/auth/esqueci-senha. Teste esse proxy em /apidocs, com cookie; ele não aceita Bearer do
 *       navegador.
 *     operationId: post_auth_esqueci_senha
 *     security: []
 *     responses:
 *       '200':
 *         description: Solicitar recuperação de senha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Se o e-mail estiver cadastrado, você receberá um link de recuperação.
 *       '400':
 *         description: >-
 *           E-mail é obrigatório. JSON malformado ou corpo inválido para express.json (resposta padrão HTML do
 *           Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: E-mail é obrigatório.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '413':
 *         description: Corpo acima do limite padrão de 100 KiB de express.json/urlencoded (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '415':
 *         description: Charset ou Content-Encoding não suportado pelo parser (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recuperacao'
 *     x-public-proxy: POST /api/auth/esqueci-senha
 */
router.post('/esqueci-senha', async (req, res) => {
    try {
        const { email } = req.body;

        if (
            typeof email !== 'string' ||
            !email.trim()
        ) {
            return res.status(400).json({
                mensagem: 'E-mail é obrigatório.'
            });
        }

        const emailNormalizado =
            email.trim().toLowerCase();

        const [usuarios] = await db.execute(
            `SELECT id, nome, email
             FROM usuarios
             WHERE email = ?`,
            [emailNormalizado]
        );

        if (usuarios.length === 0) {
            return res.json({
                mensagem:
                    'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'
            });
        }

        const usuario = usuarios[0];

        const token =
            crypto.randomBytes(32).toString('hex');

        await db.execute(
            `INSERT INTO reset_tokens
                (
                    token,
                    usuario_id,
                    expira_em,
                    usado
                )
             VALUES (
                ?,
                ?,
                DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE),
                ?
             )`,
            [
                token,
                usuario.id,
                false
            ]
        );

        const linkRecuperacao =
            `${process.env.CATALOGO_URL}/redefinir-senha.html?token=${token}`;

        await mailer.sendMail({
            from: process.env.MAIL_FROM,
            to: usuario.email,
            subject: 'Redefinição de senha - Catálogo de Filmes',
            text:
                `Olá, ${usuario.nome}.\n\n` +
                `Recebemos uma solicitação para redefinir sua senha.\n\n` +
                `Use o link abaixo:\n${linkRecuperacao}\n\n` +
                `Este link expira em 30 minutos e só pode ser utilizado uma vez.`
        });

        res.json({
            mensagem:
                'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'
        });

    } catch (erro) {
        console.error(
            'Erro ao solicitar recuperação de senha:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });
    }
});

/**
 * @openapi
 * /auth/redefinir-senha:
 *   post:
 *     tags:
 *       - Auth-service
 *     summary: Redefinir senha
 *     description: >-
 *       Token deve existir, não ter expirado e ainda não ter sido utilizado. Nova senha com no mínimo 6
 *       caracteres. Sucesso: Senha redefinida com sucesso! Proxy público existente: POST
 *       /api/auth/redefinir-senha. Teste esse proxy em /apidocs, com cookie; ele não aceita Bearer do navegador.
 *     operationId: post_auth_redefinir_senha
 *     security: []
 *     responses:
 *       '200':
 *         description: Redefinir senha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Senha redefinida com sucesso!
 *       '400':
 *         description: >-
 *           Token e nova senha são obrigatórios. / A senha deve ter pelo menos 6 caracteres. / Token inválido. /
 *           Este link já foi utilizado. / Este link expirou. Solicite uma nova recuperação de senha. JSON
 *           malformado ou corpo inválido para express.json (resposta padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Token e nova senha são obrigatórios.
 *               '1':
 *                 value:
 *                   mensagem: A senha deve ter pelo menos 6 caracteres.
 *               '2':
 *                 value:
 *                   mensagem: Token inválido.
 *               '3':
 *                 value:
 *                   mensagem: Este link já foi utilizado.
 *               '4':
 *                 value:
 *                   mensagem: Este link expirou. Solicite uma nova recuperação de senha.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '413':
 *         description: Corpo acima do limite padrão de 100 KiB de express.json/urlencoded (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '415':
 *         description: Charset ou Content-Encoding não suportado pelo parser (HTML do Express).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '500':
 *         description: Erro interno do servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Erro interno do servidor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Redefinicao'
 *     x-public-proxy: POST /api/auth/redefinir-senha
 */
router.post('/redefinir-senha', async (req, res) => {
    try {
        const { token, senha } = req.body;

        if (
            typeof token !== 'string' ||
            typeof senha !== 'string' ||
            !token.trim() ||
            !senha
        ) {
            return res.status(400).json({
                mensagem: 'Token e nova senha são obrigatórios.'
            });
        }

        if (senha.length < 6) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 6 caracteres.'
            });
        }

        const [tokens] = await db.execute(
            `SELECT
                id,
                usuario_id,
                usado,
                CASE
                    WHEN expira_em <= CURRENT_TIMESTAMP
                    THEN 1
                    ELSE 0
                END AS expirado
             FROM reset_tokens
             WHERE token = ?
             LIMIT 1`,
            [token.trim()]
        );

        if (tokens.length === 0) {
            return res.status(400).json({
                mensagem: 'Token inválido.'
            });
        }

        const resetToken = tokens[0];

        if (resetToken.usado) {
            return res.status(400).json({
                mensagem: 'Este link já foi utilizado.'
            });
        }

        if (resetToken.expirado) {
            return res.status(400).json({
                mensagem:
                    'Este link expirou. Solicite uma nova recuperação de senha.'
            });
        }

        const senhaHash =
            await bcrypt.hash(senha, 10);

        await db.execute(
            `UPDATE usuarios
             SET senha_hash = ?
             WHERE id = ?`,
            [
                senhaHash,
                resetToken.usuario_id
            ]
        );

        await db.execute(
            `UPDATE reset_tokens
             SET usado = TRUE
             WHERE id = ?`,
            [resetToken.id]
        );

        res.json({
            mensagem: 'Senha redefinida com sucesso!'
        });

    } catch (erro) {
        console.error(
            'Erro ao redefinir senha:',
            erro
        );

        res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });
    }
});

module.exports = router;