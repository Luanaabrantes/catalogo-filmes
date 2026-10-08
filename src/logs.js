const express = require('express');
const verificarAutenticacao = require('./middlewareAuth');
const registrarEventoAuditoria = require('./auditoria');

const router = express.Router();

/**
 * @openapi
 * /api/logs:
 *   get:
 *     tags:
 *       - Auditoria
 *     summary: Consultar auditoria (admin)
 *     description: >-
 *       Somente admin. Encaminha apenas limit ao log-service; busca textual e filtros da interface ocorrem no
 *       navegador. Últimos N eventos apresentados em ordem cronológica dentro do lote. Tentativas não
 *       autorizadas geram ACAO_NEGADA. Requer sessão autenticada (cookie HttpOnly token).
 *     operationId: get_api_logs
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Eventos de auditoria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quantidade:
 *                   type: integer
 *                   minimum: 0
 *                 eventos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Evento'
 *               required:
 *                 - quantidade
 *                 - eventos
 *       '400':
 *         description: limit deve ser um inteiro entre 1 e 100.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: limit deve ser um inteiro entre 1 e 100.
 *       '401':
 *         description: >-
 *           Usuário não autenticado. / Token não informado. / Sessão inválida ou expirada. / Token com usuário
 *           inválido. / Usuário não encontrado. / Token não informado ou inválido.
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
 *               '5':
 *                 value:
 *                   mensagem: Token não informado ou inválido.
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
 *         description: >-
 *           Serviço de auditoria indisponível. / Serviço de auditoria temporariamente indisponível. / Serviço de
 *           autenticação indisponível.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mensagem'
 *             examples:
 *               '0':
 *                 value:
 *                   mensagem: Serviço de auditoria indisponível.
 *               '1':
 *                 value:
 *                   mensagem: Serviço de auditoria temporariamente indisponível.
 *               '2':
 *                 value:
 *                   mensagem: Serviço de autenticação indisponível.
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Uma única string decimal positiva, sem zeros à esquerda. Parâmetro repetido é rejeitado.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 */
router.get('/', verificarAutenticacao, async (req, res) => {
    if (req.usuario.role !== 'admin') {
        await registrarEventoAuditoria({
            usuarioId: req.usuario.id,
            acao: 'ACAO_NEGADA',
            ip: req.ip,
            detalhes: { recurso: 'CONSULTA_LOGS_ADMIN', motivo: 'role_insuficiente' }
        });
        return res.status(403).json({ mensagem: 'Acesso permitido somente a administradores.' });
    }

    try {
        const destino = new URL(`${process.env.LOG_SERVICE_URL}/eventos`);
        const parametros = new URL(req.originalUrl, 'http://catalogo').searchParams;
        for (const valor of parametros.getAll('limit')) {
            destino.searchParams.append('limit', valor);
        }
        const resposta = await fetch(destino, {
            headers: { Authorization: `Bearer ${req.cookies.token}` },
            signal: AbortSignal.timeout(2000)
        });
        if (![200, 400, 401, 403, 503].includes(resposta.status)) {
            throw new Error('Resposta inesperada da auditoria');
        }
        const dados = await resposta.json();
        return res.status(resposta.status).json(dados);
    } catch {
        console.error('Falha ao consultar serviço de auditoria.');
        return res.status(503).json({ mensagem: 'Serviço de auditoria indisponível.' });
    }
});

module.exports = router;
