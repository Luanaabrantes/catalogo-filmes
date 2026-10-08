const { Registry, Counter, Histogram } = require('prom-client');
const { METHODS } = require('node:http');
function criarMetricas({ rotas = [] } = {}) {
    // Também identifica o contrato quando um middleware de autenticação encerra a resposta
    // antes de o Express preencher req.route. O label continua sendo o template fixo.
    const templates = rotas.map(([metodo, caminho]) => {
        const rota = caminho.replace(/\{([^}]+)\}/g, ':$1');
        const pattern = rota.split('/').map(p => p.startsWith(':') ? '[^/]+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/');
        return { metodo: metodo.toUpperCase(), rota, regex: new RegExp('^'+pattern+'/?$') };
    });
    const registry = new Registry();
    const labels = ['metodo', 'rota', 'status'];
    const total = new Counter({ name: 'http_requisicoes_total', help: 'Requisições HTTP concluídas ou interrompidas.', labelNames: labels, registers: [registry] });
    const duration = new Histogram({ name: 'http_requisicao_duracao_segundos', help: 'Duração das requisições HTTP.', labelNames: labels, buckets: [0.005, 0.025, 0.1, 0.5, 1, 2, 5], registers: [registry] });
    function middleware(req, res, next) {
        const inicio = process.hrtime.bigint();
        let registrado = false;
        const registrar = () => {
            if (registrado) return;
            registrado = true;
            // Nunca usa URL, query, IDs, usuário, cookie ou mensagens de erro como labels.
            let pathname = '';
            try { pathname = new URL(req.originalUrl, 'http://local').pathname; } catch {}
            const contrato = templates.find(t => t.metodo === req.method && t.regex.test(pathname));
            const rota = typeof req.route?.path === 'string' ? req.baseUrl + req.route.path : contrato?.rota || '/nao-mapeada';
            const valores = { metodo: METHODS.includes(req.method) ? req.method : 'OUTRO', rota,
                status: String(res.writableFinished ? res.statusCode : 499) };
            total.inc(valores);
            duration.observe(valores, Number(process.hrtime.bigint() - inicio) / 1e9);
        };
        res.once('finish', registrar);
        res.once('close', registrar);
        next();
    }
    async function endpoint(req, res, next) {
        try { res.type(registry.contentType).send(await registry.metrics()); } catch (e) { next(e); }
    }
    return { registry, middleware, endpoint };
}
module.exports = { criarMetricas };
