# Alertas de falhas

## Painel

O backend verifica falhas a cada minuto. O sino recebe avisos para o proprietário
da clínica e usuários ativos com papel de administrador, incluindo acesso
administrativo por clínica. Um clique abre Campanhas ou Integrações.

- Campanha com falhas: um aviso por campanha, inclusive falhas de entrega que a
  Meta comunicar depois do envio. O detalhamento atualizado está em Campanhas.
- Integração nos estados error, failed ou expired: um aviso por conexão por dia.
- Webhook que falhou: um aviso por clínica por dia. Não inclui credenciais,
  conteúdo de mensagens ou payloads nos avisos.

A verificação considera registros atualizados nas últimas 24 horas e usa as
notificações existentes para deduplicar, inclusive após reiniciar o backend.
Ler um aviso não faz o mesmo incidente gerar outro. Desconexões voluntárias não
geram alertas. Nenhuma alteração de estrutura do banco é necessária.

## Monitor externo por e-mail

O monitor precisa rodar em OUTRA máquina, fora da VPS do SellClin. Ele está em
`scripts/monitor-health.mjs` e requer Node 20 ou superior. Não é ativado pelo
deploy da aplicação. Defina, no ambiente do monitor:

```dotenv
MONITOR_HEALTH_URL=https://sellclin.com/api/health
MONITOR_ALERT_EMAIL=email-do-responsavel
RESEND_API_KEY=chave-da-resend
EMAIL_FROM="SellClin <noreply@sellclin.com>"
MONITOR_STATE_FILE=/opt/sellclin-monitor/health-state.json
```

Use um remetente já verificado na Resend. Guarde as variáveis em arquivo com
permissão 600, fora do repositório. Execute uma vez por minuto, sem sobrepor
execuções. Exemplo de cron em uma máquina Linux externa, com o script e o arquivo
de ambiente em `/opt/sellclin-monitor`:

```cron
* * * * * /usr/bin/flock -n /opt/sellclin-monitor/monitor.lock /bin/bash -c 'set -a; source /opt/sellclin-monitor/monitor.env; set +a; /usr/bin/node /opt/sellclin-monitor/monitor-health.mjs' >> /opt/sellclin-monitor/monitor.log 2>&1
```

Cada verificação tem timeout de 10 segundos. Três falhas consecutivas geram um
e-mail; novas verificações da mesma indisponibilidade não repetem o alerta. Quando
API e banco voltam a responder, envia um e-mail de recuperação. Uma falha no
envio de e-mail é registrada e permite nova tentativa no próximo ciclo.

O destino dos e-mails e a máquina externa ainda precisam ser configurados pelo
responsável. Não use a mesma VPS: ela não conseguiria avisar sobre sua própria
queda. Monitore também a execução do agendador externo e faça rotação do log.
