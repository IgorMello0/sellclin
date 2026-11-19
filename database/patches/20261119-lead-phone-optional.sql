BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.leads ALTER COLUMN phone DROP NOT NULL;
COMMIT;
