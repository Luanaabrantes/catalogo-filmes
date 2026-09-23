const db = require('./database');

class ErroGestao extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

async function alterarRole(administradorId, usuarioId, role) {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        // Ordem única de bloqueio para todas as mudanças de role. No porte deste
        // projeto, bloquear os usuários simplifica a proteção contra rebaixamentos
        // cruzados; inclui o executor, o alvo e todos os administradores.
        const [usuarios] = await conexao.execute(
            'SELECT id, nome, email, role FROM usuarios ORDER BY id ASC FOR UPDATE'
        );
        const administrador = usuarios.find(u => u.id === administradorId);
        if (!administrador) throw new ErroGestao(401, 'Usuário não encontrado.');
        if (administrador.role !== 'admin') {
            throw new ErroGestao(403, 'Acesso permitido somente a administradores.');
        }
        const usuario = usuarios.find(u => u.id === usuarioId);
        if (!usuario) throw new ErroGestao(404, 'Usuário não encontrado.');
        if (usuario.role === 'admin' && role === 'usuario' && usuarios.filter(u => u.role === 'admin').length <= 1) {
            throw new ErroGestao(409, 'Não é possível remover o papel do último administrador do sistema.');
        }
        if (administradorId === usuarioId) {
            throw new ErroGestao(409, 'Não é permitido alterar o próprio papel administrativo.');
        }
        const roleAnterior = usuario.role;
        const alterado = roleAnterior !== role;
        if (alterado) {
            await conexao.execute('UPDATE usuarios SET role = ? WHERE id = ?', [role, usuarioId]);
        }
        await conexao.commit();
        return {
            alterado,
            roleAnterior,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role }
        };
    } catch (erro) {
        await conexao.rollback();
        throw erro;
    } finally {
        conexao.release();
    }
}

module.exports = { alterarRole, ErroGestao };
