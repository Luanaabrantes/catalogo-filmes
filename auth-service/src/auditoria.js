async function registrarEventoAuditoria({ usuarioId, acao, ip, detalhes }) {
    try {
        const evento = { usuario_id: usuarioId, acao, ip };
        if (detalhes && Object.keys(detalhes).length > 0) {
            evento.detalhes = detalhes;
        }
        const resposta = await fetch(`${process.env.LOG_SERVICE_URL}/eventos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evento),
            signal: AbortSignal.timeout(2000)
        });
        if (!resposta.ok) throw new Error('Auditoria indisponível');
        await resposta.arrayBuffer();
    } catch {
        console.error('Falha ao registrar evento de auditoria.');
    }
}

module.exports = registrarEventoAuditoria;
