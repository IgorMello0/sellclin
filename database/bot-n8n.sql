-- Aplicar depois de bot-configuracoes.sql, antes da nova imagem.
BEGIN;
ALTER TABLE bot_configuracoes
  ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'native',
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS n8n_secret TEXT,
  ADD COLUMN IF NOT EXISTS n8n_timeout_seconds INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS contract_version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE bot_runs
  ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'native',
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS decision_action TEXT;
COMMIT;
