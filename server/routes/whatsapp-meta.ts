import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import {
  buildMetaConnectUrl,
  connectMetaWhatsappFromCode,
  disconnectMetaWhatsapp,
  getMetaWhatsappStatus,
  repairMetaWhatsappWebhook,
  saveManualMetaWhatsappConfig,
} from '../services/meta-whatsapp.js'
import { isCoexistenceAllowed, type WhatsAppOfficialMode } from '../services/whatsapp-connections.js'

export const router = Router()
const ownerOnly = [auth(), requireModule('conversas'), requireCompanyOwner()]

function getPublicAppUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'https://sellclin.com'
  ).replace(/\/$/, '')
}

async function getRequestCompanyId(req: any) {
  if (req.user?.companyId) return Number(req.user.companyId)

  if (req.user?.type === 'profissional') {
    const prof = await prisma.professional.findUnique({
      where: { id: req.user.id },
      select: { companyId: true },
    })
    return prof?.companyId || undefined
  }

  if (req.user?.type === 'usuario') {
    return req.user.companyId || undefined
  }

  return undefined
}

async function getRequestEmail(req: any) {
  if (req.user?.type === 'profissional') {
    const professional = await prisma.professional.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    })
    return professional?.email || null
  }

  if (req.user?.type === 'usuario') {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    })
    return user?.email || null
  }

  return null
}

router.get('/connect', ...ownerOnly, async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const cloudApiEnabled = String(process.env.WHATSAPP_CLOUD_API_ENABLED || '').toLowerCase() === 'true'
    const requestedMode = req.query.mode === 'cloud_api' ? 'cloud_api' : 'coexistence'
    const officialMode: WhatsAppOfficialMode = requestedMode === 'cloud_api' && cloudApiEnabled
      ? 'cloud_api'
      : 'coexistence'
    if (officialMode === 'coexistence') {
      const email = await getRequestEmail(req)
      if (!isCoexistenceAllowed(email)) {
        return res.status(403).json(createErrorResponse('Coexistencia ainda nao habilitada para esta conta.', 403))
      }
    }

    const url = buildMetaConnectUrl(companyId, req.user?.id || null, officialMode)
    return res.json(createSuccessResponse({ url }))
  } catch (error: any) {
    console.error('[WhatsApp Meta Connect] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao iniciar conexao com a Meta', 500))
  }
})

router.get('/callback', async (req, res) => {
  const appUrl = getPublicAppUrl()
  const code = String(req.query.code || '')
  const state = String(req.query.state || '')
  const error = req.query.error || req.query.error_reason

  if (error) {
    return res.redirect(`${appUrl}/integracoes?channel=whatsapp&whatsappMeta=error`)
  }

  if (!code || !state) {
    return res.redirect(`${appUrl}/integracoes?channel=whatsapp&whatsappMeta=error`)
  }

  try {
    const result = await connectMetaWhatsappFromCode(code, state)
    const channel = result.officialMode === 'coexistence' ? 'whatsapp-coexistence' : 'whatsapp-official'
    return res.redirect(`${appUrl}/integracoes?channel=${channel}&whatsappMeta=connected&mode=${result.officialMode}`)
  } catch (err: any) {
    console.error('[WhatsApp Meta Callback] Erro:', err)
    return res.redirect(`${appUrl}/integracoes?channel=whatsapp&whatsappMeta=error`)
  }
})

router.get('/status', auth(), requireModule('conversas'), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const [status, email] = await Promise.all([
      getMetaWhatsappStatus(companyId),
      getRequestEmail(req),
    ])
    return res.json(createSuccessResponse({
      ...status,
      coexistenceAllowed: isCoexistenceAllowed(email),
    }))
  } catch (error: any) {
    console.error('[WhatsApp Meta Status] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar status da Meta', 500))
  }
})

router.post('/configure', ...ownerOnly, async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const result = await saveManualMetaWhatsappConfig(companyId, {
      phoneNumberId: req.body?.phoneNumberId,
      wabaId: req.body?.wabaId,
      businessId: req.body?.businessId,
      accessToken: req.body?.accessToken,
      webhookVerifyToken: req.body?.webhookVerifyToken,
      twoStepPin: req.body?.twoStepPin,
      displayPhoneNumber: req.body?.displayPhoneNumber,
    })

    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[WhatsApp Meta Configure] Erro:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao salvar configuracao Meta', 400))
  }
})

router.post('/disconnect', ...ownerOnly, async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const result = await disconnectMetaWhatsapp(companyId)
    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[WhatsApp Meta Disconnect] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao desconectar Meta', 500))
  }
})

router.post('/webhook/repair', ...ownerOnly, async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const requestedMode: WhatsAppOfficialMode | undefined = req.body?.mode === 'coexistence'
      ? 'coexistence'
      : undefined
    const result = await repairMetaWhatsappWebhook(companyId, requestedMode)
    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[WhatsApp Meta Webhook Repair] Erro:', error)
    return res.status(400).json(createErrorResponse(error.message || 'Erro ao reparar recebimento da Meta', 400))
  }
})
