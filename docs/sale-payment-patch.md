# Vendas por proposta

Antes de iniciar o backend com esta alteração, aplique `database/patches/20260922-sale-payments-lead.sql` no PostgreSQL da instalação e gere o Prisma Client. Faça backup do banco antes da aplicação. O patch é idempotente e cria `sales`, o vínculo opcional `payments.sale_id` e um registro histórico para cada lead já marcado como pago.

Cada confirmação de pagamento cria uma venda ligada à proposta escolhida. O dashboard conta propostas pela data de criação e soma as vendas ativas pela data da confirmação, mesmo que o lead mude de etapa ou receba novas propostas. Boleto conta pelo valor total contratado, ainda que as parcelas estejam pendentes. A soma dos lançamentos deve ser exatamente igual ao valor da proposta após o desconto; confirmar uma proposta já vendida é rejeitado.

Mover o lead para outra etapa mantém todas as vendas. Para cancelar uma venda, abra **Propostas Comerciais** no dossiê do lead e use **Cancelar esta venda** na proposta correspondente. Apenas essa venda e seus lançamentos deixam de entrar nos indicadores; os dados permanecem no histórico. Uma proposta cancelada pode ser fechada novamente.

O histórico anterior não tem um vínculo confiável entre pagamentos e propostas. O patch liga a venda antiga à proposta somente se houver uma única proposta aceita para o lead. Nos demais casos, o histórico fica como venda sem proposta e exige revisão manual antes de um cancelamento por proposta. Os pagamentos antigos não são modificados.
