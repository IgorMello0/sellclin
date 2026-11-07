# Fluxos de atendimento

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
