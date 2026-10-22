// Provisional values agreed for the Asaas rollout, expressed in cents per cycle.
// Do not use these to alter existing AbacatePay subscriptions.
export const ASAAS_PLAN_PRICES_CENTS = {
  start: { monthly: 19700, yearly: 176400 },
  pro: { monthly: 29700, yearly: 296400 },
  enterprise: { monthly: 49700, yearly: 476400 },
} as const

export const ASAAS_ADDON_MONTHLY_PRICE_CENTS = 10000

export function getAsaasAddonPriceCents(cycle: 'monthly' | 'yearly', env: NodeJS.ProcessEnv = process.env) {
  if (cycle === 'monthly') return ASAAS_ADDON_MONTHLY_PRICE_CENTS
  // The annual price has not been agreed; fail closed rather than charge a guessed amount.
  const value = env.ASAAS_ADDON_YEARLY_PRICE_CENTS
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new Error('Defina ASAAS_ADDON_YEARLY_PRICE_CENTS apos confirmar o valor anual dos adicionais.')
  }
  return Number(value)
}
