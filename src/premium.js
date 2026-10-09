const express = require('express');
/**
 * @openapi
 * /api/premium/status:
 *   get:
 *     tags: [Premium]
 *     summary: Consultar benefício Premium confirmado pelo backend
 *     operationId: get_api_premium_status
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: Estado calculado no backend por período pago válido, vínculos e preço; sem consulta Stripe por requisição. Sempre usuário da sessão; ignora IDs enviados pelo navegador.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [premium, status, plano, valor_centavos, situacao, pagamento_pendente, cancelamento_programado, renovacao_em, termina_em, pode_assinar]
 *               properties:
 *                 premium:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 plano:
 *                   type: string
 *                   enum: [Gratuito, Premium]
 *                 valor_centavos:
 *                   type: integer
 *                   enum: [0, 990]
 *                 situacao:
 *                   type: string
 *                 pagamento_pendente:
 *                   type: boolean
 *                 cancelamento_programado:
 *                   type: boolean
 *                 renovacao_em:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 termina_em:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 pode_assinar:
 *                   type: boolean
 *       '401':
 *         description: Sessão ausente ou inválida
 *       '503':
 *         description: Banco, migração ou autenticação indisponível
 * /api/premium/checkout:
 *   post:
 *     tags: [Premium]
 *     summary: Abrir assinatura Stripe exclusivamente de teste por R$ 9,90/mês
 *     operationId: post_api_premium_checkout
 *     description: Usuário, cliente, preço e URLs definidos no backend. Reutiliza checkout aberto; impede outra assinatura ativa ou pendente. Não recebe identificadores do navegador.
 *     security:
 *       - sessao: []
 *     responses:
 *       '200':
 *         description: URL do Checkout de teste
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [url]
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *       '400':
 *         description: Objeto Stripe fora do modo de teste
 *       '401':
 *         description: Sessão ausente ou inválida
 *       '409':
 *         description: Assinatura existente ou checkout aguardando confirmação
 *       '503':
 *         description: Stripe não configurado, configuração de produção rejeitada ou dependência indisponível
 * /api/stripe/webhook:
 *   post:
 *     tags: [Premium]
 *     summary: Receber webhook Stripe assinado de teste
 *     operationId: post_api_stripe_webhook
 *     security: []
 *     description: Corpo bruto validado pelo SDK. invoice.paid confirma pagamento, vínculos e período da linha da fatura; eventos da assinatura atualizam situação sem comprovar pagamento. Acesso expira por data mesmo sem webhook; período pago é monotônico e status tem marca temporal. Registro persistente transacional e idempotente, sem payload. Falha 503 permite reenvio.
 *     parameters:
 *       - in: header
 *         name: Stripe-Signature
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Evento snapshot Stripe; assinado sobre os bytes originais
 *     responses:
 *       '200':
 *         description: Evento processado, repetido ou sem relação com esta integração
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recebido:
 *                   type: boolean
 *       '400':
 *         description: Assinatura ausente ou inválida, corpo não bruto ou livemode true
 *       '413':
 *         description: Corpo acima de 1 MiB
 *       '415':
 *         description: Codificação ou charset não suportado
 *       '503':
 *         description: Webhook não configurado ou processamento não concluído; reenviar
 */
const Stripe = require('stripe');
const { id, subscriptionId, epoch, periodoPago, acessoValido, estadoPublico } = require('./premiumPeriodo');
const terminal = status => ['canceled', 'incomplete_expired'].includes(status);
class ErroPremium extends Error {
    constructor(message, status = 503) { super(message); this.status = status; }
}
function configurar(env = process.env) {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.APP_BASE_URL) {
        throw new ErroPremium('Assinatura indisponível: configure Stripe de teste e APP_BASE_URL.');
    }
    if (!/^sk_test_/.test(env.STRIPE_SECRET_KEY)) throw new ErroPremium('Somente Stripe em modo de teste é permitido.');
    let base;
    try { base = new URL(env.APP_BASE_URL); } catch { throw new ErroPremium('APP_BASE_URL inválida.'); }
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
        throw new ErroPremium('APP_BASE_URL deve conter somente a origem HTTP(S).');
    }
    return { stripe: new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-09-30.endive', timeout: 10000, maxNetworkRetries: 1 }), price: env.STRIPE_PRICE_ID, base: base.origin };
}
function teste(objeto) {
    if (!objeto || objeto.livemode !== false) throw new ErroPremium('Objeto Stripe fora do modo de teste.', 400);
    return objeto;
}
function criarPremium({ db = require('./database'), autenticar = require('./middlewareAuth'), config = () => configurar(), env = process.env, now = () => Math.floor(Date.now() / 1000) } = {}) {
    async function transacao(fn) {
        const c = await db.getConnection();
        try { await c.beginTransaction(); const result = await fn(c); await c.commit(); return result; }
        catch (e) { await c.rollback(); throw e; }
        finally { c.release(); }
    }
    async function bloquear(c, usuarioId) {
        const [users] = await c.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
        if (!users.length) throw new ErroPremium('Usuário não encontrado.', 401);
        await c.execute('INSERT IGNORE INTO premium_assinaturas (usuario_id) VALUES (?)', [usuarioId]);
        const [rows] = await c.execute('SELECT * FROM premium_assinaturas WHERE usuario_id = ? FOR UPDATE', [usuarioId]);
        return rows[0];
    }
    const router = express.Router();
    router.use(autenticar);
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.get('/status', async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM premium_assinaturas WHERE usuario_id = ?', [req.usuario.id]);
            res.json(estadoPublico(rows[0], env.STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID, now()));
        } catch { res.status(503).json({ mensagem: 'Não foi possível consultar Premium. Verifique a migração da atividade 7.' }); }
    });
    router.post('/checkout', async (req, res) => {
        try {
            const { stripe, price, base } = config();
            const preco = teste(await stripe.prices.retrieve(price));
            if (!preco.active || preco.currency !== 'brl' || preco.unit_amount !== 990 || preco.recurring?.interval !== 'month' || preco.recurring.interval_count !== 1) {
                throw new ErroPremium('O preço deve ser de teste, ativo e de R$ 9,90/mês.');
            }
            const usuarioId = String(req.usuario.id);
            // Persiste o cliente antes de criar qualquer assinatura remota.
            await transacao(async c => {
                const row = await bloquear(c, usuarioId);
                if (!row.stripe_customer_id) {
                    const customer = teste(await stripe.customers.create({ metadata: { usuario_id: usuarioId } }, { idempotencyKey: `premium-customer-${usuarioId}` }));
                    row.stripe_customer_id = customer.id;
                    await c.execute('UPDATE premium_assinaturas SET stripe_customer_id = ? WHERE usuario_id = ?', [customer.id, usuarioId]);
                }
            });
            const url = await transacao(async c => {
                const row = await bloquear(c, usuarioId);
                // Consulta também Stripe: cobre retorno perdido e webhook ainda não recebido.
                const subscriptions = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: 'all', limit: 100 });
                if (subscriptions.has_more || subscriptions.data.some(s => { teste(s); return !terminal(s.status); })) {
                    throw new ErroPremium('Você já possui uma assinatura ativa ou pendente. Aguarde a confirmação ou gerencie-a no Stripe de teste.', 409);
                }
                if (row.stripe_checkout_id) {
                    const session = teste(await stripe.checkout.sessions.retrieve(row.stripe_checkout_id));
                    if (session.status === 'open') return session.url;
                    if (session.status === 'complete' && !subscriptions.data.length) throw new ErroPremium('Checkout concluído. Aguarde a confirmação do pagamento.', 409);
                }
                // Chave determinística por tentativa; sessão expirada permite nova tentativa.
                const tentativa = row.stripe_checkout_id || 'initial';
                const session = teste(await stripe.checkout.sessions.create({
                    mode: 'subscription', customer: row.stripe_customer_id,
                    client_reference_id: usuarioId, metadata: { usuario_id: usuarioId },
                    subscription_data: { metadata: { usuario_id: usuarioId } },
                    line_items: [{ price, quantity: 1 }],
                    success_url: `${base}/perfil.html?premium=sucesso`, cancel_url: `${base}/perfil.html?premium=cancelado`
                }, { idempotencyKey: `premium-checkout-${usuarioId}-${price}-${tentativa}` }));
                await c.execute("UPDATE premium_assinaturas SET stripe_checkout_id = ?, stripe_subscription_id = NULL, stripe_paid_invoice_id = NULL, paid_period_start = NULL, paid_period_end = NULL, stripe_price_id = NULL, cancel_at_period_end = FALSE, cancel_at = NULL, next_renewal_at = NULL, payment_problem = FALSE, state_event_created = 0, premium = FALSE, status = 'pendente' WHERE usuario_id = ?", [session.id, usuarioId]);
                return session.url;
            });
            res.json({ url });
        } catch (e) { res.status(e instanceof ErroPremium ? e.status : 503).json({ mensagem: e instanceof ErroPremium ? e.message : 'Não foi possível iniciar o checkout de teste.' }); }
    });

    async function atualizar(c, row, sub, price, invoice, created) {
        const items = sub.items?.data || [];
        const correto = items.length === 1 && !sub.items.has_more && id(items[0].price) === price && items[0].quantity === 1;
        const paid = correto && invoice ? periodoPago(invoice, sub, price) : null;
        if (paid && paid.end > Number(row.paid_period_end || 0)) {
            const continuo = row.stripe_price_id === price && epoch(row.paid_period_start) && paid.start <= Number(row.paid_period_end);
            row.paid_period_start = continuo ? Math.min(Number(row.paid_period_start), paid.start) : paid.start;
            row.paid_period_end = paid.end;
            row.stripe_paid_invoice_id = paid.invoiceId;
        }
        // Snapshot atual sob lock. Eventos antigos não sobrescrevem situações mais recentes.
        if (created >= Number(row.state_event_created || 0)) {
            row.status = correto ? sub.status : 'preco_invalido';
            row.stripe_price_id = correto ? price : id(items[0]?.price) || null;
            row.cancel_at_period_end = Boolean(sub.cancel_at_period_end);
            row.cancel_at = epoch(sub.cancel_at);
            row.next_renewal_at = sub.collection_method === 'charge_automatically' ? epoch(items[0]?.current_period_end) : null;
            row.payment_problem = ['past_due', 'unpaid'].includes(sub.status) || Boolean(sub.latest_invoice?.attempted && sub.latest_invoice.status === 'open' && sub.latest_invoice.amount_remaining > 0);
            row.state_event_created = created;
        }
        row.stripe_subscription_id = sub.id;
        row.premium = acessoValido(row, price, now());
        await c.execute('UPDATE premium_assinaturas SET stripe_subscription_id = ?, stripe_paid_invoice_id = ?, premium = ?, status = ?, stripe_price_id = ?, paid_period_start = ?, paid_period_end = ?, cancel_at_period_end = ?, cancel_at = ?, next_renewal_at = ?, payment_problem = ?, state_event_created = ? WHERE usuario_id = ?',
            [sub.id, row.stripe_paid_invoice_id || null, row.premium, row.status, row.stripe_price_id || null, row.paid_period_start || null, row.paid_period_end || null,
                row.cancel_at_period_end || false, row.cancel_at || null, row.next_renewal_at || null, row.payment_problem || false, row.state_event_created || 0, row.usuario_id]);
    }
    // CLI administrativa: não há rota que aceite identidade de terceiros.
    async function sincronizar(usuarioId, aplicar = false) {
        if (!/^[1-9]\d*$/.test(String(usuarioId))) throw new ErroPremium('Informe um ID de usuário válido.', 400);
        const { stripe, price } = config();
        return transacao(async c => {
            const [rows] = await c.execute('SELECT * FROM premium_assinaturas WHERE usuario_id = ? FOR UPDATE', [usuarioId]);
            const row = rows[0];
            if (!row?.stripe_customer_id) throw new ErroPremium('Cliente não vinculado. Confira o Checkout do usuário; não ative Premium manualmente.', 409);
            let subId = row.stripe_subscription_id;
            if (!subId && row.stripe_checkout_id) subId = id(teste(await stripe.checkout.sessions.retrieve(row.stripe_checkout_id)).subscription);
            if (!subId) {
                const list = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: 'all', limit: 100 });
                const candidates = list.data.filter(s => teste(s).metadata?.usuario_id === String(usuarioId) && !terminal(s.status));
                if (list.has_more || candidates.length !== 1) throw new ErroPremium('Não foi possível identificar uma única assinatura vinculada.', 409);
                subId = candidates[0].id;
            }
            const sub = teste(await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] }));
            if (sub.metadata?.usuario_id !== String(usuarioId) || id(sub.customer) !== row.stripe_customer_id) throw new ErroPremium('Assinatura não pertence ao usuário.', 409);
            let best = null;
            for await (const invoice of stripe.invoices.list({ customer: row.stripe_customer_id, subscription: sub.id, status: 'paid', limit: 100 })) {
                const current = teste(await stripe.invoices.retrieve(invoice.id));
                const paid = periodoPago(current, sub, price);
                if (paid && (!best || paid.end > best.period.end)) best = { invoice: current, period: paid };
            }
            const copy = { ...row };
            await atualizar(aplicar ? c : { execute: async () => [] }, copy, sub, price, best?.invoice || null, now());
            return { aplicado: aplicar, pagamento_confirmado: Boolean(best), estado: estadoPublico(copy, price, now()) };
        });
    }
    async function exigirPremium(req, res, next) {
        try {
            const [rows] = await db.execute('SELECT * FROM premium_assinaturas WHERE usuario_id = ?', [req.usuario.id]);
            if (!acessoValido(rows[0], env.STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID, now())) return res.status(403).json({ mensagem: 'Este benefício exige um período Premium pago e válido.' });
            next();
        } catch { res.status(503).json({ mensagem: 'Não foi possível verificar Premium.' }); }
    }
    async function processar(event, stripe, price) {
        teste(event);
        const supported = ['invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.created'];
        await transacao(async c => {
            // INSERT único faz eventos simultâneos aguardarem commit/rollback.
            const [insert] = await c.execute('INSERT IGNORE INTO stripe_eventos (id, tipo) VALUES (?, ?)', [event.id, event.type]);
            if (!insert.affectedRows || !supported.includes(event.type)) return;
            const object = teste(event.data.object);
            const subId = event.type.startsWith('invoice.') ? subscriptionId(object) : object.id;
            if (!subId) return;
            // Descobre usuário, mas só aceita o cliente previamente associado pelo backend.
            const initial = teste(await stripe.subscriptions.retrieve(subId));
            const usuarioId = initial.metadata?.usuario_id;
            if (!/^[1-9]\d*$/.test(usuarioId || '')) return;
            const row = await bloquear(c, usuarioId);
            // Releitura sob lock serializa snapshots atuais mesmo com eventos fora de ordem.
            const sub = teste(await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] }));
            if (sub.metadata?.usuario_id !== usuarioId || id(sub.customer) !== row.stripe_customer_id || (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id)) return;
            if (!row.stripe_subscription_id) {
                let checkout;
                if (row.stripe_checkout_id) checkout = teste(await stripe.checkout.sessions.retrieve(row.stripe_checkout_id));
                else {
                    // Recupera Checkout remoto se a resposta/commit local foi perdido.
                    const sessions = await stripe.checkout.sessions.list({ subscription: sub.id, limit: 2 });
                    if (sessions.has_more || sessions.data.length !== 1) throw new Error('Checkout ainda não sincronizado');
                    checkout = teste(sessions.data[0]);
                }
                if (!id(checkout.subscription)) throw new Error('Checkout ainda não sincronizado');
                if (id(checkout.subscription) !== sub.id || checkout.client_reference_id !== usuarioId || id(checkout.customer) !== row.stripe_customer_id) return;
                if (!row.stripe_checkout_id) await c.execute('UPDATE premium_assinaturas SET stripe_checkout_id = ? WHERE usuario_id = ?', [checkout.id, usuarioId]);
            }
            if (event.type.startsWith('invoice.') && (id(object.customer) !== row.stripe_customer_id || subscriptionId(object) !== sub.id)) return;
            const invoice = event.type === 'invoice.paid' ? teste(await stripe.invoices.retrieve(object.id)) : null;
            await atualizar(c, row, sub, price, invoice, event.created || 0);

        });
    }
    async function webhook(req, res) {
        let event, cfg;
        try {
            cfg = config();
            if (!env.STRIPE_WEBHOOK_SECRET) throw new ErroPremium('Webhook de teste não configurado.');
        } catch (e) { return res.status(503).json({ mensagem: e instanceof ErroPremium ? e.message : 'Stripe indisponível.' }); }
        try {
            if (!req.get('Stripe-Signature') || !Buffer.isBuffer(req.body)) throw new Error();
            event = cfg.stripe.webhooks.constructEvent(req.body, req.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
            teste(event);
        } catch { return res.status(400).json({ mensagem: 'Assinatura inválida ou evento fora do modo de teste.' }); }
        try { await processar(event, cfg.stripe, cfg.price); res.json({ recebido: true }); }
        catch { res.status(503).json({ mensagem: 'Não foi possível processar o evento. Tente novamente.' }); }
    }
    return { router, webhook, processar, sincronizar, exigirPremium };
}
module.exports = { criarPremium, configurar, ErroPremium };
