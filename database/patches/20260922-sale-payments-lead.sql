-- Apply before deploying the sale confirmation changes. Existing payments remain untouched.
BEGIN;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lead_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sale_voided_at TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE ON UPDATE CASCADE,
  proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL ON UPDATE CASCADE,
  legacy_lead_id INTEGER UNIQUE,
  company_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  confirmed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  voided_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sales_company_id_confirmed_at_idx ON sales(company_id, confirmed_at);
CREATE INDEX IF NOT EXISTS sales_lead_id_voided_at_idx ON sales(lead_id, voided_at);
CREATE INDEX IF NOT EXISTS sales_proposal_id_voided_at_idx ON sales(proposal_id, voided_at);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sale_id INTEGER;
CREATE INDEX IF NOT EXISTS payments_lead_id_idx ON payments(lead_id);
CREATE INDEX IF NOT EXISTS payments_sale_id_idx ON payments(sale_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_lead_id_fkey' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_sale_id_fkey' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- Preserve the value of previously confirmed leads as one historical sale each.
-- Their proposal cannot be inferred safely when several proposals exist.
INSERT INTO sales (lead_id, legacy_lead_id, company_id, amount, confirmed_at)
SELECT id, id, company_id, value, COALESCE(closed_at, updated_at)
FROM leads WHERE is_paid = TRUE
ON CONFLICT (legacy_lead_id) DO NOTHING;
-- Associate legacy sales only when one accepted proposal identifies the sale unambiguously.
UPDATE sales s SET proposal_id = p.id
FROM proposals p
WHERE s.legacy_lead_id IS NOT NULL AND s.proposal_id IS NULL
  AND p.lead_id = s.lead_id AND p.status = 'accepted'
  AND (SELECT COUNT(*) FROM proposals q WHERE q.lead_id = s.lead_id AND q.status = 'accepted') = 1;
COMMIT;
