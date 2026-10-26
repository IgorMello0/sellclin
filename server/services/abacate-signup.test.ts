// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const state = vi.hoisted(() => ({ db: {} as any, fetch: vi.fn() }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('./integration-http.js', () => ({ integrationHttpClient: { fetch: state.fetch } }))
vi.mock('../bootstrap/defaults.js', () => ({ ensureCompanyDefaults: vi.fn() }))
vi.mock('./whatsapp-integration.js', () => ({ handleEvolutionPayload: vi.fn(), handleMetaMessages: vi.fn(), handleUazapiPayload: vi.fn() }))
import { createPendingSignupCheckout } from './billing.js'
import { router } from '../routes/billing.js'
import { router as webhooks } from '../routes/webhooks.js'

const input = { name: 'Teste', email: 'signup@example.invalid', password: 'test-password', phone: '11999999999', specialization: 'Teste', planCode: 'start' as const, billingCycle: 'monthly' as const }
const checkout = { id: 'bill_test', url: 'https://app.abacatepay.com/pay/bill_test', devMode: true }
let pending: any

beforeEach(() => {
  vi.clearAllMocks()
  let checkoutDeleted = false
  state.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url.includes('/subscriptions/checkouts/get') && checkoutDeleted) {
      return new Response(JSON.stringify({ success: false, error: 'Billing not found' }), { status: 404 })
    }
    if (url.includes('/subscriptions/checkouts/delete')) checkoutDeleted = true
    return new Response(JSON.stringify({
      success: true,
      data: url.includes('/subscriptions/checkouts/get')
        ? { ...checkout, id: 'bill_previous', status: 'PENDING' }
        : url.includes('/subscriptions/list')
          ? []
          : url.includes('/subscriptions/checkouts/delete')
            ? { id: 'bill_previous', status: 'PENDING', paidAmount: null }
            : checkout,
    }))
  })
  vi.stubEnv('ABACATEPAY_API_KEY', 'test-only-key')
  vi.stubEnv('ABACATEPAY_WEBHOOK_SECRET', 'test-only-webhook-secret')
  vi.stubEnv('ABACATEPAY_API_BASE_URL', 'https://api.abacatepay.com/v2')
  vi.stubEnv('ABACATEPAY_START_MONTHLY_PRODUCT_ID', 'prod_test_start')
  vi.stubEnv('ABACATEPAY_START_YEARLY_PRODUCT_ID', 'prod_test_start_yearly')
  vi.stubEnv('ABACATEPAY_PRO_MONTHLY_PRODUCT_ID', 'prod_test_pro')
  vi.stubEnv('PUBLIC_APP_URL', 'http://127.0.0.1:8081')
  pending = {
    id: 1, ...input, passwordHash: bcrypt.hashSync(input.password, 4),
    status: 'pending', abacateCheckoutId: null, checkoutUrl: null,
    companyId: null, professionalId: null,
  }
  Object.assign(state.db, {
    professional: { findUnique: vi.fn().mockResolvedValue(null) },
    pendingSignup: {
      findUnique: vi.fn(async () => pending ? { ...pending } : null),
      create: vi.fn(async ({ data }) => (pending = { ...data, id: 1, abacateCheckoutId: null, companyId: null, professionalId: null })),
      updateMany: vi.fn(async ({ where, data }) => {
        const matches = pending && Object.entries(where).every(([key, value]) =>
          key === 'status' && value && typeof value === 'object' && 'in' in value
            ? (value.in as string[]).includes(pending.status)
            : pending[key] === value
        )
        if (!matches) return { count: 0 }
        Object.assign(pending, data)
        return { count: 1 }
      }),
    },
  })
})
afterEach(() => vi.unstubAllEnvs())

it('creates the recurring checkout and preserves the password used for the account', async () => {
  pending = null
  const result = await createPendingSignupCheckout({ ...input, email: ' SIGNUP@EXAMPLE.INVALID ' })
  expect(result.checkoutId).toBe(checkout.id)
  expect(pending.email).toBe(input.email)
  expect(await bcrypt.compare(input.password, pending.passwordHash)).toBe(true)
  expect(pending.status).toBe('pending')
  expect(pending.abacateCheckoutId).toBe(checkout.id)
  const [url, request] = state.fetch.mock.calls[0]
  expect(url).toBe('https://api.abacatepay.com/v2/subscriptions/create')
  expect(JSON.parse(request.body)).toMatchObject({
    items: [{ id: 'prod_test_start', quantity: 1 }], methods: ['CARD'],
    metadata: { pendingSignupId: '1', planCode: 'start', billingCycle: 'monthly' },
    completionUrl: 'http://127.0.0.1:8081/entrar?signup=success',
  })
})

it('resumes a reservation with no AbacatePay checkout, replacing only the stale checkout URL', async () => {
  pending.checkoutUrl = 'https://previous-provider.invalid/checkout'
  const hash = pending.passwordHash
  const result = await createPendingSignupCheckout(input)
  expect(result.checkoutUrl).toBe(checkout.url)
  expect(pending.passwordHash).toBe(hash)
  expect(state.db.pendingSignup.create).not.toHaveBeenCalled()
})

it('returns the original checkout instead of creating another charge', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  pending.checkoutUrl = 'https://app.abacatepay.com/pay/bill_previous'
  const result = await createPendingSignupCheckout(input)
  expect(result.checkoutId).toBe('bill_previous')
  expect(state.fetch).toHaveBeenCalledTimes(1)
  expect(state.fetch.mock.calls[0][0]).toContain('/subscriptions/checkouts/get?id=bill_previous')
  expect(state.db.pendingSignup.updateMany).not.toHaveBeenCalled()
})

it('creates a new checkout with the same email after the provider confirms expiry', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  pending.checkoutUrl = 'https://app.abacatepay.com/pay/bill_previous'
  const hash = pending.passwordHash
  state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({
    success: true,
    data: url.includes('/subscriptions/checkouts/get')
      ? { id: 'bill_previous', status: 'EXPIRED', paidAmount: null }
      : checkout,
  })))
  const result = await createPendingSignupCheckout(input)
  expect(result.checkoutId).toBe(checkout.id)
  expect(pending).toMatchObject({ status: 'pending', abacateCheckoutId: checkout.id, checkoutUrl: checkout.url, passwordHash: hash })
  expect(state.fetch).toHaveBeenCalledTimes(2)
  expect(state.db.pendingSignup.create).not.toHaveBeenCalled()
})

it('never creates another checkout for a paid one while activation is pending', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  state.fetch.mockImplementation(async () => new Response(JSON.stringify({
    success: true, data: { id: 'bill_previous', status: 'PAID', paidAmount: 19700 },
  })))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('Pagamento recebido')
  expect(state.fetch).toHaveBeenCalledTimes(1)
  expect(state.db.pendingSignup.updateMany).not.toHaveBeenCalled()
})

it('keeps the original checkout when the provider cannot verify its status', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  state.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 503 }))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('consultar o pagamento anterior')
  expect(pending.abacateCheckoutId).toBe('bill_previous')
  expect(state.fetch).toHaveBeenCalledTimes(1)
})

it('does not replace credentials or disclose a checkout to a different password', async () => {
  const original = { ...pending }
  await expect(createPendingSignupCheckout({ ...input, password: 'another-password' })).rejects.toThrow('senha original')
  expect(pending).toEqual(original)
  expect(state.fetch).not.toHaveBeenCalled()
})

it('changes the plan and price of an unpaid signup before opening the new checkout', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  pending.checkoutUrl = 'https://app.abacatepay.com/pay/bill_previous'
  const originalHash = pending.passwordHash
  const result = await createPendingSignupCheckout({ ...input, planCode: 'pro' })
  expect(result.checkoutId).toBe(checkout.id)
  expect(pending).toMatchObject({ planCode: 'pro', billingCycle: 'monthly', passwordHash: originalHash, abacateCheckoutId: checkout.id })
  expect(state.fetch.mock.calls.map(call => call[0])).toEqual([
    expect.stringContaining('/subscriptions/checkouts/get?id=bill_previous'),
    expect.stringContaining('/subscriptions/list?checkoutId=bill_previous'),
    expect.stringContaining('/subscriptions/checkouts/delete?id=bill_previous'),
    expect.stringContaining('/subscriptions/checkouts/get?id=bill_previous'),
    expect.stringContaining('/subscriptions/list?checkoutId=bill_previous'),
    expect.stringContaining('/subscriptions/create'),
  ])
  expect(JSON.parse(state.fetch.mock.calls[5][1].body)).toMatchObject({
    productId: 'prod_test_pro', items: [{ id: 'prod_test_pro', quantity: 1 }],
    metadata: { planCode: 'pro', billingCycle: 'monthly' },
  })
})

it('changes from monthly to yearly when the old checkout has expired', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({
    success: true,
    data: url.includes('/subscriptions/checkouts/get')
      ? { id: 'bill_previous', status: 'EXPIRED', paidAmount: null }
      : checkout,
  })))
  await createPendingSignupCheckout({ ...input, billingCycle: 'yearly' })
  expect(pending.billingCycle).toBe('yearly')
  expect(JSON.parse(state.fetch.mock.calls[1][1].body)).toMatchObject({
    productId: 'prod_test_start_yearly', metadata: { billingCycle: 'yearly' },
  })
  expect(state.fetch.mock.calls.some(call => call[0].includes('/subscriptions/checkouts/delete'))).toBe(false)
})

it('lets a pending signup without provider checkout select a different plan', async () => {
  const result = await createPendingSignupCheckout({ ...input, planCode: 'pro' })
  expect(result.planCode).toBe('pro')
  expect(pending.planCode).toBe('pro')
  expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toMatchObject({ productId: 'prod_test_pro' })
})

it('does not change plan or create another checkout when a subscription already exists', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({
    success: true,
    data: url.includes('/subscriptions/checkouts/get')
      ? { id: 'bill_previous', status: 'PENDING' }
      : [{ id: 'subs_paid', checkoutId: 'bill_previous', status: 'ACTIVE' }],
  })))
  await expect(createPendingSignupCheckout({ ...input, planCode: 'pro' })).rejects.toThrow('gerou uma assinatura')
  expect(pending.planCode).toBe('start')
  expect(state.fetch).toHaveBeenCalledTimes(2)
})

it('does not change plan when checkout cancellation fails', async () => {
  pending.abacateCheckoutId = 'bill_previous'
  state.fetch.mockImplementation(async (url: string) => new Response(JSON.stringify({
    success: !url.includes('/subscriptions/checkouts/delete'),
    data: url.includes('/subscriptions/checkouts/get') ? { id: 'bill_previous', status: 'PENDING' } : [],
    error: 'Not permitted',
  }), { status: url.includes('/subscriptions/checkouts/delete') ? 403 : 200 }))
  await expect(createPendingSignupCheckout({ ...input, planCode: 'pro' })).rejects.toThrow('encerrar o checkout anterior')
  expect(pending.planCode).toBe('start')
  expect(pending.abacateCheckoutId).toBe('bill_previous')
  expect(state.fetch).toHaveBeenCalledTimes(3)
})

it('does not recreate an existing account', async () => {
  state.db.professional.findUnique.mockResolvedValue({ id: 3 })
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('Email ja cadastrado')
  expect(state.db.pendingSignup.findUnique).not.toHaveBeenCalled()
})

it.each(['ABACATEPAY_API_KEY', 'ABACATEPAY_START_MONTHLY_PRODUCT_ID', 'ABACATEPAY_WEBHOOK_SECRET'])('validates %s before reserving the email', async (variable) => {
  vi.stubEnv(variable, '')
  vi.stubEnv('ABACATEPAY_START_PRODUCT_ID', '')
  await expect(createPendingSignupCheckout(input)).rejects.toThrow()
  expect(state.db.pendingSignup.findUnique).not.toHaveBeenCalled()
  expect(state.db.pendingSignup.create).not.toHaveBeenCalled()
  expect(state.fetch).not.toHaveBeenCalled()
})

it('releases a rejected request so the same email can retry after fixing configuration', async () => {
  state.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'invalid key' }), { status: 401 }))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('Chave da Abacate Pay invalida')
  expect(pending.status).toBe('pending')
  expect((await createPendingSignupCheckout(input)).checkoutId).toBe(checkout.id)
})

it('does not repeat an ambiguous request which could already have created a charge', async () => {
  state.fetch.mockRejectedValueOnce(new Error('Connection lost'))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('Connection lost')
  expect(pending.status).toBe('checkout_unknown')
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('aguarda verificacao')
  expect(state.fetch).toHaveBeenCalledTimes(1)
})

it('treats a malformed successful response as ambiguous', async () => {
  state.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { url: checkout.url } })))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('identificador')
  expect(pending.status).toBe('checkout_unknown')
})

it('creates at most one checkout when two requests resume the same reservation', async () => {
  const results = await Promise.allSettled([createPendingSignupCheckout(input), createPendingSignupCheckout(input)])
  expect(results.some(result => result.status === 'fulfilled')).toBe(true)
  expect(state.fetch).toHaveBeenCalledTimes(1)
})

it('handles a concurrent first registration without another provider request', async () => {
  pending = null
  state.db.pendingSignup.create.mockRejectedValueOnce(Object.assign(new Error('Unique email'), { code: 'P2002' }))
  await expect(createPendingSignupCheckout(input)).rejects.toThrow('Cadastro em processamento')
  expect(state.fetch).not.toHaveBeenCalled()
})

it('does not undo an activation that arrived before the provider response', async () => {
  state.fetch.mockImplementationOnce(async () => {
    Object.assign(pending, { status: 'completed', companyId: 2, professionalId: 3, abacateCheckoutId: checkout.id })
    return new Response(JSON.stringify({ success: true, data: checkout }))
  })
  await createPendingSignupCheckout(input)
  expect(pending.status).toBe('completed')
  expect(pending.professionalId).toBe(3)
})

it('serves only the AbacatePay catalog with the agreed discounted annual prices', () => {
  const route = router.stack.find(layer => layer.route?.path === '/catalog')!.route!
  const res = { json: vi.fn() }
  route.stack[0].handle({} as any, res as any, vi.fn())
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: {
    provider: 'abacatepay', prices: {
      start: { monthly: 19700, yearly: 176400 },
      pro: { monthly: 29700, yearly: 296400 },
      enterprise: { monthly: 49700, yearly: 476400 },
    },
  } }))
})

async function deliverWebhook(body: object, validSignature = true) {
  const key = 'test-webhook-signature-key'
  vi.stubEnv('ABACATEPAY_WEBHOOK_PUBLIC_KEY', key)
  const rawBody = JSON.stringify(body)
  const signature = crypto.createHmac('sha256', key).update(rawBody).digest('base64')
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  const route = webhooks.stack.find(layer => layer.route?.path === '/abacate-pay')!.route!
  await route.stack[0].handle({
    query: { webhookSecret: 'test-only-webhook-secret' }, rawBody, body,
    headers: { 'x-webhook-signature': validSignature ? signature : 'invalid' },
  } as any, res as any, vi.fn())
  return res
}

function setupActivationDatabase() {
  Object.assign(state.db, {
    billingWebhookEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    companySubscription: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    empresa: { create: vi.fn().mockResolvedValue({ id: 2 }), update: vi.fn() },
    $transaction: vi.fn(async callback => callback(state.db)),
  })
  state.db.professional.create = vi.fn(async ({ data }) => ({ ...data, id: 3 }))
  state.db.pendingSignup.update = vi.fn(async ({ data }) => Object.assign(pending, data))
}

const paidEvent = {
  id: 'evt_test', event: 'subscription.completed', devMode: true,
  data: {
    subscription: { id: 'sub_test', status: 'ACTIVE' },
    checkout: { id: checkout.id, items: [{ id: 'prod_test_start' }], metadata: { pendingSignupId: '1' } },
  },
}

it('creates the login account with the original password after a signed test payment', async () => {
  setupActivationDatabase()
  const originalHash = pending.passwordHash
  const res = await deliverWebhook(paidEvent)
  expect(res.status).not.toHaveBeenCalled()
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  expect(pending).toMatchObject({ status: 'completed', companyId: 2, professionalId: 3 })
  const professional = state.db.professional.create.mock.calls[0][0].data
  expect(professional.passwordHash).toBe(originalHash)
  expect(await bcrypt.compare(input.password, professional.passwordHash)).toBe(true)
  expect(state.db.companySubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    status: 'active', accessSource: 'abacatepay', abacateSubscriptionId: 'sub_test',
  }) }))
  state.db.billingWebhookEvent.findUnique.mockResolvedValue({ eventId: 'evt_test' })
  await deliverWebhook(paidEvent)
  expect(state.db.professional.create).toHaveBeenCalledTimes(1)
})

it('does not create an account from an unsigned payment', async () => {
  setupActivationDatabase()
  const res = await deliverWebhook(paidEvent, false)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(state.db.professional.create).not.toHaveBeenCalled()
})

it('ignores a delayed event from an older checkout after the customer resumes', async () => {
  setupActivationDatabase()
  pending.abacateCheckoutId = 'bill_new'
  const res = await deliverWebhook({ ...paidEvent, data: {
    ...paidEvent.data, checkout: { ...paidEvent.data.checkout, id: 'bill_previous' },
  } })
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ignored: true }) }))
  expect(state.db.professional.create).not.toHaveBeenCalled()
  expect(pending.status).toBe('pending')
})

it('does not activate a different product or a pending payment', async () => {
  setupActivationDatabase()
  const mismatched = await deliverWebhook({ ...paidEvent, data: {
    ...paidEvent.data, checkout: { ...paidEvent.data.checkout, items: [{ id: 'prod_unknown' }] },
  } })
  expect(mismatched.status).toHaveBeenCalledWith(400)
  await deliverWebhook({ ...paidEvent, event: 'subscription.created', data: {
    ...paidEvent.data, subscription: { id: 'sub_test', status: 'PENDING' },
  } })
  expect(pending.status).toBe('payment_pending')
  expect(state.db.professional.create).not.toHaveBeenCalled()
})
