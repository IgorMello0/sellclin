import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ASAAS_PLAN_PRICES_CENTS, getAsaasAddonPriceCents } from './asaas-pricing.js'

test('annual plans use the agreed provisional discounted prices', () => {
  assert.equal(ASAAS_PLAN_PRICES_CENTS.start.yearly, 176400)
  assert.equal(ASAAS_PLAN_PRICES_CENTS.pro.yearly, 296400)
  assert.equal(ASAAS_PLAN_PRICES_CENTS.enterprise.yearly, 476400)
})

test('annual addon price is never guessed', () => {
  assert.equal(getAsaasAddonPriceCents('monthly', {}), 10000)
  assert.throws(() => getAsaasAddonPriceCents('yearly', {}))
  assert.equal(getAsaasAddonPriceCents('yearly', { ASAAS_ADDON_YEARLY_PRICE_CENTS: '120000' }), 120000)
})
