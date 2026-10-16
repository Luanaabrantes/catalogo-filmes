const el = id => document.getElementById(id);
let perfil;
let carregando = false;
async function api(url, options = {}) {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000), ...options });
    if (r.status === 401) { window.location.replace('/'); throw new Error('Sua sessão expirou.'); }
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.mensagem || 'Não foi possível concluir. Tente novamente.');
    return dados;
}
function feedback(texto, erro = false) {
    el('statusEdicao').textContent = texto;
    el('statusEdicao').className = 'perfil-feedback ' + (erro ? 'mensagem-erro' : 'mensagem-sucesso');
}
function mostrarFoto(url) {
    el('fotoPerfil').hidden = true;
    el('iniciais').hidden = false;
    if (!url) return;
    el('fotoPerfil').onload = () => { el('fotoPerfil').hidden = false; el('iniciais').hidden = true; };
    el('fotoPerfil').onerror = () => feedback('A foto não pôde ser carregada. Tente atualizar a página.', true);
    el('fotoPerfil').src = url;
}
async function favoritos() {
    el('totalFavoritos').textContent = perfil.favoritos.length;
    el('favoritosPerfil').replaceChildren();
    if (!perfil.favoritos.length) {
        el('statusFavoritos').textContent = perfil.proprio ? 'Sua coleção começa com um favorito. Explore o catálogo e escolha um filme que marcou você.' : 'Este perfil ainda não tem filmes favoritos.';
        return;
    }
    try {
        const { filmes } = await api('/api/filmes');
        const porId = new Map(filmes.map(f => [Number(f.id), f]));
        let faltando = 0;
        for (const id of perfil.favoritos) {
            const filme = porId.get(Number(id));
            if (!filme) { faltando++; continue; }
            const card = document.createElement('article'); card.className = 'filme-card';
            if (filme.poster_url) {
                const img = document.createElement('img'); img.src = filme.poster_url; img.alt = `Pôster de ${filme.titulo}`; img.loading = 'lazy';
                img.onerror = () => { const vazio = document.createElement('div'); vazio.className = 'sem-poster'; vazio.textContent = 'Pôster indisponível'; img.replaceWith(vazio); };
                card.append(img);
            } else { const vazio = document.createElement('div'); vazio.className = 'sem-poster'; vazio.textContent = 'Pôster indisponível'; card.append(vazio); }
            const info = document.createElement('div'); info.className = 'filme-conteudo';
            const titulo = document.createElement('h3'); titulo.textContent = filme.titulo;
            const ano = document.createElement('p'); ano.className = 'ano'; ano.textContent = filme.data_lancamento?.slice(0, 4) || 'Ano não informado';
            const marca = document.createElement('span'); marca.className = 'perfil-favorito-marca'; marca.textContent = '♥ Favorito';
            info.append(titulo, ano, marca); card.append(info); el('favoritosPerfil').append(card);
        }
        el('statusFavoritos').textContent = faltando ? `${faltando} favorito(s) com informações temporariamente indisponíveis no catálogo.` : '';
    } catch { el('statusFavoritos').textContent = 'Não foi possível carregar os filmes favoritos. Atualize a página para tentar novamente.'; }
}
async function carregar() {
    if (carregando) return;
    carregando = true;
    el('conteudoPerfil').hidden = true; el('tentarNovamente').hidden = true;
    el('statusPerfil').textContent = 'Carregando perfil...';
    try {
        const id = new URLSearchParams(location.search).get('id');
        if (id !== null && !/^[1-9]\d*$/.test(id)) throw new Error('Perfil inválido.');
        ({ perfil } = await api('/api/perfil/' + (id || 'me')));
        el('perfilNome').textContent = perfil.nome;
        document.title = `${perfil.nome} | Catálogo de Filmes`;
        el('perfilBio').textContent = perfil.bio || 'Uma boa história ainda está por vir. Este perfil ainda não tem bio.';
        el('iniciais').textContent = perfil.nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
        el('acoesPerfil').hidden = !perfil.proprio;
        el('formBio').hidden = true;
        mostrarFoto(perfil.foto_url);
        el('conteudoPerfil').hidden = false; el('statusPerfil').textContent = '';
        await atualizarPremium();
        await favoritos();
    } catch (e) { el('statusPerfil').textContent = e.message; el('tentarNovamente').hidden = false; }
    finally { carregando = false; }
}
el('tentarNovamente').onclick = carregar;
el('editarBio').onclick = () => { el('bio').value = perfil.bio; el('contadorBio').textContent = `${perfil.bio.length} / 300`; el('formBio').hidden = false; el('bio').focus(); };
el('cancelarBio').onclick = () => { el('formBio').hidden = true; el('editarBio').focus(); };
el('bio').oninput = () => { el('contadorBio').textContent = `${el('bio').value.length} / 300`; };
el('formBio').onsubmit = async event => {
    event.preventDefault(); const botao = event.submitter; botao.disabled = true; feedback('Salvando bio...');
    try {
        const dados = await api(`/api/perfil/${perfil.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: el('bio').value }) });
        perfil.bio = dados.bio; el('perfilBio').textContent = dados.bio || 'Este perfil ainda não tem bio.'; el('formBio').hidden = true; feedback('Bio atualizada.'); el('editarBio').focus();
    } catch (e) { feedback(e.message, true); }
    finally { botao.disabled = false; }
};
el('trocarFoto').onclick = () => el('arquivoFoto').click();
el('arquivoFoto').onchange = async () => {
    const input = el('arquivoFoto'); const file = input.files[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { feedback('Escolha JPEG, PNG ou WebP de até 5 MB.', true); input.value = ''; return; }
    input.disabled = true; el('trocarFoto').disabled = true; el('acoesPerfil').classList.add('perfil-enviando'); feedback('Enviando foto...');
    try {
        const body = new FormData(); body.append('foto', file);
        const dados = await api(`/api/perfil/${perfil.id}/foto`, { method: 'POST', body });
        perfil.foto_url = dados.foto_url; mostrarFoto(dados.foto_url); feedback('Foto atualizada com sucesso.');
    } catch (e) { feedback(e.message, true); }
    finally { input.disabled = false; el('trocarFoto').disabled = false; input.value = ''; el('acoesPerfil').classList.remove('perfil-enviando'); }
};

async function atualizarPremium() {
    el('seloPremium').hidden = true;
    el('assinarPremium').hidden = true;
    el('planosPremium').hidden = !perfil?.proprio;
    if (!perfil?.proprio) return;
    try {
        const estado = await api('/api/premium/status');
        el('seloPremium').hidden = !estado.premium;
        el('assinarPremium').hidden = !estado.pode_assinar;
        el('planoAtual').textContent = estado.premium ? 'Premium' : 'Gratuito';
        el('planoGratuitoAtual').textContent = estado.premium ? 'Incluído no Premium' : 'Seu plano';
        el('cartaoGratuito').classList.toggle('perfil-plano-atual', !estado.premium);
        el('cartaoPremium').classList.toggle('perfil-plano-atual', estado.premium);
        el('resumoAssinatura').textContent = estado.plano + ' · ' +
            (estado.valor_centavos ? 'R$ 9,90/mês' : 'Grátis');
        el('situacaoAssinatura').textContent = estado.situacao;
        const linha = window.premiumApresentacao.linhaData(estado);
        el('dataAssinatura').hidden = !linha;
        el('dataAssinatura').textContent = linha;
        const retorno = new URLSearchParams(location.search).get('premium');
        el('statusPremium').textContent = estado.pagamento_pendente ?
            'Regularize o pagamento da sua assinatura no Stripe de testes. Um novo período só será liberado após confirmação do pagamento.' :
            estado.premium ? 'Seu acesso Premium está confirmado para o período pago.' :
            retorno === 'sucesso' ? 'Confirmação pendente. Aguarde o webhook e atualize a confirmação.' :
            retorno === 'cancelado' ? 'Checkout cancelado. Você pode tentar novamente.' : '';
        el('atualizarPremium').hidden = false;
    } catch (e) {
        el('statusPremium').textContent = e.message;
        el('dataAssinatura').hidden = true;
        el('atualizarPremium').hidden = false;
    }
}
el('atualizarPremium').onclick = atualizarPremium;
el('assinarPremium').onclick = async () => {
    el('assinarPremium').disabled = true;
    el('statusPremium').textContent = 'Abrindo checkout de teste...';
    try { const { url } = await api('/api/premium/checkout', { method: 'POST' }); window.location.assign(url); }
    catch (e) { el('statusPremium').textContent = e.message; }
    finally { el('assinarPremium').disabled = false; }
};
carregar();
