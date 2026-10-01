-- Separa a responsabilidade atual do acesso historico concedido ao trocar um usuario de cargo.
-- Patch idempotente: pode ser executado novamente com seguranca.
BEGIN;

CREATE TABLE IF NOT EXISTS lead_visibility_grants (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'role_change',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lead_visibility_grants_lead_user_company_key UNIQUE (lead_id, user_id, company_id)
);

CREATE INDEX IF NOT EXISTS lead_visibility_grants_company_user_idx
  ON lead_visibility_grants(company_id, user_id);

COMMIT;
