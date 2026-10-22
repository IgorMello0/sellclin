import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cancelAsaasSubscription, createAsaasRecurringCheckout, getAsaasEnvironment, getBillingProvider, updateAsaasSubscription, verifyAsaasWebhookToken } from './asaas-client.js'
import { integrationHttpClient } from './integration-http.js'

test('Asaas defaults safely to sandbox and rejects unknown environments', () => {
  assert.equal(getAsaasEnvironment({}), 'sandbox')
  assert.equal(getAsaasEnvironment({ ASAAS_ENVIRONMENT: 'production' }), 'production')
  assert.throws(() => getAsaasEnvironment({ ASAAS_ENVIRONMENT: 'prod' }))
})

test('provider selection preserves the existing provider by default', () => {
  assert.equal(getBillingProvider({}), 'abacatepay')
  assert.equal(getBillingProvider({ BILLING_PROVIDER: 'asaas' }), 'asaas')
  assert.throws(() => getBillingProvider({ BILLING_PROVIDER: 'unknown' }))
})

test('subscription changes target Asaas without modifying pending charges', async () => {
  const originalFetch = integrationHttpClient.fetch
  const originalKey = process.env.ASAAS_API_KEY
  const originalEnvironment = process.env.ASAAS_ENVIRONMENT
  try {
    process.env.ASAAS_API_KEY = 'test-key'
    process.env.ASAAS_ENVIRONMENT = 'sandbox'
    integrationHttpClient.fetch = async (url, options) => {
      assert.equal(url, 'https://api-sandbox.asaas.com/v3/subscriptions/sub_123ABC')
      if (options?.method === 'PUT') {
        assert.deepEqual(JSON.parse(String(options.body)), { value: 1764, cycle: 'YEARLY', updatePendingPayments: false })
      } else assert.equal(options?.method, 'DELETE')
      return new Response('{}', { status: 200 })
    }
    await updateAsaasSubscription({ subscriptionId: 'sub_123ABC', amountCents: 176400, cycle: 'yearly' })
    await cancelAsaasSubscription('sub_123ABC')
    await assert.rejects(() => cancelAsaasSubscription('../payments'))
  } finally {
    integrationHttpClient.fetch = originalFetch
    if (originalKey === undefined) delete process.env.ASAAS_API_KEY
    else process.env.ASAAS_API_KEY = originalKey
    if (originalEnvironment === undefined) delete process.env.ASAAS_ENVIRONMENT
    else process.env.ASAAS_ENVIRONMENT = originalEnvironment
  }
})

test('Asaas webhook requires a valid configured token and an exact match', () => {
  const token = 'a'.repeat(40)
  assert.equal(verifyAsaasWebhookToken(token, token), true)
  assert.equal(verifyAsaasWebhookToken('b'.repeat(40), token), false)
  assert.equal(verifyAsaasWebhookToken(token, 'short'), false)
  assert.equal(verifyAsaasWebhookToken(undefined, token), false)
})

test('recurring checkout sends the selected cycle and the exact amount', async () => {
  const originalFetch = integrationHttpClient.fetch
  const originalKey = process.env.ASAAS_API_KEY
  const originalEnvironment = process.env.ASAAS_ENVIRONMENT
  try {
    process.env.ASAAS_API_KEY = 'test-key'
    process.env.ASAAS_ENVIRONMENT = 'sandbox'
    integrationHttpClient.fetch = async (url, options) => {
      assert.equal(url, 'https://api-sandbox.asaas.com/v3/checkouts')
      const body = JSON.parse(String(options?.body))
      assert.deepEqual(body.billingTypes, ['CREDIT_CARD'])
      assert.deepEqual(body.chargeTypes, ['RECURRENT'])
      assert.equal(body.items[0].value, 1764)
      assert.equal(body.subscription.cycle, 'YEARLY')
      return new Response(JSON.stringify({ id: 'checkout-123' }), { status: 200 })
    }
    const result = await createAsaasRecurringCheckout({ reference: 'signup-1', name: 'Start', amountCents: 176400, quantity: 1, cycle: 'yearly', nextDueDate: '2026-10-19', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel', expiredUrl: 'https://example.com/expired' })
    assert.equal(result.checkoutUrl, 'https://sandbox.asaas.com/checkoutSession/show?id=checkout-123')
  } finally {
    integrationHttpClient.fetch = originalFetch
    if (originalKey === undefined) delete process.env.ASAAS_API_KEY
    else process.env.ASAAS_API_KEY = originalKey
    if (originalEnvironment === undefined) delete process.env.ASAAS_ENVIRONMENT
    else process.env.ASAAS_ENVIRONMENT = originalEnvironment
  }
})
