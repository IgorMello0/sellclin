import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { afterEach, describe, it } from 'node:test'
import {
  buildActiveUsersForCompanyWhere,
  getBillingCycleFromAbacateFrequency,
  getEffectiveSubscriptionStatus,
  verifyAbacateWebhookSignature,
} from './billing.js'
import { assertProductionSecurityConfig } from '../config/security.js'

const future = new Date(Date.now() + 60_000)
const past = new Date(Date.now() - 60_000)
const originalPublicKey = process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY
const originalNodeEnv = process.env.NODE_ENV
const originalJwtSecret = process.env.JWT_SECRET
const originalWebhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET
const originalEncryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  restoreEnv('ABACATEPAY_WEBHOOK_PUBLIC_KEY', originalPublicKey)
  restoreEnv('NODE_ENV', originalNodeEnv)
  restoreEnv('JWT_SECRET', originalJwtSecret)
  restoreEnv('ABACATEPAY_WEBHOOK_SECRET', originalWebhookSecret)
  restoreEnv('INTEGRATION_ENCRYPTION_KEY', originalEncryptionKey)
})

describe('production security configuration', () => {
  it('rejects weak JWT and webhook secrets in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.INTEGRATION_ENCRYPTION_KEY = 'e'.repeat(64)
    process.env.JWT_SECRET = 'dev-secret'
    process.env.ABACATEPAY_WEBHOOK_SECRET = 'short'
    assert.throws(() => assertProductionSecurityConfig(), /JWT_SECRET inseguro/)

    process.env.JWT_SECRET = 'j'.repeat(64)
    assert.throws(() => assertProductionSecurityConfig(), /pelo menos 32 caracteres/)

    process.env.ABACATEPAY_WEBHOOK_SECRET = 'w'.repeat(64)
    assert.doesNotThrow(() => assertProductionSecurityConfig())
  })
})

describe('billing entitlement status', () => {
  it('expires trials using the trial deadline', () => {
    assert.equal(getEffectiveSubscriptionStatus({
      status: 'trialing',
      accessSource: 'trial',
      trialEndsAt: past,
    }), 'expired')
  })

  it('requires an external subscription and paid period for AbacatePay access', () => {
    assert.equal(getEffectiveSubscriptionStatus({
      status: 'active',
      accessSource: 'abacatepay',
      trialEndsAt: past,
      currentPeriodEndsAt: future,
      abacateSubscriptionId: null,
    }), 'payment_pending')

    assert.equal(getEffectiveSubscriptionStatus({
      status: 'active',
      accessSource: 'abacatepay',
      trialEndsAt: past,
      currentPeriodEndsAt: future,
      abacateSubscriptionId: 'subs_test',
    }), 'active')

    assert.equal(getEffectiveSubscriptionStatus({
      status: 'active',
      accessSource: 'abacatepay',
      trialEndsAt: past,
      currentPeriodEndsAt: past,
      abacateSubscriptionId: 'subs_test',
    }), 'payment_pending')
  })

  it('maps the provider frequency to the SellClin billing cycle', () => {
    assert.equal(getBillingCycleFromAbacateFrequency('MONTHLY'), 'monthly')
    assert.equal(getBillingCycleFromAbacateFrequency('YEARLY'), 'yearly')
    assert.equal(getBillingCycleFromAbacateFrequency('unknown'), undefined)
  })

  it('requires an explicit future deadline for manual access', () => {
    assert.equal(getEffectiveSubscriptionStatus({
      status: 'active',
      accessSource: 'manual',
      trialEndsAt: past,
      manualAccessEndsAt: null,
    }), 'expired')

    assert.equal(getEffectiveSubscriptionStatus({
      status: 'active',
      accessSource: 'manual',
      trialEndsAt: past,
      manualAccessEndsAt: future,
    }), 'active')
  })
})

describe('billing usage per clinic', () => {
  it('uses active clinic links and only falls back to legacy users without links', () => {
    assert.deepEqual(buildActiveUsersForCompanyWhere(16), {
      isActive: true,
      OR: [
        { companyAccess: { some: { companyId: 16, isActive: true } } },
        { companyId: 16, companyAccess: { none: {} } },
      ],
    })
  })
})

describe('AbacatePay webhook signature', () => {
  it('accepts only the valid raw-body HMAC signature', () => {
    const body = JSON.stringify({ id: 'evt_1', event: 'subscription.completed' })
    const key = 'billing-test-public-key'
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = key
    const signature = crypto.createHmac('sha256', key).update(body).digest('base64')

    assert.equal(verifyAbacateWebhookSignature(body, signature), true)
    assert.equal(verifyAbacateWebhookSignature(body + ' ', signature), false)
    assert.equal(verifyAbacateWebhookSignature(body, undefined), false)
  })
})
