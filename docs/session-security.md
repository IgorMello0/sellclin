# Sessões e links de acesso

## Alterações

- O middleware de autenticação aceita somente JWT HS256 com expiração e identidade válida (`id` inteiro positivo e tipo `profissional`, `usuario` ou `cliente`). Tokens de estado OAuth não podem funcionar como sessões. As sessões de login existentes usam esse formato.
- O consumo de links de verificação, convite e recuperação exige uma atualização condicional no banco: token ainda não usado, do tipo esperado e ainda não expirado. Duas requisições concorrentes não conseguem consumir o mesmo link.
- Variantes privadas de `.env` estão ignoradas pelo Git. Arquivos de exemplo continuam permitidos. Isso não remove segredos do histórico nem revoga chaves já expostas.

Não há alteração de schema nem necessidade de patch SQL nesta etapa.

## Validação

Testes cobrem sessões válidas, identidade malformada, token OAuth, algoritmo diferente, assinatura incorreta, expiração ausente/vencida e consumo concorrente. Os testes do consumo verificam a condição enviada ao banco e a decisão baseada no número de registros atualizados; a concorrência não foi exercitada contra o banco da VPS.

## Pendências antes do lançamento

- Rotacionar segredos que tenham sido expostos no histórico, especialmente JWT_SECRET, com atualização coordenada da VPS. Trocar JWT_SECRET encerra sessões existentes. Não foi feita rotação automática.
- Revisar armazenamento e exposição de tokens de integrações e acesso aos arquivos enviados por clínica, considerando que provedores WhatsApp precisam buscar determinadas mídias por URL.
- Planejar revogação de sessões após troca/recuperação de senha; as sessões atuais continuam válidas até expirar. Isso exige implementação adicional.
- Conferir backup e restauração, acesso SSH e exposição de portas do banco na infraestrutura.
- Fazer os testes de integração em produção descritos em `immediate-security.md` antes de concluir a publicação.

Essas proteções reduzem riscos específicos; não equivalem a uma auditoria completa do sistema e da VPS.
