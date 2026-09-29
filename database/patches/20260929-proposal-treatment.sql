-- Persiste o texto preenchido em "Tratamento Proposto" nas propostas comerciais.
-- Patch idempotente: pode ser executado novamente sem alterar dados existentes.
BEGIN;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS treatment TEXT;
COMMIT;
