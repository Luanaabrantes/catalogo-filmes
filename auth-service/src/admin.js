const express = require('express');
const db = require('./database');
const verificarAutenticacao = require('./middlewareAuth');
const registrarEventoAuditoria = require('./auditoria');
const { alterarRole, ErroGestao } = require('./gestaoUsuarios');

const router = express.Router();

async function registrarNegacao(req, operacao) {
    await registrarEventoAuditoria({
        usuarioId: req.usuario.id,
        acao: 'ACAO_NEGADA',
        ip: req.ip,
        detalhes: { recurso: 'GESTAO_USUARIOS', operacao, motivo: 'role_insuficiente' }
    });
}

function exigirAdmin(operacao) {
    return async (req, res, next) => {
        if (req.usuario.role !== 'admin') {
            await registrarNegacao(req, operacao);
            return res.status(403).json({ mensagem: 'Acesso permitido somente a administradores.' });
        }
        next();
    };
}

/**
 * @openapi
 * /auth/admin/usuarios:
 *   get:
 *     tags:
 *       - Auth-service
 *     summary: Listar usuários (admin)
 *     description: >-
 *       Exige role admin; retorna somente id, nome, email e role, em ordem de nome e id. Requer Authorization:
 *       Bearer JWT e papel atual consultado no banco. Proxy público existente: GET /api/admin/usuarios. Teste
 *       esse proxy em /apidocs, com cookie; ele não aceita Bearer do navegador.
 *     operationId: get_auth_admin_usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuarios:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *               required:
 *                 - usuarios
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
 *       '403':
 *         description: Acesso permitido somente a administradores.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Acesso permitido somente a administradores.
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
 *     x-public-proxy: GET /api/admin/usuarios
 */
router.get('/usuarios', verificarAutenticacao, exigirAdmin('LISTAR_USUARIOS'), async (req, res) => {
    try {
        const [usuarios] = await db.execute('SELECT id, nome, email, role FROM usuarios ORDER BY nome ASC, id ASC');
        res.json({ usuarios: usuarios.map(({ id, nome, email, role }) => ({ id, nome, email, role })) });
    } catch {
        console.error('Erro ao listar usuários.');
        res.status(500).json({ mensagem: 'Erro interno do servidor.' });
    }
});

/**
 * @openapi
 * /auth/admin/usuarios/{id}/role:
 *   patch:
 *     tags:
 *       - Auth-service
 *     summary: Alterar papel (admin)
 *     description: >-
 *       Exige admin atual no banco; ID em dígitos decimais positivos e Number.isSafeInteger. Não permite alterar
 *       o próprio papel nem remover o último admin. Mensagem: Papel do usuário atualizado com sucesso. ou
 *       Usuário já possui o papel solicitado. Requer Authorization: Bearer JWT e papel atual consultado no
 *       banco. Proxy público existente: PATCH /api/admin/usuarios/{id}/role. Teste esse proxy em /apidocs, com
 *       cookie; ele não aceita Bearer do navegador.
 *     operationId: patch_auth_admin_usuarios_id_role
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Papel alterado ou já atribuído
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
 *       '400':
 *         description: >-
 *           ID do usuário inválido. / Role deve ser usuario ou admin. JSON malformado ou corpo inválido para
 *           express.json (resposta padrão HTML do Express).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: ID do usuário inválido.
 *               '1':
 *                 value:
 *                   mensagem: Role deve ser usuario ou admin.
 *           text/html:
 *             schema:
 *               type: string
 *               description: Página padrão de erro do Express; corpo depende do ambiente.
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
 *       '403':
 *         description: Acesso permitido somente a administradores.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Acesso permitido somente a administradores.
 *       '404':
 *         description: Usuário não encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Usuário não encontrado.
 *       '409':
 *         description: >-
 *           Não é possível remover o papel do último administrador do sistema. / Não é permitido alterar o
 *           próprio papel administrativo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Não é possível remover o papel do último administrador do sistema.
 *               '1':
 *                 value:
 *                   mensagem: Não é permitido alterar o próprio papel administrativo.
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
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Dígitos decimais sem zeros à esquerda; inteiro positivo seguro JavaScript.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Role'
 *     x-public-proxy: PATCH /api/admin/usuarios/{id}/role
 */
router.patch('/usuarios/:id/role', verificarAutenticacao, exigirAdmin('ALTERAR_ROLE'), async (req, res) => {
    const id = Number(req.params.id);
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id)) {
        return res.status(400).json({ mensagem: 'ID do usuário inválido.' });
    }
    const role = req.body?.role;
    if (role !== 'usuario' && role !== 'admin') {
        return res.status(400).json({ mensagem: 'Role deve ser usuario ou admin.' });
    }
    try {
        const resultado = await alterarRole(req.usuario.id, id, role);
        // A transação e a conexão já foram encerradas antes de chamar HTTP.
        if (resultado.alterado) {
            await registrarEventoAuditoria({
                usuarioId: req.usuario.id,
                acao: 'ROLE_ALTERADA',
                ip: req.ip,
                detalhes: { usuario_alvo_id: id, role_anterior: resultado.roleAnterior, role_nova: role }
            });
        }
        res.json({
            mensagem: resultado.alterado ? 'Papel do usuário atualizado com sucesso.' : 'Usuário já possui o papel solicitado.',
            usuario: resultado.usuario
        });
    } catch (erro) {
        if (erro instanceof ErroGestao) {
            if (erro.status === 403) await registrarNegacao(req, 'ALTERAR_ROLE');
            return res.status(erro.status).json({ mensagem: erro.message });
        }
        console.error('Erro ao alterar papel do usuário.');
        res.status(500).json({ mensagem: 'Erro interno do servidor.' });
    }
});

module.exports = router;
