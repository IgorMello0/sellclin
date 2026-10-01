#!/usr/bin/env bash
# Read-only diagnostics. Never source or print the environment file.
set -eu
SC_APP_ID=$(docker ps --filter name=sellclin_app --filter status=running --format '{{.ID}}' | head -n 1)
if [ -z "$SC_APP_ID" ]; then printf 'Nenhum container sellclin_app em execução.\n'; exit 1; fi

docker exec "$SC_APP_ID" node -e '
const e = process.env;
const httpsOrigin = value => { try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !["localhost", "127.0.0.1"].includes(u.hostname); } catch { return false; } };
console.log(JSON.stringify({
  production: e.NODE_ENV === "production",
  jwtSecretConfigured: Boolean(e.JWT_SECRET && e.JWT_SECRET.trim().length >= 32 && e.JWT_SECRET !== "dev-secret"),
  integrationEncryptionKeyConfigured: /^[a-f0-9]{64}$/i.test(e.INTEGRATION_ENCRYPTION_KEY || ""),
  billingWebhookSecretConfigured: Boolean(e.ABACATEPAY_WEBHOOK_SECRET && e.ABACATEPAY_WEBHOOK_SECRET.trim().length >= 32),
  metaAppSecretConfigured: Boolean(e.META_APP_SECRET),
  metaGlobalVerifyTokenConfigured: Boolean(e.META_WEBHOOK_VERIFY_TOKEN && e.META_WEBHOOK_VERIFY_TOKEN !== "sellclin-verify"),
  publicAppUrlHttps: httpsOrigin(e.PUBLIC_APP_URL),
  corsExtraOriginsHttps: (e.CORS_ALLOWED_ORIGINS || "").split(",").filter(x => x.trim()).every(x => httpsOrigin(x.trim()))
}, null, 2));'

printf '\nValidação do Nginx:\n'
docker exec "$SC_APP_ID" nginx -t
printf '\nRéplicas e portas publicadas do aplicativo:\n'
docker service inspect sellclin_app --format 'replicas={{.Spec.Mode.Replicated.Replicas}} ports={{json .Endpoint.Spec.Ports}}'
printf '\nPortas de containers (confira exposição do banco):\n'
docker ps --format '{{.Names}} {{.Ports}}'
if command -v ufw >/dev/null 2>&1; then printf '\nFirewall:\n'; ufw status; fi
if command -v sshd >/dev/null 2>&1; then
  printf '\nSSH (somente leitura; sem alterar acesso):\n'
  sshd -T | awk '$1=="permitrootlogin" || $1=="passwordauthentication" || $1=="pubkeyauthentication"'
fi
printf '\nSaúde da aplicação:\n'
curl --fail --silent --show-error --max-time 20 https://sellclin.com/api/health
printf '\nBackups e restauração precisam ser conferidos separadamente.\n'
