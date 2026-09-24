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

window.addEventListener('hashchange', () => {
    definirMenu(false, false);
    navegar(!shell.hidden);
});
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

// O drawer mantém o foco dentro do menu e impede interação com o conteúdo ao fundo.
const menuMobile = window.matchMedia('(max-width: 1024px)');
const sidebar = document.getElementById('admin-sidebar');
const menuToggle = document.getElementById('admin-menu-toggle');
const menuClose = document.getElementById('admin-menu-close');
const overlay = document.getElementById('admin-overlay');
const main = document.querySelector('.admin-main');
let menuAberto = false;

function definirMenu(aberto, devolverFoco = true) {
    menuAberto = aberto && menuMobile.matches && !shell.hidden;
    document.body.classList.toggle('admin-menu-open', menuAberto);
    overlay.hidden = !menuAberto;
    menuToggle.setAttribute('aria-expanded', String(menuAberto));
    sidebar.inert = menuMobile.matches && !menuAberto;
    main.inert = menuAberto;
    if (menuAberto) menuClose.focus();
    else if (devolverFoco && menuMobile.matches) menuToggle.focus();
}
menuToggle.addEventListener('click', () => definirMenu(true));
menuClose.addEventListener('click', () => definirMenu(false));
overlay.addEventListener('click', () => definirMenu(false));
document.querySelectorAll('.admin-nav-item').forEach(link => {
    link.addEventListener('click', () => {
        if (menuAberto) definirMenu(false);
    });
});
document.addEventListener('keydown', event => {
    if (!menuAberto) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        definirMenu(false);
    } else if (event.key === 'Tab') {
        const itens = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')];
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (event.shiftKey && document.activeElement === primeiro) {
            event.preventDefault(); ultimo.focus();
        } else if (!event.shiftKey && document.activeElement === ultimo) {
            event.preventDefault(); primeiro.focus();
        }
    }
});
menuMobile.addEventListener('change', () => {
    const focoNoMenu = sidebar.contains(document.activeElement);
    definirMenu(false, focoNoMenu);
});
definirMenu(false, false);
