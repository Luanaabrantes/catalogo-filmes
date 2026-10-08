/**
 * @openapi
 * components:
 *   schemas:
 *     Saude:
 *       type: object
 *       required: [servico, status]
 *       properties:
 *         servico:
 *           type: string
 *         status:
 *           type: string
 *           enum: [ok, indisponivel]
 *         dependencias:
 *           type: object
 *           additionalProperties:
 *             type: string
 *             enum: [ok, indisponivel]
 */
// Probes limitados e respostas públicas sem mensagens das dependências.
function limitar(probe, ms = 2000) {
    let timer;
    return Promise.race([Promise.resolve().then(probe), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('indisponivel')), ms);
    })]).finally(() => clearTimeout(timer));
}
function readiness(servico, probes) {
    return async (req, res) => {
        const dependencias = Object.fromEntries(await Promise.all(Object.entries(probes).map(async ([nome, probe]) => {
            try { await limitar(probe); return [nome, 'ok']; } catch { return [nome, 'indisponivel']; }
        })));
        const ok = Object.values(dependencias).every(v => v === 'ok');
        res.status(ok ? 200 : 503).json({ servico, status: ok ? 'ok' : 'indisponivel', dependencias });
    };
}
async function http(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(1800), redirect: 'error' });
    await response.body?.cancel();
    if (!response.ok) throw new Error('indisponivel');
}
module.exports = { limitar, readiness, http };
