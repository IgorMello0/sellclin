# Mídias e credenciais das integrações

## Mídias locais

Arquivos em `/uploads/media/<companyId>/<arquivo>` exigem uma assinatura HMAC vinculada ao caminho e uma expiração de 24 horas. Alterar a clínica, o arquivo ou a expiração invalida o link. Sem assinatura, o endpoint retorna 403. Os arquivos continuam no mesmo lugar; não é necessário migrar o banco.

O histórico e as respostas autenticadas renovam links das mídias da clínica ativa. O envio por conversas e cada envio de campanhas também renovam as assinaturas; campanhas retomadas não dependem da validade de URLs salvas anteriormente. O envio rejeita caminhos locais de outra clínica. Os leitores locais conferem a origem da URL e removem os parâmetros assinados antes de localizar o arquivo.

O link assinado funciona como uma credencial temporária: quem tiver o link pode abrir esse arquivo até expirar. Isso permite que Meta, Evolution e UAZAPI busquem mídia sem uma sessão do SellClin. Evitar compartilhar esses links fora do atendimento. Um histórico aberto por mais de 24 horas pode precisar ser atualizado para obter links novos.

Logos e fotos de perfil fora de `/uploads/media/` preservam o acesso público. Arquivos temporários `.source.` e arquivos ocultos não são servidos.

## Credenciais

As respostas autenticadas removem hashes de senha, chaves de API e tokens de acesso, inclusive dentro de objetos relacionados. Dados de verificação e URLs de webhook só são retornados ao proprietário da clínica ativa, identificado pelo banco. O diagnóstico Evolution exige proprietário. Login mantém o token de sessão necessário ao cliente.

Chamadas Graph comuns enviam o token pelo cabeçalho Authorization, em vez da URL. As trocas OAuth continuam usando os parâmetros exigidos pela integração. Os logs de acesso Nginx omitem parâmetros de consulta e ocultam caminhos de webhook.

## Publicação e testes reais

1. Conferir as configurações Meta/Evolution indicadas em `immediate-security.md`.
2. Publicar backend, frontend e Nginx juntos; versões anteriores do frontend com URLs sem assinatura podem precisar de atualização da página.
3. Todos os proprietários e funcionários deverão entrar novamente por causa da nova versão das sessões.
4. Conferir imagem, vídeo e áudio no histórico, envio manual, campanha com mídia e retomada de campanha. Os provedores externos não foram exercitados nos testes locais.
5. Conferir Nginx com `nginx -t` dentro do novo container. A configuração foi revisada, mas não há Nginx disponível no ambiente Windows para validá-la.

A criptografia em repouso e a proteção dos downloads externos de mídia foram implementadas na etapa seguinte; a aplicação na VPS segue `encryption-deployment.md`. Rotação de chaves e revisão das demais chamadas de API externa continuam separadas. Esta etapa não representa uma auditoria completa de segurança.
