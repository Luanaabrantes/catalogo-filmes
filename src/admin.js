const express = require('express');
const verificarAutenticacao = require('./middlewareAuth');
const registrarEventoAuditoria = require('./auditoria');

const router = express.Router();

function encaminhar(operacao) {
    return async (req, res) => {
        if (req.usuario.role !== 'admin') {
            await registrarEventoAuditoria({
                usuarioId: req.usuario.id,
                acao: 'ACAO_NEGADA',
                ip: req.ip,
                detalhes: { recurso: 'GESTAO_USUARIOS', operacao, motivo: 'role_insuficiente' }
            });
            return res.status(403).json({ mensagem: 'Acesso permitido somente a administradores.' });
        }

        try {
            const alterar = operacao === 'ALTERAR_ROLE';
            const caminho = alterar ? `/usuarios/${encodeURIComponent(req.params.id)}/role` : '/usuarios';
            const resposta = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/admin${caminho}`, {
                method: alterar ? 'PATCH' : 'GET',
                headers: {
                    Authorization: `Bearer ${req.cookies.token}`,
                    ...(alterar ? { 'Content-Type': 'application/json' } : {})
                },
                ...(alterar ? { body: JSON.stringify({ role: req.body?.role }) } : {}),
                signal: AbortSignal.timeout(2000)
            });
            if (![200, 400, 401, 403, 404, 409, 500, 503].includes(resposta.status)) {
                throw new Error('Resposta inesperada do serviço de autenticação');
            }
            const dados = await resposta.json();
            return res.status(resposta.status).json(dados);
        } catch {
            console.error('Falha ao consultar gestão de usuários no auth-service.');
            return res.status(503).json({ mensagem: 'Serviço de autenticação indisponível.' });
        }
    };
}

/**
 * @openapi
 * /api/admin/usuarios:
 *   get:
 *     tags:
 *       - Administração
 *     summary: Listar usuários (admin)
 *     description: >-
 *       Exige role admin; retorna somente id, nome, email e role, em ordem de nome e id. Requer sessão
 *       autenticada (cookie HttpOnly token).
 *     operationId: get_api_admin_usuarios
 *     security:
 *       - sessao: []
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
router.get('/usuarios', verificarAutenticacao, encaminhar('LISTAR_USUARIOS'));
/**
 * @openapi
 * /api/admin/usuarios/{id}/role:
 *   patch:
 *     tags:
 *       - Administração
 *     summary: Alterar papel (admin)
 *     description: >-
 *       Exige admin atual no banco; ID em dígitos decimais positivos e Number.isSafeInteger. Não permite alterar
 *       o próprio papel nem remover o último admin. Mensagem: Papel do usuário atualizado com sucesso. ou
 *       Usuário já possui o papel solicitado. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: patch_api_admin_usuarios_id_role
 *     security:
 *       - sessao: []
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
 */
router.patch('/usuarios/:id/role', verificarAutenticacao, encaminhar('ALTERAR_ROLE'));

module.exports = router;
