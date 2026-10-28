import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from './password-policy.js'
import { integrationHttpClient } from './integration-http.js'
import crypto from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'

type PrismaExecutor = PrismaClient | Prisma.TransactionClient

export const TRIAL_DAYS = 15
export const PLAN_CODES = ['start', 'pro', 'enterprise'] as const
export const BILLING_CYCLES = ['monthly', 'yearly'] as const
export const ADDON_CODES = ['extra_clinic', 'extra_user'] as const
const ABACATEPAY_DEFAULT_PUBLIC_KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
export type PlanCode = typeof PLAN_CODES[number]
export type BillingCycle = typeof BILLING_CYCLES[number]
export type AddonCode = typeof ADDON_CODES[number]

export const OPERATIONAL_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active'])
export const ALWAYS_ALLOWED_MODULES = new Set(['dashboard'])

export class SignupCheckoutConflict extends Error {
  status = 409
}

export class BillingLimitError extends Error {
  status = 402
  limitType: 'clinics' | 'users'
  addonCode: AddonCode
  used: number
  limit: number | null

  constructor(input: {
    message: string
    limitType: 'clinics' | 'users'
    addonCode: AddonCode
    used: number
    limit: number | null
  }) {
    super(input.message)
    this.name = 'BillingLimitError'
    this.limitType = input.limitType
    this.addonCode = input.addonCode
    this.used = input.used
    this.limit = input.limit
  }
}

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === 'string' && PLAN_CODES.includes(value as PlanCode)
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle)
}

export function getBillingCycleFromAbacateFrequency(value: unknown): BillingCycle | undefined {
  if (typeof value !== 'string') return undefined

  const frequency = value.trim().toLowerCase()
  if (frequency.includes('year') || frequency.includes('annual')) return 'yearly'
  if (frequency.includes('month') || frequency.includes('mensal')) return 'monthly'

  return undefined
}

export function isAddonCode(value: unknown): value is AddonCode {
  return typeof value === 'string' && ADDON_CODES.includes(value as AddonCode)
}

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getEffectiveSubscriptionStatus(subscription: {
  status: string
  accessSource?: string | null
  trialEndsAt: Date
  currentPeriodEndsAt?: Date | null
  manualAccessEndsAt?: Date | null
  abacateSubscriptionId?: string | null
}) {
  if (subscription.status === 'trialing' && subscription.trialEndsAt.getTime() < Date.now()) {
    return 'expired'
  }

  if (subscription.status === 'active') {
    if (subscription.accessSource === 'manual') {
      return subscription.manualAccessEndsAt && subscription.manualAccessEndsAt.getTime() >= Date.now()
        ? 'active'
        : 'expired'
    }

    if (subscription.accessSource === 'abacatepay') {
      return subscription.abacateSubscriptionId
        && subscription.currentPeriodEndsAt
        && subscription.currentPeriodEndsAt.getTime() >= Date.now()
        ? 'active'
        : 'payment_pending'
    }

    return 'payment_pending'
  }

  return subscription.status
}

export function getDaysRemaining(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export async function ensureCompanySubscription(
  db: PrismaExecutor,
  companyId: number,
  planCode: PlanCode = 'start',
  billingCycle: BillingCycle = 'monthly'
) {
  const subscription = await db.companySubscription.findUnique({
    where: { companyId },
  })

  if (subscription) {
    const normalizedPlan = isPlanCode(subscription.planCode) ? subscription.planCode : planCode
    if (subscription.planCode !== normalizedPlan) {
      await db.companySubscription.update({
        where: { companyId },
        data: { planCode: normalizedPlan },
      })
    }
    return subscription
  }

  const trialEndsAt = addDays(new Date(), TRIAL_DAYS)

  const created = await db.companySubscription.create({
      data: {
        companyId,
        planCode,
        billingCycle,
        status: 'trialing',
        accessSource: 'trial',
        trialEndsAt,
      },
  })

  await db.empresa.update({
    where: { id: companyId },
    data: { plan: planCode },
    select: { id: true },
  })

  return created
}

export async function getCompanyBillingStatus(companyId: number) {
  const subscription = await ensureCompanySubscription(prisma, companyId)
  let effectiveStatus = getEffectiveSubscriptionStatus(subscription)
  let planCode = subscription.planCode
  let isInherited = false

  // Herda assinatura multi-clínicas do dono da empresa (Pro ou Enterprise)
  const company = await prisma.empresa.findUnique({
    where: { id: companyId },
    select: { ownerId: true }
  })

  if (company?.ownerId) {
    const ownerSubs = await prisma.companySubscription.findMany({
      where: { company: { ownerId: company.ownerId } }
    })
    
    const masterSub = ownerSubs.find(sub => 
      ['pro', 'enterprise'].includes(sub.planCode) && getEffectiveSubscriptionStatus(sub) === 'active'
    )
    
    if (masterSub) {
      effectiveStatus = 'active'
      planCode = masterSub.planCode
      isInherited = true
    }
  }

  if (!isInherited && effectiveStatus === 'expired' && subscription.status !== 'expired') {
    await prisma.companySubscription.update({
      where: { companyId },
      data: { status: 'expired' },
    })
  }

  const planModules = await prisma.planModule.findMany({
    where: { planCode: planCode },
    include: { module: true },
    orderBy: { moduleId: 'asc' },
  })

  const modules = planModules.map(({ module }) => ({
    code: module.code,
    name: module.name,
    icon: module.icon,
  }))

  return {
    planCode: planCode,
    status: effectiveStatus,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    accessSource: subscription.accessSource,
    manualAccessEndsAt: subscription.manualAccessEndsAt,
    billingCycle: isBillingCycle(subscription.billingCycle) ? subscription.billingCycle : 'monthly',
    daysRemaining: getDaysRemaining(
      effectiveStatus === 'active' && subscription.accessSource === 'manual' && subscription.manualAccessEndsAt
        ? subscription.manualAccessEndsAt
        : effectiveStatus === 'active' && subscription.currentPeriodEndsAt
          ? subscription.currentPeriodEndsAt
          : subscription.trialEndsAt
    ),
    modules,
    abacateSubscriptionId: subscription.abacateSubscriptionId,
    abacateCheckoutId: subscription.abacateCheckoutId,
    checkoutUrl: subscription.checkoutUrl,
    pendingPlanCode: subscription.pendingPlanCode,
    pendingBillingCycle: subscription.pendingBillingCycle,
    planChangeStatus: subscription.planChangeStatus,
  }
}

export async function getCompanyModuleEntitlements(companyId?: number | null) {
  if (!companyId) {
    return {
      planCode: 'start',
      subscriptionStatus: 'missing_company',
      moduleCodes: new Set<string>(),
      hasKnownCompany: false,
    }
  }

  const status = await getCompanyBillingStatus(companyId)
  const moduleCodes = new Set(status.modules.map((module) => module.code))

  return {
    planCode: status.planCode,
    subscriptionStatus: status.status,
    moduleCodes,
    hasKnownCompany: true,
  }
}

export async function canCompanyAccessModule(companyId: number | null | undefined, moduleCode: string) {
  if (!companyId) {
    return {
      hasAccess: false,
      blockedByPlan: true,
      planCode: 'start',
      subscriptionStatus: 'missing_company',
    }
  }

  if (ALWAYS_ALLOWED_MODULES.has(moduleCode)) {
    const status = await getCompanyBillingStatus(companyId)
    return {
      hasAccess: true,
      blockedByPlan: false,
      planCode: status.planCode,
      subscriptionStatus: status.status,
    }
  }

  const entitlements = await getCompanyModuleEntitlements(companyId)
  const statusAllowsUsage = OPERATIONAL_SUBSCRIPTION_STATUSES.has(entitlements.subscriptionStatus)
  const planIncludesModule = !entitlements.hasKnownCompany || entitlements.moduleCodes.has(moduleCode)

  return {
    hasAccess: statusAllowsUsage && planIncludesModule,
    blockedByPlan: !statusAllowsUsage || !planIncludesModule,
    planCode: entitlements.planCode,
    subscriptionStatus: entitlements.subscriptionStatus,
  }
}

function getPublicAppUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'https://sellclin.com'
  ).replace(/\/$/, '')
}

function getAbacateApiBaseUrl() {
  return (process.env.ABACATEPAY_API_BASE_URL || 'https://api.abacatepay.com/v2').replace(/\/$/, '')
}

async function postAbacate(path: string, payload: Record<string, unknown>, apiKey: string, signal?: AbortSignal) {
  const response = await integrationHttpClient.fetch(`${getAbacateApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok || body?.success === false) {
    const rawMessage = body?.error?.message || body?.error || 'Nao foi possivel concluir a operacao na Abacate Pay.'
    const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage)
    const permission = path.includes('/subscriptions/checkouts/delete')
      ? 'SUBSCRIPTION:DELETE'
      : path.includes('/subscriptions/create')
        ? 'SUBSCRIPTION:CREATE'
        : null
    const friendlyMessage = response.status === 401 || response.status === 403
      ? `A chave da AbacatePay está inválida ou sem permissão${permission ? ` ${permission}` : ''}. Confira as permissões da chave no painel e tente novamente.`
      : message
    const error = new Error(friendlyMessage) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return body?.data || body
}

async function getAbacateSignupCheckout(checkoutId: string | null, apiKey: string, externalId?: string, signal?: AbortSignal): Promise<{
  id: string
  status: string
  url?: string | null
  paidAmount?: number | null
  externalId?: string | null
  metadata?: Record<string, unknown> | null
} | null> {
  if (!checkoutId && !externalId) return null
  const params = checkoutId ? `id=${encodeURIComponent(checkoutId)}` : `externalId=${encodeURIComponent(externalId!)}`
  let response: Response
  try {
    response = await integrationHttpClient.fetch(
      `${getAbacateApiBaseUrl()}/subscriptions/checkouts/get?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, ...(signal ? { signal } : {}) }
    )
  } catch {
    throw new SignupCheckoutConflict('A AbacatePay não respondeu para confirmar o pagamento anterior. Nenhuma nova cobrança foi criada; você pode tentar novamente agora.')
  }
  const body = await response.json().catch(() => ({}))
  if (response.status === 404) {
    return checkoutId ? { id: checkoutId, status: 'MISSING' } : null
  }
  if (!response.ok || body?.success === false) {
    if (response.status === 401 || response.status === 403) {
      throw new SignupCheckoutConflict('A chave da AbacatePay precisa da permissão SUBSCRIPTION:READ para verificar o pagamento anterior. Corrija a permissão e tente novamente.')
    }
    throw new SignupCheckoutConflict('A AbacatePay não confirmou o estado do pagamento anterior. Nenhuma nova cobrança foi criada; você pode tentar novamente agora.')
  }
  const checkout = body?.data
  if (!checkout || typeof checkout.id !== 'string' || typeof checkout.status !== 'string'
    || (checkoutId && checkout.id !== checkoutId)
    || (externalId && checkout.externalId !== externalId)) {
    throw new SignupCheckoutConflict('A AbacatePay retornou dados incompletos do pagamento anterior. Nenhuma nova cobrança foi criada; tente novamente agora.')
  }
  return checkout
}

async function findAbacateSignupCheckouts(pendingSignupId: number, apiKey: string, signal?: AbortSignal) {
  const matches: Array<{ id: string; status: string; url?: string | null; paidAmount?: number | null }> = []
  let cursor: string | null = null
  // Older builds used a timestamped externalId that was not stored locally.
  // Scan a bounded recent window and match the stable signup metadata.
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: '100' })
    if (cursor) query.set('after', cursor)
    let response: Response
    try {
      response = await integrationHttpClient.fetch(
        `${getAbacateApiBaseUrl()}/subscriptions/checkouts/list?${query}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, ...(signal ? { signal } : {}) }
      )
    } catch {
      throw new SignupCheckoutConflict('A AbacatePay não respondeu para localizar o checkout anterior. Nenhuma nova cobrança foi criada; tente novamente agora.')
    }
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body?.success === false || !Array.isArray(body?.data)) {
      if (response.status === 401 || response.status === 403) {
        throw new SignupCheckoutConflict('A chave da AbacatePay precisa da permissão SUBSCRIPTION:READ para localizar o checkout anterior. Corrija a permissão e tente novamente.')
      }
      throw new SignupCheckoutConflict('A AbacatePay não conseguiu localizar o checkout anterior. Nenhuma nova cobrança foi criada; você pode tentar novamente agora.')
    }
    for (const checkout of body.data) {
      if (checkout?.metadata?.pendingSignupId === String(pendingSignupId)
        && typeof checkout.id === 'string' && typeof checkout.status === 'string') {
        matches.push(checkout)
      }
    }
    const next = body?.pagination?.next
    if (!body?.pagination?.hasMore || typeof next !== 'string' || !next) return matches
    cursor = next
  }
  throw new SignupCheckoutConflict('Ainda estamos localizando uma tentativa anterior na AbacatePay. Nenhuma nova cobrança foi criada; tente novamente agora.')
}

async function assertNoAbacateSubscriptionForCheckout(checkoutId: string, apiKey: string, signal?: AbortSignal) {
  let response: Response
  try {
    response = await integrationHttpClient.fetch(
      `${getAbacateApiBaseUrl()}/subscriptions/list?checkoutId=${encodeURIComponent(checkoutId)}&limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` }, ...(signal ? { signal } : {}) }
    )
  } catch {
    throw new SignupCheckoutConflict('A AbacatePay não respondeu para confirmar o pagamento anterior. Nenhuma nova cobrança foi criada; você pode tentar novamente agora.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.success === false || !Array.isArray(body?.data)) {
    if (response.status === 401 || response.status === 403) {
      throw new SignupCheckoutConflict('A chave da AbacatePay precisa da permissão SUBSCRIPTION:READ para confirmar o pagamento anterior. Corrija a permissão e tente novamente.')
    }
    throw new SignupCheckoutConflict('A AbacatePay não confirmou se o pagamento anterior foi concluído. Nenhuma nova cobrança foi criada; você pode tentar novamente agora.')
  }
  if (body.data.length > 0) {
    throw new SignupCheckoutConflict('O pagamento anterior gerou uma assinatura. Aguarde a ativação da conta antes de contratar outro plano.')
  }
}

async function removeUnpaidAbacateSignupCheckout(checkoutId: string, apiKey: string, signal?: AbortSignal) {
  await assertNoAbacateSubscriptionForCheckout(checkoutId, apiKey, signal)
  let deleted: any
  try {
    deleted = await postAbacate(`/subscriptions/checkouts/delete?id=${encodeURIComponent(checkoutId)}`, {}, apiKey, signal)
  } catch (error: any) {
    if (error instanceof SignupCheckoutConflict) throw error
    if (error?.status === 401 || error?.status === 403) {
      throw new SignupCheckoutConflict(String(error.message || 'A chave da AbacatePay precisa da permissão SUBSCRIPTION:DELETE. Corrija a permissão e tente novamente.'))
    }
    throw new SignupCheckoutConflict('A AbacatePay não confirmou o encerramento do checkout anterior. Nenhuma nova cobrança foi criada; tente novamente agora.')
  }
  if (deleted?.id !== checkoutId || typeof deleted?.status !== 'string') {
    throw new SignupCheckoutConflict('A AbacatePay não confirmou o encerramento do checkout anterior. Nenhuma nova cobrança foi criada; tente novamente agora.')
  }
  if (deleted.status.toUpperCase() === 'PAID' || deleted.paidAmount) {
    throw new SignupCheckoutConflict('O pagamento anterior foi confirmado. Aguarde a ativação da conta antes de contratar outro plano.')
  }
  const afterDeletion = await getAbacateSignupCheckout(checkoutId, apiKey, undefined, signal)
  if (afterDeletion && !['MISSING', 'EXPIRED', 'CANCELLED'].includes(afterDeletion.status.toUpperCase())) {
    if (afterDeletion.status.toUpperCase() === 'PAID' || afterDeletion.paidAmount) {
      throw new SignupCheckoutConflict('O pagamento anterior foi confirmado. Entre com o email e a senha cadastrados; não inicie outra cobrança.')
    }
    throw new SignupCheckoutConflict('O checkout anterior continua ativo na AbacatePay. Nenhuma nova cobrança foi criada; tente novamente agora.')
  }
  await assertNoAbacateSubscriptionForCheckout(checkoutId, apiKey, signal)
}

async function createAbacateBilling(path: string, payload: Record<string, unknown>, apiKey: string, signal?: AbortSignal) {
  const data = await postAbacate(path, payload, apiKey, signal)
  const checkoutId = data?.id || data?.checkoutId || null
  const checkoutUrl = data?.url || data?.checkoutUrl || data?.paymentUrl || null

  if (typeof checkoutId !== 'string' || !checkoutId || typeof checkoutUrl !== 'string' || !checkoutUrl) {
    throw new Error('A Abacate Pay nao retornou o identificador e a URL do checkout.')
  }

  return { checkoutId, checkoutUrl }
}

async function createAbacateCheckout(payload: Record<string, unknown>, apiKey: string) {
  return createAbacateBilling('/checkouts/create', payload, apiKey)
}

async function createAbacateSubscriptionBilling(payload: Record<string, unknown>, apiKey: string, signal?: AbortSignal) {
  return createAbacateBilling('/subscriptions/create', payload, apiKey, signal)
}

async function cancelAbacateSubscription(subscriptionId: string, apiKey: string) {
  return postAbacate('/subscriptions/cancel', { id: subscriptionId }, apiKey)
}

async function changeAbacateSubscriptionPlan(subscriptionId: string, productId: string, apiKey: string) {
  return postAbacate('/subscriptions/change-plan', {
    id: subscriptionId,
    productId,
    quantity: 1,
  }, apiKey)
}

export function getPeriodEndForCycle(cycle: BillingCycle, baseDate = new Date()) {
  return addDays(baseDate, cycle === 'yearly' ? 365 : 30)
}

function getPlanProductEnvNames(planCode: PlanCode, billingCycle: BillingCycle) {
  const envPrefixByPlan: Record<PlanCode, string> = {
    start: 'ABACATEPAY_START',
    pro: 'ABACATEPAY_PRO',
    enterprise: 'ABACATEPAY_ENTERPRISE',
  }
  const prefix = envPrefixByPlan[planCode]
  const primary = `${prefix}_${billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'}_PRODUCT_ID`
  const legacy = billingCycle === 'monthly' ? `${prefix}_PRODUCT_ID` : null

  return { primary, legacy }
}

export function getProductIdForPlan(planCode: PlanCode, billingCycle: BillingCycle) {
  const envNames = getPlanProductEnvNames(planCode, billingCycle)
  return process.env[envNames.primary] || (envNames.legacy ? process.env[envNames.legacy] : undefined)
}

function assertPlanProductIsUnique(planCode: PlanCode, billingCycle: BillingCycle, productId: string) {
  const duplicates: string[] = []

  for (const candidatePlan of PLAN_CODES) {
    for (const candidateCycle of BILLING_CYCLES) {
      if (candidatePlan === planCode && candidateCycle === billingCycle) continue
      if (getProductIdForPlan(candidatePlan, candidateCycle) === productId) {
        duplicates.push(`${candidatePlan} ${candidateCycle}`)
      }
    }
  }

  if (duplicates.length > 0) {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ABACATEPAY_ALLOW_SHARED_PRODUCT_IDS === 'true'
    ) {
      console.warn('[Billing] Produto compartilhado permitido para teste', {
        planCode,
        billingCycle,
        productId,
        sharedWith: duplicates,
      })
      return
    }

    const envNames = getPlanProductEnvNames(planCode, billingCycle)
    throw new Error(
      `Produto repetido na configuracao da Abacate Pay: ${planCode} ${billingCycle} usa o mesmo ID de ${duplicates.join(', ')}. Defina um produto exclusivo em ${envNames.primary}.`
    )
  }
}

function assertPlanCheckoutConfig(
  context: 'criar checkout' | 'alterar plano',
  planCode: PlanCode,
  billingCycle: BillingCycle,
  apiKey: string | undefined,
  productId: string | undefined
): { apiKey: string; productId: string } {
  if (!apiKey) {
    throw new Error(`Configuracao da Abacate Pay incompleta para ${context}: defina ABACATEPAY_API_KEY no ambiente da VPS.`)
  }

  if (!productId) {
    const envNames = getPlanProductEnvNames(planCode, billingCycle)
    const expectedEnv = envNames.legacy
      ? `${envNames.primary} ou ${envNames.legacy}`
      : envNames.primary

    throw new Error(
      `Configuracao da Abacate Pay incompleta para ${context} do plano ${planCode} ${billingCycle}: defina ${expectedEnv} no ambiente da VPS.`
    )
  }

  assertPlanProductIsUnique(planCode, billingCycle, productId)

  return { apiKey, productId }
}

export function getProductIdForAddon(addonCode: AddonCode, billingCycle: BillingCycle) {
  if (addonCode === 'extra_clinic') {
    return billingCycle === 'yearly'
      ? process.env.ABACATEPAY_EXTRA_CLINIC_YEARLY_PRODUCT_ID
      : process.env.ABACATEPAY_EXTRA_CLINIC_MONTHLY_PRODUCT_ID
  }

  if (addonCode === 'extra_user') {
    return billingCycle === 'yearly'
      ? process.env.ABACATEPAY_EXTRA_USER_YEARLY_PRODUCT_ID
      : process.env.ABACATEPAY_EXTRA_USER_MONTHLY_PRODUCT_ID
  }

  return undefined
}

export function getPlanBaseLimits(planCode?: string | null) {
  if (planCode === 'enterprise') {
    return {
      clinicLimit: null as number | null,
      usersPerClinicLimit: null as number | null,
    }
  }

  if (planCode === 'pro') {
    return {
      clinicLimit: 3,
      usersPerClinicLimit: 10,
    }
  }

  return {
    clinicLimit: 1,
    usersPerClinicLimit: 5,
  }
}

async function getOwnedClinicIds(ownerProfessionalId: number) {
  const professional = await prisma.professional.findUnique({
    where: { id: ownerProfessionalId },
    select: {
      companyId: true,
      ownedCompanies: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })

  if (!professional) {
    throw new Error('Profissional nao encontrado.')
  }

  return Array.from(new Set([
    ...(professional.companyId ? [professional.companyId] : []),
    ...professional.ownedCompanies.map((company) => company.id),
  ]))
}

export function buildActiveUsersForCompanyWhere(companyId: number, excludeUserId?: number | null) {
  return {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    OR: [
      {
        companyAccess: {
          some: {
            companyId,
            isActive: true,
          },
        },
      },
      {
        // Compatibilidade para usuarios antigos, criados antes da tabela de vinculos.
        companyId,
        companyAccess: { none: {} },
      },
    ],
  }
}

async function countActiveUsersForCompany(companyId: number, excludeUserId?: number | null) {
  return prisma.usuario.count({
    where: buildActiveUsersForCompanyWhere(companyId, excludeUserId),
  })
}

async function sumActiveAddons(input: {
  ownerProfessionalId: number
  addonCode: AddonCode
  targetCompanyId?: number | null
}) {
  const result = await prisma.billingAddon.aggregate({
    where: {
      ownerProfessionalId: input.ownerProfessionalId,
      addonCode: input.addonCode,
      status: 'active',
      abacateSubscriptionId: { not: null },
      currentPeriodEndsAt: { gte: new Date() },
      targetCompanyId: input.targetCompanyId ?? null,
    },
    _sum: { quantity: true },
  })

  return result._sum.quantity || 0
}

export async function expirePastDueBillingRecords() {
  const now = new Date()
  const legacySubscriptions = await prisma.companySubscription.findMany({
    where: {
      status: 'active',
      accessSource: 'trial',
    },
    select: {
      id: true,
      abacateSubscriptionId: true,
      currentPeriodEndsAt: true,
      trialEndsAt: true,
    },
  })

  if (legacySubscriptions.length > 0) {
    await prisma.$transaction(
      legacySubscriptions.map((subscription) => prisma.companySubscription.update({
        where: { id: subscription.id },
        data: subscription.abacateSubscriptionId
          ? { accessSource: 'abacatepay' }
          : {
              accessSource: 'manual',
              manualAccessEndsAt: subscription.currentPeriodEndsAt || subscription.trialEndsAt,
            },
      })),
    )
  }

  const [paidSubscriptions, manualSubscriptions, addons] = await prisma.$transaction([
    prisma.companySubscription.updateMany({
      where: {
        status: 'active',
        accessSource: 'abacatepay',
        currentPeriodEndsAt: { lt: now },
      },
      data: { status: 'expired' },
    }),
    prisma.companySubscription.updateMany({
      where: {
        status: 'active',
        accessSource: 'manual',
        manualAccessEndsAt: { lt: now },
      },
      data: { status: 'expired' },
    }),
    prisma.billingAddon.updateMany({
      where: {
        status: { in: ['trialing', 'active'] },
        currentPeriodEndsAt: { lt: now },
      },
      data: { status: 'expired' },
    }),
  ])

  return {
    subscriptionsExpired: paidSubscriptions.count + manualSubscriptions.count,
    addonsExpired: addons.count,
    legacySubscriptionsReconciled: legacySubscriptions.length,
  }
}

export async function getBillingUsage(ownerProfessionalId: number, activeCompanyId?: number | null) {
  const ownedClinicIds = await getOwnedClinicIds(ownerProfessionalId)

  if (activeCompanyId && !ownedClinicIds.includes(activeCompanyId)) {
    throw new Error('Clinica selecionada nao pertence ao profissional.')
  }

  const targetCompanyId = activeCompanyId || ownedClinicIds[0] || null

  if (!targetCompanyId) {
    throw new Error('Clinica ativa nao encontrada.')
  }

  const billingStatus = await getCompanyBillingStatus(targetCompanyId)
  const baseLimits = getPlanBaseLimits(billingStatus.planCode)
  const [clinicExtraQuantity, userExtraQuantity, usersUsed] = await Promise.all([
    sumActiveAddons({ ownerProfessionalId, addonCode: 'extra_clinic' }),
    sumActiveAddons({ ownerProfessionalId, addonCode: 'extra_user', targetCompanyId }),
    countActiveUsersForCompany(targetCompanyId),
  ])

  const clinicLimit = baseLimits.clinicLimit === null ? null : baseLimits.clinicLimit + clinicExtraQuantity
  const usersPerClinicLimit = baseLimits.usersPerClinicLimit === null ? null : baseLimits.usersPerClinicLimit + userExtraQuantity

  return {
    planCode: billingStatus.planCode,
    billingCycle: billingStatus.billingCycle,
    subscriptionStatus: billingStatus.status,
    clinics: {
      used: ownedClinicIds.length,
      baseLimit: baseLimits.clinicLimit,
      extraQuantity: clinicExtraQuantity,
      limit: clinicLimit,
      canCreate: clinicLimit === null || ownedClinicIds.length < clinicLimit,
    },
    users: {
      companyId: targetCompanyId,
      used: usersUsed,
      baseLimit: baseLimits.usersPerClinicLimit,
      extraQuantity: userExtraQuantity,
      limit: usersPerClinicLimit,
      canCreate: usersPerClinicLimit === null || usersUsed < usersPerClinicLimit,
    },
  }
}

export async function assertCanCreateClinic(ownerProfessionalId: number) {
  const usage = await getBillingUsage(ownerProfessionalId)
  if (!OPERATIONAL_SUBSCRIPTION_STATUSES.has(usage.subscriptionStatus)) {
    throw new BillingLimitError({
      message: 'Assinatura inativa. Ative um plano para criar clinicas.',
      limitType: 'clinics',
      addonCode: 'extra_clinic',
      used: usage.clinics.used,
      limit: usage.clinics.limit,
    })
  }
  if (!usage.clinics.canCreate) {
    throw new BillingLimitError({
      message: 'Limite de clinicas do plano atingido.',
      limitType: 'clinics',
      addonCode: 'extra_clinic',
      used: usage.clinics.used,
      limit: usage.clinics.limit,
    })
  }

  return usage
}

export async function assertCanAddUserToCompany(
  ownerProfessionalId: number,
  companyId: number,
  excludeUserId?: number | null
) {
  const ownerClinicIds = await getOwnedClinicIds(ownerProfessionalId)
  if (!ownerClinicIds.includes(companyId)) {
    throw new Error('Clinica alvo nao pertence ao profissional.')
  }

  const usage = await getBillingUsage(ownerProfessionalId, companyId)
  if (!OPERATIONAL_SUBSCRIPTION_STATUSES.has(usage.subscriptionStatus)) {
    throw new BillingLimitError({
      message: 'Assinatura inativa. Ative um plano para adicionar usuarios.',
      limitType: 'users',
      addonCode: 'extra_user',
      used: usage.users.used,
      limit: usage.users.limit,
    })
  }
  const used = await countActiveUsersForCompany(companyId, excludeUserId)
  const limit = usage.users.limit
  if (limit !== null && used >= limit) {
    throw new BillingLimitError({
      message: 'Limite de usuarios do plano atingido nesta clinica.',
      limitType: 'users',
      addonCode: 'extra_user',
      used,
      limit,
    })
  }

  return usage
}

export async function createAddonCheckout(input: {
  ownerProfessionalId: number
  addonCode: AddonCode
  targetCompanyId?: number | null
  billingCycle?: BillingCycle
  quantity?: number
}) {
  const ownerClinicIds = await getOwnedClinicIds(input.ownerProfessionalId)
  const activeCompanyId = input.targetCompanyId || ownerClinicIds[0]

  if (!activeCompanyId) {
    throw new Error('Clinica ativa nao encontrada.')
  }

  if (input.addonCode === 'extra_user' && !input.targetCompanyId) {
    throw new Error('Extra de usuario exige uma clinica alvo.')
  }

  if (input.targetCompanyId && !ownerClinicIds.includes(input.targetCompanyId)) {
    throw new Error('Clinica alvo nao pertence ao profissional.')
  }

  const usage = await getBillingUsage(input.ownerProfessionalId, activeCompanyId)
  if (!OPERATIONAL_SUBSCRIPTION_STATUSES.has(usage.subscriptionStatus)) {
    throw new Error('Ative um plano antes de contratar adicionais.')
  }

  const planBillingCycle = isBillingCycle(usage.billingCycle) ? usage.billingCycle : 'monthly'
  if (input.billingCycle && input.billingCycle !== planBillingCycle) {
    throw new Error('O adicional deve usar o mesmo ciclo de cobranca do plano ativo.')
  }
  const billingCycle = planBillingCycle
  const productId = getProductIdForAddon(input.addonCode, billingCycle)
  const apiKey = process.env.ABACATEPAY_API_KEY
  const requestedQuantity = Number(input.quantity || 1)
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 50) {
    throw new Error('Quantidade de adicional invalida.')
  }
  const quantity = requestedQuantity

  if (!apiKey || !productId) {
    throw new Error('Configuracao da Abacate Pay incompleta para criar checkout de extra.')
  }

  const addon = await prisma.billingAddon.create({
    data: {
      ownerProfessionalId: input.ownerProfessionalId,
      targetCompanyId: input.addonCode === 'extra_user' ? input.targetCompanyId || activeCompanyId : null,
      addonCode: input.addonCode,
      quantity,
      billingCycle,
      status: 'payment_pending',
    },
  })

  const appUrl = getPublicAppUrl()
  const externalId = `sellclin-addon-${addon.id}-${Date.now()}`

  const payload = {
    items: [{ id: productId, quantity }],
    externalId,
    returnUrl: `${appUrl}/configuracoes?tab=planos&billing=addon-return`,
    completionUrl: `${appUrl}/configuracoes?tab=planos&billing=addon-success`,
    methods: ['CARD'],
    metadata: {
      billingAddonId: String(addon.id),
      ownerProfessionalId: String(input.ownerProfessionalId),
      addonCode: input.addonCode,
      targetCompanyId: input.addonCode === 'extra_user' ? String(input.targetCompanyId || activeCompanyId) : '',
      billingCycle,
      quantity: String(quantity),
    },
  }

  const { checkoutId, checkoutUrl } = await createAbacateSubscriptionBilling(payload, apiKey)

  await prisma.billingAddon.update({
    where: { id: addon.id },
    data: {
      abacateCheckoutId: checkoutId,
      checkoutUrl,
    },
  })

  return {
    billingAddonId: addon.id,
    checkoutId,
    checkoutUrl,
  }
}

export async function activateBillingAddon(input: {
  billingAddonId: number
  normalizedStatus: string
  subscriptionId?: string | null
  checkoutId?: string | null
  billingCycle?: BillingCycle
  quantity?: number | null
}) {
  const addon = await prisma.billingAddon.findUnique({
    where: { id: input.billingAddonId },
  })

  if (!addon) {
    throw new Error('Extra de billing nao encontrado.')
  }

  const isOperational = OPERATIONAL_SUBSCRIPTION_STATUSES.has(input.normalizedStatus)
  if (isOperational && !input.subscriptionId) {
    throw new Error('Evento operacional de adicional sem assinatura recorrente.')
  }
  const data = {
    status: input.normalizedStatus,
    ...(input.subscriptionId ? { abacateSubscriptionId: input.subscriptionId } : {}),
    ...(input.checkoutId ? { abacateCheckoutId: input.checkoutId } : {}),
    ...(input.billingCycle ? { billingCycle: input.billingCycle } : {}),
    ...(input.quantity && input.quantity > 0 ? { quantity: input.quantity } : {}),
    ...(isOperational ? { activatedAt: addon.activatedAt || new Date() } : {}),
    ...(input.normalizedStatus === 'active' ? { currentPeriodEndsAt: getPeriodEndForCycle(input.billingCycle || (isBillingCycle(addon.billingCycle) ? addon.billingCycle : 'monthly')) } : {}),
    ...(input.normalizedStatus === 'canceled' ? { canceledAt: new Date() } : {}),
  }

  const updated = await prisma.billingAddon.update({
    where: { id: addon.id },
    data,
  })

  return {
    billingAddonId: updated.id,
    addonCode: updated.addonCode,
    targetCompanyId: updated.targetCompanyId,
    quantity: updated.quantity,
    status: updated.status,
  }
}

export async function createAbacateSubscriptionCheckout(
  companyId: number,
  planCode: PlanCode,
  billingCycle: BillingCycle = 'monthly'
) {
  const apiKey = process.env.ABACATEPAY_API_KEY
  const productId = getProductIdForPlan(planCode, billingCycle)

  const abacateConfig = assertPlanCheckoutConfig('criar checkout', planCode, billingCycle, apiKey, productId)

  const company = await prisma.empresa.findUnique({
    where: { id: companyId },
    select: { id: true, subscription: true },
  })

  if (!company) {
    throw new Error('Clinica nao encontrada.')
  }

  const subscription = company.subscription || await ensureCompanySubscription(prisma, companyId, planCode)
  const appUrl = getPublicAppUrl()
  const externalId = `sellclin-${companyId}-${subscription.id}-${planCode}-${billingCycle}-${Date.now()}`

  const payload = {
    productId: abacateConfig.productId,
    quantity: 1,
    items: [{ id: abacateConfig.productId, quantity: 1 }],
    externalId,
    returnUrl: `${appUrl}/painel?billing=return`,
    completionUrl: `${appUrl}/painel?billing=success`,
    methods: ['CARD'],
    metadata: {
      companyId: String(companyId),
      planCode,
      billingCycle,
      subscriptionId: String(subscription.id),
    },
  }

  console.info('[Billing] Criando checkout de assinatura', {
    companyId,
    planCode,
    billingCycle,
    productId: abacateConfig.productId,
  })

  const { checkoutId, checkoutUrl } = await createAbacateSubscriptionBilling(payload, abacateConfig.apiKey)

  await prisma.companySubscription.update({
    where: { companyId },
    data: {
      status: getEffectiveSubscriptionStatus(subscription) === 'expired' ? 'payment_pending' : subscription.status,
      abacateCheckoutId: checkoutId,
      checkoutUrl,
      pendingPlanCode: planCode,
      pendingBillingCycle: billingCycle,
      abacatePlanChangeId: null,
      planChangeStatus: null,
    },
  })

  return {
    checkoutId,
    checkoutUrl,
    planCode,
    billingCycle,
    productId: abacateConfig.productId,
  }
}

export async function cancelCompanyAbacateSubscription(companyId: number) {
  const apiKey = process.env.ABACATEPAY_API_KEY
  if (!apiKey) {
    throw new Error('Configuracao da Abacate Pay incompleta para cancelar assinatura.')
  }

  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
  })

  if (!subscription) {
    throw new Error('Assinatura nao encontrada.')
  }

  if (!subscription.abacateSubscriptionId) {
    throw new Error('Esta assinatura ainda nao possui ID recorrente na Abacate Pay.')
  }

  await cancelAbacateSubscription(subscription.abacateSubscriptionId, apiKey)

  const updated = await prisma.companySubscription.update({
    where: { companyId },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
      pendingPlanCode: null,
      pendingBillingCycle: null,
      abacatePlanChangeId: null,
      planChangeStatus: null,
    },
  })

  return {
    planCode: updated.planCode,
    billingCycle: updated.billingCycle,
    status: updated.status,
    canceledAt: updated.canceledAt,
  }
}

export async function changeCompanyAbacateSubscriptionPlan(
  companyId: number,
  planCode: PlanCode,
  billingCycle: BillingCycle
) {
  const apiKey = process.env.ABACATEPAY_API_KEY
  const productId = getProductIdForPlan(planCode, billingCycle)
  const abacateConfig = assertPlanCheckoutConfig('alterar plano', planCode, billingCycle, apiKey, productId)

  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
  })

  if (!subscription) {
    throw new Error('Assinatura nao encontrada.')
  }

  if (subscription.status !== 'active' || !subscription.abacateSubscriptionId) {
    throw new Error('Somente assinaturas ativas da Abacate Pay podem trocar de plano.')
  }

  const change = await changeAbacateSubscriptionPlan(
    subscription.abacateSubscriptionId,
    abacateConfig.productId,
    abacateConfig.apiKey
  )
  const planChangeId = change?.id || null
  const planChangeStatus = change?.status || 'PENDING'

  const updated = await prisma.companySubscription.update({
    where: { companyId },
    data: {
      pendingPlanCode: planCode,
      pendingBillingCycle: billingCycle,
      abacatePlanChangeId: planChangeId,
      planChangeStatus,
    },
  })

  return {
    planCode: updated.planCode,
    billingCycle: updated.billingCycle,
    pendingPlanCode: updated.pendingPlanCode,
    pendingBillingCycle: updated.pendingBillingCycle,
    planChangeStatus: updated.planChangeStatus,
  }
}

export async function createPendingSignupCheckout(input: {
  name: string
  email: string
  password: string
  phone?: string | null
  specialization?: string | null
  companyName?: string | null
  planCode: PlanCode
  billingCycle: BillingCycle
}) {
  const apiKey = process.env.ABACATEPAY_API_KEY
  const productId = getProductIdForPlan(input.planCode, input.billingCycle)

  const abacateConfig = assertPlanCheckoutConfig('criar checkout', input.planCode, input.billingCycle, apiKey, productId)
  if (!process.env.ABACATEPAY_WEBHOOK_SECRET?.trim()) {
    throw new Error('Configure ABACATEPAY_WEBHOOK_SECRET antes de iniciar cadastros.')
  }
  // Bound the full provider reconciliation + replacement flow. A timeout is
  // treated as ambiguous, so the next click reconciles by the stable externalId.
  const providerSignal = AbortSignal.timeout(15_000)

  const email = input.email.trim().toLowerCase()
  const existingProfessional = await prisma.professional.findUnique({ where: { email } })
  if (existingProfessional) {
    throw new Error('Email ja cadastrado.')
  }

  if (!isValidNewPassword(input.password)) throw new Error(PASSWORD_POLICY_MESSAGE)
  let pending = await prisma.pendingSignup.findUnique({ where: { email } })
  if (pending) {
    if (!await bcrypt.compare(input.password, pending.passwordHash)) {
      throw new SignupCheckoutConflict('Ja existe um cadastro com esse email. Use a senha original para retomar o pagamento ou recupere o acesso.')
    }
    if (pending.companyId || pending.professionalId || pending.status === 'completed') {
      throw new SignupCheckoutConflict('Cadastro ja concluido. Entre com o email e a senha cadastrados.')
    }
    const recoverableStatuses = ['pending', 'payment_pending', 'expired', 'canceled', 'checkout_unknown']
    if (!recoverableStatuses.includes(pending.status)) {
      throw new SignupCheckoutConflict('Este cadastro ainda está sendo processado. Nenhuma nova cobrança foi criada; envie novamente o formulário agora.')
    }

    let previousCheckouts: Array<{ id: string; status: string; url?: string | null; paidAmount?: number | null }> = []
    if (pending.abacateCheckoutId) {
      const checkout = await getAbacateSignupCheckout(pending.abacateCheckoutId, abacateConfig.apiKey, undefined, providerSignal)
      if (checkout) previousCheckouts.push(checkout)
    } else if (pending.status === 'checkout_unknown') {
      const stableExternalId = `sellclin-signup-${pending.id}`
      const checkout = await getAbacateSignupCheckout(null, abacateConfig.apiKey, stableExternalId, providerSignal)
      previousCheckouts = checkout
        ? [checkout]
        : await findAbacateSignupCheckouts(pending.id, abacateConfig.apiKey, providerSignal)
    }

    for (const checkout of previousCheckouts) {
      const checkoutStatus = checkout.status.toUpperCase()
      if (checkoutStatus === 'PAID' || checkout.paidAmount) {
        throw new SignupCheckoutConflict('Pagamento recebido. Entre com o email e a senha cadastrados; não inicie outra cobrança.')
      }
      if (checkoutStatus === 'PENDING') {
        // Always rotate a pending link on form resubmission. The hosted page
        // can already be expired even when the provider still reports PENDING.
        await removeUnpaidAbacateSignupCheckout(checkout.id, abacateConfig.apiKey, providerSignal)
      } else if (['MISSING', 'EXPIRED', 'CANCELLED'].includes(checkoutStatus)) {
        await assertNoAbacateSubscriptionForCheckout(checkout.id, abacateConfig.apiKey, providerSignal)
      } else {
        throw new SignupCheckoutConflict('A AbacatePay não confirmou que o pagamento anterior terminou sem cobrança. Nenhuma nova cobrança foi criada; tente novamente agora.')
      }
    }

    // The provider must confirm every previous checkout is unpaid and closed
    // before the same email can receive a replacement checkout.
    const claimed = await prisma.pendingSignup.updateMany({
      where: {
        id: pending.id,
        status: { in: recoverableStatuses },
        abacateCheckoutId: pending.abacateCheckoutId,
        companyId: null, professionalId: null,
      },
      data: {
        status: 'creating_checkout', abacateCheckoutId: null, checkoutUrl: null,
        planCode: input.planCode, billingCycle: input.billingCycle,
      },
    })
    if (!claimed.count) {
      throw new SignupCheckoutConflict('Outra tentativa deste cadastro está em andamento. Nenhuma cobrança duplicada foi criada; envie o formulário novamente agora.')
    }
  } else {
    try {
      pending = await prisma.pendingSignup.create({
        data: {
          name: input.name.trim(), email,
          passwordHash: await bcrypt.hash(input.password, 10),
          phone: input.phone || null,
          specialization: input.specialization || null,
          companyName: input.companyName || null,
          planCode: input.planCode,
          billingCycle: input.billingCycle,
          status: 'creating_checkout',
        },
      })
    } catch (error: any) {
      if (error.code === 'P2002') throw new SignupCheckoutConflict('Outra tentativa deste cadastro está em andamento. Envie o formulário novamente agora com os mesmos dados.')
      throw error
    }
  }

  const appUrl = getPublicAppUrl()
  // A stable reference lets the next request recover a checkout if AbacatePay
  // accepted the create request but its response was lost in transit.
  const externalId = `sellclin-signup-${pending.id}`

  const payload = {
    productId: abacateConfig.productId,
    quantity: 1,
    items: [{ id: abacateConfig.productId, quantity: 1 }],
    externalId,
    returnUrl: `${appUrl}/entrar?signup=return`,
    completionUrl: `${appUrl}/entrar?signup=success`,
    methods: ['CARD'],
    metadata: {
      pendingSignupId: String(pending.id),
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      email,
    },
  }

  console.info('[Billing] Criando checkout de cadastro', {
    pendingSignupId: pending.id,
    planCode: input.planCode,
    billingCycle: input.billingCycle,
    productId: abacateConfig.productId,
  })

  try {
    const { checkoutId, checkoutUrl } = await createAbacateSubscriptionBilling(payload, abacateConfig.apiKey, providerSignal)
    // A webhook can complete the account before the checkout response arrives.
    await prisma.pendingSignup.updateMany({
      where: { id: pending.id, status: 'creating_checkout' },
      data: { status: 'pending', abacateCheckoutId: checkoutId, checkoutUrl },
    })
    return {
      pendingSignupId: pending.id, checkoutId, checkoutUrl,
      planCode: input.planCode, billingCycle: input.billingCycle,
      productId: abacateConfig.productId,
    }
  } catch (error: any) {
    // A lost response may already have created a checkout. Keep the signup
    // recoverable; the next attempt reconciles the stable externalId first.
    const rejected = [400, 401, 403, 404, 422, 429].includes(error.status)
    await prisma.pendingSignup.updateMany({
      where: { id: pending.id, status: 'creating_checkout', abacateCheckoutId: null },
      data: { status: rejected ? 'pending' : 'checkout_unknown' },
    }).catch(() => console.error('[Billing] Nao foi possivel registrar a falha do checkout', { pendingSignupId: pending.id }))
    if (rejected) throw error
    throw new SignupCheckoutConflict('Não conseguimos confirmar se a AbacatePay criou o checkout. Reenvie o formulário agora; vamos conferir a tentativa antes de cobrar novamente.')
  }
}

export function verifyAbacateWebhookSignature(rawBody: string, signature: string | undefined) {
  const hmacKey =
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY ||
    process.env.ABACATEPAY_PUBLIC_KEY ||
    process.env.ABACATEPAY_HMAC_KEY ||
    ABACATEPAY_DEFAULT_PUBLIC_KEY

  if (!hmacKey) return false
  if (!signature) return false

  const expected = crypto
    .createHmac('sha256', hmacKey)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64')

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function markWebhookEventProcessed(eventId: string, eventType: string | undefined, payload: any) {
  try {
    await prisma.billingWebhookEvent.create({
      data: {
        eventId,
        eventType,
        payload,
      },
    })

    return true
  } catch (error: any) {
    if (error?.code === 'P2002') return false
    throw error
  }
}
