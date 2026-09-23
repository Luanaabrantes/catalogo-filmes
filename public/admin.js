const shell = document.getElementById('admin-shell');
const statusPainel = document.getElementById('admin-status');
const mensagem = document.getElementById('admin-status-message');
const recovery = document.getElementById('admin-recovery');
const secoes = { '#overview': 'overview', '#auditoria': 'audit', '#usuarios': 'users' };

function navegar(focar = false) {
    const secao = secoes[window.location.hash] || 'overview';
    if (!Object.hasOwn(secoes, window.location.hash)) history.replaceState(null, '', '#overview');
    document.querySelectorAll('[data-section]').forEach(elemento => {
        elemento.hidden = elemento.dataset.section !== secao;
        if (!elemento.hidden && focar) elemento.querySelector('h1').focus();
    });
    document.querySelectorAll('.admin-nav-item').forEach(link => {
        const ativo = link.dataset.target === secao;
        link.classList.toggle('active', ativo);
        if (ativo) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

async function validarSessao() {
    shell.hidden = true;
    statusPainel.hidden = false;
    recovery.hidden = true;
    mensagem.textContent = 'Carregando painel...';
    try {
        const resposta = await fetch('/api/auth/me', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
        if (resposta.status === 401) return window.location.replace('/');
        if (!resposta.ok) throw new Error('Sessão indisponível');
        const dados = await resposta.json();
        if (!dados.usuario || typeof dados.usuario.role !== 'string') throw new Error('Sessão inválida');
        if (dados.usuario.role !== 'admin') return window.location.replace('/catalogo.html');
        document.getElementById('admin-name').textContent = dados.usuario.nome;
        navegar();
        statusPainel.hidden = true;
        shell.hidden = false;
    } catch {
        mensagem.textContent = 'Não foi possível validar sua sessão no momento.';
        recovery.hidden = false;
    }
}

window.addEventListener('hashchange', () => navegar(!shell.hidden));
document.getElementById('admin-retry').addEventListener('click', validarSessao);
document.getElementById('admin-logout').addEventListener('click', async event => {
    const botao = event.currentTarget;
    const erro = document.getElementById('admin-logout-error');
    botao.disabled = true;
    erro.hidden = true;
    try {
        const resposta = await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(10000) });
        if (!resposta.ok && resposta.status !== 401) throw new Error('Logout indisponível');
        window.location.replace('/');
    } catch {
        erro.textContent = 'Não foi possível sair. Tente novamente.';
        erro.hidden = false;
        botao.disabled = false;
    }
});
validarSessao();
