const express = require('express');
const registrarEventoAuditoria = require('./auditoria');

const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

/**
 * @openapi
 * /api/auth/cadastro:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Cadastrar usuário
 *     description: >-
 *       Cria conta com role usuario; qualquer role enviada é ignorada. Nome e e-mail normalizados com trim;
 *       e-mail lowercase.
 *     operationId: post_api_auth_cadastro
 *     security: []
 *     responses:
 *       '201':
 *         description: Cadastrar usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *               required:
 *                 - mensagem
 *                 - usuario
 *             example:
 *               mensagem: Usuário cadastrado com sucesso!
 *               usuario:
 *                 id: 1
 *                 nome: Pessoa de exemplo
 *                 email: pessoa@example.invalid
 *                 role: usuario
 *       '400':
 *         description: >-
 *           Nome, e-mail e senha são obrigatórios. / A senha deve ter pelo menos 6 caracteres. JSON malformado
 *           ou corpo inválido para express.json (resposta padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Nome, e-mail e senha são obrigatórios.
 *               '1':
 *                 value:
 *                   mensagem: A senha deve ter pelo menos 6 caracteres.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '409':
 *         description: Este e-mail já está cadastrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Este e-mail já está cadastrado.
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
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Cadastro'
 */
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

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Autenticar usuário
 *     description: >-
 *       Senha comparada com bcryptjs. Define Set-Cookie token (HttpOnly, SameSite=Lax, Secure em produção, 8
 *       horas); não retorna JWT no corpo. Faça login com uma conta LOCAL antes de testar operações protegidas.
 *     operationId: post_api_auth_login
 *     security: []
 *     responses:
 *       '200':
 *         description: Autenticar usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *               required:
 *                 - mensagem
 *                 - usuario
 *             example:
 *               mensagem: Login realizado com sucesso!
 *               usuario:
 *                 id: 1
 *                 nome: Pessoa de exemplo
 *                 email: pessoa@example.invalid
 *                 role: usuario
 *         headers:
 *           Set-Cookie:
 *             description: >-
 *               token=JWT; HttpOnly; SameSite=Lax; Secure em produção; validade de 8h. Enviado automaticamente
 *               pelo navegador; sem exemplo de credencial.
 *             schema:
 *               type: string
 *       '400':
 *         description: >-
 *           E-mail e senha são obrigatórios. JSON malformado ou corpo inválido para express.json (resposta
 *           padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: E-mail e senha são obrigatórios.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
 *       '401':
 *         description: E-mail ou senha inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: E-mail ou senha inválidos.
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
 *       '502':
 *         description: Resposta inválida do serviço de autenticação.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Resposta inválida do serviço de autenticação.
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 */
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

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Autenticação
 *     summary: Consultar sessão
 *     description: Retorna id, nome, email e role atual da conta. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_auth_me
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Sessão válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *               required:
 *                 - usuario
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
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
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 */
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

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Encerrar sessão
 *     description: >-
 *       Limpa o cookie token e registra LOGOUT. Sucesso: Logout realizado com sucesso! Requer sessão autenticada
 *       (cookie HttpOnly token).
 *     operationId: post_api_auth_logout
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Sessão encerrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             example:
 *               mensagem: Logout realizado com sucesso!
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não autenticado.
 *               '1':
 *                 value:
 *                   mensagem: Token não informado.
 *               '2':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '3':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '4':
 *                 value:
 *                   mensagem: Usuário não encontrado.
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
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 */
router.post('/logout', verificarAutenticacao, async (req, res) => {
    await registrarEventoAuditoria({
        usuarioId: req.usuario.id,
        acao: 'LOGOUT',
        ip: req.ip
    });

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

/**
 * @openapi
 * /api/auth/esqueci-senha:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Solicitar recuperação de senha
 *     description: >-
 *       Resposta genérica mesmo se a conta não existir; se existir, envia e-mail com link e token de 30 minutos.
 *       Sucesso: Se o e-mail estiver cadastrado, você receberá um link de recuperação.
 *     operationId: post_api_auth_esqueci_senha
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
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recuperacao'
 */
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

/**
 * @openapi
 * /api/auth/redefinir-senha:
 *   post:
 *     tags:
 *       - Autenticação
 *     summary: Redefinir senha
 *     description: >-
 *       Token deve existir, não ter expirado e ainda não ter sido utilizado. Nova senha com no mínimo 6
 *       caracteres. Sucesso: Senha redefinida com sucesso!
 *     operationId: post_api_auth_redefinir_senha
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
 *       '503':
 *         description: Serviço de autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Redefinicao'
 */
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