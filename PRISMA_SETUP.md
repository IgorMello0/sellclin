# Prisma no SellClin

O schema fica em `prisma/schema.prisma` e o cliente compartilhado em
`server/prisma.ts`. O Prisma é usado exclusivamente no backend.
Os componentes React acessam os endpoints autenticados por `src/lib/api.ts`.
As rotas validam as permissões e o vínculo com a clínica antes de acessar dados.

Os antigos exemplos `src/lib/database.ts` e `src/lib/prisma.ts` foram removidos:
não tinham consumidores e usavam modelos que não correspondem ao schema atual.

## Desenvolvimento

- Configure DATABASE_URL no ambiente do servidor, sem versionar credenciais.
- `npx prisma generate` atualiza o cliente local; não altera o banco.
- `npm run prisma:studio` abre a ferramenta de inspeção do banco configurado.
- `npm run typecheck` verifica os tipos do frontend.
- `npx tsc -p tsconfig.server.json --noEmit` verifica os tipos do backend.
- `npm run build` gera o cliente, verifica os tipos do frontend e cria o bundle.

Mudanças de schema devem seguir as migrações e os scripts de implantação
documentados para a funcionalidade. Valide primeiro em homologação e revise o
banco de destino antes de executar comandos que alterem sua estrutura.
