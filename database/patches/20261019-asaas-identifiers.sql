-- Additive preparation only; existing AbacatePay records remain unchanged.
BEGIN;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS asaas_checkout_id TEXT;
ALTER TABLE company_subscriptions ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS asaas_checkout_id TEXT;
ALTER TABLE billing_addons ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE billing_addons ADD COLUMN IF NOT EXISTS asaas_checkout_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_asaas_subscription_id_key ON company_subscriptions (asaas_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_asaas_checkout_id_key ON company_subscriptions (asaas_checkout_id);
CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_asaas_checkout_id_key ON pending_signups (asaas_checkout_id);
CREATE UNIQUE INDEX IF NOT EXISTS billing_addons_asaas_subscription_id_key ON billing_addons (asaas_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS billing_addons_asaas_checkout_id_key ON billing_addons (asaas_checkout_id);
COMMIT;
