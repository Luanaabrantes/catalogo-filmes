# Roteiro de evidências — atividade 7

Sequência inspirada na clareza do [projeto do Leonardo](https://github.com/leonardoricci-tsi/api_filme_), com os planos e benefícios próprios deste catálogo. As capturas existentes foram revisadas; as legendas completas estão no README.

| Evidência | Arquivo em docs/evidencias | Conteúdo real / estado |
|---|---|---|
| Perfil gratuito | atividade-7-perfil-gratuito.png | Pendente: perfil com Gratuito como plano atual |
| Tela do checkout | atividade-7-stripe-checkout.png | Pendente: captura da tela do Stripe Checkout; Dashboard não substitui |
| Transações | atividade-7-stripe-transacoes.png | Disponível: lista com pagamento de R$ 9,90 bem-sucedido |
| Pagamento detalhado | atividade-7-stripe-pagamento-detalhado.png | Disponível: detalhes, assinatura/fatura e Resumo do Checkout no Dashboard |
| Webhook | atividade-7-stripe-webhook.png | Disponível: invoice.paid entregue, HTTP 200 e recebido true |
| Banco | atividade-7-premium-banco.png | Disponível: usuário 39, premium 1, active e vínculos Stripe; não mostra período nem eventos |
| Perfil Premium | atividade-7-premium-perfil.png | Disponível: selo, assinatura ativa e próxima renovação em 09/11/2026 |

Os cinco arquivos disponíveis foram copiados de docs/evidencias_atividades sem modificar as imagens ou remover os originais. O nome de destino descreve o conteúdo: o original atividade-7-stripe-pagamento.png é a lista de transações; o original atividade-7-stripe-transacoes.png é o pagamento detalhado.

Para complementar o banco, falta capturar início/fim do período pago e stripe_eventos por SELECT. A tabela de eventos contém apenas ID, tipo e horário; confira no Stripe o vínculo entre o evento, a fatura, o cliente e a assinatura.

O backup anterior à migração complementar já mostrava premium 1 e a mesma assinatura/fatura sem campos de período. O estado com datas é posterior. A sincronização deve ser identificada como sincronização, não como novo recebimento de webhook; as capturas atuais não registram o histórico de quem preencheu as datas.

Não faça UPDATE manual ou novo pagamento para produzir evidências. Não capture chaves, cookies, segredos de webhook, hashes de senha, número completo de cartão, CVV ou validade. Nenhuma captura foi fabricada.
