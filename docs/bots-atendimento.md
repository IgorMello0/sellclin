# Bots de atendimento nativos

O módulo está em `/bots`, para o proprietário da clínica. Os canais iniciais são WhatsApp Meta e Uazapi. Cada clínica cadastra sua própria chave OpenAI ou Anthropic, escolhe um modelo habilitado nessa conta e assume o custo diretamente no provedor.

## Preparar o banco antes de iniciar a nova imagem

1. Faça backup do banco de destino e confira sua legibilidade.
2. Aplique **`database/bot-configuracoes.sql`** com `psql -v ON_ERROR_STOP=1` no banco de homologação. Após validar, aplique a mesma migração em produção antes da troca de imagem.
3. Compile e inicie a nova versão. `prisma generate` gera o cliente; **`prisma db push` sozinho não instala a fila nem o índice parcial**.
4. Verifique a estrutura:

```sql
SELECT to_regclass('public.bot_configuracoes'),
       to_regclass('public.bot_sessions'), to_regclass('public.bot_runs');
SELECT indexname FROM pg_indexes
WHERE indexname = 'agentes_ia_um_ativo_por_clinica';
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname = 'sellclin_bot_message_received' AND NOT tgisinternal;
```

A migração é transacional e repetível. Preserva os agentes antigos como rascunhos e preserva conversas com histórico humano como pausadas. Não altera assinaturas, cobranças ou credenciais existentes. Não é necessário cadastrar um novo webhook: a mensagem persistida pelos webhooks existentes aciona a fila na mesma transação do banco.

O backend precisa permanecer em execução (como no serviço Docker atual). O processamento não depende de uma página aberta nem de n8n. Em execução serverless sem processo persistente é necessário hospedar o worker separadamente.

## Configurar uma clínica

- Manter `INTEGRATION_ENCRYPTION_KEY` no servidor, com a mesma chave usada pelas demais integrações. Nunca trocar essa chave sem migrar as credenciais criptografadas.
- Conectar Meta ou Uazapi na clínica usando a configuração existente. Para Meta, o bot respeita a janela de atendimento; para Uazapi, utiliza `UAZAPI_API_URL` ou `UAZAPI_BASE_URL` já configurados. A versão Meta usa `META_GRAPH_VERSION`, com padrão `v22.0` nesta integração.
- Criar um bot a partir de um modelo ou em branco. Preencher instruções, informações da clínica e perguntas frequentes. Pode importar texto de arquivos `.txt` ou `.md`; limite total de 40 mil caracteres.
- Salvar provedor, modelo e chave. A chave não volta na resposta da API e não fica no prompt. O campo vazio mantém a chave; existe uma opção explícita para removê-la. Mudar o provedor sem fornecer outra chave remove a anterior.
- Configurar campos de qualificação (`nome`, `email` e campos adicionais para o histórico), termos de transferência, limites, fuso e dias de atendimento. A agenda usa abertura/fechamento da clínica. Serviços precisam estar ativos e ter duração. O cliente pode escolher o profissional do serviço ou um especialista ativo da clínica.
- Testar a chave e conversar no Playground. O Playground usa a mesma decisão e consulta de horários do atendimento, mas não escreve leads/agendamentos nem envia WhatsApp. Testes de chave e Playground consomem créditos da clínica.
- Revisar as respostas, confirmar responsabilidade pelo consumo e ativar. Ativar um bot desativa o outro da mesma clínica. Editar instruções/configuração desativa o bot e exige novo teste antes da reativação.

## Regras do atendimento

- Mensagens da clínica nunca entram na fila de outra clínica. O banco impede dois bots ativos na mesma clínica e duas tarefas para a mesma mensagem.
- O bot atende mensagens novas após a ativação, sem responder retroativamente ao histórico antigo. Pequenas sequências são agrupadas antes da resposta; há limite por conversa e limite de execuções nas últimas 24 horas.
- Qualificação usa apenas campos permitidos e valores que o contato informou. Nome/e-mail atualizam o lead; demais respostas ficam em seu histórico. O pipeline existente cria o lead quando o contato chega pelo WhatsApp.
- Agendamento: consultar horários → escolher um número → responder **CONFIRMAR**. O servidor revalida clínica, serviço, profissional, duração, dias e conflitos dentro da transação. A confirmação consome a proposta. Ofertas valem 15 minutos, e a reserva pode falhar se alguém ocupar o horário nesse intervalo. **CANCELAR** descarta a escolha atual, sem cancelar um agendamento já gravado.
- As gravações manuais da agenda usam a mesma trava de banco que o bot. As permissões de agenda e funil da clínica também são verificadas pelo atendimento automático.
- Mensagem humana no SellClin ou no celular conectado pausa a conversa. Atribuição manual também pausa. O responsável atual continua com a conversa; sem responsável, ela fica na fila da clínica. A equipe pode retomar o bot ativo pelo menu da conversa; ele responde a partir da próxima mensagem do contato.
- Pedido de humano, tema clínico, falta de informação, limite atingido, mídia não interpretada ou indisponibilidade da IA encaminham para a equipe. O bot inicial trabalha com texto; arquivos e áudios são transferidos para atendimento humano.
- Não há garantia de entrega exatamente uma vez por uma API externa. Se um envio ficar sem confirmação, o registro fica como **Revisar envio**, a conversa é pausada e o sistema não repete o envio automaticamente. A equipe confere o histórico antes de retomar.
- Tarefas interrompidas são recuperadas pelo worker. Registros de execução contêm estado, motivo, duração e tokens, sem chave ou conteúdo bruto do provedor. O custo monetário deve ser conferido no painel do fornecedor da chave.

## Testes

```powershell
npm run test:bots
npm run test:whatsapp
npx vitest run --config vitest.config.ts
npx tsc -p tsconfig.server.json --noEmit
npm run build
```

A suíte dos bots utiliza provedores simulados e PostgreSQL em memória (`PGlite`), sem ler o banco configurado no `.env`. Cobre banco, API, isolamento, credenciais, interface, Meta/Uazapi, transferência, limites, confirmação, concorrência e falhas de envio.

Validação desta entrega (05/11/2026): 36 testes dos bots, 151 testes de regressão e 21 testes de WhatsApp passaram; o build Vite e a compilação TypeScript do backend também passaram. A atualização de nomes de contatos da equipe (`3c69aec`) foi incorporada antes da publicação. A verificação completa de tipos do frontend mantém os mesmos 32 erros já presentes na `main` de referência (`c9f6d3e`), sem novos erros introduzidos por esta entrega. A imagem Docker não foi construída neste computador, que não tem Docker instalado.

Na homologação, usar uma clínica de teste, a chave do provedor escolhida e números autorizados. Validar nos dois canais: dúvida conhecida/desconhecida; qualificação; agenda livre/ocupada; confirmação repetida; pausa/retomada por humano; troca de bot; falha da chave; arquivo recebido. Depois conferir os registros de execução e o histórico do lead/agendamento. A resposta real do modelo e o recebimento no celular precisam dessa rodada com as credenciais da clínica.

Referências usadas na integração: [OpenAI Responses](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) e [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create). A resposta JSON de ambos é validada no servidor antes de qualquer ação.
