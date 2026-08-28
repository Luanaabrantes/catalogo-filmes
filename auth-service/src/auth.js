const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./database');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (
            typeof nome !== 'string' ||
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !nome.trim() ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                mensagem: 'Nome, e-mail e senha são obrigatórios.'
            });
        }

        if (senha.length < 6) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 6 caracteres.'
            });
        }

        const nomeNormalizado = nome.trim();
        const emailNormalizado =
            email.trim().toLowerCase();

        const [usuarios] = await db.execute(
            'SELECT id FROM usuarios WHERE email = ?',
            [emailNormalizado]
        );

        if (usuarios.length > 0) {
            return res.status(409).json({
                mensagem: 'Este e-mail já está cadastrado.'
            });
        }

        const senhaHash = await bcrypt.hash(
            senha,
            10
        );

        const [resultado] = await db.execute(
            `INSERT INTO usuarios
                (
                    nome,
                    email,
                    senha_hash,
                    role
                )
             VALUES (?, ?, ?, ?)`,
            [
                nomeNormalizado,
                emailNormalizado,
                senhaHash,
                'usuario'
            ]
        );

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso!',
            usuario: {
                id: resultado.insertId,
                nome: nomeNormalizado,
                email: emailNormalizado,
                role: 'usuario'
            }
        });

    } catch (erro) {
        console.error(
            'Erro ao cadastrar usuário:',
            erro
        );

        return res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                mensagem: 'E-mail e senha são obrigatórios.'
            });
        }

        const emailNormalizado =
            email.trim().toLowerCase();

        const [usuarios] = await db.execute(
            `SELECT
                id,
                nome,
                email,
                senha_hash,
                role
             FROM usuarios
             WHERE email = ?`,
            [emailNormalizado]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha inválidos.'
            });
        }

        const usuario = usuarios[0];

        const senhaCorreta =
            await bcrypt.compare(
                senha,
                usuario.senha_hash
            );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha inválidos.'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        return res.json({
            mensagem: 'Login realizado com sucesso!',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role
            }
        });

    } catch (erro) {
        console.error(
            'Erro no login:',
            erro
        );

        return res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });
    }
});

router.get('/validar', (req, res) => {
    const authorization =
        req.headers.authorization;

    if (
        typeof authorization !== 'string' ||
        !authorization.startsWith('Bearer ')
    ) {
        return res.status(401).json({
            mensagem: 'Token não informado.'
        });
    }

    const token =
        authorization
            .substring('Bearer '.length)
            .trim();

    if (!token) {
        return res.status(401).json({
            mensagem: 'Token não informado.'
        });
    }

    try {
        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        return res.json({
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                role: usuario.role
            }
        });

    } catch (erro) {
        return res.status(401).json({
            mensagem: 'Sessão inválida ou expirada.'
        });
    }
});

module.exports = router;