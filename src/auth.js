const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./database');
const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        // Verifica se todos os campos foram preenchidos
        if (!nome || !email || !senha) {
            return res.status(400).json({
                mensagem: 'Nome, e-mail e senha são obrigatórios.'
            });
        }

        // Exige pelo menos 6 caracteres na senha
        if (senha.length < 6) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 6 caracteres.'
            });
        }

        // Padroniza o e-mail
        const emailNormalizado = email.trim().toLowerCase();

        // Verifica se o e-mail já existe
        const [usuarios] = await db.execute(
            'SELECT id FROM usuarios WHERE email = ?',
            [emailNormalizado]
        );

        if (usuarios.length > 0) {
            return res.status(409).json({
                mensagem: 'Este e-mail já está cadastrado.'
            });
        }

        // Transforma a senha em hash
        const senhaHash = await bcrypt.hash(senha, 10);

        // Salva usuário
        const [resultado] = await db.execute(
            `INSERT INTO usuarios (nome, email, senha_hash)
             VALUES (?, ?, ?)`,
            [
                nome.trim(),
                emailNormalizado,
                senhaHash
            ]
        );

        res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso!',
            usuario: {
                id: resultado.insertId,
                nome: nome.trim(),
                email: emailNormalizado
            }
        });

    } catch (erro) {
        console.error('Erro ao cadastrar usuário:', erro);

        res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });
    }
});

router.post('/login', async (req, res) => {
    try {

        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: 'E-mail e senha são obrigatórios.'
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const [usuarios] = await db.execute(
            `SELECT id, nome, email, senha_hash
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

        const senhaCorreta = await bcrypt.compare(
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
                email: usuario.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 8 * 60 * 60 * 1000
        });

        res.json({
            mensagem: 'Login realizado com sucesso!',
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            }
        });

    } catch (erro) {

        console.error('Erro no login:', erro);

        res.status(500).json({
            mensagem: 'Erro interno do servidor.'
        });

    }
});

router.get('/me', verificarAutenticacao, (req, res) => {

    res.json({
        usuario: {
            id: req.usuario.id,
            nome: req.usuario.nome,
            email: req.usuario.email
        }
    });

});

router.post('/logout', (req, res) => {

    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });

    res.json({
        mensagem: 'Logout realizado com sucesso!'
    });

});

module.exports = router;