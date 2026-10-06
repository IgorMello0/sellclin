-- Run this file directly with psql outside a transaction.
-- CONCURRENTLY keeps the application available while PostgreSQL builds each index.

CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_company_updated_idx
  ON clients (company_id, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_professional_updated_idx
  ON clients (professional_id, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_tags_gin_idx
  ON clients USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_company_status_updated_idx
  ON leads (company_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_company_created_idx
  ON leads (company_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_company_sdr_idx
  ON leads (company_id, sdr_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_company_closer_idx
  ON leads (company_id, closer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_professional_status_idx
  ON leads (professional_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tags_gin_idx
  ON leads USING GIN (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_activities_lead_created_idx
  ON lead_activities (lead_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS proposals_lead_created_idx
  ON proposals (lead_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_company_start_idx
  ON appointments (company_id, start_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_professional_start_idx
  ON appointments (professional_id, start_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_specialist_start_idx
  ON appointments (especialista_id, start_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_lead_idx
  ON appointments (lead_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_company_date_idx
  ON payments (company_id, date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_company_status_date_idx
  ON payments (company_id, status, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS conversas_company_last_message_idx
  ON conversas (company_id, last_message_at DESC, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS mensagens_conversation_created_idx
  ON mensagens (conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_company_status_due_idx
  ON tasks (company_id, status, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_user_status_due_idx
  ON tasks (assigned_to_user_id, status, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_professional_status_due_idx
  ON tasks (assigned_to_id, status, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS message_campaigns_company_created_idx
  ON message_campaigns (company_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS message_campaigns_status_scheduled_idx
  ON message_campaigns (status, scheduled_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS campaign_recipients_campaign_status_idx
  ON campaign_recipients (campaign_id, status);
