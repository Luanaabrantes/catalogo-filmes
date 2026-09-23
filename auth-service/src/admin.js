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

router.get('/usuarios', verificarAutenticacao, exigirAdmin('LISTAR_USUARIOS'), async (req, res) => {
    try {
        const [usuarios] = await db.execute('SELECT id, nome, email, role FROM usuarios ORDER BY nome ASC, id ASC');
        res.json({ usuarios: usuarios.map(({ id, nome, email, role }) => ({ id, nome, email, role })) });
    } catch {
        console.error('Erro ao listar usuários.');
        res.status(500).json({ mensagem: 'Erro interno do servidor.' });
    }
});

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
