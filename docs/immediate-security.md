# Proteções de acesso e webhooks

## Limites (janela de 15 minutos)

- Login: 30 requisições por IP e 10 por e-mail, compartilhadas entre profissionais e usuários. Tentativas bem-sucedidas também contam.
- Recuperação e reenvio de verificação: 20 por IP e 3 por e-mail, compartilhadas entre as duas operações.
- Redefinição, aceite de convite e login Google: 20 por IP, compartilhadas entre as três operações.
- Webhooks: 3.000 requisições por minuto por IP, antes de interpretar o corpo.

O bloqueio retorna HTTP 429 e `Retry-After`. Os contadores estão em memória, adequados à implantação atual com uma réplica. Antes de aumentar o número de réplicas, usar armazenamento compartilhado para os limites. O proxy deve remover cabeçalhos de IP fornecidos pelo cliente e encaminhar o IP real.

## Antes de publicar

1. Conferir que `META_APP_SECRET` está configurado no serviço e corresponde ao aplicativo Meta usado pela integração. Sem ele, os POSTs Meta retornam 503; assinatura ausente ou inválida retorna 403.
2. Para a verificação inicial Meta, configurar `META_WEBHOOK_VERIFY_TOKEN` ou o token específico da clínica. O valor padrão público foi removido.
3. Conferir que as instâncias Evolution usam `/api/webhooks/evolution/<webhookToken>`. A URL antiga sem token retorna 410. O sistema já gera a URL com token para as integrações.
4. CORS permite `https://sellclin.com`, `https://www.sellclin.com` e a origem de `PUBLIC_APP_URL`. Outras origens autorizadas devem ser listadas em `CORS_ALLOWED_ORIGINS`, separadas por vírgula, e repassadas ao serviço. Localhost é permitido somente fora de produção. Requisições sem Origin continuam funcionando; CORS não substitui autenticação.
5. Após publicar, validar login de proprietário e funcionário, recuperação de senha e recebimento de evento real de cada provedor usado. Não imprimir segredos no terminal.

As respostas de erro 5xx criadas pelo helper comum não incluem mensagens internas nem detalhes. Os logs do servidor continuam disponíveis para diagnóstico. Tokens inválidos dos webhooks Meta e Evolution não são impressos nos avisos.

## Testes

`npx tsx --test server/middleware/public-security.test.ts`

Os testes usam HTTP local para conferir limites compartilhados, normalização de e-mail e CORS, além de assinatura Meta e ocultação de erros. Não enviam e-mails, não acessam o banco e não acionam provedores.
