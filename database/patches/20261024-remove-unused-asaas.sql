-- Optional cleanup AFTER deploying the AbacatePay-only application.
-- Back up and verify the database first. No account or signup is deleted.
-- The application works with these unused nullable columns still present.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'company_subscriptions'
               AND column_name = 'asaas_subscription_id') THEN
    IF EXISTS (SELECT 1 FROM company_subscriptions
               WHERE asaas_subscription_id IS NOT NULL OR access_source = 'asaas') THEN
      RAISE EXCEPTION 'Asaas subscription found: stop cleanup and reconcile first';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'billing_addons'
               AND column_name = 'asaas_subscription_id') THEN
    IF EXISTS (SELECT 1 FROM billing_addons WHERE asaas_subscription_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Asaas addon subscription found: stop cleanup and reconcile first';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'pending_signups'
               AND column_name = 'asaas_checkout_id') THEN
    IF EXISTS (SELECT 1 FROM pending_signups WHERE asaas_checkout_id IS NOT NULL
               AND (company_id IS NOT NULL OR professional_id IS NOT NULL OR status = 'completed')) THEN
      RAISE EXCEPTION 'Completed Asaas signup found: stop cleanup and reconcile first';
    END IF;
    UPDATE pending_signups SET checkout_url = NULL
      WHERE asaas_checkout_id IS NOT NULL AND abacate_checkout_id IS NULL
        AND status = 'pending' AND company_id IS NULL AND professional_id IS NULL;
  END IF;
END $$;

ALTER TABLE company_subscriptions
  DROP COLUMN IF EXISTS asaas_subscription_id,
  DROP COLUMN IF EXISTS asaas_checkout_id,
  DROP COLUMN IF EXISTS asaas_customer_id;
ALTER TABLE pending_signups DROP COLUMN IF EXISTS asaas_checkout_id;
ALTER TABLE billing_addons
  DROP COLUMN IF EXISTS asaas_subscription_id,
  DROP COLUMN IF EXISTS asaas_checkout_id;
COMMIT;
