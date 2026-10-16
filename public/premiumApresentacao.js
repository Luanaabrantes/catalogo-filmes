/* Datas reais enviadas pelo backend; nenhuma estimativa no navegador. */
(function(root) {
    function data(valor) {
        if (typeof valor !== 'string' || !valor) return '';
        const date = new Date(valor);
        return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date) : '';
    }
    function linhaData(estado) {
        if (!estado.premium) return '';
        const fim = data(estado.termina_em);
        if (fim) return 'Seu acesso Premium termina em ' + fim;
        const renovar = data(estado.renovacao_em);
        return renovar ? 'Próxima renovação: ' + renovar : '';
    }
    const api = { data, linhaData };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.premiumApresentacao = api;
})(globalThis);
