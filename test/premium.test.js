const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const Stripe = require('stripe');
const { criarPremium, configurar } = require('../src/premium');
const secret = 'whsec_fixture_only';
const price = 'price_fixture';
test('configuração opcional e rejeição de produção', () => {
    assert.throws(() => configurar({}), /configure Stripe de teste/);
    assert.throws(() => configurar({ STRIPE_SECRET_KEY: 'sk_live_fixture', STRIPE_PRICE_ID: price, APP_BASE_URL: 'http://localhost:3000' }), /Somente Stripe/);
    assert.throws(() => configurar({ STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PRICE_ID: price, APP_BASE_URL: 'javascript:alert(1)' }), /APP_BASE_URL/);
});
test('Premium: HTTP, assinatura real do SDK e integrações externas simuladas', async t => {
    let row, events, sub, invoice, checkout, subscriptions, calls, fail, commits, clock, sequence, history;
    const sdk = new Stripe('sk_test_fixture');
    const db = {
        async execute(sql, args) {
            if (sql.startsWith('SELECT id FROM usuarios')) return [[{ id: 1 }]];
            if (sql.startsWith('INSERT IGNORE INTO premium_assinaturas')) return [{ affectedRows: 0 }];
            if (sql.startsWith('SELECT * FROM premium_assinaturas')) { calls.push({consultaUsuario:args[0]}); return [[{ ...row }]]; }
            if (sql.startsWith('SELECT premium, status')) return [[{ ...row }]];
            if (sql.startsWith('INSERT IGNORE INTO stripe_eventos')) {
                if (events.has(args[0])) return [{ affectedRows: 0 }];
                events.add(args[0]); return [{ affectedRows: 1 }];
            }
            if (sql.startsWith('UPDATE premium_assinaturas SET stripe_customer_id')) row.stripe_customer_id = args[0];
            else if (sql.startsWith('UPDATE premium_assinaturas SET stripe_checkout_id')) {
                row.stripe_checkout_id = args[0];
                if (sql.includes("status = 'pendente'")) Object.assign(row, { stripe_subscription_id: null, stripe_paid_invoice_id: null, premium: false, status: 'pendente' });
            } else if (sql.startsWith('UPDATE premium_assinaturas SET stripe_subscription_id')) {
                if (fail) throw new Error('falha SQL com dado privado');
                Object.assign(row, { stripe_subscription_id: args[0], stripe_paid_invoice_id: args[1], premium: args[2], status: args[3], stripe_price_id: args[4], paid_period_start: args[5], paid_period_end: args[6], cancel_at_period_end: args[7], cancel_at: args[8], next_renewal_at: args[9], payment_problem: args[10], state_event_created: args[11] });
            } else throw new Error('SQL inesperado');
            return [{ affectedRows: 1 }];
        },
        async getConnection() {
            const backup = structuredClone(row), saved = new Set(events);
            return { execute: db.execute, async beginTransaction() {}, async commit() { commits++; },
                async rollback() { row = backup; events = saved; }, release() {} };
        }
    };
    const stripe = {
        invoices: { async retrieve(id) { return structuredClone(invoice.id === id ? invoice : history.get(id)); }, async *list() { for (const i of history.values()) yield i; } },
        webhooks: sdk.webhooks,
        prices: { async retrieve() { return { livemode: false, active: true, currency: 'brl', unit_amount: 990, recurring: { interval: 'month', interval_count: 1 } }; } },
        customers: { async create(data, options) { calls.push({ customer: data, options }); return { id: 'cus_fixture', livemode: false }; } },
        subscriptions: { async list() { return { data: subscriptions, has_more: false }; }, async retrieve() { return structuredClone(sub); } },
        checkout: { sessions: {
            async list() { return { data: [structuredClone(checkout)], has_more: false }; },
            async retrieve() { return structuredClone(checkout); },
            async create(data, options) { calls.push({ data, options }); return { ...checkout, status: 'open' }; }
        } }
    };
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify({ usuario: { id: 1, role: 'usuario' } }));
    const premium = criarPremium({ db, config: () => ({ stripe, price, base: 'http://localhost:3000' }), env: { STRIPE_WEBHOOK_SECRET: secret, STRIPE_PRICE_ID: price }, now: () => clock });
    const app = express();
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), premium.webhook);
    app.use(express.json()); app.use(cookieParser()); app.use('/api/premium', premium.router);
    app.use('/indisponivel', criarPremium({ db, config: () => configurar({}) }).router);
    app.get('/beneficio', (req,res,next)=>{req.usuario={id:1};next();}, premium.exigirPremium, (req,res)=>res.json({selo:true}));
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    t.after(() => { global.fetch = originalFetch; server.close(); server.closeAllConnections(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    function event(type = 'invoice.paid', eventId = 'evt_fixture') {
        history.set(invoice.id, structuredClone(invoice));
        return { id: eventId, created: clock + sequence++, type, livemode: false, data: { object: structuredClone(type.startsWith('invoice.') ? invoice : sub) } };
    }
    async function webhook(e, signature) {
        const payload = JSON.stringify(e);
        const header = signature === undefined ? sdk.webhooks.generateTestHeaderString({ payload, secret }) : signature;
        return originalFetch(base + '/api/stripe/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(header ? { 'Stripe-Signature': header } : {}) }, body: payload });
    }
    async function caso(name, fn) {
        await t.test(name, async () => {
            clock=1700000000; sequence=0; history=new Map();
            row = { usuario_id: 1, premium: false, status: 'pendente', stripe_customer_id: 'cus_fixture', stripe_checkout_id: 'cs_fixture', stripe_subscription_id: null, stripe_paid_invoice_id: null };
            invoice = { id: 'in_fixture', livemode: false, status: 'paid', amount_paid: 990, currency: 'brl', customer: 'cus_fixture', parent: { subscription_details: { subscription: 'sub_fixture' } }, lines: { data: [{ livemode:false, currency:'brl', quantity:1, pricing: { price_details: { price } }, parent:{type:'subscription_item_details',subscription_item_details:{subscription:'sub_fixture',subscription_item:'si_fixture',proration:false}}, period:{start:1699990000,end:1702592000} }], has_more: false } };
            sub = { id: 'sub_fixture', livemode: false, customer: 'cus_fixture', metadata: { usuario_id: '1' }, status: 'active', cancel_at_period_end:false, cancel_at:null, collection_method:'charge_automatically', items: { data: [{ id:'si_fixture',current_period_start:1699990000,current_period_end:1702592000,price: { id: price }, quantity: 1 }], has_more: false }, latest_invoice: invoice };
            checkout = { id: 'cs_fixture', livemode: false, status: 'complete', subscription: 'sub_fixture', customer: 'cus_fixture', client_reference_id: '1', url: 'https://checkout.stripe.com/fixture' };
            events = new Set(); subscriptions = []; calls = []; fail = false; commits = 0;
            await fn();
        });
    }
    await caso('checkout sem sessão retorna 401', async () => {
        const r = await originalFetch(base + '/api/premium/checkout', { method: 'POST' }); assert.equal(r.status, 401); assert.equal(calls.filter(c=>c.data||c.customer).length, 0);
    });
    await caso('Stripe ausente retorna erro claro somente ao assinar', async () => {
        const r = await originalFetch(base + '/indisponivel/checkout', { method: 'POST', headers: { Cookie: 'token=fixture' } });
        assert.equal(r.status, 503); assert.match((await r.json()).mensagem, /configure Stripe de teste/);
        const status = await originalFetch(base + '/indisponivel/status', { headers: { Cookie: 'token=fixture' } }); assert.equal(status.status, 200);
    });
    await caso('checkout usa somente identidade, preço e URLs do backend', async () => {
        row.stripe_checkout_id = null; row.stripe_customer_id = null;
        const r = await originalFetch(base + '/api/premium/checkout', { method: 'POST', headers: { Cookie: 'token=fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: 999, price: 'outro', success_url: 'https://evil.invalid' }) });
        assert.equal(r.status, 200); assert.equal((await r.json()).url, checkout.url);
        const data = calls.find(c => c.data).data;
        assert.equal(data.client_reference_id, '1'); assert.equal(data.mode, 'subscription'); assert.equal(data.line_items[0].price, price);
        assert.equal(data.subscription_data.metadata.usuario_id, '1'); assert.equal(data.success_url, 'http://localhost:3000/perfil.html?premium=sucesso'); assert.equal(row.premium, false);
    });
    await caso('reutiliza checkout aberto', async () => {
        checkout.status = 'open';
        const r = await originalFetch(base + '/api/premium/checkout', { method: 'POST', headers: { Cookie: 'token=fixture' } }); assert.equal(r.status, 200); assert.equal(calls.filter(c=>c.data||c.customer).length, 0);
    });
    await caso('impede assinatura ativa duplicada', async () => {
        subscriptions = [sub];
        const r = await originalFetch(base + '/api/premium/checkout', { method: 'POST', headers: { Cookie: 'token=fixture' } }); assert.equal(r.status, 409); assert.equal(calls.filter(c=>c.data||c.customer).length, 0);
    });
    await caso('assinatura de webhook ausente e inválida', async () => {
        for (const signature of ['', 't=1,v1=invalida']) assert.equal((await webhook(event(), signature)).status, 400);
        assert.equal(events.size, 0); assert.equal(row.premium, false);
    });
    await caso('rejeita evento livemode mesmo assinado', async () => {
        assert.equal((await webhook({ ...event(), livemode: true })).status, 400); assert.equal(events.size, 0);
    });
    await caso('pagamento confirmado concede benefício e status HTTP confirmado', async () => {
        assert.equal((await webhook(event())).status, 200); assert.equal(row.premium, true); assert.equal(row.stripe_subscription_id, sub.id);
        const r = await originalFetch(base + '/api/premium/status', { headers: { Cookie: 'token=fixture' } }); const body=await r.json(); assert.equal(body.premium,true);assert.equal(body.status,'active');assert.equal(body.renovacao_em,new Date(1702592000*1000).toISOString());assert.ok(!JSON.stringify(body).includes('cus_fixture'));
    });
    await caso('evento duplicado não reaplica atualização', async () => {
        await webhook(event()); fail = true;
        assert.equal((await webhook(event())).status, 200); assert.equal(events.size, 1); assert.equal(row.premium, true);
    });
    await caso('recupera vínculo do checkout após commit local perdido', async () => {
        row.stripe_checkout_id = null;
        assert.equal((await webhook(event())).status, 200); assert.equal(row.premium, true); assert.equal(row.stripe_checkout_id, checkout.id);
    });
    await caso('rollback remove registro para permitir retry', async () => {
        fail = true; assert.equal((await webhook(event())).status, 503); assert.equal(events.size, 0); assert.equal(row.premium, false);
        fail = false; assert.equal((await webhook(event())).status, 200); assert.equal(row.premium, true);
    });
    await caso('status ativo e redirecionamento não concedem benefício sem invoice.paid', async () => {
        assert.equal((await webhook(event('customer.subscription.updated'))).status, 200); assert.equal(row.premium, false);
    });
    await caso('preço ou cliente divergente não concedem benefício', async () => {
        sub.items.data[0].price.id = 'price_outro'; await webhook(event()); assert.equal(row.premium, false);
        sub.items.data[0].price.id = price; sub.customer = 'cus_outro'; await webhook(event('invoice.paid', 'evt_outro')); assert.equal(row.premium, false);
    });
    await caso('fatura não paga e preço divergente na fatura não concedem acesso', async () => {
        invoice.status = 'open'; await webhook(event()); assert.equal(row.premium, false);
        invoice.status = 'paid'; invoice.lines.data[0].pricing.price_details.price = 'price_outro'; sub.latest_invoice = invoice;
        await webhook(event('invoice.paid', 'evt_preco')); assert.equal(row.premium, false);
    });
    await caso('checkout de outra assinatura não vincula', async () => {
        checkout.subscription = 'sub_outro'; await webhook(event()); assert.equal(row.premium, false); assert.equal(row.stripe_subscription_id, null);
    });
    await caso('cancelamento e evento de pagamento antigo não restauram acesso', async () => {
        await webhook(event()); sub.status = 'canceled';
        await webhook(event('customer.subscription.deleted', 'evt_cancel')); assert.equal(row.premium, false);
        await webhook(event('invoice.paid', 'evt_atrasado')); assert.equal(row.premium, false);
    });
    await caso('past_due preserva período pago, expiração retira e recuperação exige renovação paga', async () => {
        await webhook(event()); sub.status = 'past_due';
        await webhook(event('invoice.payment_failed', 'evt_failed')); assert.equal(row.premium, true);
        let state=await (await originalFetch(base+'/api/premium/status',{headers:{Cookie:'token=fixture'}})).json();assert.equal(state.pagamento_pendente,true);
        clock=1702592000;state=await (await originalFetch(base+'/api/premium/status',{headers:{Cookie:'token=fixture'}})).json();assert.equal(state.premium,false);
        sub.status = 'active'; sub.latest_invoice = structuredClone({...invoice,id:'in_renewal'});sub.latest_invoice.lines.data[0].period={start:1702592000,end:1705184000};sub.items.data[0].current_period_end=1705184000;
        await webhook(event('customer.subscription.updated', 'evt_updated')); assert.equal(row.premium, false);
        invoice = sub.latest_invoice; await webhook(event('invoice.paid', 'evt_renewal')); assert.equal(row.premium, true);
    });
    await caso('status e benefício negam período vencido mesmo com premium persistido true', async () => {
        await webhook(event());
        clock=1702592000;
        const r=await originalFetch(base+'/api/premium/status',{headers:{Cookie:'token=fixture'}});
        assert.equal((await r.json()).premium,false);
        assert.equal(row.premium,true);
        assert.equal((await originalFetch(base+'/beneficio')).status,403);
    });
    await caso('cancelamento programado mantém acesso até data paga e omite renovação', async () => {
        await webhook(event());
        sub.cancel_at_period_end=true;sub.cancel_at=1702592000;
        await webhook(event('customer.subscription.updated','evt_end'));
        let state=await (await originalFetch(base+'/api/premium/status',{headers:{Cookie:'token=fixture'}})).json();
        assert.equal(state.premium,true);assert.equal(state.renovacao_em,null);assert.equal(state.termina_em,new Date(1702592000*1000).toISOString());
        clock=1702592000;
        state=await (await originalFetch(base+'/api/premium/status',{headers:{Cookie:'token=fixture'}})).json();assert.equal(state.premium,false);
    });
    await caso('pagamento antigo não encurta renovação e situação antiga não sobrescreve cancelamento', async () => {
        const old=event();await webhook(old);
        invoice=structuredClone(invoice);invoice.id='in_new';invoice.lines.data[0].period={start:1702592000,end:1705184000};sub.latest_invoice=invoice;sub.items.data[0].current_period_end=1705184000;
        await webhook(event('invoice.paid','evt_new'));assert.equal(row.paid_period_end,1705184000);
        await webhook({...old,id:'evt_old_late'});assert.equal(row.paid_period_end,1705184000);assert.equal(row.stripe_paid_invoice_id,'in_new');
        sub.cancel_at_period_end=true;sub.cancel_at=1705184000;const cancellation=event('customer.subscription.updated','evt_cancellation');cancellation.created+=100;await webhook(cancellation);
        sub.cancel_at_period_end=false;sub.cancel_at=null;
        const stale=event('customer.subscription.updated','evt_stale');stale.created=old.created;
        await webhook(stale);assert.equal(row.cancel_at_period_end,true);assert.equal(row.cancel_at,1705184000);
    });
    await caso('IDs enviados pelo usuário não consultam ou alteram outra assinatura', async () => {
        await webhook(event());calls=[];
        const r=await originalFetch(base+'/api/premium/status?usuario_id=999',{headers:{Cookie:'token=fixture'}});
        assert.equal(r.status,200);assert.deepEqual(calls.filter(c=>c.consultaUsuario).map(c=>c.consultaUsuario),[1]);
        for(const [route,method] of [['/status/999','GET'],['/status','PATCH'],['/sincronizar','POST']]){
            assert.equal((await originalFetch(base+'/api/premium'+route,{method,headers:{Cookie:'token=fixture','Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify({usuario_id:999,premium:true})})})).status,404);
        }
        assert.equal(row.usuario_id,1);
    });
    await caso('sincronização recupera fatura paga existente sem criação de checkout ou cobrança', async () => {
        history.set(invoice.id,structuredClone(invoice));
        const preview=await premium.sincronizar(1,false);
        assert.equal(preview.aplicado,false);assert.equal(preview.estado.premium,true);assert.equal(row.paid_period_end,undefined);
        const result=await premium.sincronizar(1,true);
        assert.equal(result.estado.premium,true);assert.equal(row.paid_period_end,1702592000);assert.equal(calls.filter(c=>c.data||c.customer).length,0);
    });
    await caso('sincronização rejeita assinatura com metadata de outro usuário', async () => {
        sub.metadata.usuario_id='999';history.set(invoice.id,structuredClone(invoice));
        await assert.rejects(()=>premium.sincronizar(1,true),/não pertence/);assert.equal(row.premium,false);
    });

});
