-- Migração idempotente. Aplicar após backup, antes de iniciar a nova imagem.
BEGIN;
ALTER TABLE agentes_ia ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP(3);
ALTER TABLE agentes_ia ALTER COLUMN is_active SET DEFAULT false;
CREATE TABLE IF NOT EXISTS bot_configuracoes (
  agent_id INTEGER PRIMARY KEY REFERENCES agentes_ia(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai', model TEXT NOT NULL DEFAULT '', api_key TEXT,
  knowledge TEXT NOT NULL DEFAULT '', max_responses INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE bot_configuracoes
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS playground_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS qualification_fields JSONB,
  ADD COLUMN IF NOT EXISTS handoff_terms JSONB,
  ADD COLUMN IF NOT EXISTS qualify_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_limit INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS working_days JSONB;
-- Agentes antigos eram apenas cadastros. Exigir teste e ativação explícitos para começar a enviar.
UPDATE agentes_ia SET is_active = false WHERE activated_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agentes_ia_um_ativo_por_clinica ON agentes_ia(company_id) WHERE is_active = true;
CREATE TABLE IF NOT EXISTS bot_sessions (
  conversation_id INTEGER PRIMARY KEY REFERENCES conversas(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL, paused BOOLEAN NOT NULL DEFAULT false, reason TEXT,
  response_count INTEGER NOT NULL DEFAULT 0, state JSONB, busy_until TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bot_sessions_company_id_idx ON bot_sessions(company_id);
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS running_run_id INTEGER;
CREATE TABLE IF NOT EXISTS bot_runs (
  id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id INTEGER NOT NULL,
  conversation_id INTEGER REFERENCES conversas(id) ON DELETE CASCADE, message_id INTEGER UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL DEFAULT 'live', input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER, error_code TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bot_runs_status_created_at_idx ON bot_runs(status, created_at);
CREATE INDEX IF NOT EXISTS bot_runs_company_id_agent_id_created_at_idx ON bot_runs(company_id, agent_id, created_at);

-- Preservar atendimentos humanos iniciados antes desta implantação.
INSERT INTO bot_sessions(conversation_id, company_id, paused, reason)
  SELECT c.id, c.company_id, true, 'manual' FROM conversas c
  WHERE EXISTS(SELECT 1 FROM mensagens m WHERE m.conversation_id = c.id AND m.sender::text = 'profissional')
  ON CONFLICT(conversation_id) DO NOTHING;

-- Enfileirar na mesma transação que persiste a mensagem: não existe janela de perda entre webhook e fila.
CREATE OR REPLACE FUNCTION sellclin_bot_message_received() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE clinic INTEGER; bot INTEGER; enabled_at TIMESTAMP(3);
BEGIN
  SELECT c.company_id INTO clinic FROM conversas c WHERE c.id = NEW.conversation_id;
  IF NEW.sender::text = 'profissional' THEN
    INSERT INTO bot_sessions(conversation_id, company_id, paused, reason, state)
      VALUES(NEW.conversation_id, clinic, true, 'manual', '{}'::jsonb)
      ON CONFLICT(conversation_id) DO UPDATE SET paused = true, reason = 'manual', state = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP;
    UPDATE conversas SET agent_id = NULL WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;
  IF NEW.sender::text <> 'cliente' OR NEW.provider_message_id IS NULL THEN RETURN NEW; END IF;
  SELECT a.id, a.activated_at INTO bot, enabled_at FROM agentes_ia a
    JOIN bot_configuracoes b ON b.agent_id = a.id
    JOIN empresas e ON e.id = a.company_id
    WHERE a.company_id = clinic AND a.is_active AND b.verified_at IS NOT NULL
      AND e.is_active AND e.whatsapp_provider IN ('meta','uazapi');
  IF bot IS NULL OR NEW.created_at < enabled_at THEN RETURN NEW; END IF;
  INSERT INTO bot_runs(company_id, agent_id, conversation_id, message_id)
    VALUES(clinic, bot, NEW.conversation_id, NEW.id) ON CONFLICT(message_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sellclin_bot_message_received ON mensagens;
CREATE TRIGGER sellclin_bot_message_received AFTER INSERT ON mensagens FOR EACH ROW EXECUTE FUNCTION sellclin_bot_message_received();
COMMIT;
