const test = require('node:test');
const assert = require('node:assert/strict');
const { acessoValido, estadoPublico, periodoPago } = require('../src/premiumPeriodo');
const { linhaData } = require('../public/premiumApresentacao');
const now=1700000000;
const row={premium:false,stripe_customer_id:'cus_fixture',stripe_subscription_id:'sub_fixture',stripe_paid_invoice_id:'in_fixture',stripe_price_id:'price_fixture',paid_period_start:now-100,paid_period_end:now+1000,status:'active'};
test('benefício depende de período e vínculos, não do booleano ou papel',()=>{
    assert.equal(acessoValido(row,'price_fixture',now),true);
    for(const changed of [{paid_period_start:now+1},{paid_period_end:now},{stripe_paid_invoice_id:null},{stripe_price_id:'outro'},{status:'canceled'},{status:'paused'}])
        assert.equal(acessoValido({...row,premium:true,...changed},'price_fixture',now),false);
});
test('datas ausentes são omitidas; renovação e cancelamento mostram datas reais em pt-BR',()=>{
    assert.equal(linhaData({premium:true}), '');
    assert.equal(linhaData({premium:false,renovacao_em:'2026-11-10T15:00:00Z'}),'');
    assert.equal(linhaData({premium:true,renovacao_em:'2026-11-10T15:00:00Z'}),'Próxima renovação: 10/11/2026');
    assert.equal(linhaData({premium:true,termina_em:'2026-11-10T15:00:00Z'}),'Seu acesso Premium termina em 10/11/2026');
    assert.equal(linhaData({premium:true,renovacao_em:'inválida'}),'');
    assert.equal(estadoPublico(row,'price_fixture',now).renovacao_em,null);
});
test('dados de fatura sem linha de assinatura, período ou com rateio não provam acesso',()=>{
    const sub={id:'sub_fixture',customer:'cus_fixture',items:{data:[{id:'si_fixture'}]}};
    const line={livemode:false,currency:'brl',quantity:1,pricing:{price_details:{price:'price_fixture'}},period:{start:now-100,end:now+1000},parent:{type:'subscription_item_details',subscription_item_details:{subscription:sub.id,subscription_item:'si_fixture',proration:false}}};
    const invoice={id:'in_fixture',livemode:false,status:'paid',currency:'brl',amount_paid:990,customer:sub.customer,parent:{subscription_details:{subscription:sub.id}},lines:{data:[line],has_more:false}};
    assert.ok(periodoPago(invoice,sub,'price_fixture'));
    for(const bad of [{period:{}},{parent:null},{quantity:2},{livemode:true},{parent:{...line.parent,subscription_item_details:{...line.parent.subscription_item_details,proration:true}}}])
        assert.equal(periodoPago({...invoice,lines:{data:[{...line,...bad}],has_more:false}},sub,'price_fixture'),null);
});
