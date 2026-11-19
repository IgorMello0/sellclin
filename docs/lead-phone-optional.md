# Telefone opcional no cadastro de leads

O nome permanece obrigatório. Telefone ausente é salvo como NULL, permitindo vários leads sem número na mesma clínica. Telefones informados continuam únicos por clínica. Edição e importação seguem a mesma normalização.

Antes de publicar o backend novo, faça backup e aplique `database/patches/20261119-lead-phone-optional.sql` com `psql -v ON_ERROR_STOP=1` no banco correto. É uma alteração repetível, sem apagar registros. Alternativamente, numa imagem compilada com esta atualização, execute `node dist-server/scripts/migrate-lead-phone-optional.js --apply`. Sem `--apply`, o script só consulta a obrigatoriedade da coluna.

A imagem em execução antes desta atualização não possui o script novo. Para aplicar com ela, use um PrismaClient diretamente ou o SQL pelo cliente PostgreSQL. Não usar `prisma db push` para esta alteração.

Aplique a alteração da coluna antes da troca para a versão nova; o código anterior continua aceitando telefones preenchidos. Não reverta a coluna para NOT NULL depois que existirem leads sem telefone.
