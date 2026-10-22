import type { BillingCycle } from './billing.js'

// The due date identifies the billing period; webhook delivery can be delayed or repeated.
export function asaasPeriodEnd(dueDate: unknown, cycle: BillingCycle): Date {
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error('Vencimento da cobranca Asaas invalido.')
  }
  const [year, month, day] = dueDate.split('-').map(Number)
  const source = new Date(Date.UTC(year, month - 1, day))
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day) {
    throw new Error('Vencimento da cobranca Asaas invalido.')
  }
  const targetMonth = month - 1 + (cycle === 'yearly' ? 12 : 1)
  const first = new Date(Date.UTC(year, targetMonth, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  // End immediately before the next due date starts in Sao Paulo (UTC-3).
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay), 2, 59, 59, 999))
}

export function isAsaasPaidPayment(event: unknown, payment: unknown): boolean {
  if (event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') return false
  if (!payment || typeof payment !== 'object') return false
  const status = (payment as { status?: unknown }).status
  return status === 'CONFIRMED' || status === 'RECEIVED' || status === 'RECEIVED_IN_CASH'
}
