const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./database');
const mailer = require('./mailer');

const router = express.Router();

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