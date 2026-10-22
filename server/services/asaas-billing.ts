import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { ensureCompanyDefaults, ensureDefaultPlans } from '../bootstrap/defaults.js'
import { addDays, isBillingCycle, isPlanCode, TRIAL_DAYS, type BillingCycle, type PlanCode } from './billing.js'
import { asaasRequest, cancelAsaasSubscription, createAsaasRecurringCheckout, getAsaasEnvironment, updateAsaasSubscription, verifyAsaasWebhookToken } from './asaas-client.js'
import { asaasPeriodEnd, isAsaasPaidPayment } from './asaas-events.js'
import { ASAAS_PLAN_PRICES_CENTS } from './asaas-pricing.js'
import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from './password-policy.js'

type SignupInput = { name: string; email: string; password: string; phone?: string | null; specialization?: string | null; companyName?: string | null; planCode: PlanCode; billingCycle: BillingCycle }

export class AsaasSignupConflict extends Error {}

function todayInBrazil() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function appBaseUrl() {
  return (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || 'https://sellclin.com').replace(/\/$/, '')
}

export async function createAsaasCompanyCheckout(companyId: number, planCode: PlanCode, billingCycle: BillingCycle) {
  if (!verifyAsaasWebhookToken(process.env.ASAAS_WEBHOOK_TOKEN)) throw new Error('Webhook Asaas ainda nao configurado.')
  const existing = await prisma.companySubscription.findUnique({ where: { companyId } })
  if (!existing) throw new Error('Assinatura nao encontrada.')
  if (existing.asaasSubscriptionId || existing.abacateSubscriptionId || existing.asaasCheckoutId || existing.status === 'payment_pending') {
    throw new Error('Ja existe uma assinatura ou checkout pendente para esta clinica.')
  }
  const reserved = await prisma.companySubscription.updateMany({ where: { id: existing.id, asaasCheckoutId: null, asaasSubscriptionId: null, abacateSubscriptionId: null, status: existing.status }, data: { status: 'payment_pending', pendingPlanCode: planCode, pendingBillingCycle: billingCycle } })
  if (reserved.count !== 1) throw new Error('Checkout ja esta em processamento.')
  const url = appBaseUrl()
  const checkout = await createAsaasRecurringCheckout({ reference: `sellclin-company-${companyId}`, name: `SellClin ${planCode}`, amountCents: ASAAS_PLAN_PRICES_CENTS[planCode][billingCycle], quantity: 1, cycle: billingCycle, nextDueDate: todayInBrazil(), successUrl: `${url}/painel?billing=success`, cancelUrl: `${url}/painel?billing=return`, expiredUrl: `${url}/painel?billing=return` })
  await prisma.companySubscription.update({ where: { id: existing.id }, data: { asaasCheckoutId: checkout.checkoutId, checkoutUrl: checkout.checkoutUrl } })
  return { ...checkout, planCode, billingCycle }
}

export async function cancelAsaasCompanySubscription(companyId: number) {
  const current = await prisma.companySubscription.findUnique({ where: { companyId } })
  if (!current || current.accessSource !== 'asaas' || !current.asaasSubscriptionId) throw new Error('Assinatura Asaas nao encontrada.')
  await cancelAsaasSubscription(current.asaasSubscriptionId)
  const updated = await prisma.companySubscription.update({ where: { id: current.id }, data: { status: 'canceled', canceledAt: new Date(), pendingPlanCode: null, pendingBillingCycle: null, planChangeStatus: null } })
  return { planCode: updated.planCode, billingCycle: updated.billingCycle, status: updated.status, canceledAt: updated.canceledAt }
}

export async function changeAsaasCompanyPlan(companyId: number, planCode: PlanCode, billingCycle: BillingCycle) {
  const current = await prisma.companySubscription.findUnique({ where: { companyId } })
  if (!current || current.accessSource !== 'asaas' || current.status !== 'active' || !current.asaasSubscriptionId) throw new Error('Assinatura Asaas ativa nao encontrada.')
  if (current.pendingPlanCode) throw new Error('Ja existe uma troca de plano pendente.')
  const reserved = await prisma.companySubscription.updateMany({ where: { id: current.id, pendingPlanCode: null, status: 'active' }, data: { pendingPlanCode: planCode, pendingBillingCycle: billingCycle, planChangeStatus: 'SUBMITTING' } })
  if (reserved.count !== 1) throw new Error('Ja existe uma troca de plano em processamento.')
  try {
    await updateAsaasSubscription({ subscriptionId: current.asaasSubscriptionId, amountCents: ASAAS_PLAN_PRICES_CENTS[planCode][billingCycle], cycle: billingCycle })
  } catch (error) {
    await prisma.companySubscription.updateMany({ where: { id: current.id, planChangeStatus: 'SUBMITTING' }, data: { planChangeStatus: 'REQUIRES_RECONCILIATION' } })
    throw error
  }
  await prisma.companySubscription.updateMany({ where: { id: current.id, planChangeStatus: 'SUBMITTING' }, data: { planChangeStatus: 'PENDING' } })
  const updated = await prisma.companySubscription.findUniqueOrThrow({ where: { id: current.id } })
  return { planCode: updated.planCode, billingCycle: updated.billingCycle, pendingPlanCode: updated.pendingPlanCode, pendingBillingCycle: updated.pendingBillingCycle, planChangeStatus: updated.planChangeStatus }
}

export async function createAsaasSignupCheckout(input: SignupInput) {
  if (!verifyAsaasWebhookToken(process.env.ASAAS_WEBHOOK_TOKEN)) throw new Error('Webhook Asaas ainda nao configurado.')
  const email = input.email.trim().toLowerCase()
  if (await prisma.professional.findUnique({ where: { email } })) throw new Error('Email ja cadastrado.')
  if (!isValidNewPassword(input.password)) throw new Error(PASSWORD_POLICY_MESSAGE)
  const existing = await prisma.pendingSignup.findUnique({ where: { email } })
  if (existing) {
    // Never replace a pending checkout: it may already be paid while its webhook
    // is delayed. Preserve both the payment linkage and the original credentials.
    if (existing.status !== 'pending' || !await bcrypt.compare(input.password, existing.passwordHash)) {
      throw new AsaasSignupConflict('Ja existe um cadastro para este email. Entre na conta ou contate o suporte.')
    }
    if (existing.planCode !== input.planCode || existing.billingCycle !== input.billingCycle) {
      throw new AsaasSignupConflict('Ja existe um cadastro com outro plano. Conclua o cadastro original ou contate o suporte.')
    }
    if (existing.asaasCheckoutId && existing.checkoutUrl && Date.now() < existing.createdAt.getTime() + 60 * 60 * 1000) {
      return { pendingSignupId: existing.id, checkoutId: existing.asaasCheckoutId, checkoutUrl: existing.checkoutUrl, planCode: input.planCode, billingCycle: input.billingCycle }
    }
    throw new AsaasSignupConflict('O cadastro anterior aguarda confirmacao. Se ja pagou, aguarde a ativacao; caso contrario, contate o suporte para retomar o checkout.')
  }
  const data = {
    name: input.name.trim(), email, passwordHash: await bcrypt.hash(input.password, 10),
    phone: input.phone || null, specialization: input.specialization || null, companyName: input.companyName || null,
    planCode: input.planCode, billingCycle: input.billingCycle, status: 'pending',
  } as const
  const pending = await prisma.pendingSignup.create({ data })
  const appUrl = appBaseUrl()
  const checkout = await createAsaasRecurringCheckout({
    reference: `sellclin-signup-${pending.id}`, name: `SellClin ${input.planCode}`,
    amountCents: ASAAS_PLAN_PRICES_CENTS[input.planCode][input.billingCycle], quantity: 1,
    cycle: input.billingCycle, nextDueDate: todayInBrazil(),
    successUrl: `${appUrl}/entrar?signup=success`, cancelUrl: `${appUrl}/entrar?signup=return`, expiredUrl: `${appUrl}/entrar?signup=return`,
  })
  await prisma.pendingSignup.update({ where: { id: pending.id }, data: { asaasCheckoutId: checkout.checkoutId, checkoutUrl: checkout.checkoutUrl } })
  return { pendingSignupId: pending.id, ...checkout, planCode: input.planCode, billingCycle: input.billingCycle }
}

export async function processAsaasPaymentEvent(eventId: string, event: string, payloadPayment: any, verifiedCheckoutId?: string) {
  if (!isAsaasPaidPayment(event, payloadPayment)) return { ignored: true }
  const paymentId = payloadPayment?.id
  if (typeof paymentId !== 'string' || !/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new Error('Cobranca Asaas invalida.')
  // The API is authoritative, so old or forged payload contents cannot activate access.
  const payment = await asaasRequest(`/payments/${paymentId}`)
  if (!isAsaasPaidPayment(event, payment) || typeof payment.subscription !== 'string' || !/^sub_[a-zA-Z0-9]+$/.test(payment.subscription)) throw new Error('Cobranca recorrente confirmada nao encontrada.')
  if (verifiedCheckoutId && payment.checkoutSession && payment.checkoutSession !== verifiedCheckoutId) throw new Error('Cobranca pertence a outro checkout.')
  const subscriptionId: string = payment.subscription
  const remoteSubscription = await asaasRequest(`/subscriptions/${subscriptionId}`)
  if (remoteSubscription.deleted || remoteSubscription.status !== 'ACTIVE') return { inactive: true }
  const checkoutId: string | null = typeof payment.checkoutSession === 'string' ? payment.checkoutSession : verifiedCheckoutId || null
  // Shared plan/module defaults must be committed before the account transaction.
  if (checkoutId && await prisma.pendingSignup.findUnique({ where: { asaasCheckoutId: checkoutId } })) {
    await ensureDefaultPlans(prisma)
  }
  return prisma.$transaction(async tx => {
    // Serialize concurrent deliveries of the same payment and keep the event and mutation atomic.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`asaas-subscription-${subscriptionId}`}))::text`
    const previous = await tx.billingWebhookEvent.findUnique({ where: { eventId: `asaas:${eventId}` } })
    if (previous) return { duplicate: true }
    let current = await tx.companySubscription.findUnique({ where: { asaasSubscriptionId: subscriptionId } })
    if (!current && checkoutId) {
      const checkoutSubscription = await tx.companySubscription.findUnique({ where: { asaasCheckoutId: checkoutId } })
      if (checkoutSubscription) {
        if (checkoutSubscription.asaasSubscriptionId || !isPlanCode(checkoutSubscription.pendingPlanCode) || !isBillingCycle(checkoutSubscription.pendingBillingCycle)) throw new Error('Checkout de clinica invalido.')
        if (Math.round(Number(payment.value) * 100) !== ASAAS_PLAN_PRICES_CENTS[checkoutSubscription.pendingPlanCode][checkoutSubscription.pendingBillingCycle]) throw new Error('Valor pago diverge do checkout.')
        const planCode = checkoutSubscription.pendingPlanCode
        const billingCycle = checkoutSubscription.pendingBillingCycle
        current = await tx.companySubscription.update({ where: { id: checkoutSubscription.id }, data: { planCode, billingCycle, status: 'active', accessSource: 'asaas', asaasSubscriptionId: subscriptionId, asaasCustomerId: payment.customer || null, currentPeriodEndsAt: asaasPeriodEnd(payment.dueDate, billingCycle), pendingPlanCode: null, pendingBillingCycle: null } })
        await tx.empresa.update({ where: { id: current.companyId }, data: { plan: planCode } })
      }
    }
    const pending = !current && checkoutId ? await tx.pendingSignup.findUnique({ where: { asaasCheckoutId: checkoutId } }) : null
    if (!current && pending) {
      if (pending.status === 'completed' && pending.companyId) {
        current = await tx.companySubscription.findUnique({ where: { companyId: pending.companyId } })
        if (current?.asaasSubscriptionId !== subscriptionId) throw new Error('Assinatura divergente do cadastro.')
      } else {
        if (pending.status !== 'pending' || !isPlanCode(pending.planCode) || !isBillingCycle(pending.billingCycle)) throw new Error('Cadastro pendente invalido.')
        if (Math.round(Number(payment.value) * 100) !== ASAAS_PLAN_PRICES_CENTS[pending.planCode][pending.billingCycle]) throw new Error('Valor pago diverge do checkout.')
        if (await tx.professional.findUnique({ where: { email: pending.email } })) throw new Error('Email ja cadastrado; reconciliacao manual necessaria.')
        const company = await tx.empresa.create({ data: { name: pending.companyName || `Empresa de ${pending.name}`, plan: pending.planCode, isActive: true } })
        const professional = await tx.professional.create({ data: { name: pending.name, email: pending.email, passwordHash: pending.passwordHash, phone: pending.phone, specialization: pending.specialization, companyId: company.id, companyName: pending.companyName, authProvider: 'local' } })
        await tx.empresa.update({ where: { id: company.id }, data: { ownerId: professional.id } })
        await ensureCompanyDefaults(tx, company.id, professional.id)
        current = await tx.companySubscription.update({ where: { companyId: company.id }, data: {
          planCode: pending.planCode, billingCycle: pending.billingCycle, status: 'active', accessSource: 'asaas',
          trialEndsAt: addDays(new Date(), TRIAL_DAYS), currentPeriodEndsAt: asaasPeriodEnd(payment.dueDate, pending.billingCycle),
          asaasSubscriptionId: subscriptionId, asaasCheckoutId: checkoutId, asaasCustomerId: payment.customer || null, checkoutUrl: pending.checkoutUrl,
        } })
        await tx.pendingSignup.update({ where: { id: pending.id }, data: { status: 'completed', companyId: company.id, professionalId: professional.id, completedAt: new Date() } })
      }
    }
    // The first payment can arrive without its checkout ID. CHECKOUT_PAID is
    // reconciled separately using the provider's checkout filter.
    if (!current && !checkoutId) return { waitingForCheckout: true }
    if (!current) throw new Error('Pagamento Asaas sem checkout ou assinatura vinculada; reenviar apos reconciliacao.')
    if (current.accessSource !== 'asaas' || !isBillingCycle(current.billingCycle)) throw new Error('Assinatura Asaas invalida.')
    let cycle = current.billingCycle
    let nextPlan: PlanCode | null = null
    if (isPlanCode(current.pendingPlanCode) && isBillingCycle(current.pendingBillingCycle) && Math.round(Number(payment.value) * 100) === ASAAS_PLAN_PRICES_CENTS[current.pendingPlanCode][current.pendingBillingCycle]) {
      nextPlan = current.pendingPlanCode
      cycle = current.pendingBillingCycle
    } else if (isPlanCode(current.planCode) && Math.round(Number(payment.value) * 100) !== ASAAS_PLAN_PRICES_CENTS[current.planCode][cycle]) {
      throw new Error('Valor da renovacao nao corresponde ao plano.')
    }
    const end = asaasPeriodEnd(payment.dueDate, cycle)
    if (current.status !== 'canceled' && (!current.currentPeriodEndsAt || end > current.currentPeriodEndsAt)) {
      await tx.companySubscription.update({ where: { id: current.id }, data: { status: 'active', currentPeriodEndsAt: end, ...(nextPlan ? { planCode: nextPlan, billingCycle: cycle, pendingPlanCode: null, pendingBillingCycle: null, planChangeStatus: 'APPLIED' } : {}) } })
      if (nextPlan) await tx.empresa.update({ where: { id: current.companyId }, data: { plan: nextPlan } })
    }
    await tx.billingWebhookEvent.create({ data: { provider: 'asaas', eventId: `asaas:${eventId}`, eventType: event, payload: { paymentId, subscriptionId } } })
    return { processed: true }
  }, { timeout: 120000 })
}

export async function processAsaasPaidCheckout(eventId: string, checkoutId: unknown) {
  if (typeof checkoutId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(checkoutId)) throw new Error('Checkout Asaas invalido.')
  // A checkout notification may arrive before its payment; retry until it is confirmed.
  const result = await asaasRequest(`/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=100`)
  let payments = Array.isArray(result?.data) ? result.data : []
  // Sandbox has occasionally omitted checkoutSession filtering immediately
  // after a test payment. This fallback remains provider-authoritative and is
  // deliberately restricted to the sandbox environment.
  if (!payments.length && getAsaasEnvironment() === 'sandbox') {
    const recent = await asaasRequest('/payments?limit=100')
    payments = Array.isArray(recent?.data) ? recent.data.filter((payment: any) => payment?.checkoutSession === checkoutId) : []
  }
  const paid = payments.find((payment: any) => payment?.subscription && (!payment.checkoutSession || payment.checkoutSession === checkoutId) && isAsaasPaidPayment('PAYMENT_CONFIRMED', payment))
  if (!paid) throw new Error('Aguardando cobranca recorrente confirmada para o checkout.')
  return processAsaasPaymentEvent(eventId, 'PAYMENT_CONFIRMED', paid, checkoutId)
}

export async function reconcileAsaasSignup(checkoutId: string) {
  const pending = await prisma.pendingSignup.findUnique({ where: { asaasCheckoutId: checkoutId } })
  if (!pending) return { status: 'not_found' as const }
  if (pending.status !== 'completed') await processAsaasPaidCheckout(`return:${checkoutId}`, checkoutId)
  // A provider response (including an inactive subscription) is not proof that
  // the local account was created. Only the committed signup is authoritative.
  const current = await prisma.pendingSignup.findUnique({ where: { asaasCheckoutId: checkoutId } })
  return { status: current?.status === 'completed' && current.professionalId && current.companyId ? 'completed' as const : 'pending' as const }
}

export async function processAsaasSubscriptionDeleted(eventId: string, subscriptionId: unknown) {
  if (typeof subscriptionId !== 'string' || !/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) throw new Error('Assinatura Asaas invalida.')
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`asaas-subscription-${subscriptionId}`}))::text`
    if (await tx.billingWebhookEvent.findUnique({ where: { eventId: `asaas:${eventId}` } })) return { duplicate: true }
    await tx.companySubscription.updateMany({ where: { asaasSubscriptionId: subscriptionId, accessSource: 'asaas' }, data: { status: 'canceled', canceledAt: new Date(), pendingPlanCode: null, pendingBillingCycle: null, planChangeStatus: null } })
    await tx.billingWebhookEvent.create({ data: { provider: 'asaas', eventId: `asaas:${eventId}`, eventType: 'SUBSCRIPTION_DELETED', payload: { subscriptionId } } })
    return { processed: true }
  })
}
