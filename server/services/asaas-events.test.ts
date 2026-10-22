import test from 'node:test'
import assert from 'node:assert/strict'
import { asaasPeriodEnd, isAsaasPaidPayment } from './asaas-events.js'

test('period end follows the charge due date, including short months', () => {
  assert.equal(asaasPeriodEnd('2024-01-31', 'monthly').toISOString(), '2024-02-29T02:59:59.999Z')
  assert.equal(asaasPeriodEnd('2024-02-29', 'yearly').toISOString(), '2025-02-28T02:59:59.999Z')
  assert.throws(() => asaasPeriodEnd('2025-02-29', 'yearly'))
})

test('only confirmed or received payments grant access', () => {
  assert.equal(isAsaasPaidPayment('PAYMENT_CONFIRMED', { status: 'CONFIRMED' }), true)
  assert.equal(isAsaasPaidPayment('PAYMENT_RECEIVED', { status: 'RECEIVED' }), true)
  assert.equal(isAsaasPaidPayment('CHECKOUT_PAID', { status: 'CONFIRMED' }), false)
  assert.equal(isAsaasPaidPayment('PAYMENT_CONFIRMED', { status: 'PENDING' }), false)
})
