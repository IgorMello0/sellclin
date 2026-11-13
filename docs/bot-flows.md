# Fluxos de atendimento

## Memória externa do n8n

O payload inclui `contact.phone` (DDI + DDD + número, somente dígitos),
`contact.id`, `conversation.id` e `conversation.memoryKey`. Use
`{{$json.body.conversation.memoryKey}}` após o Webhook como chave da memória:
ela combina clínica e telefone, preservando a continuidade entre mensagens e
evitando colisão entre clínicas. `eventId` identifica uma execução/mensagem,
não uma conversa. `conversation.id` identifica a conversa do CRM.

`connection_test` e `playground` usam automaticamente o número fictício
`5500000000000`; não é necessário preencher telefone. A chave de memória
continua marcada como teste e separada por clínica, bot e modo. O telefone real
é enviado pelo worker em mensagens `live`. Um LID não é convertido em telefone.
O workflow deve respeitar o modo de teste e não executar envios externos.

### Campos compatíveis com workflows de texto existentes

Além de `message.text`, o payload oferece `message.message_id`,
`message.chat_id`, `message.content_type` (`text`), `message.content`,
`message.timestamp`, `message.content_url` (vazio para texto),
`message.event` (`incoming`), `body.event` (`messages.upsert`) e `telefone`
(mesmo valor de `message.chat_id`). No modo live são usados o identificador
do provedor e a data da mensagem, quando disponíveis. Os testes usam sempre o número fictício fixo,
com `conversation.isTest: true`.

Após o Webhook n8n, leia `{{$json.body.message.content}}`,
`{{$json.body.message.chat_id}}` e `{{$json.body.telefone}}`. O campo de evento
compatível aninhado é `{{$json.body.body.event}}`. O envelope de entrada
do n8n adiciona o primeiro `body`; ele não deve ser confundido com o payload.
Não são enviados `evoDomain`, `evoInstance` ou `evoAPIKey`: os envios permanecem
sob responsabilidade do SellClin, pelo provedor da clínica.

## Interface disponível nesta fase

A interface pública está concentrada em **Configurações → Atendimento n8n**
(`/configuracoes?tab=atendimento`). Ela permite salvar URL/token, testar a
conexão, simular conversas e ativar/desativar o atendimento. Conexões n8n
existentes são reaproveitadas. Havendo mais de uma, a página permite selecionar.
As rotas antigas `/bots` e `/fluxos` levam à configuração n8n.

Provedor/modelo/chave de IA nativa, base de conhecimento e editor visual estão
ocultos nesta fase. As capacidades descritas abaixo são preservadas no código
para uma entrega futura. Nenhuma migração adicional é necessária para essa
mudança de interface.

Configurações → Atendimento e IA reúne provedor, modelo, chave, comportamento,
base de conhecimento, campos de qualificação, limites e agenda da clínica.
Cada clínica utiliza sua chave. Salvar essas configurações desativa os fluxos
e invalida os testes, inclusive os de n8n, pois as regras compartilhadas mudaram.
Credenciais antigas por bot são preservadas até a clínica salvar a configuração
compartilhada. A nova configuração passa a ser a fonte usada por todos os fluxos.

Fluxos permite criar modelos, editar blocos conectados, testar no Playground e
ativar um atendimento por clínica. Menus usam números, compatíveis com Meta e
Uazapi. O bloco de IA continua com dúvidas, qualificação e agendamento; reservas
exigem confirmação explícita e revalidação de disponibilidade pelo servidor.
O modo n8n mantém URL, token e teste de conexão no próprio fluxo.

## Atualização do banco antes do deploy

Somente construir a imagem não atualiza o banco. Faça um backup legível antes
de aplicar SQL. No diretório do projeto da VPS, com o container PostgreSQL em
execução e o banco confirmado como `sellclin`:

```sh
sellclinPg=$(docker ps -q --filter label=com.docker.swarm.service.name=postgres_postgres)
test -n "$sellclinPg" || exit 1
mkdir -p /root/sellclin-backups
sellclinDump=$(mktemp /root/sellclin-backups/pre-fluxos-XXXXXXXX.dump)
chmod 600 "$sellclinDump"
docker exec "$sellclinPg" pg_dump -U admin -d sellclin -Fc > "$sellclinDump" || exit 1
docker exec -i "$sellclinPg" pg_restore -l < "$sellclinDump" >/dev/null || exit 1
for sellclinSql in database/bot-configuracoes.sql database/bot-n8n.sql database/bot-flows.sql; do
  docker exec -i "$sellclinPg" psql -U admin -d sellclin -v ON_ERROR_STOP=1 < "$sellclinSql" || exit 1
done
```

Os scripts são repetíveis. Depois construa a imagem e atualize o serviço, conforme
o procedimento de deploy existente. Reinicie o backend após aplicar as migrações,
pois a fila verifica a estrutura na inicialização. Não use `db push` como
substituto: o índice exclusivo e o trigger de mensagens estão nos scripts SQL.

## Validação

1. Salvar e testar a chave em Atendimento e IA.
2. Criar um fluxo, revisar conexões, salvar e validar o fluxo e conexão.
3. Testar menu, coleta, transferência e agenda no Playground.
4. Aprovar os custos e ativar. Testar WhatsApp Meta e Uazapi com números de teste.
5. Assumir a conversa como humano e verificar a pausa do fluxo.

O Playground não grava leads ou reservas. O teste real dos provedores exige
credenciais e conexão WhatsApp da clínica; testes automatizados usam simulações.

## Arquivos em Base64 enviados ao n8n

O worker externo encaminha a mídia ao workflow, em vez de transformá-la em texto ou transferir automaticamente o áudio à equipe. Mensagens do n8n são processadas individualmente: um áudio não é descartado porque outro evento chegou em seguida. As verificações de plano, controle humano e limites continuam em vigor.

Para texto, `message.content_type` é `text`, `message.content` contém o texto e `message.content_url` é vazio. Para áudio, `content_type` é `audio`, `content_url` é o link temporário do arquivo, `base64` contém o arquivo já decifrado, `encoding` é `base64`, `file_size` informa os bytes originais, `mime_type` indica o formato e `file_name` informa o nome. O mesmo vale para `image`, `video`, `sticker` e `document` (PDF). Não confundir `content` (legenda/texto quando houver) com o conteúdo binário do áudio.

```json
{
  "message": {
    "message_id": "exemplo-audio-1",
    "chat_id": "5500000000000@s.whatsapp.net",
    "content_type": "audio",
    "content": "",
    "timestamp": "2026-11-12T21:00:00Z",
    "content_url": "https://sellclin.com/uploads/media/2/exemplo.mp3?expires=EXPIRACAO&mediaSignature=ASSINATURA",
    "base64": "QllURVNfRE9fQVJRVUlWTw==",
    "encoding": "base64",
    "file_size": 16,
    "mime_type": "audio/mpeg",
    "file_name": "exemplo.mp3",
    "event": "incoming"
  },
  "body": { "event": "messages.upsert" },
  "telefone": "5500000000000@s.whatsapp.net"
}
```

O Base64 e a URL acima são ilustrativos. Para sua divisão de mensagens, use `{{$json.body.message.content_type}}`; no nó Convert to File → Move Base64 String to File, leia `{{$json.body.message.base64}}`, com MIME type de `{{$json.body.message.mime_type}}` e nome de `{{$json.body.message.file_name}}`. Se um nó anterior removeu o envelope do Webhook, remova `.body` dessas expressões. A string Base64 é pura, sem prefixo `data:`. O arquivo não precisa ser buscado novamente na Evolution.

 URLs reais são assinadas para um único arquivo da clínica, válidas por até 24 horas. No n8n, após o Webhook, faça GET de `{{$json.body.message.content_url}}` com HTTP Request configurado para resposta File; o binário resultante pode seguir para transcrição/IA. Após um nó que remove o envelope, use `{{$json.message.content_url}}`. Não precisa enviar token do WhatsApp no download desse link.

Na Meta, usa-se o arquivo já baixado pelo backend (por exemplo, OGG). Na Uazapi, o backend usa `/message/download`, solicita MP3 para áudio, baixa o arquivo decifrado e publica somente a cópia local assinada. Downloads usam proteção contra acesso a redes privadas e limite de 10 MB por arquivo para manter o JSON Base64 abaixo do limite de transporte. Arquivos acima desse tamanho são recusados sem truncamento; configurar o proxy e o n8n para aceitar o JSON enviado (um arquivo de 10 MiB gera cerca de 13,4 MiB de Base64, além dos metadados). Falhas geram `workflow_media_unavailable`, sem expor respostas ou credenciais do provedor. Formatos não suportados não são disfarçados como texto. Não há nova migração de banco nesta alteração.

Os campos `evoDomain`, `evoInstance` e `evoAPIKey` não são incluídos: o transporte de WhatsApp continua no SellClin. O n8n devolve a decisão pelo contrato existente.

Validação com provedores simulados não substitui um teste real após a publicação: conferir áudio Meta/Uazapi, acesso ao link a partir do n8n e o formato aceito pela IA escolhida. Referências: [Download Uazapi](https://docs.uazapi.com/endpoint/post/message~download) e [HTTP Request n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
