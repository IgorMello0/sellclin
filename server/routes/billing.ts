import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from '../services/password-policy.js'
import { Router } from 'express'
import { auth, requireCompany, requireCompanyOwner } from '../middleware/auth.js'
import { prisma } from '../prisma.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import {
  cancelCompanyAbacateSubscription,
  changeCompanyAbacateSubscriptionPlan,
  createAddonCheckout,
  createAbacateSubscriptionCheckout,
  createPendingSignupCheckout,
  getBillingUsage,
  getCompanyBillingStatus,
  isAddonCode,
  isBillingCycle,
  isPlanCode,
} from '../services/billing.js'
import { getMessageCreditSummary } from '../services/message-credits.js'

export const router = Router()

router.post('/signup-checkout', async (req, res) => {
  try {
    const { name, email, password, phone, specialization, companyName } = req.body || {}
    const requestedPlanCode = req.body?.planCode
    const requestedBillingCycle = req.body?.billingCycle || 'monthly'

    if (!name || !email || !password || !phone || !specialization) {
      return res.status(400).json(createErrorResponse('Nome, email, telefone, especialidade e senha sao obrigatorios', 400))
    }

    if (!isValidNewPassword(password)) {
      return res.status(400).json(createErrorResponse(PASSWORD_POLICY_MESSAGE, 400))
    }

    if (!isPlanCode(requestedPlanCode)) {
      return res.status(400).json(createErrorResponse('Plano invalido para checkout automatico', 400))
    }

    if (!isBillingCycle(requestedBillingCycle)) {
      return res.status(400).json(createErrorResponse('Ciclo de cobranca invalido', 400))
    }

    const checkout = await createPendingSignupCheckout({
      name,
      email,
      password,
      phone,
      specialization,
      companyName,
      planCode: requestedPlanCode,
      billingCycle: requestedBillingCycle,
    })

    return res.status(201).json(createSuccessResponse(checkout))
  } catch (error: any) {
    console.error('[Billing] Erro ao criar checkout de cadastro:', error)
    const status = error.message?.includes('Email ja cadastrado') ? 400 : 500
    return res.status(status).json(createErrorResponse(error.message || 'Erro ao criar checkout de cadastro', status))
  }
})

router.get('/status', auth(), requireCompany, async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const status = await getCompanyBillingStatus(companyId)
    return res.json(createSuccessResponse(status))
  } catch (error: any) {
    console.error('[Billing] Erro ao buscar status:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar assinatura', 500))
  }
})

router.get('/usage', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Apenas profissionais podem consultar limites da conta', 403))
    }

    const requestedCompanyId = req.query.companyId ? Number(req.query.companyId) : req.user.companyId
    if (!requestedCompanyId || !Number.isInteger(requestedCompanyId)) {
      return res.status(400).json(createErrorResponse('Clinica selecionada invalida', 400))
    }

    const usage = await getBillingUsage(req.user.id, requestedCompanyId)
    return res.json(createSuccessResponse(usage))
  } catch (error: any) {
    console.error('[Billing] Erro ao buscar uso:', error)
    const status = error.message?.includes('nao pertence') ? 403 : 500
    return res.status(status).json(createErrorResponse(error.message || 'Erro ao buscar limites', status))
  }
})

router.get('/message-credits', auth(), requireCompany, async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const summary = await getMessageCreditSummary(companyId)
    return res.json(createSuccessResponse(summary))
  } catch (error: any) {
    console.error('[Billing] Erro ao buscar creditos de disparo:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar creditos de disparo', 500))
  }
})

router.post('/checkout', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const requestedPlanCode = req.body?.planCode
    const requestedBillingCycle = req.body?.billingCycle

    if (requestedPlanCode && !isPlanCode(requestedPlanCode)) {
      return res.status(400).json(createErrorResponse('Plano invalido', 400))
    }

    const currentStatus = await getCompanyBillingStatus(companyId)
    const planCode = requestedPlanCode || currentStatus.planCode
    const billingCycle = isBillingCycle(requestedBillingCycle)
      ? requestedBillingCycle
      : currentStatus.billingCycle || 'monthly'

    const checkout = await createAbacateSubscriptionCheckout(companyId, planCode, billingCycle)
    return res.json(createSuccessResponse(checkout))
  } catch (error: any) {
    console.error('[Billing] Erro ao criar checkout:', error)
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500
    return res.status(status).json(createErrorResponse(error.message || 'Erro ao criar checkout', status))
  }
})

router.post('/change-plan', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const requestedPlanCode = req.body?.planCode
    const requestedBillingCycle = req.body?.billingCycle

    if (!isPlanCode(requestedPlanCode)) {
      return res.status(400).json(createErrorResponse('Plano invalido para alteracao automatica', 400))
    }

    if (!isBillingCycle(requestedBillingCycle)) {
      return res.status(400).json(createErrorResponse('Ciclo de cobranca invalido', 400))
    }

    const change = await changeCompanyAbacateSubscriptionPlan(companyId, requestedPlanCode, requestedBillingCycle)
    return res.json(createSuccessResponse(change))
  } catch (error: any) {
    console.error('[Billing] Erro ao alterar plano:', error)
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500
    return res.status(status).json(createErrorResponse(error.message || 'Erro ao alterar plano', status))
  }
})

router.post('/cancel-subscription', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const result = await cancelCompanyAbacateSubscription(companyId)
    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[Billing] Erro ao cancelar assinatura:', error)
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500
    return res.status(status).json(createErrorResponse(error.message || 'Erro ao cancelar assinatura', status))
  }
})

router.post('/addon-checkout', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Apenas profissionais podem contratar extras', 403))
    }

    const requestedAddonCode = req.body?.addonCode
    const requestedBillingCycle = req.body?.billingCycle
    const targetCompanyId = req.body?.targetCompanyId ? Number(req.body.targetCompanyId) : req.user.companyId
    const quantity = req.body?.quantity ? Number(req.body.quantity) : 1

    if (!isAddonCode(requestedAddonCode)) {
      return res.status(400).json(createErrorResponse('Extra invalido', 400))
    }

    if (requestedBillingCycle && !isBillingCycle(requestedBillingCycle)) {
      return res.status(400).json(createErrorResponse('Ciclo de cobranca invalido', 400))
    }

    const checkout = await createAddonCheckout({
      ownerProfessionalId: req.user.id,
      addonCode: requestedAddonCode,
      targetCompanyId: requestedAddonCode === 'extra_user' ? targetCompanyId : null,
      billingCycle: isBillingCycle(requestedBillingCycle) ? requestedBillingCycle : undefined,
      quantity,
    })

    return res.status(201).json(createSuccessResponse(checkout))
  } catch (error: any) {
    console.error('[Billing] Erro ao criar checkout de extra:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao criar checkout de extra', 500))
  }
})

router.post('/select-plan', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const requestedPlanCode = req.body?.planCode
    const requestedBillingCycle = req.body?.billingCycle || 'monthly'

    if (!isPlanCode(requestedPlanCode)) {
      return res.status(400).json(createErrorResponse('Plano invalido', 400))
    }

    if (!isBillingCycle(requestedBillingCycle)) {
      return res.status(400).json(createErrorResponse('Ciclo de cobranca invalido', 400))
    }

    const subscription = await prisma.companySubscription.findUnique({
      where: { companyId },
    })

    if (!subscription || !['trialing', 'expired', 'payment_pending'].includes(subscription.status)) {
      return res.status(400).json(createErrorResponse('Este plano deve ser alterado pelo checkout', 400))
    }

    const updated = await prisma.companySubscription.update({
      where: { companyId },
      data: {
        pendingPlanCode: requestedPlanCode,
        pendingBillingCycle: requestedBillingCycle,
      },
    })

    return res.json(createSuccessResponse({
      planCode: updated.pendingPlanCode,
      billingCycle: updated.pendingBillingCycle,
      status: updated.status,
    }))
  } catch (error: any) {
    console.error('[Billing] Erro ao selecionar plano:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao selecionar plano', 500))
  }
})

router.post('/cancel-trial', auth(), requireCompany, requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!
    const subscription = await prisma.companySubscription.findUnique({
      where: { companyId },
    })

    if (!subscription) {
      return res.status(404).json(createErrorResponse('Assinatura nao encontrada', 404))
    }

    if (!['trialing', 'payment_pending', 'expired'].includes(subscription.status)) {
      return res.status(400).json(createErrorResponse('Esta assinatura nao pode ser cancelada por esta acao', 400))
    }

    const updated = await prisma.companySubscription.update({
      where: { companyId },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    })

    return res.json(createSuccessResponse({
      planCode: updated.planCode,
      status: updated.status,
      canceledAt: updated.canceledAt,
    }))
  } catch (error: any) {
    console.error('[Billing] Erro ao cancelar teste:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao cancelar teste', 500))
  }
})
