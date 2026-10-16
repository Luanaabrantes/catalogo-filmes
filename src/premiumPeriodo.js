// API Stripe 2026-09-30.endive: epochs UTC em segundos.
const id = v => typeof v === 'string' ? v : v?.id;
const subscriptionId = i => id(i.parent?.subscription_details?.subscription);
const epoch = v => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
function periodoPago(invoice, sub, price) {
    if (invoice?.livemode !== false || invoice.status !== 'paid' || invoice.amount_paid < 990 || invoice.currency !== 'brl' ||
        subscriptionId(invoice) !== sub.id || id(invoice.customer) !== id(sub.customer) || invoice.lines?.has_more) return null;
    const lines = (invoice.lines?.data || []).filter(l => l.livemode === false && l.currency === 'brl' && l.quantity === 1 &&
        id(l.pricing?.price_details?.price) === price && l.parent?.type === 'subscription_item_details' &&
        l.parent.subscription_item_details.subscription === sub.id && !l.parent.subscription_item_details.proration &&
        l.parent.subscription_item_details.subscription_item === sub.items?.data?.[0]?.id &&
        epoch(l.period?.start) && epoch(l.period?.end) > epoch(l.period.start));
    if (lines.length !== 1) return null;
    return { start: epoch(lines[0].period.start), end: epoch(lines[0].period.end), invoiceId: invoice.id };
}
function acessoValido(row, price, now = Math.floor(Date.now() / 1000)) {
    return Boolean(row?.stripe_customer_id && row.stripe_subscription_id && row.stripe_paid_invoice_id &&
        price && row.stripe_price_id === price && epoch(row.paid_period_start) && epoch(row.paid_period_start) <= now &&
        epoch(row.paid_period_end) > now && (!epoch(row.cancel_at) || epoch(row.cancel_at) > now) &&
        ['active', 'past_due', 'unpaid'].includes(row.status));
}
function estadoPublico(row, price, now = Math.floor(Date.now() / 1000)) {
    const premium = acessoValido(row, price, now);
    const regularizar = Boolean(row?.payment_problem) || ['past_due', 'unpaid'].includes(row?.status);
    const cancelar = Boolean(row?.cancel_at_period_end) || Boolean(epoch(row?.cancel_at));
    const iso = s => new Date(s * 1000).toISOString();
    const fim = epoch(row?.paid_period_end);
    const termina = premium && cancelar ? Math.min(fim, epoch(row.cancel_at) || fim) : null;
    const renovar = premium && !cancelar && !regularizar && row.status === 'active' && epoch(row.next_renewal_at) > now ? epoch(row.next_renewal_at) : null;
    let situacao = 'Plano gratuito';
    if (regularizar) situacao = 'Pagamento precisa ser regularizado';
    else if (premium) situacao = cancelar ? 'Cancelamento ao final do período' : 'Assinatura ativa';
    else if (['pendente', 'incomplete'].includes(row?.status)) situacao = 'Confirmação de pagamento pendente';
    else if (row?.stripe_subscription_id) situacao = row.status === 'canceled' ? 'Assinatura cancelada' : 'Período pago encerrado';
    return { premium, status: row?.status || 'nenhuma', plano: row?.stripe_subscription_id ? 'Premium' : 'Gratuito',
        valor_centavos: row?.stripe_subscription_id ? 990 : 0, situacao, pagamento_pendente: regularizar,
        cancelamento_programado: cancelar, renovacao_em: renovar ? iso(renovar) : null, termina_em: termina ? iso(termina) : null,
        pode_assinar: !row?.stripe_subscription_id || ['canceled', 'incomplete_expired'].includes(row.status) };
}
module.exports = { id, subscriptionId, epoch, periodoPago, acessoValido, estadoPublico };
