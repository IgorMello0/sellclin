# Asaas: implantação e validação controlada

O envio ao Git não atualiza o banco nem comprova a configuração da VPS. Não abrir
novas vendas até validar o ciclo completo abaixo. Manter a imagem anterior para rollback.

## Antes de publicar a imagem

1. Fazer backup recente do banco de produção e verificar a leitura do dump.
2. Conferir o banco de destino. Aplicar **somente**
   `database/patches/20261019-asaas-identifiers.sql`, usando `psql -v ON_ERROR_STOP=1`.
   O script é transacional, aditivo e pode ser repetido; não copia dados de homologação
   nem altera as assinaturas AbacatePay. Não usar `db push --accept-data-loss`.
3. Confirmar as seis novas colunas e os cinco índices únicos. O stack mantém
   `RUN_PRISMA_DB_PUSH=false`: a aplicação não aplica esse patch automaticamente.
4. Preparar no ambiente **do container**, sem commitar segredos:

   ```dotenv
   BILLING_PROVIDER=asaas
   ASAAS_ENVIRONMENT=production
   ASAAS_API_KEY=<chave da conta Asaas de producao>
   ASAAS_WEBHOOK_TOKEN=<segredo aleatorio exclusivo de 32 a 255 caracteres, sem espacos>
   PUBLIC_APP_URL=https://sellclin.com
   ```

   Preservar DATABASE_URL, DIRECT_URL, JWT_SECRET, INTEGRATION_ENCRYPTION_KEY,
   ABACATEPAY_WEBHOOK_SECRET (ainda exigido na inicialização) e as
   demais configurações existentes. Não reutilizar as chaves do sandbox.
   Em Docker Swarm, um `.env` no disco não é carregado automaticamente por
   `docker stack deploy`: cadastrar as variáveis no Portainer/ambiente usado no deploy.
   Não imprimir o ambiente completo nos logs. Chaves Asaas nunca usam prefixo VITE_.
5. Gerar a imagem pelo Dockerfile e atualizar o serviço pelo procedimento da VPS.
   O frontend de produção deve usar `/api`, nunca localhost. Confirmar serviço saudável.

## Webhook e teste real

Na conta Asaas de produção, configurar:

- URL: `https://sellclin.com/api/webhooks/asaas`.
- Token de autenticação: exatamente o valor de ASAAS_WEBHOOK_TOKEN do container.
- API v3, envio sequencial.
- Eventos: CHECKOUT_PAID, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, SUBSCRIPTION_DELETED.

Ativar depois que o endpoint novo estiver publicado. Verificar no painel Asaas que
a fila está ativa e sem entregas com falha. Reenviar eventos pendentes após corrigir
eventuais erros. Um webhook sem token ou com token incorreto deve responder 401.

Com uma conta nova e pagamento **real autorizado** (produção cobra dinheiro):

1. Confirmar plano, valor e recorrência no checkout.
2. Confirmar que um cadastro sem pagamento não recebe acesso pago.
3. Pagar, conferir entrega HTTP 200 no Asaas e cadastro completed no SellClin.
4. Entrar com o email e a senha originais e concluir o onboarding.
5. Reenviar a mesma notificação: não deve duplicar empresa, profissional ou período.
6. Verificar renovação, troca de plano e cancelamento. A troca é aplicada no novo
   período confirmado; o cancelamento preserva acesso até o fim do período pago.

O retorno do checkout tem reconciliação adicional: consulta o Asaas no servidor e só
informa ativação após confirmar a conta no banco. Não substitui o webhook, pois o
cliente pode fechar a página. Não liberar acesso manualmente só porque o navegador
voltou com `signup=success`.

## Limitações desta versão

- Adicionais de clínica/usuário pelo Asaas ainda estão indisponíveis; a API rejeita
  a compra explicitamente. Os planos principais usam cartão recorrente.
- Um cadastro pendente pode retomar o mesmo checkout dentro de uma hora com a senha
  e o plano originais. Checkout expirado ou falha de criação exige reconciliação pelo
  suporte. Não sobrescrever o cadastro: pode haver pagamento com webhook atrasado.
- Reembolso e chargeback não revogam acesso automaticamente nesta versão; exigem
  conciliação operacional. Não confundir isso com cancelamento da assinatura.
- A troca de provedor não migra cobranças existentes do AbacatePay para o Asaas.

## Rollback

Voltar para a imagem anterior, preservando dados e colunas aditivas. Suspender novas
vendas Asaas se o endpoint não puder processar eventos e acompanhar a fila no Asaas.
Não apagar cadastros/identificadores nem cancelar cobranças automaticamente. A imagem
antiga não garante processamento dos pagamentos Asaas que já ocorreram; reconciliá-los
antes de reabrir vendas. Alterar BILLING_PROVIDER sozinho não desfaz cobranças.

## Verificações locais

```text
npx tsc --noEmit -p tsconfig.server.json
npx vitest run
npx tsx --test server/services/asaas-client.test.ts server/services/asaas-events.test.ts server/services/asaas-pricing.test.ts server/services/billing.test.ts
```

O teste `asaas-billing.integration.test.ts` é opt-in (`RUN_ASAAS_HOMOLOG_TEST=1`),
recusa qualquer banco que não seja `sellclin_homolog` em `127.0.0.1:15432` e cria
somente uma conta técnica example.invalid. O Asaas é simulado nesse teste; ele não
comprova entrega do webhook público nem autorização de cartão real.

No Node 25 local, executar Vitest com `NODE_OPTIONS=--no-experimental-webstorage`
para evitar colisão entre o Web Storage experimental do Node e o jsdom. O Dockerfile
usa Node 20. Testes HTTP precisam de acesso a portas locais efêmeras.
