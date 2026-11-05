# Etapa 1 — autorização de rotas e isolamento de clínicas

## Decisões aprovadas

- Categorias, catálogo e modelos de fichas são exclusivos de cada clínica, inclusive quando o proprietário é o mesmo.
- Ausência de permissão implica bloqueio. O proprietário verificado conserva acesso aos módulos da própria clínica liberados pelo plano.
- Permissões antigas implícitas são materializadas uma única vez, preservando negativas explícitas. Isso mantém acessos legados, mas não equivale a uma revisão humana do menor privilégio de cada cargo.

## Matriz e barreira central

`server/config/route-manifest.json` registra os 225 pares método/caminho atuais, arquivo de origem e middlewares declarados. `scripts/security-route-inventory.mjs` extrai as declarações pela AST TypeScript, sem interpretar comentários como rotas. O teste compara a matriz com o código: alterações exigem revisão explícita do manifesto.

`routePolicy` bloqueia endpoints `/api` fora do manifesto. Rotas privadas exigem sessão e clínica ativa antes de chegar ao handler. Autenticação repetida reutiliza somente o resultado da mesma requisição; a requisição seguinte revalida acesso no banco. HEAD usa a política de GET. CORS trata preflight antes dessa barreira.

Exceções sem sessão são exatas, por método e caminho: login, recuperação/verificação/convite, cadastro com checkout, catálogo de preços, health, callbacks OAuth, webhooks e mídia de campanha assinada. Elas continuam sujeitas às verificações específicas de token/assinatura/estado existentes nos handlers. Cadastro profissional direto e webhook Evolution antigo continuam desativados. Não existe exceção genérica para `/webhooks` ou `/auth`.

| Família | Autorização e escopo |
|---|---|
| Clientes/fichas/modelos | Módulo clientes e `verClientes`; gravações/exclusões verificam suas ações; vínculos de cliente e modelo na clínica |
| Leads/propostas | Módulo funnel, `clientes.verLeads`, visibilidade do lead e ações de proposta/fase/exclusão; lote valida os registros |
| Agenda | Módulo e ações de agenda; visualização alheia controlada; serviço e participantes na clínica; horários mascarados não incluem fichas, pagamentos ou contatos |
| Catálogo/categorias | `companyId` obrigatório; catálogo legível por conta autenticada para formulários, alterações exigem módulo catálogo; categoria na mesma clínica |
| Conversas/mensagens | Módulo conversas; mesma política de atribuição/visibilidade para ambas as APIs; cliente, agente e profissional vinculados à clínica |
| Equipe/cargos/permissões | Alterações administrativas exigem proprietário; perfil próprio valida tipo de identidade; nenhuma elevação por nome de cargo no token |
| Pagamentos | Módulo pagamentos; pagamento, cliente e agendamento na clínica |
| Tarefas/metas | Clínica, ações e acesso próprio/equipe; metas da equipe exigem permissão explícita |
| Campanhas | Clínica e ações de campanha; destinatários manuais também são filtrados pela clínica |
| Notificações | Clínica ativa e destinatário, tanto na listagem como na atualização |
| Integrações/cobrança | Conexão e operações administrativas exigem proprietário; callbacks/webhooks usam autenticação própria |
| Uploads | Sessão na API; mídias privadas mantêm assinatura por caminho/clínica; logos públicos legados continuam como antes |

O manifesto verifica cobertura de rotas, não prova sozinho a correção de todas as consultas. Testes comportamentais exercitam autenticação real com persistência simulada e fixtures de duas clínicas.

## Migração obrigatória antes da nova versão

Arquivo: `server/scripts/migrate-security-isolation.ts`. NÃO executar `prisma db push` para substituir essa migração: ele não separa os cadastros nem preserva os vínculos.

1. Fazer backup completo e testar restauração em um PostgreSQL isolado de homologação. Configurar a conexão desse ambiente sem copiar segredos para logs.
2. Gerar o Prisma Client da nova versão: `npx prisma generate`.
3. Conferir o alvo e obter contagens com `npx tsx server/scripts/migrate-security-isolation.ts`. Sem `--apply`, o comando é somente leitura; essa contagem não é uma simulação completa.
4. Interromper todas as escritas, inclusive workers e webhooks, antes da aplicação. Em homologação, executar `npx tsx server/scripts/migrate-security-isolation.ts --apply`.
5. A transação serializável adiciona as colunas, cria uma cópia de cada cadastro compartilhado em cada clínica do proprietário, remapeia `appointments.service_id` e `fichas.template_id`, materializa as permissões e torna as colunas obrigatórias. Pacientes e fichas não são copiados. O primeiro cadastro mantém o ID; as demais clínicas recebem IDs novos.
6. Registros sem proprietário ou vínculos históricos fora das clínicas esperadas abortam a transação. Resolver os IDs apontados, revisar os dados e repetir. Não usar uma clínica padrão para esconder inconsistências.
7. Conferir contagens, vínculos e acessos de proprietário, funcionário restrito e usuário multiempresa; executar novamente e confirmar `alreadyApplied: true`. A marca de versão impede duplicação.
8. Só depois repetir o procedimento aprovado na produção e publicar backend/frontend juntos. Evitar versões antiga e nova simultâneas. Manter `RUN_PRISMA_DB_PUSH=false`.

Uma falha antes do commit desfaz as alterações da transação; sequências PostgreSQL podem avançar. Após o commit, a reversão exige procedimento de restauração planejado: não há down migration que una cadastros que já possam ter sido editados separadamente. Guardar backup até a homologação e o aceite operacional.

Os cargos criados futuramente começam sem acesso; a tela de cargos permite liberar os módulos e ações explicitamente. A inicialização não reativa negativas gravadas. Revisar o cargo `Acessos legados — revisar` quando ele for criado pela migração para usuários sem cargo local.

## Verificação e limites

Validação local em 01/11/2026: TypeScript do backend e build de produção aprovados. A suíte Vitest executou 164 testes; houve um timeout na leitura da matriz sob carga, corrigido com prazo específico de 20 segundos, e a reexecução direcionada passou (8/8, incluindo matriz, migração e usuários). Os outros 163 haviam passado na suíte completa. Dashboard e segurança de sessões passaram em 39/39 testes Node. O Node 26 exigiu desativar seu Web Storage experimental nos testes jsdom. Nenhum teste utilizou banco de produção.

- `npx tsc -p tsconfig.server.json --noEmit`
- `npx vitest run` (suítes HTTP usam localhost e persistência simulada).
- No Node 26, usar `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` para o jsdom fornecer o armazenamento de navegador dos testes.
- `npm run build`
- `node --import tsx --test server/middleware/session-revocation.test.ts server/services/session-security.test.ts`

As fixtures cobrem isolamento de mensagens inclusive dentro da mesma clínica, troca de clínica por cabeçalho, IDs coincidentes entre tipos de conta, cadastros do mesmo proprietário, vínculos externos, notificações, elevação de privilégios, bloqueio por ausência de permissões e transformação da migração. A migração ainda precisa de ensaio em PostgreSQL com cópia restaurada e teste real de rollback/constraints. Não foi executada contra produção.

Etapas 2–5 do plano (rotação de chaves, sessão por cookie/MFA, revisão ampla de logs/arquivos e infraestrutura) não são entregues por esta mudança.
