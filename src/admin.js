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

router.get('/usuarios', verificarAutenticacao, encaminhar('LISTAR_USUARIOS'));
router.patch('/usuarios/:id/role', verificarAutenticacao, encaminhar('ALTERAR_ROLE'));

module.exports = router;
