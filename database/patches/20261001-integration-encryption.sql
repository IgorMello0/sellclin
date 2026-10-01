-- Lookup index allows existing lead webhook URLs to work after API key encryption.
BEGIN;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64);
-- Ciphertext is larger than the token; do not rely on legacy VARCHAR limits.
ALTER TABLE empresas
  ALTER COLUMN api_key TYPE TEXT,
  ALTER COLUMN meta_token TYPE TEXT,
  ALTER COLUMN meta_two_step_pin TYPE TEXT,
  ALTER COLUMN meta_webhook_verify_token TYPE TEXT,
  ALTER COLUMN uazapi_token TYPE TEXT;
ALTER TABLE whatsapp_connections
  ALTER COLUMN access_token TYPE TEXT,
  ALTER COLUMN webhook_verify_token TYPE TEXT;
ALTER TABLE google_calendar_connections
  ALTER COLUMN access_token TYPE TEXT,
  ALTER COLUMN refresh_token TYPE TEXT;
CREATE INDEX IF NOT EXISTS empresas_api_key_hash_idx ON empresas(api_key_hash);
COMMIT;
