// Opt-in only: creates a synthetic account in the explicitly checked homologation database.
import 'dotenv/config'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { prisma } from '../prisma.js'
import { integrationHttpClient } from './integration-http.js'
import { cancelAsaasCompanySubscription, changeAsaasCompanyPlan, createAsaasSignupCheckout, processAsaasPaidCheckout, processAsaasPaymentEvent } from './asaas-billing.js'

test('signup, verified payment and duplicate delivery in homologation', { skip: process.env.RUN_ASAAS_HOMOLOG_TEST !== '1', timeout: 240000 }, async () => {
  const url = new URL(process.env.DATABASE_URL || '')
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal(url.port, '15432')
  assert.equal(url.pathname, '/sellclin_homolog')
  const actual = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`
  assert.equal(actual[0].name, 'sellclin_homolog')
  const suffix = crypto.randomUUID().replace(/-/g, '')
  const email = `asaas-test-${suffix}@example.invalid`
  const checkoutId = crypto.randomUUID()
  const payment = { id: `pay_${suffix}`, subscription: `sub_${suffix}`, customer: `cus_${suffix}`, checkoutSession: checkoutId, status: 'CONFIRMED', value: 197, dueDate: new Date().toISOString().slice(0, 10) }
  const originalFetch = integrationHttpClient.fetch
  const originalKey = process.env.ASAAS_API_KEY
  const originalToken = process.env.ASAAS_WEBHOOK_TOKEN
  const originalEnvironment = process.env.ASAAS_ENVIRONMENT
  try {
    process.env.ASAAS_API_KEY = 'test-only'
    process.env.ASAAS_WEBHOOK_TOKEN = 't'.repeat(40)
    process.env.ASAAS_ENVIRONMENT = 'sandbox'
    integrationHttpClient.fetch = async (url, options) => {
      if (url.endsWith('/checkouts') && options?.method === 'POST') return new Response(JSON.stringify({ id: checkoutId }), { status: 200 })
      if (url.includes('/payments?checkoutSession=')) return new Response(JSON.stringify({ data: [payment] }), { status: 200 })
      if (url.endsWith(`/payments/${payment.id}`)) return new Response(JSON.stringify(payment), { status: 200 })
      if (url.endsWith(`/subscriptions/${payment.subscription}`) && options?.method === 'GET') return new Response(JSON.stringify({ status: 'ACTIVE', deleted: false }), { status: 200 })
      if (url.endsWith(`/subscriptions/${payment.subscription}`) && (options?.method === 'PUT' || options?.method === 'DELETE')) return new Response('{}', { status: 200 })
      throw new Error(`Unexpected test request: ${url}`)
    }
    await createAsaasSignupCheckout({ name: 'Teste Asaas', email, password: crypto.randomBytes(24).toString('hex'), phone: '11999999999', specialization: 'Teste', planCode: 'start', billingCycle: 'monthly' })
    const pending = await prisma.pendingSignup.findUniqueOrThrow({ where: { email } })
    assert.equal(pending.status, 'pending')
    assert.equal(await prisma.professional.findUnique({ where: { email } }), null)
    await processAsaasPaidCheckout(`evt_checkout_${suffix}`, checkoutId)
    const completed = await prisma.pendingSignup.findUniqueOrThrow({ where: { email } })
    assert.equal(completed.status, 'completed')
    const subscription = await prisma.companySubscription.findUniqueOrThrow({ where: { companyId: completed.companyId! } })
    assert.equal(subscription.accessSource, 'asaas')
    assert.equal(subscription.asaasSubscriptionId, payment.subscription)
    const duplicate = await processAsaasPaidCheckout(`evt_checkout_${suffix}`, checkoutId)
    assert.deepEqual(duplicate, { duplicate: true })
    await processAsaasPaymentEvent(`evt_payment_${suffix}`, 'PAYMENT_CONFIRMED', payment)
    const unchanged = await prisma.companySubscription.findUniqueOrThrow({ where: { companyId: completed.companyId! } })
    assert.equal(unchanged.currentPeriodEndsAt?.toISOString(), subscription.currentPeriodEndsAt?.toISOString())
    await changeAsaasCompanyPlan(completed.companyId!, 'pro', 'monthly')
    const pendingChange = await prisma.companySubscription.findUniqueOrThrow({ where: { companyId: completed.companyId! } })
    assert.equal(pendingChange.planCode, 'start')
    assert.equal(pendingChange.pendingPlanCode, 'pro')
    payment.id = `pay_${suffix}renewal`
    payment.value = 297
    payment.dueDate = '2090-01-01'
    await processAsaasPaymentEvent(`evt_renewal_${suffix}`, 'PAYMENT_CONFIRMED', payment)
    const renewed = await prisma.companySubscription.findUniqueOrThrow({ where: { companyId: completed.companyId! } })
    assert.equal(renewed.planCode, 'pro')
    assert.equal(renewed.pendingPlanCode, null)
    assert.ok(renewed.currentPeriodEndsAt! > subscription.currentPeriodEndsAt!)
    await cancelAsaasCompanySubscription(completed.companyId!)
    payment.id = `pay_${suffix}late`
    payment.dueDate = '2090-02-01'
    await processAsaasPaymentEvent(`evt_late_${suffix}`, 'PAYMENT_CONFIRMED', payment)
    const canceled = await prisma.companySubscription.findUniqueOrThrow({ where: { companyId: completed.companyId! } })
    assert.equal(canceled.status, 'canceled')
    console.info('Conta tecnica de homologacao criada:', email)
  } finally {
    integrationHttpClient.fetch = originalFetch
    if (originalKey === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY = originalKey
    if (originalToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN; else process.env.ASAAS_WEBHOOK_TOKEN = originalToken
    if (originalEnvironment === undefined) delete process.env.ASAAS_ENVIRONMENT; else process.env.ASAAS_ENVIRONMENT = originalEnvironment
    await prisma.$disconnect()
  }
})
