-- Apply after bot-configuracoes.sql and bot-n8n.sql. Safe to repeat.
BEGIN;
CREATE TABLE IF NOT EXISTS bot_clinic_settings (
  company_id INTEGER PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  api_key TEXT,
  verified_at TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE bot_configuracoes ADD COLUMN IF NOT EXISTS flow_definition JSONB;
-- Retain legacy per-agent configurations. The owner explicitly chooses shared
-- settings in the UI; no credential is silently selected from another bot.
COMMIT;
