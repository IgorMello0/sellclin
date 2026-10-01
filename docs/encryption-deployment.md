# Publicação da criptografia e proteção de downloads

## O que mudou

O cliente Prisma criptografa credenciais de empresa, conexão WhatsApp e Google Calendar antes de gravar e as decifra somente no backend. AES-256-GCM usa um nonce aleatório por gravação e autentica o campo. A chave de criptografia é independente de JWT_SECRET. Novas gravações de credenciais falham se essa chave estiver ausente; em produção, a aplicação também recusa iniciar sem ela.

Os campos protegidos são `apiKey`, `metaToken`, `metaTwoStepPin`, `metaWebhookVerifyToken`, `uazapiToken`, `WhatsAppConnection.accessToken`, `WhatsAppConnection.webhookVerifyToken`, `GoogleCalendarConnection.accessToken` e `GoogleCalendarConnection.refreshToken`. Isso não criptografa o banco inteiro: dados clínicos, arquivos, tokens de roteamento webhook e outras informações mantêm o formato atual.

O índice `empresas.api_key_hash` mantém as URLs existentes de entrada de leads funcionando após a criptografia da API key. O valor original continua disponível somente ao backend para falar com o provedor. Credenciais antigas em texto permanecem legíveis até a migração.

Os downloads de mídia feitos pelo servidor validam todos os IPs retornados pelo DNS, fixam o IP aprovado na conexão, bloqueiam redes internas/loopback/metadata e revalidam até três redirecionamentos. A autenticação é removida ao mudar a origem. Há limite de 16 MB e prazo de 30 segundos. Downloads da Meta aceitam somente domínios Meta conhecidos. Isso protege os downloads de mídia; não equivale a controlar todas as chamadas de API externa do sistema.

## Ordem obrigatória de implantação

**Não usar apenas os comandos antigos de rebuild e atualização de imagem nesta versão.** Há uma nova configuração obrigatória e um patch de banco.

1. Fazer backup do banco e garantir uma cópia restaurável. Usar uma janela de manutenção para a implantação/migração.
2. Gerar uma chave aleatória de 32 bytes, representada por 64 caracteres hexadecimais. Salvá-la como `INTEGRATION_ENCRYPTION_KEY` na configuração privada da VPS e guardar uma cópia segura fora dela. Não enviar o valor pelo chat, Git ou capturas de tela. O serviço Docker precisa receber essa variável; atualizar somente a imagem não adiciona a variável ao serviço existente. Um ambiente local que use o mesmo banco criptografado também precisa da mesma chave.
3. Aplicar `database/patches/20261001-integration-encryption.sql` enquanto a versão anterior ainda está em execução. O patch adiciona uma coluna e um índice e garante campos TEXT para comportar a criptografia, preservando o conteúdo das credenciais. Como alternativa, executar o novo script `migrate-integration-credentials.js --prepare` em um processo com acesso ao banco e o cliente Prisma novo.
4. Construir a imagem nova e atualizar o serviço com imagem **e configuração de ambiente**, preservando as outras variáveis e redes. Conferir Nginx, saúde e login. Proprietários e funcionários devem entrar novamente devido à revogação de sessões da etapa anterior.
5. Confirmar que nenhum container antigo continua atendendo. **Não criptografar os valores enquanto a versão antiga estiver atendendo**, pois ela não sabe decifrá-los.
6. No container novo, executar a conferência sem alterações:

   ```bash
   APP_ID=$(docker ps --filter name=sellclin_app --filter status=running --format '{{.ID}}' | head -n 1)
   docker exec "$APP_ID" node dist-server/scripts/migrate-integration-credentials.js
   ```

7. Se a conferência não apontar credenciais inválidas, aplicar e verificar:

   ```bash
   docker exec "$APP_ID" node dist-server/scripts/migrate-integration-credentials.js --apply
   docker exec "$APP_ID" node dist-server/scripts/migrate-integration-credentials.js --verify
   docker exec "$APP_ID" node dist-server/scripts/verify-db-patches.js
   ```

   `--verify` deve terminar sem erros, com `plaintext`, `invalid`, `hashesMissing` e `concurrentChanges` iguais a zero. No modo `--apply`, `plaintext` representa a quantidade encontrada antes de gravar; por isso a verificação seguinte é necessária. Alterações concorrentes são preservadas e exigem outra conferência, sem sobrescrever o registro.

8. No checkout da VPS, rodar `bash server/scripts/vps-security-check.sh`. O script não altera firewall, SSH, banco, chaves ou serviços. Ele mostra indicadores de configuração, testa Nginx, exibe réplicas/portas e consulta a saúde. Acesso SSH e backups precisam de conferência do operador antes de qualquer alteração.
9. Testar envio e recebimento de texto/imagem/áudio/vídeo por cada provedor em uso, campanha com mídia, webhook de leads e Google Calendar. Os testes locais não usam o banco da VPS nem os provedores reais.

## Backup e reversão

Não substituir nem regenerar `INTEGRATION_ENCRYPTION_KEY` depois da migração: os dados existentes dependem dela. Fazer backup da chave junto do procedimento de recuperação, com acesso restrito e separado do banco. A chave não é rotacionada automaticamente nesta entrega.

Depois de criptografar dados, voltar apenas a imagem antiga não é uma reversão válida. A versão antiga não consegue ler os valores. Planejar a recuperação com o backup anterior e a janela de manutenção, considerando quaisquer gravações feitas após o backup.

Chaves anteriormente expostas ainda precisam ser revogadas/rotacionadas no provedor e na VPS. Criptografia não revoga uma chave vazada. Alterar JWT_SECRET não altera a chave de criptografia, mas encerra sessões e invalida links de mídia existentes; o sistema emite links novos ao carregar o histórico.

## Limites de validação

Testes locais cobrem criptografia/autenticação dos valores, proteção de gravações simples/aninhadas, lookup por hash, redes proibidas, DNS, redirecionamentos, limites de bytes/tempo e regressões de WhatsApp. A migração real do PostgreSQL e o diagnóstico da VPS devem ser executados no ambiente de implantação; não foram feitos localmente.
