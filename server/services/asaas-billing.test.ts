// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'

const state = vi.hoisted(() => ({ db: {} as any, request: vi.fn(), checkout: vi.fn() }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../bootstrap/defaults.js', () => ({ ensureCompanyDefaults: vi.fn(), ensureDefaultPlans: vi.fn() }))
vi.mock('./asaas-client.js', async importOriginal => ({
  ...await importOriginal<typeof import('./asaas-client.js')>(),
  asaasRequest: state.request,
  createAsaasRecurringCheckout: state.checkout,
}))
import { createAsaasSignupCheckout, processAsaasPaidCheckout, processAsaasPaymentEvent, reconcileAsaasSignup } from './asaas-billing.js'

const input = { name: 'Teste', email: 'test@example.invalid', password: 'test-only-password', planCode: 'start' as const, billingCycle: 'monthly' as const }
const payment = { id: 'pay_test', subscription: 'sub_test', checkoutSession: 'checkout-test', status: 'CONFIRMED', value: 197, dueDate: '2026-10-22' }
let pending: any

beforeEach(() => {
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'x'.repeat(40))
  vi.stubEnv('ASAAS_ENVIRONMENT', 'production')
  vi.clearAllMocks()
  state.request.mockReset()
  pending = { id: 1, status: 'pending', passwordHash: bcrypt.hashSync(input.password, 4), planCode: 'start', billingCycle: 'monthly', createdAt: new Date(), asaasCheckoutId: 'checkout-test', checkoutUrl: 'https://asaas.com/checkoutSession/show?id=checkout-test' }
  Object.assign(state.db, {
    professional: { findUnique: vi.fn().mockResolvedValue(null) },
    pendingSignup: { findUnique: vi.fn(async () => pending), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  })
})
afterEach(() => vi.unstubAllEnvs())

it('resumes the existing checkout only with the original credentials and plan', async () => {
  const result = await createAsaasSignupCheckout(input)
  expect(result.checkoutId).toBe('checkout-test')
  expect(state.checkout).not.toHaveBeenCalled()
  expect(state.db.pendingSignup.update).not.toHaveBeenCalled()
})
it('retries an authenticated reservation that has no provider checkout after a local setup failure', async () => {
  pending = { ...pending, asaasCheckoutId: null, abacateCheckoutId: null, checkoutUrl: null, companyId: null, professionalId: null }
  state.checkout.mockResolvedValue({ checkoutId: 'checkout-recovered', checkoutUrl: 'https://asaas.com/checkoutSession/show?id=checkout-recovered' })
  const result = await createAsaasSignupCheckout(input)
  expect(result.checkoutId).toBe('checkout-recovered')
  expect(state.checkout).toHaveBeenCalledTimes(1)
  expect(state.db.pendingSignup.create).not.toHaveBeenCalled()
  expect(state.db.pendingSignup.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: pending.id },
    data: { asaasCheckoutId: 'checkout-recovered', checkoutUrl: 'https://asaas.com/checkoutSession/show?id=checkout-recovered' },
  }))
})
it('never replaces an expired checkout which may already have been paid', async () => {
  pending.createdAt = new Date(0)
  await expect(createAsaasSignupCheckout(input)).rejects.toThrow('aguarda confirmacao')
  expect(state.db.pendingSignup.update).not.toHaveBeenCalled()
  expect(state.db.pendingSignup.create).not.toHaveBeenCalled()
  expect(state.checkout).not.toHaveBeenCalled()
  expect(state.request).not.toHaveBeenCalled()
})
it('does not replace the stored password or disclose the checkout to another password', async () => {
  await expect(createAsaasSignupCheckout({ ...input, password: 'another-password' })).rejects.toThrow('Ja existe um cadastro')
  expect(state.db.pendingSignup.update).not.toHaveBeenCalled()
  expect(state.checkout).not.toHaveBeenCalled()
})
it('rejects a different plan rather than silently returning the previous price', async () => {
  await expect(createAsaasSignupCheckout({ ...input, planCode: 'pro' })).rejects.toThrow('outro plano')
  expect(state.checkout).not.toHaveBeenCalled()
})
it('rejects unusable webhook tokens before creating any signup', async () => {
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'x'.repeat(32) + ' ')
  await expect(createAsaasSignupCheckout(input)).rejects.toThrow('Webhook Asaas')
  expect(state.db.pendingSignup.findUnique).not.toHaveBeenCalled()
})
it('rejects a payment belonging to another checkout, even if the payload claims otherwise', async () => {
  state.request.mockResolvedValue({ ...payment, checkoutSession: 'another-checkout' })
  await expect(processAsaasPaymentEvent('evt_test', 'PAYMENT_CONFIRMED', payment, 'checkout-test')).rejects.toThrow('outro checkout')
  expect(state.db.$transaction).not.toHaveBeenCalled()
})
it('does not activate pending payments', async () => {
  state.request.mockResolvedValue({ data: [{ ...payment, status: 'PENDING' }] })
  await expect(processAsaasPaidCheckout('evt_test', 'checkout-test')).rejects.toThrow('Aguardando cobranca')
  expect(state.db.$transaction).not.toHaveBeenCalled()
})
it('does not accept a mismatched payment in the checkout list', async () => {
  state.request.mockResolvedValue({ data: [{ ...payment, checkoutSession: 'another-checkout' }] })
  await expect(processAsaasPaidCheckout('evt_test', 'checkout-test')).rejects.toThrow('Aguardando cobranca')
})
it('does not report account activation when the provider subscription is inactive', async () => {
  state.request.mockResolvedValueOnce({ data: [payment] }).mockResolvedValueOnce(payment).mockResolvedValueOnce({ status: 'INACTIVE' })
  await expect(reconcileAsaasSignup('checkout-test')).resolves.toEqual({ status: 'pending' })
  expect(state.db.$transaction).not.toHaveBeenCalled()
})
it('confirms an already committed signup without contacting the provider again', async () => {
  pending = { ...pending, status: 'completed', professionalId: 3, companyId: 4 }
  await expect(reconcileAsaasSignup('checkout-test')).resolves.toEqual({ status: 'completed' })
  expect(state.request).not.toHaveBeenCalled()
})
it('does not report a completed account without its professional and company', async () => {
  pending.status = 'completed'
  await expect(reconcileAsaasSignup('checkout-test')).resolves.toEqual({ status: 'pending' })
})
it('does not query Asaas for an unknown signup', async () => {
  pending = null
  await expect(reconcileAsaasSignup('checkout-test')).resolves.toEqual({ status: 'not_found' })
  expect(state.request).not.toHaveBeenCalled()
})
