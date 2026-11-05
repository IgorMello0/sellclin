# Workflows externos de atendimento

Aplique `database/bot-configuracoes.sql` (instalação inicial) e depois `database/bot-n8n.sql`, com backup e `psql -v ON_ERROR_STOP=1`, antes de iniciar a imagem. A segunda migração é repetível e preserva bots nativos. Não altera o webhook do WhatsApp.

Em Bots de atendimento, escolha Workflow n8n, cadastre a URL HTTPS pública de produção, token e espera de 5 a 25 segundos. URLs com credenciais, query string, redirecionamentos, porta não padrão ou endereço privado são recusadas. Mesmo origens privadas autorizadas para outras integrações não são permitidas aqui. Use o domínio HTTPS público do n8n, inclusive quando ele estiver na mesma VPS.

O token é criptografado no servidor; não retorna na API. Campo vazio preserva o token salvo. Mudar a URL exige informar o token novamente. Salvar desativa o bot e invalida o Playground. Trocar conexão exige nova validação. O índice existente garante um único bot ativo por clínica, somando nativos e externos.

## Configurar o n8n

Importe `public/examples/sellclin-n8n.json`. No Webhook, configure Header Auth com nome `Authorization` e valor `Bearer SEU_TOKEN`. No SellClin, cole somente o token. Publique o workflow e use a URL de produção. O exemplo responde handoff até você personalizar as regras; não contém chave de IA nem envia mensagens.

O teste de conexão envia dados fictícios. O Playground envia o texto digitado, contexto e catálogo da clínica; não grava ações no SellClin. O workflow é um sistema externo: seu responsável precisa respeitar `mode=connection_test` e `mode=playground`, evitando efeitos externos. A interface informa esse compartilhamento. Não cadastre credenciais de WhatsApp no workflow.

## Contrato 1.0

POST JSON autenticado. Cabeçalhos `X-SellClin-Event-Id` e `X-SellClin-Schema-Version`. O corpo contém `schemaVersion`, `eventId`, `sentAt`, `mode` (live/playground/connection_test), `bot` (name/instructions/knowledge), `clinic` (timezone/currentDate), `contact` (phone quando atendimento real), `message.text`, `history` (até 14 mensagens com role customer/assistant), `state`, `capabilities`, `qualificationFields`, `services` e `specialists`. Campos opcionais podem estar ausentes no teste de conexão. Não há credenciais ou identificador de outra clínica no corpo.

Retorne HTTP 200 com um objeto JSON, sem envelope, HTML, array ou bloco Markdown. Resposta máxima: 64 KiB. Campos extras são rejeitados.

```json
{"action":"answer","reply":"Nosso endereço é Rua A, 10.","evidence":"Rua A, 10","clinical":false,"fields":[],"serviceId":null,"specialistId":null,"date":null}
```

`answer` exige evidence literal da base cadastrada ou catálogo. Para coletar dados:

```json
{"action":"qualify","reply":"Qual serviço deseja?","fields":[{"key":"nome","value":"Maria"}]}
```

O valor deve constar literalmente na mensagem atual e o campo precisa estar permitido. Nome e email atualizam o lead; outros campos ficam no histórico. Não crie leads diretamente pelo workflow.

Para horários, use IDs recebidos no catálogo e data pedida pela pessoa:

```json
{"action":"slots","reply":"Vou consultar os horários.","serviceId":12,"specialistId":null,"date":"2026-11-10"}
```

O SellClin consulta os horários reais, mostra as opções, exige escolha e CONFIRMAR e revalida a reserva. Não existe ação book no contrato. Para encaminhar: `{"action":"handoff","reply":"Vou encaminhar para a equipe."}`. Temas clínicos devem trazer `clinical:true` e handoff.

Não retorne companyId, credenciais, SQL ou instruções de execução. O SellClin valida tudo usando a clínica da conversa, verifica controle humano novamente e executa ações permitidas.

## Falhas e validação

Sem repetição automática do POST ao workflow. O eventId é estável para a execução ao vivo; a fila deduplica o evento de entrada. Extensões do workflow devem usar esse ID para sua própria deduplicação. Timeout, resposta inválida ou erro encaminham à equipe; envios sem confirmação não são repetidos cegamente. Sinais de controle humano e limites também se aplicam ao n8n.

Execute `npm run test:bots`, o build e a compilação do backend. Em homologação valide a credencial Header Auth, retorno da decisão, Playground, respostas nos dois canais, lead, agenda ocupada, confirmação repetida e assumir conversa durante a chamada. O JSON de exemplo precisa ser importado na versão de n8n usada pela clínica para validar a execução real. Nenhum workflow é publicado automaticamente por esta entrega.

Referências: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) e [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).

Validação local em 05/11/2026: 45 testes dos bots, 151 de regressão e 6 do transporte HTTP passaram. A compilação do backend passou; a checagem completa de tipos do frontend mantém os mesmos 32 erros preexistentes, sem novos apontamentos. A importação e execução no n8n real ainda precisam ser validadas com a instância e credencial da clínica.
