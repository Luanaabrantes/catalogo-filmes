# Roteiro de evidências — atividade 7

Sequência inspirada na clareza do [projeto do Leonardo](https://github.com/leonardoricci-tsi/api_filme_), com os planos e benefícios próprios deste catálogo.

| Ordem | Arquivo em docs/evidencias | O que comprovar | Estado |
|---|---|---|---|
| 1 | atividade-7-perfil-gratuito.png | Comparação de planos; favoritos e comentários disponíveis no Gratuito | Pendente |
| 2 | atividade-7-stripe-checkout.png | Checkout de R$ 9,90/mês de teste e sua conclusão; use registro real existente da Luana sem novo pagamento desnecessário | Pendente |
| 3 | atividade-7-stripe-pagamento-confirmado.png | Pagamento/fatura de teste confirmado no Dashboard e associado à assinatura correta | Pendente |
| 4 | atividade-7-premium-banco.png | Vínculo e período pago real após webhook, evento persistente sem duplicação e premium efetivo | Pendente |
| 5 | atividade-7-premium-perfil.png | Mesmo assinante com selo, situação e renovação ou término real | Pendente |

Não faça UPDATE manual para produzir o selo, nem use redirecionamento como prova de pagamento. Não capture chaves, cookies, segredos de webhook, hashes de senha, cartão, CVV ou validade.

A recuperação pela CLI deve ser identificada como **sincronização**, não como recebimento de novo webhook. Para evidenciar banco após webhook, registre o processamento real de um evento assinado/reenvio que tenha sido efetivamente executado.

Não foram encontrados prints Premium com esses nomes ao organizar este roteiro. Nenhuma imagem nova foi fabricada.
