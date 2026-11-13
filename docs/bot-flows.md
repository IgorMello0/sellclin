# Fluxos de atendimento

## Memória externa do n8n

O payload inclui `contact.phone` (DDI + DDD + número, somente dígitos),
`contact.id`, `conversation.id` e `conversation.memoryKey`. Use
`{{$json.body.conversation.memoryKey}}` após o Webhook como chave da memória:
ela combina clínica e telefone, preservando a continuidade entre mensagens e
evitando colisão entre clínicas. `eventId` identifica uma execução/mensagem,
não uma conversa. `conversation.id` identifica a conversa do CRM.

`connection_test` e `playground` usam identificadores com prefixo `test:` e
telefone nulo por padrão; a página permite informar um telefone de simulação.
Mesmo com telefone informado, a chave de memória continua separada da produção.
Filtre esses modos no workflow para não
enviar WhatsApp nem executar efeitos externos. O telefone real é enviado pelo
worker em mensagens `live`. Quando não existe telefone válido, a chave de
memória usa o identificador da conversa; um LID não é convertido em telefone.

### Campos compatíveis com workflows de texto existentes

Além de `message.text`, o payload oferece `message.message_id`,
`message.chat_id`, `message.content_type` (`text`), `message.content`,
`message.timestamp`, `message.content_url` (vazio para texto),
`message.event` (`incoming`), `body.event` (`messages.upsert`) e `telefone`
(mesmo valor de `message.chat_id`). No modo live são usados o identificador
do provedor e a data da mensagem, quando disponíveis. Sem telefone de teste,
o chat usa um identificador sintético claramente marcado como teste.

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
