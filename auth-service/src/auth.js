const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./database');
const registrarEventoAuditoria = require('./auditoria');

const verificarAutenticacao = require('./middlewareAuth');

const router = express.Router();

/**
 * @openapi
 * /auth/cadastro:
 *   post:
 *     tags:
 *       - Auth-service
 *     summary: Cadastrar usuário
 *     description: >-
 *       Cria conta com role usuario; qualquer role enviada é ignorada. Nome e e-mail normalizados com trim;
 *       e-mail lowercase. Proxy público existente: POST /api/auth/cadastro. Teste esse proxy em /apidocs, com
 *       cookie; ele não aceita Bearer do navegador.
 *     operationId: post_auth_cadastro
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Cadastro'
 *     x-public-proxy: POST /api/auth/cadastro
 */
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

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth-service
 *     summary: Autenticar usuário
 *     description: >-
 *       Senha comparada com bcryptjs. Retorna JWT válido por 8 horas. Proxy público existente: POST
 *       /api/auth/login. Teste esse proxy em /apidocs, com cookie; ele não aceita Bearer do navegador.
 *     operationId: post_auth_login
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
 *                 token:
 *                   type: string
 *                   description: JWT emitido pelo serviço; nenhum token é incluído nos exemplos.
 *                 usuario:
 *                   $ref: '#/components/schemas/Usuario'
 *               required:
 *                 - mensagem
 *                 - token
 *                 - usuario
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     x-public-proxy: POST /api/auth/login
 */
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

        await registrarEventoAuditoria({
            usuarioId: usuario.id,
            acao: 'LOGIN',
            ip: req.ip
        });

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

/**
 * @openapi
 * /auth/validar:
 *   get:
 *     tags:
 *       - Auth-service
 *     summary: Consultar sessão
 *     description: >-
 *       Retorna id, nome, email e role atual da conta. Requer Authorization: Bearer JWT e papel atual consultado
 *       no banco. Proxy público existente: GET /api/auth/me. Teste esse proxy em /apidocs, com cookie; ele não
 *       aceita Bearer do navegador.
 *     operationId: get_auth_validar
 *     security:
 *       - bearerAuth: []
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
 *           Token não informado. / Sessão inválida ou expirada. / Token com usuário inválido. / Usuário não
 *           encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Token não informado.
 *               '1':
 *                 value:
 *                   mensagem: Sessão inválida ou expirada.
 *               '2':
 *                 value:
 *                   mensagem: Token com usuário inválido.
 *               '3':
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
 *     x-public-proxy: GET /api/auth/me
 */
router.get('/validar', verificarAutenticacao, (req, res) => {
    res.json({ usuario: req.usuario });
});

module.exports = router;
