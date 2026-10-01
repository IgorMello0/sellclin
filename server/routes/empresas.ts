import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyAccess, requireCompanyOwner } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { ensureCompanyDefaults } from '../bootstrap/defaults.js'
import { assertCanCreateClinic, BillingLimitError } from '../services/billing.js'
import {
  diagnoseCentralEvolution,
  disconnectCentralWhatsapp,
  getCentralWhatsappStatus,
  restartCentralWhatsapp,
  setupEvolutionWebhookForCompany,
  startCentralWhatsappConnection,
  startCentralWhatsappPairingCode,
} from '../services/whatsapp-integration.js'

export const router = Router()

async function getRequestCompanyId(req: any) {
  return req.user?.companyId || undefined
}

function sanitizeCompanySecrets(company: any) {
  if (!company) return company
  const {
    apiKey,
    apiKeyHash: _apiKeyHash,
    metaToken,
    metaWebhookVerifyToken,
    metaTwoStepPin,
    uazapiToken,
    ...safeCompany
  } = company

  return {
    ...safeCompany,
    hasApiKey: Boolean(apiKey),
    hasMetaToken: Boolean(metaToken),
    hasMetaWebhookVerifyToken: Boolean(metaWebhookVerifyToken),
    hasMetaTwoStepPin: Boolean(metaTwoStepPin),
    hasUazapiToken: Boolean(uazapiToken),
  }
}

// Obter empresa do profissional logado
router.get('/my-company', auth(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)

    if (!companyId) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId }
    })

    if (!empresa) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }


    res.json(createSuccessResponse(sanitizeCompanySecrets(empresa)))
  } catch (error: any) {
    console.error('[Empresas] Erro ao buscar minha empresa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar empresa', 500))
  }
})

router.get('/my-company/whatsapp/status', auth(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const status = await getCentralWhatsappStatus(companyId)
    return res.json(createSuccessResponse(status))
  } catch (error: any) {
    console.error('[WhatsApp Status] Erro geral:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar status do WhatsApp', 500))
  }
})

router.post('/my-company/whatsapp/connect/start', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const status = await startCentralWhatsappConnection(companyId)
    return res.json(createSuccessResponse(status))
  } catch (error: any) {
    console.error('[WhatsApp Connect] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao iniciar conexao do WhatsApp', 500))
  }
})

router.post('/my-company/whatsapp/connect/pairing-code', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const status = await startCentralWhatsappPairingCode(companyId, String(req.body?.phone || ''))
    return res.json(createSuccessResponse(status))
  } catch (error: any) {
    console.error('[WhatsApp Pairing] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao gerar codigo de pareamento do WhatsApp', 500))
  }
})

router.post('/my-company/whatsapp/webhook/setup', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const company = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ownerId: true,
        name: true,
        webhookToken: true,
        evolutionInstance: true,
        evolutionMode: true,
        evolutionApiUrl: true,
        apiKey: true,
      },
    })
    if (!company) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const result = await setupEvolutionWebhookForCompany(company)
    return res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[WhatsApp Webhook Setup] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao configurar webhook do WhatsApp', 500))
  }
})

router.get('/my-company/whatsapp/diagnostics', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const diagnostics = await diagnoseCentralEvolution(companyId)
    return res.json(createSuccessResponse(diagnostics))
  } catch (error: any) {
    console.error('[WhatsApp Diagnostics] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao diagnosticar Evolution API', 500))
  }
})

router.post('/my-company/whatsapp/disconnect', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const data = await disconnectCentralWhatsapp(companyId)
    return res.json(createSuccessResponse({ success: true, data }))
  } catch (error: any) {
    console.error('[WhatsApp Disconnect] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao desconectar WhatsApp', 500))
  }
})

router.post('/my-company/whatsapp/restart', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)
    if (!companyId) return res.status(404).json(createErrorResponse('Empresa nao encontrada', 404))

    const data = await restartCentralWhatsapp(companyId)
    return res.json(createSuccessResponse({ success: true, data }))
  } catch (error: any) {
    console.error('[WhatsApp Restart] Erro:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao reiniciar WhatsApp', 500))
  }
})

// Obter status do WhatsApp e QR Code da Evolution API (legado)
router.get('/my-company/whatsapp/legacy-status', auth(), async (req, res) => {
  try {
    const companyId = await getRequestCompanyId(req)

    if (!companyId) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: { evolutionApiUrl: true, apiKey: true, evolutionInstance: true, whatsappProvider: true }
    })

    if (!empresa) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    if (empresa.whatsappProvider !== 'evolution' || !empresa.evolutionApiUrl || !empresa.apiKey || !empresa.evolutionInstance) {
      return res.json(createSuccessResponse({ status: 'NOT_CONFIGURED' }))
    }

    const baseUrl = empresa.evolutionApiUrl.replace(/\/+$/, '')
    const instance = empresa.evolutionInstance
    const apiKey = empresa.apiKey

    // 1. Checar o estado da conexão da instância
    let connectionState: any
    try {
      const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      })
      if (stateRes.status === 200) {
        connectionState = await stateRes.json()
      }
    } catch (e: any) {
      console.error('[WhatsApp Status] Erro ao consultar connectionState:', e.message)
    }

    // Se estiver conectado
    if (connectionState?.instance?.state === 'open') {
      return res.json(createSuccessResponse({ status: 'CONNECTED' }))
    }

    // 2. Se não estiver conectado, solicitar QR Code / Conexão
    try {
      const connectRes = await fetch(`${baseUrl}/instance/connect/${instance}`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      })

      if (connectRes.status === 200) {
        const connectData: any = await connectRes.json()
        
        // Se no meio do caminho abriu a conexão
        if (connectData?.instance?.state === 'open') {
          return res.json(createSuccessResponse({ status: 'CONNECTED' }))
        }

        // Extrair o QR Code base64
        const qrcode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null
        const pairingCode = connectData?.pairingCode || null

        return res.json(createSuccessResponse({
          status: 'DISCONNECTED',
          qrcode,
          pairingCode
        }))
      }
    } catch (e: any) {
      console.error('[WhatsApp Status] Erro ao gerar QR Code:', e.message)
    }

    return res.json(createSuccessResponse({ status: 'DISCONNECTED', qrcode: null }))

  } catch (error: any) {
    console.error('[WhatsApp Status] Erro geral:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar status do WhatsApp', 500))
  }
})

// Desconectar/Logout do WhatsApp na Evolution API (legado)
router.post('/my-company/whatsapp/legacy-disconnect', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    let companyId: number | undefined

    if (req.user?.type === 'profissional') {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      })
      companyId = prof?.companyId || undefined
    } else if (req.user?.type === 'usuario') {
      companyId = req.user.companyId || undefined
    }

    if (!companyId) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: { evolutionApiUrl: true, apiKey: true, evolutionInstance: true }
    })

    if (!empresa || !empresa.evolutionApiUrl || !empresa.apiKey || !empresa.evolutionInstance) {
      return res.status(400).json(createErrorResponse('Integração não configurada', 400))
    }

    const baseUrl = empresa.evolutionApiUrl.replace(/\/+$/, '')
    const instance = empresa.evolutionInstance
    const apiKey = empresa.apiKey

    const logoutRes = await fetch(`${baseUrl}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey }
    })

    const data = await logoutRes.json().catch(() => ({}))

    res.json(createSuccessResponse({ success: true, data }))
  } catch (error: any) {
    console.error('[WhatsApp Disconnect] Erro:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao desconectar WhatsApp', 500))
  }
})

// Reiniciar Instância do WhatsApp na Evolution API
router.post('/my-company/whatsapp/legacy-restart', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    let companyId: number | undefined

    if (req.user?.type === 'profissional') {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      })
      companyId = prof?.companyId || undefined
    } else if (req.user?.type === 'usuario') {
      companyId = req.user.companyId || undefined
    }

    if (!companyId) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: { evolutionApiUrl: true, apiKey: true, evolutionInstance: true }
    })

    if (!empresa || !empresa.evolutionApiUrl || !empresa.apiKey || !empresa.evolutionInstance) {
      return res.status(400).json(createErrorResponse('Integração não configurada', 400))
    }

    const baseUrl = empresa.evolutionApiUrl.replace(/\/+$/, '')
    const instance = empresa.evolutionInstance
    const apiKey = empresa.apiKey

    const restartRes = await fetch(`${baseUrl}/instance/restart/${instance}`, {
      method: 'POST',
      headers: { 'apikey': apiKey }
    })

    const data = await restartRes.json().catch(() => ({}))

    res.json(createSuccessResponse({ success: true, data }))
  } catch (error: any) {
    console.error('[WhatsApp Restart] Erro:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao reiniciar WhatsApp', 500))
  }
})


router.get('/', auth(), async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const allowedCompanyIds = req.user?.allowedCompanies || []
  const [items, total] = await Promise.all([
    prisma.empresa.findMany({
      where: { id: { in: allowedCompanyIds } },
      skip,
      take,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        ownerId: true,
        name: true,
        logoUrl: true,
        domain: true,
        whatsapp: true,
        plan: true,
        openHour: true,
        closeHour: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.empresa.count({ where: { id: { in: allowedCompanyIds } } })
  ])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})

// Listar todas as clínicas do profissional logado
router.get('/my-companies', auth(), async (req, res) => {
  try {
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Apenas proprietários podem listar filiais', 403))
    }

    const professional = await prisma.professional.findUnique({
      where: { id: req.user.id },
      select: {
        companyId: true,
        ownedCompanies: {
          where: { isActive: true },
          select: { id: true },
        },
      }
    })

    const allowedCompanyIds = Array.from(new Set([
      ...(req.user.allowedCompanies || []),
      ...(professional?.companyId ? [professional.companyId] : []),
      ...(professional?.ownedCompanies.map((company) => company.id) || []),
    ].filter(Boolean)))

    if (allowedCompanyIds.length === 0) {
      return res.json(createSuccessResponse([]))
    }

    const empresas = await prisma.empresa.findMany({
      where: {
        id: { in: allowedCompanyIds },
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        domain: true,
        whatsapp: true,
        openHour: true,
        closeHour: true,
        maxDiscountPercentage: true,
        isActive: true,
        createdAt: true,
      },
    })

    res.json(createSuccessResponse(empresas))
  } catch (error: any) {
    console.error('[Empresas] Erro ao listar empresas:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar empresas', 500))
  }
})

router.get('/:id', auth(), requireCompanyAccess('id'), async (req, res) => {
  const id = Number(req.params.id)
  const item = await prisma.empresa.findUnique({
    where: { id },
  })
  if (!item) return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
  res.json(createSuccessResponse(sanitizeCompanySecrets(item)))
})



router.post('/', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Apenas proprietários podem criar clínicas', 403))
    }

    const usage = await assertCanCreateClinic(req.user.id)

    const { name, domain, whatsapp, openHour, closeHour } = req.body

    if (!String(name || '').trim()) {
      return res.status(400).json(createErrorResponse('Nome da clinica e obrigatorio', 400))
    }
    
    const created = await prisma.empresa.create({ 
      data: { 
        name, 
        domain, 
        whatsapp, 
        plan: usage.planCode,
        isActive: true,
        openHour, 
        closeHour,
        ownerId: req.user.id // Vincula a empresa ao dono que está criando
      } 
    })
    await ensureCompanyDefaults(prisma, created.id, req.user.id)
    res.status(201).json(createSuccessResponse(sanitizeCompanySecrets(created)))
  } catch (error: any) {
    console.error('[Empresas] Erro ao criar empresa:', error)
    if (error instanceof BillingLimitError) {
      return res.status(error.status).json(createErrorResponse(error.message, error.status, {
        limitType: error.limitType,
        addonCode: error.addonCode,
        used: error.used,
        limit: error.limit,
      }))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar clínica', 500))
  }
})

router.put('/:id', auth(), requireCompanyOwner('id'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const {
      name, domain, whatsapp, apiKey, isActive, openHour, closeHour,
      // Campos de integração WhatsApp
      whatsappProvider, evolutionMode, evolutionApiUrl, evolutionInstance, metaToken, metaPhoneNumberId,
      metaWabaId, metaBusinessId, metaPhoneDisplayNumber, metaWebhookVerifyToken, metaTwoStepPin, metaConnectionStatus,
      leadRoutingMode, maxDiscountPercentage, chargeConsultation, contactCadence
    } = req.body

    const currentCompany = await prisma.empresa.findUnique({
      where: { id },
      select: { isActive: true, openHour: true, closeHour: true },
    })
    if (!currentCompany) return res.status(404).json(createErrorResponse('Clinica nao encontrada', 404))
    if (isActive === true && !currentCompany.isActive) {
      await assertCanCreateClinic(req.user!.id)
    }

    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
    const nextOpenHour = openHour ?? currentCompany.openHour
    const nextCloseHour = closeHour ?? currentCompany.closeHour
    if (!timePattern.test(nextOpenHour) || !timePattern.test(nextCloseHour) || nextOpenHour >= nextCloseHour) {
      return res.status(400).json(createErrorResponse('Informe um horario de funcionamento valido, com abertura anterior ao fechamento', 400))
    }
    if (maxDiscountPercentage !== undefined) {
      const discount = Number(maxDiscountPercentage)
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        return res.status(400).json(createErrorResponse('O desconto maximo deve estar entre 0 e 100', 400))
      }
    }
    if (leadRoutingMode !== undefined && !['manual', 'automatic_equal', 'semi_automatic'].includes(leadRoutingMode)) {
      return res.status(400).json(createErrorResponse('Modo de roteamento invalido', 400))
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (domain !== undefined) data.domain = domain
    if (whatsapp !== undefined) data.whatsapp = whatsapp
    if (apiKey !== undefined) data.apiKey = apiKey
    if (maxDiscountPercentage !== undefined) data.maxDiscountPercentage = Number(maxDiscountPercentage)
    if (contactCadence !== undefined) data.contactCadence = Number(contactCadence)
    if (isActive !== undefined) data.isActive = isActive
    if (openHour !== undefined) data.openHour = openHour
    if (closeHour !== undefined) data.closeHour = closeHour
    if (chargeConsultation !== undefined) data.chargeConsultation = Boolean(chargeConsultation)
    if (leadRoutingMode !== undefined) data.leadRoutingMode = leadRoutingMode
    if (whatsappProvider !== undefined) data.whatsappProvider = whatsappProvider
    if (evolutionMode !== undefined) data.evolutionMode = evolutionMode
    if (evolutionApiUrl !== undefined) data.evolutionApiUrl = evolutionApiUrl
    if (evolutionInstance !== undefined) data.evolutionInstance = evolutionInstance
    if (metaToken !== undefined) data.metaToken = metaToken
    if (metaPhoneNumberId !== undefined) data.metaPhoneNumberId = metaPhoneNumberId
    if (metaWabaId !== undefined) data.metaWabaId = metaWabaId
    if (metaBusinessId !== undefined) data.metaBusinessId = metaBusinessId
    if (metaPhoneDisplayNumber !== undefined) data.metaPhoneDisplayNumber = metaPhoneDisplayNumber
    if (metaWebhookVerifyToken !== undefined) data.metaWebhookVerifyToken = metaWebhookVerifyToken
    if (metaTwoStepPin !== undefined) data.metaTwoStepPin = metaTwoStepPin
    if (metaConnectionStatus !== undefined) {
      data.metaConnectionStatus = metaConnectionStatus
      data.metaConnectedAt = metaConnectionStatus === 'connected' ? new Date() : null
    }

    const updated = await prisma.empresa.update({ where: { id }, data })
    res.json(createSuccessResponse(sanitizeCompanySecrets(updated)))
  } catch (error: any) {
    console.error('[Empresas] Erro ao atualizar empresa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar clínica', 500))
  }
})

router.delete('/:id', auth(), requireCompanyOwner('id'), async (req, res) => {
  const id = Number(req.params.id)
  await prisma.empresa.delete({ where: { id } })
  res.json(createSuccessResponse({ id }))
})
