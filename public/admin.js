const shell = document.getElementById('admin-shell');
const statusPainel = document.getElementById('admin-status');
const mensagem = document.getElementById('admin-status-message');
const recovery = document.getElementById('admin-recovery');
let usuarioAutenticado = null;
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
    if (secao === 'users' && usuarioAutenticado && !usuariosCarregados && !shell.hidden) carregarUsuarios();
}

async function validarSessao() {
    usuarioAutenticado = null;
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
        usuarioAutenticado = dados.usuario;
        document.getElementById('admin-name').textContent = dados.usuario.nome;
        statusPainel.hidden = true;
        shell.hidden = false;
        navegar();
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

// Estado da seção Usuários permanece apenas na memória desta página.
let usuarios = [];
let usuariosCarregados = false;
let carregandoUsuarios = false;
let salvandoRole = false;
let usuarioAlvo = null;
let origemModal = null;
let toastTimer;
const buscaUsuarios = document.getElementById('admin-user-search');
const corpoUsuarios = document.getElementById('admin-users-body');
const tabelaUsuarios = document.querySelector('.admin-table-wrapper');
const statusUsuarios = document.getElementById('admin-users-status');
const atualizarUsuarios = document.getElementById('admin-users-refresh');
const tentarUsuarios = document.getElementById('admin-users-retry');
const modalRole = document.getElementById('admin-role-modal');
const selectRole = document.getElementById('admin-role-select');
const confirmarRole = document.getElementById('admin-role-confirm');
const erroRole = document.getElementById('admin-role-error');
const labelRole = role => role === 'admin' ? 'Administrador' : 'Usuário';

function toast(texto, tipo = 'success') {
    const regiao = document.getElementById('admin-toast-region');
    clearTimeout(toastTimer);
    const aviso = document.createElement('div');
    aviso.className = `admin-toast admin-toast-${tipo}`;
    aviso.textContent = texto;
    regiao.replaceChildren(aviso);
    toastTimer = setTimeout(() => regiao.replaceChildren(), 6000);
}

function renderizarUsuarios() {
    const termo = buscaUsuarios.value.trim().toLowerCase();
    const filtrados = usuarios.filter(u => u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo));
    corpoUsuarios.replaceChildren();
    tabelaUsuarios.hidden = filtrados.length === 0;
    statusUsuarios.textContent = !usuarios.length ? 'Nenhum usuário cadastrado.' : !filtrados.length ? 'Nenhum usuário encontrado para esta busca.' : '';
    for (const usuario of filtrados) {
        const linha = document.createElement('tr');
        const nome = document.createElement('td');
        nome.className = 'admin-user-name';
        nome.textContent = usuario.nome;
        const propriaConta = usuario.id === usuarioAutenticado.id;
        if (propriaConta) {
            const badge = document.createElement('span');
            badge.className = 'admin-you-badge'; badge.textContent = 'Você'; nome.append(badge);
        }
        const email = document.createElement('td'); email.textContent = usuario.email;
        const papel = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `admin-role ${usuario.role === 'admin' ? 'admin-role-admin' : 'admin-role-user'}`;
        badge.textContent = labelRole(usuario.role); papel.append(badge);
        const acoes = document.createElement('td');
        if (propriaConta) acoes.textContent = 'Sua conta';
        else {
            const botao = document.createElement('button');
            botao.type = 'button'; botao.className = 'admin-action-button'; botao.textContent = 'Alterar papel';
            botao.dataset.usuarioId = usuario.id;
            botao.setAttribute('aria-label', `Alterar papel de ${usuario.nome}`);
            botao.disabled = carregandoUsuarios || salvandoRole;
            botao.addEventListener('click', () => abrirRole(usuario, botao)); acoes.append(botao);
        }
        linha.append(nome, email, papel, acoes); corpoUsuarios.append(linha);
    }
}

function atualizarBotoesUsuarios() {
    atualizarUsuarios.disabled = carregandoUsuarios || salvandoRole;
    atualizarUsuarios.textContent = carregandoUsuarios ? 'Atualizando...' : 'Atualizar';
    tentarUsuarios.disabled = carregandoUsuarios;
    corpoUsuarios.querySelectorAll('button').forEach(b => { b.disabled = carregandoUsuarios || salvandoRole; });
}

async function verificarAcessoResposta(resposta) {
    if (resposta.status !== 401 && resposta.status !== 403) return true;
    fecharRole(true);
    definirMenu(false, false);
    shell.hidden = true;
    if (resposta.status === 401) { usuarioAutenticado = null; window.location.replace('/'); }
    else {
        toast('Seu acesso administrativo precisa ser validado novamente.', 'error');
        // Evita uma nova busca automática enquanto a sessão está sendo revalidada.
        await validarSessao();
        if (!usuariosCarregados && usuarioAutenticado) {
            statusUsuarios.textContent = 'Não foi possível carregar os usuários.';
            tentarUsuarios.hidden = false;
        }
    }
    return false;
}

function mensagemErro(status, dados) {
    if ((status === 400 || status === 409) && typeof dados?.mensagem === 'string') return dados.mensagem;
    if (status === 503) return 'Serviço de usuários temporariamente indisponível. Tente novamente.';
    return 'Não foi possível concluir a operação.';
}

async function carregarUsuarios() {
    if (carregandoUsuarios || salvandoRole || !usuarioAutenticado || shell.hidden) return;
    carregandoUsuarios = true;
    tentarUsuarios.hidden = true;
    atualizarBotoesUsuarios();
    if (!usuariosCarregados) statusUsuarios.textContent = 'Carregando usuários...';
    try {
        const resposta = await fetch('/api/admin/usuarios', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!await verificarAcessoResposta(resposta)) return;
        const dados = await resposta.json();
        if (!resposta.ok) {
            const erro = new Error(mensagemErro(resposta.status, dados));
            erro.mensagemSegura = true;
            throw erro;
        }
        if (!Array.isArray(dados.usuarios) || !dados.usuarios.every(u => Number.isInteger(u.id) && typeof u.nome === 'string' && typeof u.email === 'string' && ['admin', 'usuario'].includes(u.role))) throw new Error('Não foi possível concluir a operação.');
        usuarios = dados.usuarios;
        usuariosCarregados = true;
        renderizarUsuarios();
    } catch (erro) {
        const texto = erro.name === 'TimeoutError' || erro.name === 'TypeError' ? 'Serviço de usuários temporariamente indisponível. Tente novamente.' : 'Não foi possível concluir a operação.';
        if (!usuariosCarregados) {
            statusUsuarios.textContent = 'Não foi possível carregar os usuários.';
            tentarUsuarios.hidden = false;
        }
        toast(erro.mensagemSegura ? erro.message : texto, 'error');
    } finally {
        carregandoUsuarios = false;
        atualizarBotoesUsuarios();
    }
}

function abrirRole(usuario, botao) {
    if (usuario.id === usuarioAutenticado.id || carregandoUsuarios || salvandoRole) return;
    usuarioAlvo = usuario; origemModal = botao;
    document.getElementById('admin-role-name').textContent = usuario.nome;
    document.getElementById('admin-role-email').textContent = usuario.email;
    document.getElementById('admin-role-current').textContent = labelRole(usuario.role);
    const novo = usuario.role === 'admin' ? 'usuario' : 'admin';
    selectRole.replaceChildren(new Option(labelRole(novo), novo));
    document.getElementById('admin-role-impact').textContent = novo === 'admin'
        ? 'Este usuário passará a ter acesso às funções administrativas da plataforma.'
        : 'Este usuário perderá o acesso às funções administrativas da plataforma.';
    erroRole.hidden = true;
    modalRole.showModal();
    document.body.classList.add('admin-modal-open');
    document.getElementById('admin-role-cancel').focus();
}

function fecharRole(forcar = false) {
    if (salvandoRole && !forcar) return;
    modalRole.close();
    document.body.classList.remove('admin-modal-open');
    // Após renderização, o botão original pode ter sido substituído.
    const destino = origemModal?.isConnected ? origemModal : corpoUsuarios.querySelector(`[data-usuario-id="${usuarioAlvo?.id}"]`);
    (destino || atualizarUsuarios).focus();
    usuarioAlvo = null;
}
modalRole.addEventListener('cancel', event => { event.preventDefault(); fecharRole(); });
document.getElementById('admin-role-close').addEventListener('click', () => fecharRole());
document.getElementById('admin-role-cancel').addEventListener('click', () => fecharRole());
modalRole.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const itens = [...modalRole.querySelectorAll('button:not(:disabled), select:not(:disabled)')];
    if (!itens.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === itens[0]) { event.preventDefault(); itens.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === itens.at(-1)) { event.preventDefault(); itens[0].focus(); }
});
document.getElementById('admin-role-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (salvandoRole || !usuarioAlvo) return;
    const alvo = usuarioAlvo;
    salvandoRole = true;
    modalRole.querySelectorAll('button, select').forEach(e => { e.disabled = true; });
    confirmarRole.textContent = 'Salvando...';
    erroRole.hidden = true;
    atualizarBotoesUsuarios();
    try {
        const resposta = await fetch(`/api/admin/usuarios/${encodeURIComponent(alvo.id)}/role`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: selectRole.value }), signal: AbortSignal.timeout(10000)
        });
        if (!await verificarAcessoResposta(resposta)) return;
        const dados = await resposta.json();
        if (resposta.status === 404) {
            salvandoRole = false;
            fecharRole(); toast('Este usuário não foi encontrado.', 'error');
            await carregarUsuarios(); return;
        }
        if (!resposta.ok) {
            erroRole.textContent = mensagemErro(resposta.status, dados); erroRole.hidden = false; return;
        }
        if (dados.usuario?.id !== alvo.id || !['usuario', 'admin'].includes(dados.usuario.role)) throw new Error('Resposta inválida');
        usuarios = usuarios.map(u => u.id === alvo.id ? { ...u, role: dados.usuario.role } : u);
        salvandoRole = false;
        renderizarUsuarios(); fecharRole();
        toast(`Papel de ${alvo.nome} atualizado para ${labelRole(dados.usuario.role)}.`);
    } catch (erro) {
        erroRole.textContent = erro.name === 'TimeoutError' || erro.name === 'TypeError'
            ? 'Serviço de usuários temporariamente indisponível. Tente novamente.' : 'Não foi possível concluir a operação.';
        erroRole.hidden = false;
    } finally {
        salvandoRole = false;
        modalRole.querySelectorAll('button, select').forEach(e => { e.disabled = false; });
        confirmarRole.textContent = 'Confirmar alteração';
        atualizarBotoesUsuarios();
    }
});
buscaUsuarios.addEventListener('input', () => { if (usuariosCarregados) renderizarUsuarios(); });
atualizarUsuarios.addEventListener('click', carregarUsuarios);
tentarUsuarios.addEventListener('click', carregarUsuarios);
validarSessao();
