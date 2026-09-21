# Metas por clínica — aplicação da alteração

Antes de iniciar a versão nova da API, executar database/patches/20260918-goals-company.sql no PostgreSQL e gerar o Prisma Client (`npx prisma generate`). Este projeto ainda usa db push; o SQL é um patch incremental, não uma baseline do Prisma Migrate.

O patch adiciona goals.company_id com índice e chave estrangeira, sem apagar planos. Vincula planos antigos apenas quando o proprietário/profissional corresponde a uma única clínica. Proprietários de múltiplas clínicas ficam com planos antigos sem vínculo (NULL), preservados no banco e ocultos nas listas até atribuição explícita.

A consulta final mostra esses planos. Para cada um, confirmar a clínica de origem com o proprietário antes de atualizar company_id. Não duplicar automaticamente entre clínicas.

Os planos novos recebem a clínica autenticada; companyId/professionalId enviados pelo cliente não escolhem a clínica. Listagem e exclusão usam a clínica ativa. Não iniciar a API nova antes da criação da coluna.

O patch não foi executado no banco compartilhado durante o desenvolvimento local. Aplicá-lo é uma etapa de publicação, independente do envio ao GitHub.
