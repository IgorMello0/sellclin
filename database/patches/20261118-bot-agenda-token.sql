BEGIN;
ALTER TABLE bot_configuracoes ADD COLUMN IF NOT EXISTS agenda_token_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS bot_configuracoes_agenda_token_hash_key
  ON bot_configuracoes (agenda_token_hash);
COMMIT;
