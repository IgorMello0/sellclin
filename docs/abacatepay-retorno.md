# Retorno ao AbacatePay (modo de teste)

O aplicativo usa somente AbacatePay. As correções de interface e autenticação
foram preservadas. Nenhuma conta precisa ser apagada ou recadastrada.

## Ambiente e preços

O teste é definido pela **chave de Dev mode do AbacatePay**, não por NODE_ENV.
Mantenha NODE_ENV=production na VPS e a chave de teste já utilizada.
Fonte: https://docs.abacatepay.com/pages/authentication

Confira no serviço Docker (sem imprimir os valores das credenciais):

```sh
docker exec "$(docker ps -q --filter label=com.docker.swarm.service.name=sellclin_app)" \
  node -e 'for (const k of ["ABACATEPAY_API_KEY", "ABACATEPAY_WEBHOOK_SECRET", "ABACATEPAY_START_MONTHLY_PRODUCT_ID", "ABACATEPAY_PRO_MONTHLY_PRODUCT_ID", "ABACATEPAY_ENTERPRISE_MONTHLY_PRODUCT_ID"]) console.log(k, process.env[k] ? "presente" : "AUSENTE")'
```

Também configure os três IDs anuais `ABACATEPAY_{START,PRO,ENTERPRISE}_YEARLY_PRODUCT_ID`
e os IDs de adicionais que serão oferecidos. Os IDs devem ser produtos diferentes
por plano/ciclo, do mesmo ambiente da chave. As cobranças usam o preço do produto
no AbacatePay. Os valores exibidos no SellClin seguem os descontos combinados:

| Plano | Mensal | Total anual |
| --- | ---: | ---: |
| Start | R$ 197 | R$ 1.764 |
| Pro | R$ 297 | R$ 2.964 |
| Enterprise | R$ 497 | R$ 4.764 |

Antes de testar planos anuais, confira esses valores nos produtos do painel.
O preço de adicionais também vem do produto: R$ 100 mensais conforme combinado;
o preço anual dos adicionais ainda precisa ser definido pelos sócios.

O webhook do ambiente de teste deve apontar para:

`https://sellclin.com/api/webhooks/abacate-pay?webhookSecret=SEU_SEGREDO`

Use o mesmo segredo de `ABACATEPAY_WEBHOOK_SECRET`. Preserve a verificação de
assinatura do webhook. A conta só é criada após um evento válido do AbacatePay;
o parâmetro `signup=success` no navegador não confirma pagamento.

## Publicar a versão

No servidor, em `/opt/sellclin`, faça pull da main e reconstrua a imagem antes
de atualizar o serviço. Preserve os argumentos de build do Google Login usados
no deploy atual (`VITE_GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_ID`). O exemplo abaixo
reutiliza o client ID público presente no container atual:

```sh
git pull --ff-only origin main
sellclinGoogleClientId="$(docker exec "$(docker ps -q --filter label=com.docker.swarm.service.name=sellclin_app)" node -e 'process.stdout.write(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "")')"
docker build --build-arg "VITE_GOOGLE_CLIENT_ID=$sellclinGoogleClientId" -t sellclin:latest .
unset sellclinGoogleClientId
docker service update --force --update-order start-first \
  --env-rm BILLING_PROVIDER \
  --env-rm ASAAS_API_KEY --env-rm ASAAS_ENVIRONMENT \
  --env-rm ASAAS_WEBHOOK_TOKEN --env-rm ASAAS_ADDON_YEARLY_PRICE_CENTS \
  sellclin_app
docker service ps sellclin_app
curl --fail https://sellclin.com/api/billing/catalog
```

Execute cada comando somente se o anterior terminar com sucesso. O catálogo deve
retornar `provider: "abacatepay"`. A atualização preserva as variáveis AbacatePay
que já estão no serviço. Alterações no arquivo `.env` exigem atualizar o serviço;
não execute `source .env`, pois credenciais podem conter caracteres de shell.
Remova do `.env` as linhas `ASAAS_*` e `BILLING_PROVIDER`, desative o webhook
Asaas no painel e revogue a chave que não será mais utilizada.

Se o Google client ID existia somente no build anterior, use esse mesmo ID no
argumento de build; ele não é uma credencial secreta. Não publique uma imagem
construída sem esse argumento caso utilize o login com Google.

## Cadastros pendentes

- Sem checkout AbacatePay: repetir o formulário com a senha, plano e ciclo
  originais cria o checkout e preserva o cadastro.
- Com checkout AbacatePay: retorna o mesmo link, sem criar outra cobrança.
- Conta já criada: entrar pelo login; não criar outro cadastro.
- Falha explícita de configuração ou rejeição da API: corrigir e repetir.
- Resposta perdida ou timeout: verificar o provedor antes de repetir uma cobrança.
  O estado `checkout_unknown` exige conferir se o checkout foi criado; não limpar
  esse estado nem apagar o cadastro sem essa conferência.

## Banco e validação

Não use `prisma db push --accept-data-loss`. A versão funciona com as colunas
antigas presentes, portanto a limpeza não é requisito para disponibilizar o site.

Após publicar e validar, faça e verifique um backup novo. A limpeza opcional está
em `database/patches/20261024-remove-unused-asaas.sql`. Execute com
`psql -v ON_ERROR_STOP=1` no banco correto. Ela aborta se encontrar assinaturas
ou cadastros concluídos do Asaas e não exclui contas, senhas ou cadastros pendentes.

Valide um cadastro novo e um pendente: abrir checkout com **Modo simulação**,
simular pagamento, conferir entrega HTTP 200 do webhook, entrar com a senha do
cadastro e verificar o plano. Depois, testar renovação, troca de plano e cancelamento
no ambiente de teste. Os testes automatizados usam mocks; não substituem esse
teste de entrega do webhook entre AbacatePay e a VPS.
