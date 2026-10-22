import crypto from 'node:crypto'
import { integrationHttpClient } from './integration-http.js'

export type AsaasEnvironment = 'sandbox' | 'production'

export function getBillingProvider(env: NodeJS.ProcessEnv = process.env): 'asaas' | 'abacatepay' {
  const provider = env.BILLING_PROVIDER || 'abacatepay'
  if (provider !== 'asaas' && provider !== 'abacatepay') throw new Error('BILLING_PROVIDER deve ser asaas ou abacatepay.')
  return provider
}

export function getAsaasEnvironment(env: NodeJS.ProcessEnv = process.env): AsaasEnvironment {
  const value = env.ASAAS_ENVIRONMENT || 'sandbox'
  if (value !== 'sandbox' && value !== 'production') throw new Error('ASAAS_ENVIRONMENT deve ser sandbox ou production.')
  return value
}

export function verifyAsaasWebhookToken(received: unknown, expected = process.env.ASAAS_WEBHOOK_TOKEN): boolean {
  if (typeof received !== 'string' || !expected || expected.length < 32 || expected.length > 255 || /\s/.test(expected)) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function asaasRequest(path: string, init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}) {
  const apiKey = process.env.ASAAS_API_KEY?.trim()
  if (!apiKey) throw new Error('ASAAS_API_KEY nao configurada.')
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Caminho Asaas invalido.')
  const base = getAsaasEnvironment() === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
  const response = await integrationHttpClient.fetch(`${base}${path}`, {
    method: init.method || 'GET',
    headers: { access_token: apiKey, accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'SellClin/1.0' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error('Nao foi possivel concluir a operacao no Asaas.') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return body
}

export async function createAsaasRecurringCheckout(input: {
  reference: string
  name: string
  amountCents: number
  quantity: number
  cycle: 'monthly' | 'yearly'
  nextDueDate: string
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}) {
  if (!input.reference || input.reference.length > 200 || !input.name ||
      !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 ||
      !Number.isSafeInteger(input.quantity) || input.quantity <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)) throw new Error('Dados do checkout Asaas invalidos.')
  const data = await asaasRequest('/checkouts', {
    method: 'POST',
    body: {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      externalReference: input.reference,
      callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl },
      items: [{ name: input.name, quantity: input.quantity, value: input.amountCents / 100 }],
      subscription: { cycle: input.cycle === 'yearly' ? 'YEARLY' : 'MONTHLY', nextDueDate: input.nextDueDate },
    },
  })
  if (typeof data?.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(data.id)) throw new Error('Asaas nao retornou um ID de checkout valido.')
  const host = getAsaasEnvironment() === 'production' ? 'https://asaas.com' : 'https://sandbox.asaas.com'
  return { checkoutId: data.id, checkoutUrl: `${host}/checkoutSession/show?id=${encodeURIComponent(data.id)}` }
}

export async function cancelAsaasCheckout(checkoutId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(checkoutId)) throw new Error('ID de checkout Asaas invalido.')
  return asaasRequest(`/checkouts/${checkoutId}/cancel`, { method: 'POST' })
}

function subscriptionPath(subscriptionId: string): string {
  if (!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) throw new Error('ID de assinatura Asaas invalido.')
  return `/subscriptions/${subscriptionId}`
}

export async function cancelAsaasSubscription(subscriptionId: string) {
  return asaasRequest(subscriptionPath(subscriptionId), { method: 'DELETE' })
}

export async function updateAsaasSubscription(input: {
  subscriptionId: string
  amountCents: number
  cycle: 'monthly' | 'yearly'
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Valor da assinatura Asaas invalido.')
  if (input.cycle !== 'monthly' && input.cycle !== 'yearly') throw new Error('Ciclo da assinatura Asaas invalido.')
  return asaasRequest(subscriptionPath(input.subscriptionId), {
    method: 'PUT',
    body: {
      value: input.amountCents / 100,
      cycle: input.cycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
      updatePendingPayments: false,
    },
  })
}
