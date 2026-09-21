-- Apply before deploying the company-scoped goals API. No rows are deleted.
BEGIN;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS company_id INTEGER;
CREATE INDEX IF NOT EXISTS goals_company_id_idx ON goals(company_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_company_id_fkey' AND conrelid = 'goals'::regclass) THEN
    ALTER TABLE goals ADD CONSTRAINT goals_company_id_fkey FOREIGN KEY (company_id) REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
-- Only infer a clinic when ownership/membership identifies exactly one clinic.
WITH candidates AS (
  SELECT owner_id AS professional_id, id AS company_id FROM empresas WHERE owner_id IS NOT NULL
  UNION
  SELECT id AS professional_id, company_id FROM professionals WHERE company_id IS NOT NULL
), unambiguous AS (
  SELECT professional_id, MIN(company_id) AS company_id FROM candidates
  GROUP BY professional_id HAVING COUNT(DISTINCT company_id) = 1
)
UPDATE goals g SET company_id = u.company_id
FROM unambiguous u WHERE g.professional_id = u.professional_id AND g.company_id IS NULL;
COMMIT;
-- Remaining NULL rows are preserved for manual attribution, never shared between clinics.
SELECT id, professional_id, name FROM goals WHERE company_id IS NULL;
