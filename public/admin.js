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
    if (['audit', 'overview'].includes(secao) && usuarioAutenticado && (!auditoriaCarregada || auditoriaDesatualizada) && !shell.hidden) carregarAuditoria();
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
const tabelaUsuarios = document.querySelector('#admin-users-content .admin-table-wrapper');
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

async function verificarAcessoResposta(resposta, origem = 'users') {
    if (resposta.status !== 401 && resposta.status !== 403) return true;
    fecharRole(true);
    fecharDetalhesEvento();
    definirMenu(false, false);
    shell.hidden = true;
    if (resposta.status === 401) { usuarioAutenticado = null; window.location.replace('/'); }
    else {
        toast('Seu acesso administrativo precisa ser validado novamente.', 'error');
        // Evita uma nova busca automática enquanto a sessão está sendo revalidada.
        await validarSessao();
        if (origem === 'users' && !usuariosCarregados && usuarioAutenticado) {
            statusUsuarios.textContent = 'Não foi possível carregar os usuários.';
            tentarUsuarios.hidden = false;
        }
        if (origem === 'audit' && !auditoriaCarregada && usuarioAutenticado) {
            statusAuditoria.textContent = 'Não foi possível carregar os eventos de auditoria.';
            tentarAuditoria.hidden = false;
            estadoVisaoGeral('error');
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
        if (dados.usuario.role !== alvo.role) { auditoriaDesatualizada = true; revisaoAuditoria++; }
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

// O array recebido é mantido em ordem cronológica; a exibição usa uma cópia invertida.
let eventosAuditoria = [];
let auditoriaCarregada = false;
let auditoriaDesatualizada = false;
let revisaoAuditoria = 0;
let ultimaAtualizacaoAuditoria = null;
let carregandoAuditoria = false;
let limiteCarregado = '50';
let origemDrawer = null;
const buscaAuditoria = document.getElementById('admin-audit-search');
const acaoAuditoria = document.getElementById('admin-audit-action');
const limiteAuditoria = document.getElementById('admin-audit-limit');
const atualizarAuditoria = document.getElementById('admin-audit-refresh');
const tentarAuditoria = document.getElementById('admin-audit-retry');
const statusAuditoria = document.getElementById('admin-audit-status');
const corpoAuditoria = document.getElementById('admin-audit-body');
const tabelaAuditoria = document.getElementById('admin-audit-table-wrapper');
const drawerAuditoria = document.getElementById('admin-audit-drawer');
const fecharAuditoria = document.getElementById('admin-audit-close');
const acoesAuditoria = {
    LOGIN: ['Login', 'login'], LOGOUT: ['Logout', 'neutral'],
    FILME_FAVORITADO: ['Filme favoritado', 'info'], FILME_DESFAVORITADO: ['Filme desfavoritado', 'info'],
    COMENTARIO_CRIADO: ['Comentário criado', 'info'], COMENTARIO_APAGADO: ['Comentário apagado', 'warning'],
    ACAO_NEGADA: ['Ação negada', 'security'], ROLE_ALTERADA: ['Papel alterado', 'role']
};
const camposAuditoria = {
    tmdb_movie_id: 'Filme TMDB', comentario_id: 'Comentário', proprietario_id: 'Proprietário',
    moderacao: 'Moderação', recurso: 'Recurso', motivo: 'Motivo', operacao: 'Operação',
    usuario_alvo_id: 'Usuário afetado', role_anterior: 'Papel anterior', role_nova: 'Novo papel'
};
const chavesSensiveis = new Set(['senha', 'password', 'senhahash', 'passwordhash', 'token', 'jwt', 'cookie', 'authorization', 'resettoken', 'accesstoken', 'refreshtoken']);
function protegerDetalhes(valor, nivel = 0) {
    if (nivel > 12) return '[estrutura extensa]';
    if (Array.isArray(valor)) return valor.map(item => protegerDetalhes(item, nivel + 1));
    if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor).map(([chave, conteudo]) => [chave,
            chavesSensiveis.has(chave.toLowerCase().replace(/[^a-z0-9]/g, ''))
                ? '[conteúdo protegido]' : protegerDetalhes(conteudo, nivel + 1)
        ]));
    }
    return valor;
}
const textoEvento = valor => ['string', 'number'].includes(typeof valor) && String(valor).length ? String(valor) : '—';
function dataEvento(timestamp) {
    if (typeof timestamp !== 'string' || !timestamp) return '—';
    const data = new Date(timestamp);
    if (!Number.isFinite(data.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}
function contextoEvento(evento) {
    const d = protegerDetalhes(evento.detalhes) || {};
    const partes = [];
    const adicionar = (prefixo, valor) => { if (textoEvento(valor) !== '—') partes.push(`${prefixo}${textoEvento(valor)}`); };
    if (['FILME_FAVORITADO', 'FILME_DESFAVORITADO'].includes(evento.acao)) adicionar('Filme TMDB #', d.tmdb_movie_id);
    if (['COMENTARIO_CRIADO', 'COMENTARIO_APAGADO'].includes(evento.acao)) {
        adicionar('Comentário #', d.comentario_id);
        if (evento.acao === 'COMENTARIO_CRIADO') adicionar('Filme TMDB #', d.tmdb_movie_id);
        if (d.moderacao === true) partes.push('Moderação');
    }
    if (evento.acao === 'ROLE_ALTERADA') {
        adicionar('Usuário #', d.usuario_alvo_id);
        if (['usuario', 'admin'].includes(d.role_anterior) && ['usuario', 'admin'].includes(d.role_nova)) partes.push(`${labelRole(d.role_anterior)} → ${labelRole(d.role_nova)}`);
    }
    if (evento.acao === 'ACAO_NEGADA') { adicionar('', d.recurso); adicionar('', d.operacao); }
    const texto = partes.join(' · ');
    return texto.length > 140 ? `${texto.slice(0, 137)}...` : texto || '—';
}
function renderizarAuditoria() {
    const termo = buscaAuditoria.value.trim().toLowerCase();
    const filtrados = [...eventosAuditoria].reverse().filter(evento => {
        if (acaoAuditoria.value && evento.acao !== acaoAuditoria.value) return false;
        const texto = [evento.usuario_id, evento.acao, evento.id, evento.ip, JSON.stringify(protegerDetalhes(evento.detalhes))].join(' ').toLowerCase();
        return texto.includes(termo);
    });
    corpoAuditoria.replaceChildren();
    tabelaAuditoria.hidden = !filtrados.length;
    statusAuditoria.textContent = !eventosAuditoria.length ? 'Nenhum evento de auditoria encontrado.' : !filtrados.length ? 'Nenhum evento corresponde aos filtros atuais.' : '';
    for (const evento of filtrados) {
        const linha = document.createElement('tr');
        const celula = texto => { const td = document.createElement('td'); td.textContent = texto; linha.append(td); return td; };
        celula(dataEvento(evento.timestamp));
        celula(textoEvento(evento.usuario_id) === '—' ? '—' : `#${evento.usuario_id}`);
        celula('').append(badgeEvento(evento));
        celula(contextoEvento(evento)); celula(textoEvento(evento.ip));
        const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'admin-action-button'; botao.textContent = 'Ver detalhes';
        botao.setAttribute('aria-label', `Ver detalhes do evento ${textoEvento(evento.id)}`);
        botao.addEventListener('click', () => abrirDetalhesEvento(evento, botao)); celula('').append(botao);
        corpoAuditoria.append(linha);
    }
}
async function carregarAuditoria() {
    if (carregandoAuditoria || !usuarioAutenticado || shell.hidden) return;
    const limite = limiteAuditoria.value;
    if (!['20', '50', '100'].includes(limite)) { limiteAuditoria.value = limiteCarregado; return; }
    const origemOverview = (secoes[window.location.hash] || 'overview') === 'overview';
    const revisaoConsulta = revisaoAuditoria;
    carregandoAuditoria = true;
    estadoVisaoGeral('loading');
    atualizarAuditoria.disabled = limiteAuditoria.disabled = tentarAuditoria.disabled = true;
    atualizarAuditoria.textContent = 'Atualizando...'; tentarAuditoria.hidden = true;
    if (!auditoriaCarregada) statusAuditoria.textContent = 'Carregando eventos...';
    try {
        const resposta = await fetch(`/api/logs?limit=${limite}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!await verificarAcessoResposta(resposta, 'audit')) return;
        const dados = await resposta.json();
        if (!resposta.ok) {
            const erro = new Error(resposta.status === 400 && typeof dados.mensagem === 'string' ? dados.mensagem : resposta.status === 503 ? 'Serviço de auditoria temporariamente indisponível.' : 'Não foi possível carregar os eventos de auditoria.');
            erro.mensagemSegura = true; throw erro;
        }
        if (!Array.isArray(dados.eventos) || !dados.eventos.every(e => e && typeof e === 'object' && !Array.isArray(e))) throw new Error('Resposta inválida');
        eventosAuditoria = dados.eventos;
        auditoriaCarregada = true; limiteCarregado = limite;
        auditoriaDesatualizada = revisaoConsulta !== revisaoAuditoria;
        ultimaAtualizacaoAuditoria = new Date().toISOString();
        renderizarAuditoria();
        renderizarVisaoGeral();
    } catch (erro) {
        if (!auditoriaCarregada) { statusAuditoria.textContent = 'Não foi possível carregar os eventos de auditoria.'; tentarAuditoria.hidden = false; }
        limiteAuditoria.value = limiteCarregado;
        estadoVisaoGeral('error');
        toast(origemOverview && auditoriaCarregada ? 'Não foi possível atualizar os dados.' : erro.mensagemSegura ? erro.message : 'Serviço de auditoria temporariamente indisponível.', 'error');
    } finally {
        carregandoAuditoria = false;
        atualizarOverview.disabled = tentarOverview.disabled = false;
        atualizarOverview.textContent = 'Atualizar';
        atualizarAuditoria.disabled = limiteAuditoria.disabled = tentarAuditoria.disabled = false;
        atualizarAuditoria.textContent = 'Atualizar';
    }
}
function valorDetalhe(chave, valor) {
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (['role_anterior', 'role_nova'].includes(chave) && ['usuario', 'admin'].includes(valor)) return labelRole(valor);
    if (valor && typeof valor === 'object') {
        const texto = JSON.stringify(valor);
        return texto.length > 500 ? `${texto.slice(0, 497)}...` : texto;
    }
    return textoEvento(valor);
}
function parDetalhe(container, chave, valor) {
    const linha = document.createElement('div'); linha.className = 'admin-audit-detail-row';
    const titulo = document.createElement('dt'); titulo.textContent = chave;
    const conteudo = document.createElement('dd'); conteudo.textContent = valor;
    linha.append(titulo, conteudo); container.append(linha);
}
function abrirDetalhesEvento(evento, botao) {
    if (modalRole.open) return;
    origemDrawer = botao;
    const resumo = document.getElementById('admin-audit-summary'); resumo.replaceChildren();
    for (const [chave, valor] of [
        ['Ação', textoEvento(evento.acao)], ['ID do evento', textoEvento(evento.id)],
        ['Usuário', textoEvento(evento.usuario_id) === '—' ? '—' : `#${evento.usuario_id}`],
        ['Data e hora', dataEvento(evento.timestamp)], ['IP', textoEvento(evento.ip)]
    ]) parDetalhe(resumo, chave, valor);
    const container = document.getElementById('admin-audit-details'); container.replaceChildren();
    const detalhes = protegerDetalhes(evento.detalhes);
    const entradas = detalhes && typeof detalhes === 'object' ? Object.entries(detalhes) : [];
    if (!entradas.length) parDetalhe(container, 'Detalhes', '—');
    for (const [chave, valor] of entradas) parDetalhe(container, Object.hasOwn(camposAuditoria, chave) ? camposAuditoria[chave] : chave.replaceAll('_', ' '), valorDetalhe(chave, valor));
    drawerAuditoria.showModal(); document.body.classList.add('admin-audit-open'); fecharAuditoria.focus();
}
function fecharDetalhesEvento() {
    if (!drawerAuditoria.open) return;
    drawerAuditoria.close(); document.body.classList.remove('admin-audit-open');
    (origemDrawer?.isConnected ? origemDrawer : atualizarAuditoria).focus();
}
fecharAuditoria.addEventListener('click', fecharDetalhesEvento);
drawerAuditoria.addEventListener('cancel', event => { event.preventDefault(); fecharDetalhesEvento(); });
drawerAuditoria.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); fecharAuditoria.focus(); } });
drawerAuditoria.addEventListener('click', event => {
    const rect = drawerAuditoria.getBoundingClientRect();
    if (event.target === drawerAuditoria && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) fecharDetalhesEvento();
});
for (const acao of Object.keys(acoesAuditoria)) acaoAuditoria.append(new Option(acao, acao));
buscaAuditoria.addEventListener('input', () => { if (auditoriaCarregada) renderizarAuditoria(); });
acaoAuditoria.addEventListener('change', () => { if (auditoriaCarregada) renderizarAuditoria(); });
limiteAuditoria.addEventListener('change', carregarAuditoria);
atualizarAuditoria.addEventListener('click', carregarAuditoria);
tentarAuditoria.addEventListener('click', carregarAuditoria);

const atualizarOverview = document.getElementById('admin-overview-refresh');
const tentarOverview = document.getElementById('admin-overview-retry');
const statusOverview = document.getElementById('admin-overview-status');
function estadoVisaoGeral(estado) {
    atualizarOverview.disabled = tentarOverview.disabled = estado === 'loading';
    atualizarOverview.textContent = estado === 'loading' ? 'Atualizando...' : 'Atualizar';
    document.getElementById('admin-overview-data').hidden = !auditoriaCarregada;
    tentarOverview.hidden = auditoriaCarregada || estado !== 'error';
    statusOverview.textContent = auditoriaCarregada ? '' : estado === 'error'
        ? 'Não foi possível carregar os dados administrativos.' : 'Carregando visão geral...';
}
function badgeEvento(evento) {
    const [label, tipo] = Object.hasOwn(acoesAuditoria, evento.acao) ? acoesAuditoria[evento.acao] : [textoEvento(evento.acao), 'neutral'];
    const badge = document.createElement('span');
    badge.className = `admin-event-badge admin-event-${tipo}`; badge.textContent = label;
    return badge;
}
function listaAtividades(container, eventos) {
    container.replaceChildren();
    for (const evento of eventos) {
        const item = document.createElement('li'); item.className = 'admin-recent-item';
        const main = document.createElement('div'); main.className = 'admin-recent-main';
        const cabecalho = document.createElement('div'); cabecalho.className = 'admin-recent-meta';
        const data = document.createElement('span'); data.textContent = dataEvento(evento.timestamp);
        cabecalho.append(data, badgeEvento(evento));
        const contexto = document.createElement('p');
        const usuario = textoEvento(evento.usuario_id) === '—' ? 'Usuário —' : `Usuário #${textoEvento(evento.usuario_id)}`;
        const resumo = contextoEvento(evento);
        contexto.textContent = resumo === '—' ? usuario : `${usuario} · ${resumo}`;
        main.append(cabecalho, contexto);
        const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'admin-action-button'; botao.textContent = 'Ver detalhes';
        botao.setAttribute('aria-label', `Ver detalhes do evento ${textoEvento(evento.id)}`);
        botao.addEventListener('click', () => abrirDetalhesEvento(evento, botao));
        item.append(main, botao); container.append(item);
    }
}
function renderizarVisaoGeral() {
    if (!auditoriaCarregada) return;
    const contar = acao => eventosAuditoria.filter(e => e.acao === acao).length;
    const negadas = contar('ACAO_NEGADA'); const alteracoes = contar('ROLE_ALTERADA');
    for (const [id, valor] of Object.entries({
        'admin-metric-events': eventosAuditoria.length, 'admin-metric-logins': contar('LOGIN'),
        'admin-metric-denied': negadas, 'admin-metric-roles': alteracoes,
        'admin-security-denied': negadas, 'admin-security-roles': alteracoes
    })) document.getElementById(id).textContent = valor;
    document.getElementById('admin-overview-window').textContent = `Baseado nos últimos ${limiteCarregado} eventos registrados.`;
    document.getElementById('admin-overview-updated').textContent = `Última atualização: ${dataEvento(ultimaAtualizacaoAuditoria)}`;
    const recentes = [...eventosAuditoria].reverse();
    const seguranca = recentes.filter(e => ['ACAO_NEGADA', 'ROLE_ALTERADA'].includes(e.acao)).slice(0, 3);
    listaAtividades(document.getElementById('admin-recent-list'), recentes.slice(0, 5));
    listaAtividades(document.getElementById('admin-security-list'), seguranca);
    document.getElementById('admin-recent-empty').hidden = recentes.length > 0;
    document.getElementById('admin-security-empty').hidden = seguranca.length > 0;
    estadoVisaoGeral('success');
}
function atualizarVisaoGeral() {
    if (carregandoAuditoria) return;
    limiteAuditoria.value = limiteCarregado;
    carregarAuditoria();
}
atualizarOverview.addEventListener('click', atualizarVisaoGeral);
tentarOverview.addEventListener('click', atualizarVisaoGeral);
validarSessao();
