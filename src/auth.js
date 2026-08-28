const express = require('express');

const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
    try {
        const resposta = await fetch(
            `${process.env.AUTH_SERVICE_URL}/auth/cadastro`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            }
        );

        const dados = await resposta.json();

        return res
            .status(resposta.status)
            .json(dados);

    } catch (erro) {
        console.error(
            'Erro ao consultar auth-service no cadastro:',
            erro
        );

        return res.status(503).json({
            mensagem: 'Serviço de autenticação indisponível.'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const resposta = await fetch(
            `${process.env.AUTH_SERVICE_URL}/auth/login`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            return res
                .status(resposta.status)
                .json(dados);
        }

        if (!dados.token) {
            return res.status(502).json({
                mensagem:
                    'Resposta inválida do serviço de autenticação.'
            });
        }

        res.cookie('token', dados.token, {
            httpOnly: true,
            sameSite: 'lax',
            secure:
                process.env.NODE_ENV === 'production',
            maxAge: 8 * 60 * 60 * 1000
        });

        return res.json({
            mensagem: dados.mensagem,
            usuario: dados.usuario
        });

    } catch (erro) {
        console.error(
            'Erro ao consultar auth-service no login:',
            erro
        );

        return res.status(503).json({
            mensagem: 'Serviço de autenticação indisponível.'
        });
    }
});

router.get(
    '/me',
    verificarAutenticacao,
    (req, res) => {
        res.json({
            usuario: {
                id: req.usuario.id,
                nome: req.usuario.nome,
                email: req.usuario.email,
                role: req.usuario.role
            }
        });
    }
);

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure:
            process.env.NODE_ENV === 'production'
    });

    res.json({
        mensagem: 'Logout realizado com sucesso!'
    });
});

router.post('/esqueci-senha', async (req, res) => {
    try {
        const resposta = await fetch(
            `${process.env.AUTH_SERVICE_URL}/auth/esqueci-senha`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            }
        );

        const dados = await resposta.json();

        return res
            .status(resposta.status)
            .json(dados);

    } catch (erro) {
        console.error(
            'Erro ao consultar auth-service na recuperação:',
            erro
        );

        return res.status(503).json({
            mensagem: 'Serviço de autenticação indisponível.'
        });
    }
});

router.post('/redefinir-senha', async (req, res) => {
    try {
        const resposta = await fetch(
            `${process.env.AUTH_SERVICE_URL}/auth/redefinir-senha`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            }
        );

        const dados = await resposta.json();

        return res
            .status(resposta.status)
            .json(dados);

    } catch (erro) {
        console.error(
            'Erro ao consultar auth-service na redefinição:',
            erro
        );

        return res.status(503).json({
            mensagem: 'Serviço de autenticação indisponível.'
        });
    }
});

module.exports = router;