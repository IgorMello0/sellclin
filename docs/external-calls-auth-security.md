# Revisão de chamadas externas, senhas e sessões

## Alterações de código

As chamadas explícitas de HTTP do backend para Evolution (incluindo caminhos legados, campanhas, alertas e diagnósticos), UAZAPI, Meta Graph, Google Calendar, AbacatePay e Resend usam `integrationHttpClient`. As operações de mídia continuam usando o carregador de mídia já protegido. As operações internas do SDK Google de OAuth/certificados continuam no SDK e usam os endpoints oficiais fixos; não recebem uma URL de destino escolhida pela clínica.

O cliente de integrações exige HTTPS na porta padrão por padrão. Recusa esquemas diferentes, credenciais embutidas, fragmentos, portas não autorizadas e qualquer resolução DNS que contenha IP privado, loopback, metadata ou faixa reservada. O transporte fixa o IP aprovado na conexão, mantendo hostname/TLS. Não segue redirecionamentos, para não encaminhar credenciais ou repetir uma operação de escrita em outro destino. Respostas são limitadas a 8 MB, inclusive após descompressão; requisições são limitadas a 20 MB após serialização; há prazo de 30 segundos e respeito ao sinal de cancelamento, inclusive durante DNS. Uploads FormData e respostas sem conteúdo foram preservados.

### Serviços internos legítimos

Somente o operador da VPS pode definir `TRUSTED_INTEGRATION_ORIGINS`, separando origens completas por vírgula. Exemplo sem segredo: `http://evolution:8080`. A autorização vale apenas para essa combinação exata de esquema, host e porta, sem caminho, query, usuário/senha ou curingas. Não é configurável pelo painel da clínica. Não copie esse exemplo sem confirmar que é o serviço usado na VPS.

Uma origem explicitamente autorizada pode acessar a rede privada ou uma porta diferente. Isso é uma concessão administrativa e deve se limitar ao serviço necessário. Prefira HTTPS quando disponível. Não autorize endpoints de metadata ou origens amplas. As URLs existentes que usem HTTP, portas alternativas ou redirecionamento precisarão ser conferidas antes de publicar. Para uma URL que redireciona, configure diretamente a raiz final correta da API.

`docker-stack.yml` inclui a variável opcional, e o validador de inicialização confere seu formato. Atualizar somente a imagem não altera o ambiente de um serviço Docker já criado. Serviços públicos HTTPS normais não exigem preencher a variável.

## Senhas e login

- Criação de senha no checkout, redefinição, aceite de convite, edição administrativa e troca autenticada seguem a mesma validação: string, mínimo atual de 6 caracteres e máximo de 72 bytes UTF-8 do bcrypt. Senhas com acentos podem atingir o limite com menos de 72 caracteres. Não há coerção de objetos/números para uma senha.
- A política mínima existente foi mantida nesta correção. Não foi implementada uma lista de senhas vazadas, MFA ou uma exigência de maior comprimento. Senhas existentes não foram regravadas.
- Login verifica a senha antes de informar que o e-mail ainda não foi verificado ou que o convite não foi aceito. Para uma conta inexistente também realiza uma comparação bcrypt com hash fictício, reduzindo a diferença óbvia de processamento. Não é uma garantia de tempo idêntico de ponta a ponta.
- Entradas de login malformadas são recusadas. Mantivemos compatibilidade de comparação das senhas legadas; o limite de 72 bytes é exigido nas novas gravações.
- Reenvio de verificação responde com o mesmo resultado público para uma conta já verificada ou inexistente. Falhas de envio no reenvio/recuperação ficam nos logs e não mudam a resposta conforme a existência da conta. Em produção, a ausência de Resend não é simulada como envio real pelo serviço. O remetente e a entrega precisam ser conferidos na VPS.
- O token Google de login precisa declarar e-mail verificado antes de vincular uma conta.
- Foram removidos logs de login com e-mail e diferenciação de conta inexistente/senha incorreta.

## Sessões e conexões

- Tokens com tipo `cliente` não entram no middleware das contas de clínica. Não existe emissor de sessão de portal de cliente no backend atual; permitir esse tipo sem consultar uma conta real deixava uma exceção às verificações de banco.
- Estado OAuth de Meta e Google Calendar tem propósito específico, proprietário identificado, IDs inteiros positivos, prazo e algoritmo HS256. Um JWT de sessão ou de outra integração não substitui esse estado.
- O callback confere novamente no banco se a clínica está ativa e ainda pertence ao proprietário que iniciou a conexão, antes de trocar o código no provedor.
- Links de conexão emitidos antes desta mudança precisam ser reiniciados. Conexões já salvas não são apagadas.
- Redefinição de senha e aceite de convite consomem o token e atualizam a conta na mesma transação. Uma falha de gravação desfaz o consumo. A atualização condicional de uso único permanece, impedindo consumo simultâneo.
- A revogação de sessões após trocar senha, implementada anteriormente, permanece em uso.

O estado OAuth continua sendo um token assinado e temporário, sem armazenamento de nonce para consumo único ou vínculo a cookie do navegador. Esta entrega não deve ser descrita como prevenção completa de replay ou como migração de sessão para cookies HttpOnly. Sessões continuam no modelo Bearer existente.

## Respostas da API

A filtragem de credenciais agora reconhece variações de maiúsculas/minúsculas e sublinhado, além de senha, marca de sessão, segredos de aplicativo/cliente, token administrativo e Authorization. Campos de webhook, diagnósticos, QR Code e código de pareamento são exclusivos do proprietário; a rota legada que gera QR Code também exige o proprietário. Tentativas de diagnóstico não devolvem corpo bruto, exceção nem URL do provedor, mesmo ao proprietário. A mensagem de falha do webhook Evolution também não embute o corpo bruto da última tentativa.

Os campos comuns de negócio e tipos especiais de dados são preservados. A filtragem não promete detectar qualquer segredo escrito arbitrariamente dentro de texto clínico ou de mensagens. Ela protege os campos e diagnósticos identificados.

## Validação e publicação

Passaram 84 testes locais distintos: cliente HTTP 6, senhas 2, estados OAuth 2, filtragem de respostas 2, rotas de autenticação 7, downloads 5, templates 13, integração WhatsApp 16, Meta 4, segurança de sessão 4, middleware de revogação 1, criptografia 6, mídias 6, rotas públicas 3 e faturamento 7. Há cobertura de SSRF por DNS/IP, autorização exata de serviço interno, bloqueio de redirecionamento com credenciais, multipart no transporte real local, cancelamento, limites após descompressão, política de senha, proteção de login/reenvio, transações de token, estados de integração e respostas.

O TypeScript do backend passou e o lint dos arquivos de segurança verificados passou. Nenhum arquivo frontend foi alterado nesta etapa; não se afirma que o build completo do frontend está aprovado. O teste antigo da configuração de faturamento recebeu a chave de criptografia fictícia no seu ambiente de teste para conferir os demais segredos obrigatórios sem conflitar com a nova exigência da etapa anterior.

O executor normal com subprocessos foi bloqueado pelo Windows com `spawn EPERM`. Os testes Node foram transpilados com TypeScript e executados diretamente, em processos separados pelo PowerShell, sem chamadas aos provedores reais. A transação real do PostgreSQL e os fluxos dos provedores continuam exigindo teste na VPS.

Não há novo patch SQL nesta etapa. A publicação ainda depende da chave e do patch da entrega anterior de criptografia; seguir `docs/encryption-deployment.md`. Conferir as origens das APIs antes de atualizar e depois testar envio/recebimento, campanhas com mídia, templates, e-mail, checkout e Google Calendar. Não houve alteração da página Recuperar senha, publicação ou rotação de segredos nesta etapa.
