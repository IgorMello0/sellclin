import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { sendUazapiRequest } from '../services/uazapi-whatsapp.js'
import { getApprovedWhatsAppTemplate } from '../services/whatsapp-templates.js'
import { processOutgoingMessage } from '../services/whatsapp-integration.js'
import crypto from 'node:crypto'
import { getJwtSecret } from '../config/security.js'

export const router = Router()

const SPREADSHEET_CONTACT_LIMIT = 5000
const CAMPAIGN_VARIABLE_KEYS = new Set([
  '{{nome}}', '{{primeiro_nome}}', '{{telefone}}', '{{data}}', '{{hora}}',
  '{{especialista}}', '{{proxima_data}}', '{{proxima_hora}}', '{{ultima_data}}', '{{ultima_hora}}',
])

type CampaignProvider = 'meta' | 'uazapi' | 'evolution'

function normalizeCampaignProvider(value: unknown): CampaignProvider | null {
  const provider = String(value || '').trim().toLowerCase()
  return provider === 'meta' || provider === 'uazapi' || provider === 'evolution' ? provider : null
}

function getPublicAppUrlFromRequest(req?: any) {
  const configured = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '')
  if (configured) return configured
  if (!req) return ''
  return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '')
}

function toPublicMediaUrl(url: string, req?: any) {
  if (!url || url.startsWith('data:') || /^https?:\/\//i.test(url)) return url
  if (url.startsWith('/uploads/')) {
    const publicUrl = getPublicAppUrlFromRequest(req)
    return publicUrl ? `${publicUrl}${url}` : url
  }
  return url
}

function normalizeMediaUrlPayload(value?: string | null, req?: any) {
  if (!value) return value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.map((item: any) => ({
        ...item,
        url: item?.url ? toPublicMediaUrl(String(item.url), req) : item?.url,
      })))
    }
  } catch {
    // Plain URL, handled below.
  }
  return toPublicMediaUrl(value, req)
}

function getTemplateBodyDescriptor(template: { components: unknown; parameterFormat?: string | null }) {
  const components = Array.isArray(template.components) ? template.components as Array<Record<string, unknown>> : []
  const body = components.find(component => String(component.type || '').toUpperCase() === 'BODY')
  const text = String(body?.text || '')
  const tokens: string[] = []
  for (const match of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    const token = String(match[1] || '').trim()
    if (token && !tokens.includes(token)) tokens.push(token)
  }
  const parameterFormat = String(template.parameterFormat || '').toUpperCase() === 'NAMED' ? 'NAMED' : 'POSITIONAL'
  if (parameterFormat === 'POSITIONAL') tokens.sort((left, right) => Number(left) - Number(right))
  return { text, tokens, parameterFormat }
}

function getTemplateHeaderMediaType(template: { components: unknown } | null | undefined): 'image' | 'video' | null {
  const components = Array.isArray(template?.components)
    ? template.components as Array<Record<string, unknown>>
    : []
  const header = components.find(component => String(component.type || '').toUpperCase() === 'HEADER')
  const format = String(header?.format || '').toUpperCase()
  if (format === 'IMAGE') return 'image'
  if (format === 'VIDEO') return 'video'
  return null
}

function normalizeTemplateMappings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean)
}

function validateTemplateMappings(mappings: string[], expectedCount: number) {
  if (mappings.length !== expectedCount) {
    return `Este template exige ${expectedCount} variavel(is), mas ${mappings.length} foram vinculadas.`
  }
  const invalid = mappings.find(mapping => !CAMPAIGN_VARIABLE_KEYS.has(mapping))
  return invalid ? `A variavel ${invalid} nao pode ser usada nesta campanha.` : null
}

function getCampaignMediaSignature(campaignId: number, index: string) {
  return crypto.createHmac('sha256', getJwtSecret()).update(`${campaignId}:${index}`).digest('hex')
}

function hasValidCampaignMediaSignature(campaignId: number, index: string, signature: unknown) {
  if (typeof signature !== 'string') return false
  const expected = Buffer.from(getCampaignMediaSignature(campaignId, index))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function getCampaignMediaPath(campaignId: number, index: string) {
  const signature = getCampaignMediaSignature(campaignId, index)
  return `/api/campaigns/media/${campaignId}/${index}?signature=${encodeURIComponent(signature)}`
}

// ─── Helper: Resolve companyId & professionalId from JWT ───
function resolveIds(req: any) {
  let professionalId: number | undefined
  let companyId: number | undefined

  if (req.user?.type === 'profissional') {
    professionalId = req.user.id
    companyId = req.user.companyId
  } else if (req.user?.type === 'usuario') {
    companyId = req.user.companyId
  }

  return { professionalId, companyId }
}

// ─── Stream de Mídias de Campanhas (Público, para a Evolution API obter as mídias salvas em Base64) ───
router.get('/media/:campaignId/:index', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId)
    const indexStr = req.params.index

    if (!hasValidCampaignMediaSignature(campaignId, indexStr, req.query.signature)) {
      return res.status(401).send('Assinatura de midia invalida')
    }

    const campaign = await prisma.messageCampaign.findUnique({
      where: { id: campaignId },
      select: { mediaUrl: true }
    })

    if (!campaign || !campaign.mediaUrl) {
      return res.status(404).send('Mídia não encontrada')
    }

    let targetUrl = ''
    if (indexStr === 'single') {
      targetUrl = campaign.mediaUrl
    } else {
      const parsed = JSON.parse(campaign.mediaUrl)
      const index = parseInt(indexStr)
      if (Array.isArray(parsed) && parsed[index]) {
        targetUrl = parsed[index].url
      }
    }

    if (!targetUrl || !targetUrl.startsWith('data:')) {
      return res.status(404).send('Formato de mídia inválido ou não encontrado')
    }

    // Parse do Data URL base64
    const match = targetUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return res.status(400).send('Dados de mídia corrompidos')
    }

    const mimeType = match[1]
    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cacheable por 1 ano
    res.send(buffer)
  } catch (error: any) {
    console.error('[campaigns-media-stream] error:', error)
    res.status(500).send('Erro ao processar mídia')
  }
})

// ─── Listar campanhas ───
router.use(auth(), requireModule('campanhas'))
router.use(auth(), actionPermissions('campanhas'))

router.get('/', auth(), async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query)
    const { companyId } = resolveIds(req)

    if (!companyId) {
      return res.json(createSuccessResponse([], { page, pageSize, total: 0 }))
    }

    const where: any = { companyId }

    const [campaigns, total] = await Promise.all([
      prisma.messageCampaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          professional: { select: { name: true } },
          _count: { select: { recipients: true } }
        }
      }),
      prisma.messageCampaign.count({ where })
    ])

    res.json(createSuccessResponse(campaigns, { page, pageSize, total }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Obter campanha por ID com destinatários ───
router.get('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { companyId } = resolveIds(req)

    const campaign = await prisma.messageCampaign.findFirst({
      where: { id, companyId: companyId || undefined },
      include: {
        professional: { select: { name: true } },
        recipients: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!campaign) {
      return res.status(404).json(createErrorResponse('Campanha não encontrada'))
    }

    res.json(createSuccessResponse(campaign))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Criar campanha (rascunho) ───
router.post('/', auth(), async (req, res) => {
  try {
    const { professionalId, companyId } = resolveIds(req)
    const {
      name,
      message,
      audienceType,
      audienceFilter,
      mediaUrl,
      mediaType,
      minDelay,
      maxDelay,
      randomize,
      variations,
      templateId,
      provider: requestedProvider,
      connectionMode: requestedConnectionMode,
      templateParameterMappings,
    } = req.body

    if (!name || !audienceType) {
      return res.status(400).json(createErrorResponse('Nome e tipo de audiencia sao obrigatorios'))
    }

    // Buscar professionalId para usuários
    let profId = professionalId
    if (!profId && companyId) {
      const empresa = await prisma.empresa.findUnique({
        where: { id: companyId },
        select: { ownerId: true }
      })
      profId = empresa?.ownerId || undefined
    }

    if (!profId || !companyId) {
      return res.status(400).json(createErrorResponse('Não foi possível identificar o profissional ou empresa'))
    }

    const company = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: {
        whatsappProvider: true,
        evolutionApiUrl: true,
        apiKey: true,
        evolutionInstance: true,
        uazapiToken: true,
        metaToken: true,
        metaPhoneNumberId: true,
        whatsappConnection: { select: { officialMode: true } },
      },
    })
    if (!company) {
      return res.status(404).json(createErrorResponse('Clinica nao encontrada'))
    }

    const provider = normalizeCampaignProvider(requestedProvider || company.whatsappProvider)
    if (!provider) {
      return res.status(400).json(createErrorResponse('Escolha um canal de WhatsApp para a campanha'))
    }

    let selectedTemplate: Awaited<ReturnType<typeof getApprovedWhatsAppTemplate>> | null = null
    if (templateId) {
      try {
        selectedTemplate = await getApprovedWhatsAppTemplate(companyId, Number(templateId), true)
      } catch (error: any) {
        return res.status(400).json(createErrorResponse(error.message, 400))
      }
    }
    if (templateId && (!selectedTemplate || selectedTemplate.status.toUpperCase() !== 'APPROVED')) {
      return res.status(400).json(createErrorResponse('Selecione um template aprovado desta clinica'))
    }

    if (provider === 'meta' && !selectedTemplate) {
      return res.status(400).json(createErrorResponse('O WhatsApp Oficial exige um template aprovado da Meta'))
    }
    if (provider !== 'meta' && selectedTemplate) {
      return res.status(400).json(createErrorResponse('Templates da Meta so podem ser usados no WhatsApp Oficial'))
    }

    const uazapiUrl = process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL || ''
    const providerConfigured = provider === 'meta'
      ? Boolean(company.metaToken && company.metaPhoneNumberId)
      : provider === 'uazapi'
        ? Boolean(uazapiUrl && company.uazapiToken)
        : Boolean(company.evolutionApiUrl && company.apiKey && company.evolutionInstance)
    if (!providerConfigured) {
      return res.status(400).json(createErrorResponse('O canal escolhido nao esta conectado nesta clinica'))
    }

    const templateDescriptor = selectedTemplate ? getTemplateBodyDescriptor(selectedTemplate) : null
    const templateHeaderMediaType = getTemplateHeaderMediaType(selectedTemplate)
    const mappings = normalizeTemplateMappings(templateParameterMappings)
    if (templateDescriptor) {
      const mappingError = validateTemplateMappings(mappings, templateDescriptor.tokens.length)
      if (mappingError) return res.status(400).json(createErrorResponse(mappingError))
    }
    if (provider === 'meta' && templateHeaderMediaType) {
      if (!mediaUrl) {
        return res.status(400).json(createErrorResponse(
          `O template selecionado exige ${templateHeaderMediaType === 'image' ? 'uma imagem' : 'um video'} no cabecalho`,
        ))
      }
      if (String(mediaType || '').toLowerCase() !== templateHeaderMediaType) {
        return res.status(400).json(createErrorResponse(
          `Envie ${templateHeaderMediaType === 'image' ? 'uma imagem' : 'um video'} compativel com o cabecalho do template`,
        ))
      }
    }

    const campaignMessage = templateDescriptor?.text || String(message || '').trim()
    if (!campaignMessage) {
      return res.status(400).json(createErrorResponse('Escreva a mensagem da campanha'))
    }
    const connectionMode = provider === 'meta'
      ? (requestedConnectionMode === 'coexistence' || company.whatsappConnection?.officialMode === 'coexistence' ? 'coexistence' : 'cloud_api')
      : 'unofficial'

    // Buscar destinatários com base no tipo de audiência
    const audienceResolution = await resolveAudience(audienceType, audienceFilter, profId, companyId)
    const recipients = audienceResolution.recipients

    if (recipients.length === 0) {
      return res.status(400).json(createErrorResponse('Nenhum destinatario valido encontrado para esta campanha'))
    }

    const leadIds = recipients
      .filter(r => r.sourceType === 'lead' && r.sourceId)
      .map(r => Number(r.sourceId))
    const clientIds = recipients
      .filter(r => r.sourceType === 'client' && r.sourceId)
      .map(r => Number(r.sourceId))

    // Buscar próximos agendamentos (futuros) em lote
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { clientId: { in: clientIds } },
          { leadId: { in: leadIds } }
        ],
        startTime: { gte: new Date() },
        status: { in: ['agendado', 'confirmado'] }
      },
      orderBy: { startTime: 'asc' },
      include: {
        professional: { select: { name: true } },
        especialista: { select: { name: true } },
      },
    })

    // Buscar agendamentos concluídos (passados) em lote
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { clientId: { in: clientIds } },
          { leadId: { in: leadIds } }
        ],
        status: 'concluido'
      },
      orderBy: { startTime: 'desc' },
      include: {
        professional: { select: { name: true } },
        especialista: { select: { name: true } },
      },
    })

    // Criar mapas O(1) de busca por cliente/lead
    const upcomingMap = new Map<string, any>()
    for (const appt of upcomingAppointments) {
      const key = appt.clientId ? `client_${appt.clientId}` : `lead_${appt.leadId}`
      if (!upcomingMap.has(key)) {
        upcomingMap.set(key, appt)
      }
    }

    const pastMap = new Map<string, any>()
    for (const appt of pastAppointments) {
      const key = appt.clientId ? `client_${appt.clientId}` : `lead_${appt.leadId}`
      if (!pastMap.has(key)) {
        pastMap.set(key, appt)
      }
    }

    const campaign = await prisma.messageCampaign.create({
      data: {
        companyId,
        professionalId: profId,
        templateId: selectedTemplate?.id || null,
        templateSnapshot: selectedTemplate ? {
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          language: selectedTemplate.language,
          category: selectedTemplate.category,
          components: selectedTemplate.components,
          parameterFormat: templateDescriptor?.parameterFormat,
          parameterTokens: templateDescriptor?.tokens,
          parameterMappings: mappings,
          headerMediaType: templateHeaderMediaType,
        } : undefined,
        providerSnapshot: provider,
        connectionMode,
        name,
        message: campaignMessage,
        audienceType,
        audienceFilter: audienceResolution.audienceFilter || undefined,
        status: 'draft',
        totalRecipients: recipients.length,
        mediaUrl: provider === 'meta' && !templateHeaderMediaType ? null : (mediaUrl || null),
        mediaType: provider === 'meta' && !templateHeaderMediaType ? null : (mediaType || null),
        minDelay: provider === 'meta' ? 0 : (minDelay !== undefined ? Number(minDelay) : 180),
        maxDelay: provider === 'meta' ? 0 : (maxDelay !== undefined ? Number(maxDelay) : 200),
        randomize: provider === 'meta' ? false : (randomize !== undefined ? !!randomize : false),
        variations: provider === 'meta' ? null : (variations || null),
        recipients: {
          create: recipients.map(r => {
            const key = r.sourceType === 'client'
              ? `client_${r.sourceId}`
              : r.sourceType === 'lead'
                ? `lead_${r.sourceId}`
                : `spreadsheet_${r.phone}`
            const upcomingAppt = upcomingMap.get(key)
            const pastAppt = pastMap.get(key)
            const variables = buildRecipientVariables(r, upcomingAppt, pastAppt)
            const resolvedRecipient = { ...r, variables }
            return {
              name: r.name,
              phone: r.phone,
              sourceType: r.sourceType,
              sourceId: r.sourceId ?? null,
              status: 'pending',
              variables,
              renderedMessage: renderMessage(campaignMessage, resolvedRecipient, upcomingAppt, pastAppt)
            }
          })
        }
      },
      include: {
        _count: { select: { recipients: true } }
      }
    })

    res.status(201).json(createSuccessResponse(campaign))
  } catch (error: any) {
    console.error('[campaigns] create error:', error)
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Disparar campanha ───
router.post('/:id/send', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { companyId } = resolveIds(req)

    const campaign = await prisma.messageCampaign.findFirst({
      where: { id, companyId: companyId || undefined },
      include: { recipients: { where: { status: { in: ['pending', 'processing'] } } }, template: true }
    })

    if (!campaign) {
      return res.status(404).json(createErrorResponse('Campanha não encontrada'))
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json(createErrorResponse('Campanha já foi enviada ou está em andamento'))
    }

    // Verificar se a API de WhatsApp está configurada
    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId! },
      select: {
        id: true,
        ownerId: true,
        webhookToken: true,
        whatsappProvider: true,
        evolutionMode: true,
        apiKey: true,
        evolutionApiUrl: true,
        evolutionInstance: true,
        uazapiToken: true,
        metaToken: true,
        metaPhoneNumberId: true,
      }
    })

    const provider = normalizeCampaignProvider(campaign.providerSnapshot || empresa?.whatsappProvider) || 'evolution'
    const isEvolutionConfigured = provider === 'evolution' && Boolean(
      empresa?.evolutionApiUrl && empresa?.apiKey && empresa?.evolutionInstance
    )
    const isMetaConfigured = provider === 'meta' && empresa?.metaToken && empresa?.metaPhoneNumberId
    const uazapiUrl = process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL || ''
    const isUazapiConfigured = provider === 'uazapi' && Boolean(uazapiUrl && empresa?.uazapiToken)

    if (!isEvolutionConfigured && !isMetaConfigured && !isUazapiConfigured) {
      return res.status(400).json(createErrorResponse(
        'WhatsApp API não configurada. Vá em Configurações → Integração WhatsApp para configurar.'
      ))
    }

    if (provider === 'meta' && campaign.templateId) {
      try {
        campaign.template = await getApprovedWhatsAppTemplate(companyId!, campaign.templateId, true)
      } catch (error: any) {
        return res.status(400).json(createErrorResponse(error.message, 400))
      }
    }

    // Atualizar status para "sending"
    await prisma.messageCampaign.update({
      where: { id },
      data: { status: 'sending', startedAt: new Date() }
    })

    let absoluteMediaUrl = campaign.mediaUrl
    if (absoluteMediaUrl) {
      try {
        const parsed = JSON.parse(absoluteMediaUrl)
        if (Array.isArray(parsed)) {
          const mapped = parsed.map((item: any, idx: number) => {
            if (item.url) {
              if (item.url.startsWith('data:')) {
                return {
                  ...item,
                  url: `${getPublicAppUrlFromRequest(req)}${getCampaignMediaPath(id, String(idx))}`
                }
              } else if (item.url.startsWith('/uploads/')) {
                return {
                  ...item,
                  url: toPublicMediaUrl(item.url, req)
                }
              }
            }
            return item
          })
          absoluteMediaUrl = JSON.stringify(mapped)
        } else if (absoluteMediaUrl.startsWith('data:')) {
          absoluteMediaUrl = `${getPublicAppUrlFromRequest(req)}${getCampaignMediaPath(id, 'single')}`
        } else if (absoluteMediaUrl.startsWith('/uploads/')) {
          absoluteMediaUrl = toPublicMediaUrl(absoluteMediaUrl, req)
        }
      } catch {
        if (absoluteMediaUrl.startsWith('data:')) {
          absoluteMediaUrl = `${getPublicAppUrlFromRequest(req)}${getCampaignMediaPath(id, 'single')}`
        } else if (absoluteMediaUrl.startsWith('/uploads/')) {
          absoluteMediaUrl = toPublicMediaUrl(absoluteMediaUrl, req)
        }
      }
    }

    if (absoluteMediaUrl) {
      console.info('[campaigns] media url preparada para envio', {
        campaignId: id,
        provider,
        mediaType: campaign.mediaType,
        mediaUrl: absoluteMediaUrl.slice(0, 240),
      })
    }

    // Processar envios em background
    processCampaignSend(id, campaign.recipients, {
      companyId: empresa!.id,
      ownerId: empresa!.ownerId,
      provider,
      evolutionUrl: empresa!.evolutionApiUrl!,
      evolutionKey: empresa!.apiKey!,
      evolutionInstance: empresa!.evolutionInstance!,
      uazapiUrl,
      uazapiToken: empresa!.uazapiToken!,
      metaToken: empresa!.metaToken!,
      metaPhoneId: empresa!.metaPhoneNumberId!,
      metaTemplate: getMetaTemplateFromCampaign(campaign, absoluteMediaUrl),
      mediaUrl: absoluteMediaUrl,
      mediaType: campaign.mediaType,
      minDelay: campaign.minDelay,
      maxDelay: campaign.maxDelay,
      randomize: campaign.randomize,
      variations: campaign.variations ? (campaign.variations as string[]) : undefined
    }).catch(err => {
      console.error('[campaigns] background send error:', err)
    })

    res.json(createSuccessResponse({ message: 'Campanha iniciada', campaignId: id }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Atualizar campanha (apenas rascunhos) ───
router.put('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { companyId } = resolveIds(req)
    const { name, message, mediaUrl, mediaType, minDelay, maxDelay, randomize, variations } = req.body

    const existing = await prisma.messageCampaign.findFirst({
      where: { id, companyId: companyId || undefined }
    })

    if (!existing) {
      return res.status(404).json(createErrorResponse('Campanha não encontrada'))
    }

    if (existing.status !== 'draft') {
      return res.status(400).json(createErrorResponse('Apenas rascunhos podem ser editados'))
    }

    const campaign = await prisma.messageCampaign.update({
      where: { id },
      data: { 
        name, 
        message,
        mediaUrl: mediaUrl !== undefined ? mediaUrl : undefined,
        mediaType: mediaType !== undefined ? mediaType : undefined,
        minDelay: minDelay ? Number(minDelay) : undefined,
        maxDelay: maxDelay ? Number(maxDelay) : undefined,
        randomize: randomize !== undefined ? !!randomize : undefined,
        variations: variations !== undefined ? variations : undefined
      }
    })

    res.json(createSuccessResponse(campaign))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Deletar campanha ───
router.delete('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { companyId } = resolveIds(req)

    const existing = await prisma.messageCampaign.findFirst({
      where: { id, companyId: companyId || undefined }
    })

    if (!existing) {
      return res.status(404).json(createErrorResponse('Campanha não encontrada'))
    }

    // Deletar destinatários primeiro para evitar erro de chave estrangeira
    await prisma.campaignRecipient.deleteMany({
      where: { campaignId: id }
    })

    await prisma.messageCampaign.delete({ where: { id } })
    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ─── Obter status de progresso da campanha ───
router.get('/:id/progress', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { companyId } = resolveIds(req)

    const campaign = await prisma.messageCampaign.findFirst({
      where: { id, companyId: companyId || -1 },
      select: {
        id: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        startedAt: true,
        completedAt: true,
      }
    })

    if (!campaign) {
      return res.status(404).json(createErrorResponse('Campanha não encontrada'))
    }

    res.json(createSuccessResponse(campaign))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message))
  }
})

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

interface RecipientData {
  name: string
  phone: string
  sourceType: 'lead' | 'client' | 'spreadsheet'
  sourceId?: number | null
  variables?: Record<string, string>
}

interface AudienceResolution {
  recipients: RecipientData[]
  audienceFilter?: any
}

function normalizeBrazilianWhatsAppPhone(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '')
  if (/^55\d{10,11}$/.test(digits)) return digits
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`
  return null
}

function normalizeSpreadsheetContacts(audienceFilter: any): {
  recipients: RecipientData[]
  metadata: Record<string, any>
} {
  const rawContacts = Array.isArray(audienceFilter?.contacts) ? audienceFilter.contacts : []
  const contacts = rawContacts.slice(0, SPREADSHEET_CONTACT_LIMIT)
  const phones = new Set<string>()
  const recipients: RecipientData[] = []
  let duplicateRows = 0
  let invalidRows = 0

  for (const contact of contacts) {
    const phone = normalizeBrazilianWhatsAppPhone(contact?.phone || contact?.telefone || contact?.whatsapp || contact?.celular)
    const name = String(contact?.name || contact?.nome || contact?.cliente || contact?.contato || '').trim() || 'Contato'
    const date = String(contact?.date || contact?.data || contact?.dia || contact?.dataAgendamento || contact?.data_consulta || '').trim()
    const time = String(contact?.time || contact?.hora || contact?.horario || contact?.horaAgendamento || contact?.hora_consulta || '').trim()
    const specialist = String(contact?.specialist || contact?.especialista || contact?.profissional || contact?.dr || contact?.dra || contact?.medico || '').trim()

    if (!phone) {
      invalidRows++
      continue
    }

    if (phones.has(phone)) {
      duplicateRows++
      continue
    }

    phones.add(phone)
    recipients.push({
      name,
      phone,
      sourceType: 'spreadsheet',
      sourceId: null,
      variables: {
        data: date,
        hora: time,
        especialista: specialist,
        dr: specialist,
      },
    })
  }

  const clientStats = audienceFilter?.stats || {}
  const totalImported = Number(clientStats.totalImported || rawContacts.length || contacts.length)
  const clientInvalidRows = Number(clientStats.invalidRows)
  const clientDuplicateRows = Number(clientStats.duplicateRows)

  return {
    recipients,
    metadata: {
      source: audienceFilter?.source || audienceFilter?.fileName || null,
      ...(audienceFilter?.metaTemplate ? { metaTemplate: audienceFilter.metaTemplate } : {}),
      totalImported: Number.isFinite(totalImported) ? totalImported : rawContacts.length,
      totalReceived: rawContacts.length,
      totalProcessed: contacts.length,
      totalValid: recipients.length,
      duplicateRows: Number.isFinite(clientDuplicateRows) ? Math.max(clientDuplicateRows, duplicateRows) : duplicateRows,
      invalidRows: Number.isFinite(clientInvalidRows) ? Math.max(clientInvalidRows, invalidRows) : invalidRows,
      limit: SPREADSHEET_CONTACT_LIMIT,
      truncated: rawContacts.length > SPREADSHEET_CONTACT_LIMIT || Boolean(clientStats.truncated),
    },
  }
}

// Resolve audiência: busca leads/clientes com base nos filtros
async function resolveAudience(
  audienceType: string,
  audienceFilter: any,
  professionalId: number,
  companyId: number
): Promise<AudienceResolution> {
  const recipients: RecipientData[] = []
  const phones = new Set<string>() // Evita duplicatas

  if (audienceType === 'spreadsheet' && Array.isArray(audienceFilter?.contacts)) {
    const spreadsheetAudience = normalizeSpreadsheetContacts(audienceFilter)
    return {
      recipients: spreadsheetAudience.recipients,
      audienceFilter: spreadsheetAudience.metadata,
    }
  }

  if (audienceType === 'by_tags' && audienceFilter?.tags?.length) {
    const target = audienceFilter.target || 'both'
    const selectedTags = audienceFilter.tags

    if (target === 'leads' || target === 'both') {
      const leads = await prisma.lead.findMany({
        where: {
          professionalId,
          companyId,
          tags: {
            hasSome: selectedTags
          }
        },
        select: { id: true, name: true, phone: true }
      })

      for (const l of leads) {
        if (l.phone && !phones.has(l.phone)) {
          phones.add(l.phone)
          recipients.push({ name: l.name, phone: l.phone, sourceType: 'lead', sourceId: l.id })
        }
      }
    }

    if (target === 'clients' || target === 'both') {
      const clients = await prisma.client.findMany({
        where: {
          professionalId,
          companyId,
          tags: {
            hasSome: selectedTags
          }
        },
        select: { id: true, name: true, phone: true }
      })

      for (const c of clients) {
        if (c.phone && !phones.has(c.phone)) {
          phones.add(c.phone)
          recipients.push({ name: c.name, phone: c.phone, sourceType: 'client', sourceId: c.id })
        }
      }
    }
  }

  if (audienceType === 'all_leads' || audienceType === 'leads_by_status') {
    const where: any = { professionalId, companyId }
    if (audienceType === 'leads_by_status' && audienceFilter?.statuses?.length) {
      where.status = { in: audienceFilter.statuses }
    }

    const leads = await prisma.lead.findMany({
      where,
      select: { id: true, name: true, phone: true }
    })

    for (const l of leads) {
      if (l.phone && !phones.has(l.phone)) {
        phones.add(l.phone)
        recipients.push({ name: l.name, phone: l.phone, sourceType: 'lead', sourceId: l.id })
      }
    }
  }

  if (audienceType === 'all_clients') {
    const clients = await prisma.client.findMany({
      where: { professionalId, companyId },
      select: { id: true, name: true, phone: true }
    })

    for (const c of clients) {
      if (c.phone && !phones.has(c.phone)) {
        phones.add(c.phone)
        recipients.push({ name: c.name, phone: c.phone, sourceType: 'client', sourceId: c.id })
      }
    }
  }

  if (audienceType === 'both') {
    const [leads, clients] = await Promise.all([
      prisma.lead.findMany({
        where: { professionalId, companyId },
        select: { id: true, name: true, phone: true }
      }),
      prisma.client.findMany({
        where: { professionalId, companyId },
        select: { id: true, name: true, phone: true }
      })
    ])

    for (const l of leads) {
      if (l.phone && !phones.has(l.phone)) {
        phones.add(l.phone)
        recipients.push({ name: l.name, phone: l.phone, sourceType: 'lead', sourceId: l.id })
      }
    }
    for (const c of clients) {
      if (c.phone && !phones.has(c.phone)) {
        phones.add(c.phone)
        recipients.push({ name: c.name, phone: c.phone, sourceType: 'client', sourceId: c.id })
      }
    }
  }

  if (audienceType === 'manual' && audienceFilter?.recipientIds?.length) {
    const { type, recipientIds } = audienceFilter
    if (type === 'leads') {
      const leads = await prisma.lead.findMany({
        where: { id: { in: recipientIds.map(Number) }, professionalId },
        select: { id: true, name: true, phone: true }
      })
      for (const l of leads) {
        if (l.phone && !phones.has(l.phone)) {
          phones.add(l.phone)
          recipients.push({ name: l.name, phone: l.phone, sourceType: 'lead', sourceId: l.id })
        }
      }
    } else {
      const clients = await prisma.client.findMany({
        where: { id: { in: recipientIds.map(Number) }, professionalId },
        select: { id: true, name: true, phone: true }
      })
      for (const c of clients) {
        if (c.phone && !phones.has(c.phone)) {
          phones.add(c.phone)
          recipients.push({ name: c.name, phone: c.phone, sourceType: 'client', sourceId: c.id })
        }
      }
    }
  }

  return {
    recipients,
    audienceFilter: audienceFilter || undefined,
  }
}

function buildRecipientVariables(recipient: RecipientData, upcomingAppt?: any, pastAppt?: any) {
  const existing = recipient.variables && typeof recipient.variables === 'object' ? recipient.variables : {}
  const upcomingProfessional = upcomingAppt?.especialista?.name || upcomingAppt?.professional?.name || ''
  const pastProfessional = pastAppt?.especialista?.name || pastAppt?.professional?.name || ''

  return {
    ...existing,
    nome: recipient.name,
    primeiro_nome: recipient.name.split(' ')[0] || recipient.name,
    telefone: recipient.phone,
    proxima_data: upcomingAppt ? formatDate(upcomingAppt.startTime) : '',
    proxima_hora: upcomingAppt ? formatTime(upcomingAppt.startTime) : '',
    ultima_data: pastAppt ? formatDate(pastAppt.startTime) : '',
    ultima_hora: pastAppt ? formatTime(pastAppt.startTime) : '',
    especialista: String(existing.especialista || existing.dr || upcomingProfessional || pastProfessional || ''),
    profissional: String(existing.especialista || existing.dr || upcomingProfessional || pastProfessional || ''),
  }
}

// Renderiza mensagem substituindo variáveis
function renderMessage(
  template: string, 
  recipient: any, 
  upcomingAppt?: any, 
  pastAppt?: any
): string {
  const variables = (recipient.variables && typeof recipient.variables === 'object') ? recipient.variables : {}
  const spreadsheetDate = String(variables.data || variables.date || '')
  const spreadsheetTime = String(variables.hora || variables.time || '')
  const spreadsheetSpecialist = String(variables.especialista || variables.profissional || variables.specialist || variables.dr || '')

  let msg = template
    .replace(/\{\{nome\}\}/gi, recipient.name)
    .replace(/\{\{telefone\}\}/gi, recipient.phone)
    .replace(/\{\{primeiro_nome\}\}/gi, recipient.name.split(' ')[0])
    .replace(/\{\{data\}\}/gi, spreadsheetDate)
    .replace(/\{\{hora\}\}/gi, spreadsheetTime)
    .replace(/\{\{especialista\}\}/gi, spreadsheetSpecialist)
    .replace(/\{\{dr\}\}/gi, spreadsheetSpecialist)

  // Substituição para o próximo agendamento (futuro)
  const upcomingDate = upcomingAppt ? formatDate(upcomingAppt.startTime) : String(variables.proxima_data || '')
  const upcomingTime = upcomingAppt ? formatTime(upcomingAppt.startTime) : String(variables.proxima_hora || '')
  if (upcomingDate || upcomingTime) {
    msg = msg
      .replace(/\{\{data_agendamento\}\}/gi, upcomingDate)
      .replace(/\{\{hora_agendamento\}\}/gi, upcomingTime)
      .replace(/\{\{proxima_data\}\}/gi, upcomingDate)
      .replace(/\{\{proxima_hora\}\}/gi, upcomingTime)
  } else {
    msg = msg
      .replace(/\{\{data_agendamento\}\}/gi, '')
      .replace(/\{\{hora_agendamento\}\}/gi, '')
      .replace(/\{\{proxima_data\}\}/gi, '')
      .replace(/\{\{proxima_hora\}\}/gi, '')
  }

  // Substituição para o último agendamento (passado concluído)
  const pastDate = pastAppt ? formatDate(pastAppt.startTime) : String(variables.ultima_data || '')
  const pastTime = pastAppt ? formatTime(pastAppt.startTime) : String(variables.ultima_hora || '')
  if (pastDate || pastTime) {
    msg = msg
      .replace(/\{\{ultima_data\}\}/gi, pastDate)
      .replace(/\{\{ultima_hora\}\}/gi, pastTime)
      .replace(/\{\{data_ultima_consulta\}\}/gi, pastDate)
      .replace(/\{\{hora_ultima_consulta\}\}/gi, pastTime)
  } else {
    msg = msg
      .replace(/\{\{ultima_data\}\}/gi, '')
      .replace(/\{\{ultima_hora\}\}/gi, '')
      .replace(/\{\{data_ultima_consulta\}\}/gi, '')
      .replace(/\{\{hora_ultima_consulta\}\}/gi, '')
  }

  return msg
}

function formatDate(date: any): string {
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return ''
  }
}

function formatTime(date: any): string {
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return ''
  }
}

// Configuração agrupada
interface WhatsAppConfig {
  companyId: number
  ownerId: number | null
  provider: string
  evolutionUrl: string
  evolutionKey: string
  evolutionInstance: string
  uazapiUrl: string
  uazapiToken: string
  metaToken: string
  metaPhoneId: string
  metaTemplate?: {
    enabled: boolean
    name: string
    languageCode: string
    parameters: string[]
    parameterNames?: string[]
    parameterFormat?: 'POSITIONAL' | 'NAMED'
    headerMediaType?: 'image' | 'video'
    headerMediaUrl?: string
  } | null
  mediaUrl?: string | null
  mediaType?: string | null
  minDelay?: number
  maxDelay?: number
  randomize?: boolean
  variations?: string[]
}

// Formata telefone para o padrão internacional (55XXXXXXXXXXX)
function formatPhoneForWhatsApp(phone: string, provider: string = 'evolution'): string {
  const digits = phone.replace(/\D/g, '')
  if (provider === 'meta') {
    // Meta geralmente aceita o número no formato internacional. Se for BR, adicionar 55.
    return digits.startsWith('55') ? digits : '55' + digits
  }
  
  // Se já tem 13 dígitos (55 + DDD + 9 dígitos), retorna
  if (digits.length === 13 && digits.startsWith('55')) return digits
  // Se tem 11 dígitos (DDD + 9 dígitos), adiciona 55
  if (digits.length === 11) return '55' + digits
  // Se tem 10 dígitos (DDD + 8 dígitos fixo), adiciona 55
  if (digits.length === 10) return '55' + digits
  // Se já começa com 55, retorna
  if (digits.startsWith('55')) return digits
  // Fallback
  return '55' + digits
}

function cleanMediaUrl(url: string): string {
  if (url.startsWith('data:')) {
    const commaIndex = url.indexOf(',')
    if (commaIndex !== -1) {
      return url.substring(commaIndex + 1)
    }
  }
  return url
}

function getMimeType(url: string): string | undefined {
  if (url.startsWith('data:')) {
    const match = url.match(/data:([^;]+);base64/)
    if (match) return match[1]
  }
  return undefined
}

function getEvolutionBaseUrls(rawUrl: string) {
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  const normalized = withProtocol.replace(/\/+$/, '')
  const withoutManager = normalized.replace(/\/manager$/i, '')
  return Array.from(new Set([normalized, withoutManager].filter(Boolean)))
}

function getEvolutionAuthHeaders(apiKey: string) {
  return [
    { 'Content-Type': 'application/json', apikey: apiKey },
    { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    { 'Content-Type': 'application/json', 'x-api-key': apiKey },
  ]
}

function getMetaTemplateFromAudienceFilter(audienceFilter: any): WhatsAppConfig['metaTemplate'] {
  const raw = audienceFilter?.metaTemplate
  if (!raw?.enabled || !raw?.name) return null

  const parameters = Array.isArray(raw.parameters)
    ? raw.parameters.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : String(raw.parameters || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  return {
    enabled: true,
    name: String(raw.name).trim(),
    languageCode: String(raw.languageCode || raw.language || 'pt_BR').trim() || 'pt_BR',
    parameters,
  }
}

function getMetaTemplateFromCampaign(campaign: any, mediaUrl?: string | null): WhatsAppConfig['metaTemplate'] {
  if (!campaign?.template) return getMetaTemplateFromAudienceFilter(campaign?.audienceFilter)

  const snapshot = campaign.templateSnapshot && typeof campaign.templateSnapshot === 'object'
    ? campaign.templateSnapshot as Record<string, unknown>
    : {}
  const fallback = getMetaTemplateFromAudienceFilter(campaign.audienceFilter)
  const parameters = Array.isArray(snapshot.parameterMappings)
    ? snapshot.parameterMappings.map(item => String(item || '').trim()).filter(Boolean)
    : fallback?.parameters || []
  const parameterNames = Array.isArray(snapshot.parameterTokens)
    ? snapshot.parameterTokens.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const snapshotHeaderMediaType = String(snapshot.headerMediaType || '').toLowerCase()
  const headerMediaType = snapshotHeaderMediaType === 'image' || snapshotHeaderMediaType === 'video'
    ? snapshotHeaderMediaType
    : getTemplateHeaderMediaType(campaign.template)

  return {
    enabled: true,
    name: campaign.template.name,
    languageCode: campaign.template.language,
    parameters,
    parameterNames,
    parameterFormat: String(snapshot.parameterFormat || '').toUpperCase() === 'NAMED' ? 'NAMED' : 'POSITIONAL',
    headerMediaType: headerMediaType || undefined,
    headerMediaUrl: headerMediaType && mediaUrl ? mediaUrl : undefined,
  }
}

function formatMetaApiError(status: number, body: any) {
  const error = body?.error || body
  const code = error?.code
  const subcode = error?.error_subcode
  const message = String(error?.message || body?.message || `Meta Cloud API HTTP ${status}`)

  if (code === 131047 || /24\s*h|24h|customer service window|janela/i.test(message)) {
    return 'A Meta bloqueou texto livre fora da janela de 24h. Para iniciar conversa/campanha pela API Oficial, use um template aprovado.'
  }

  if (code === 132001 || (/template/i.test(message) && /not found|inexistente|does not exist/i.test(message))) {
    return 'Template Meta nao encontrado. Confira o nome exato do template e o idioma aprovado no WhatsApp Manager.'
  }

  if (code === 131008 || /parameter/i.test(message)) {
    return 'Parametros do template Meta invalidos ou incompletos. Confira se a quantidade de variaveis bate com o template aprovado.'
  }

  if (code === 190 || status === 401) {
    return 'Token permanente da Meta invalido, expirado ou sem permissao whatsapp_business_messaging.'
  }

  return subcode ? `${message} (Meta code ${code}/${subcode})` : `${message}${code ? ` (Meta code ${code})` : ''}`
}

async function postEvolution(
  config: WhatsAppConfig,
  path: string,
  payload: any
): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  const attempts: string[] = []

  for (const baseUrl of getEvolutionBaseUrls(config.evolutionUrl)) {
    const url = `${baseUrl}${path}`
    for (const headers of getEvolutionAuthHeaders(config.evolutionKey)) {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const text = await response.text().catch(() => '')
      if (response.ok) return { ok: true, status: response.status, text, url }

      const authFailed = response.status === 401 || response.status === 403
      const notFound = response.status === 404
      attempts.push(`${url} HTTP ${response.status}: ${text.slice(0, 180)}`)

      if (!authFailed && !notFound) {
        return { ok: false, status: response.status, text, url }
      }
    }
  }

  return {
    ok: false,
    status: 401,
    text: attempts[attempts.length - 1] || 'Evolution API nao autorizou a requisicao.',
    url: getEvolutionBaseUrls(config.evolutionUrl)[0] || config.evolutionUrl,
  }
}

async function sendEvolutionMessage(config: WhatsAppConfig, formattedPhone: string, message: string) {
  interface MediaAttachment {
    url: string
    type: 'image' | 'video' | 'audio'
  }

  let attachments: MediaAttachment[] = []
  if (config.mediaUrl) {
    try {
      const parsed = JSON.parse(config.mediaUrl)
      if (Array.isArray(parsed)) {
        attachments = parsed.map((item: any) => ({
          url: item.url,
          type: item.type || 'image'
        }))
      } else {
        attachments = [{ url: config.mediaUrl, type: (config.mediaType as any) || 'image' }]
      }
    } catch {
      attachments = [{ url: config.mediaUrl, type: (config.mediaType as any) || 'image' }]
    }
  }

  // CASO 1: Múltiplas mídias
  if (attachments.length > 1) {
    if (message.trim()) {
      const textResponse = await postEvolution(config, `/message/sendText/${config.evolutionInstance}`, {
        number: formattedPhone,
        text: message
      })

      if (!textResponse.ok) {
        const errorData = textResponse.text
        console.error(`[whatsapp-evolution] send text failed in multi-media for ${formattedPhone}:`, errorData)
        return { success: false, error: `HTTP ${textResponse.status}: ${errorData}` }
      }
    }

    for (let i = 0; i < attachments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const att = attachments[i]
      const isAudio = att.type === 'audio'
      const mediaUrlEndpoint = isAudio
        ? `/message/sendWhatsAppAudio/${config.evolutionInstance}`
        : `/message/sendMedia/${config.evolutionInstance}`
      
      const payload: any = isAudio
        ? {
            number: formattedPhone,
            audio: att.url
          }
        : {
            number: formattedPhone,
            mediatype: att.type,
            media: att.url,
            fileName: att.type === 'image' ? 'imagem.png' : 'video.mp4'
          }
      if (!isAudio) {
        const mime = getMimeType(att.url)
        if (mime) {
          payload.mimetype = mime
        }
      }

      const mediaResponse = await postEvolution(config, mediaUrlEndpoint, payload)

      if (!mediaResponse.ok) {
        const errorData = mediaResponse.text
        console.error(`[whatsapp-evolution] send media index ${i} failed for ${formattedPhone}:`, errorData)
        return { success: false, error: `Falha no anexo ${i + 1} (${att.type}): HTTP ${mediaResponse.status}: ${errorData}` }
      }
    }

    return { success: true }
  }

  // CASO 2: Único anexo de mídia (Lógica original preservada)
  if (attachments.length === 1) {
    const single = attachments[0]

    if (single.type === 'image' || single.type === 'video') {
      const mediaUrlEndpoint = `/message/sendMedia/${config.evolutionInstance}`
      const payload: any = {
        number: formattedPhone,
        mediatype: single.type,
        media: single.url,
        caption: message,
        fileName: single.type === 'image' ? 'imagem.png' : 'video.mp4'
      }
      const mime = getMimeType(single.url)
      if (mime) {
        payload.mimetype = mime
      }

      const response = await postEvolution(config, mediaUrlEndpoint, payload)
      if (!response.ok) {
        const responseError = response.text
        console.error(`[whatsapp-evolution] send media failed for ${formattedPhone}:`, responseError)
        return { success: false, error: `HTTP ${response.status}: ${responseError}` }
      }
      return { success: true }
    } else if (single.type === 'audio') {
      const mediaUrlEndpoint = `/message/sendWhatsAppAudio/${config.evolutionInstance}`
      const payload = {
        number: formattedPhone,
        audio: single.url
      }

      const audioResponse = await postEvolution(config, mediaUrlEndpoint, payload)
      
      if (!audioResponse.ok) {
        const errorData = audioResponse.text
        console.error(`[whatsapp-evolution] send audio failed for ${formattedPhone}:`, errorData)
        return { success: false, error: `HTTP ${audioResponse.status}: ${errorData}` }
      }
      
      if (message.trim()) {
        await new Promise(resolve => setTimeout(resolve, 1200))
        const textResponse = await postEvolution(config, `/message/sendText/${config.evolutionInstance}`, {
          number: formattedPhone,
          text: message
        })
        
        if (!textResponse.ok) {
          const errorData = textResponse.text
          console.error(`[whatsapp-evolution] send text after audio failed for ${formattedPhone}:`, errorData)
          return { success: false, error: `HTTP ${textResponse.status}: ${errorData}` }
        }
      }
      return { success: true }
    }
  }

  // CASO 3: Sem mídia (apenas texto)
  const response = await postEvolution(config, `/message/sendText/${config.evolutionInstance}`, {
    number: formattedPhone,
    text: message
  })

  if (!response.ok) {
    const errorData = response.text
    console.error(`[whatsapp-evolution] send failed for ${formattedPhone}:`, errorData)
    return { success: false, error: `HTTP ${response.status}: ${errorData}` }
  }
  return { success: true }
}

async function sendUazapiMessage(config: WhatsAppConfig, formattedPhone: string, message: string) {
  type MediaAttachment = { url: string; type: 'image' | 'video' | 'audio' }
  let attachments: MediaAttachment[] = []

  if (config.mediaUrl) {
    try {
      const parsed = JSON.parse(config.mediaUrl)
      attachments = Array.isArray(parsed)
        ? parsed.map((item: any) => ({ url: item.url, type: item.type || 'image' }))
        : [{ url: config.mediaUrl, type: (config.mediaType as MediaAttachment['type']) || 'image' }]
    } catch {
      attachments = [{ url: config.mediaUrl, type: (config.mediaType as MediaAttachment['type']) || 'image' }]
    }
  }

  const send = async (path: '/send/text' | '/send/media', body: any) => {
    const result = await sendUazapiRequest({
      baseUrl: config.uazapiUrl,
      token: config.uazapiToken,
      path,
      body,
    })
    if (!result.response.ok) {
      const error = result.data?.message || result.data?.error || result.text || `HTTP ${result.response.status}`
      throw new Error(error)
    }
  }

  try {
    if (attachments.length === 0) {
      await send('/send/text', { number: formattedPhone, text: message, linkPreview: false })
      return { success: true }
    }

    if (attachments.length > 1 && message.trim()) {
      await send('/send/text', { number: formattedPhone, text: message, linkPreview: false })
    }

    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index]
      if (index > 0) await new Promise(resolve => setTimeout(resolve, 1200))
      await send('/send/media', {
        number: formattedPhone,
        type: attachment.type,
        file: attachment.url,
        text: attachments.length === 1 ? message : '',
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error(`[whatsapp-uazapi] send failed for ${formattedPhone}:`, error)
    return { success: false, error: String(error.message || 'Falha no envio pelo WhatsApp').replace(/UAZAPI/gi, 'servico de conexao') }
  }
}

function buildMetaTemplatePayload(config: WhatsAppConfig, formattedPhone: string, recipient: any) {
  const template = config.metaTemplate
  if (!template?.enabled || !template.name) return null

  const parameters = template.parameters.map((param, index) => ({
    type: 'text',
    ...(template.parameterFormat === 'NAMED' && template.parameterNames?.[index]
      ? { parameter_name: template.parameterNames[index] }
      : {}),
    text: renderMessage(param, recipient),
  }))

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.languageCode || 'pt_BR' },
    },
  }

  const components: any[] = []
  if (template.headerMediaType && template.headerMediaUrl) {
    components.push({
      type: 'header',
      parameters: [{
        type: template.headerMediaType,
        [template.headerMediaType]: { link: template.headerMediaUrl },
      }],
    })
  }
  if (parameters.length > 0) components.push({ type: 'body', parameters })
  if (components.length > 0) payload.template.components = components

  return payload
}

function renderMetaTemplateMessage(config: WhatsAppConfig, templateText: string, recipient: any) {
  const template = config.metaTemplate
  if (!template?.enabled) return templateText

  const values = template.parameters.map(parameter => renderMessage(parameter, recipient))
  let rendered = templateText.replace(/\{\{\s*(\d+)\s*\}\}/g, (token, position) => {
    return values[Number(position) - 1] ?? token
  })

  if (template.parameterFormat === 'NAMED') {
    template.parameterNames?.forEach((name, index) => {
      if (!name) return
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      rendered = rendered.replace(new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g'), values[index] ?? '')
    })
  }

  return rendered
}

async function sendMetaMessage(config: WhatsAppConfig, formattedPhone: string, message: string, recipient: any) {
  // A Meta Cloud API usa a graph API para envios.
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const url = `https://graph.facebook.com/${graphVersion}/${config.metaPhoneId}/messages`
  const templatePayload = buildMetaTemplatePayload(config, formattedPhone, recipient)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.metaToken}`
    },
    body: JSON.stringify(templatePayload || {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error(`[whatsapp-meta] send failed for ${formattedPhone}:`, errorData)
    return { success: false, error: formatMetaApiError(response.status, errorData) }
  }
  const body = await response.json().catch(() => ({}))
  return { success: true, providerMessageId: body?.messages?.[0]?.id || null }
}

async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  phone: string,
  message: string,
  recipient: any
): Promise<{ success: boolean; error?: string; providerMessageId?: string | null }> {
  const formattedPhone = formatPhoneForWhatsApp(phone, config.provider)

  try {
    if (config.provider === 'meta') {
      return await sendMetaMessage(config, formattedPhone, message, recipient)
    } else if (config.provider === 'uazapi') {
      return await sendUazapiMessage(config, formattedPhone, message)
    } else {
      return await sendEvolutionMessage(config, formattedPhone, message)
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de conexão com API' }
  }
}

export async function processCampaignSend(campaignId: number, recipients: any[], config: WhatsAppConfig) {
  let sentCount = await prisma.campaignRecipient.count({
    where: { campaignId, status: { in: ['sent', 'delivered', 'read'] } },
  })
  let failedCount = await prisma.campaignRecipient.count({ where: { campaignId, status: 'failed' } })

  for (const [recipientIndex, recipient] of recipients.entries()) {
    const claimed = await prisma.campaignRecipient.updateMany({
      where: {
        id: recipient.id,
        status: { in: ['pending', 'processing'] },
        attempts: { lt: 4 },
      },
      data: { status: 'processing', processingAt: new Date(), attempts: { increment: 1 } },
    })
    if (claimed.count === 0) continue

    await prisma.messageCampaign.update({ where: { id: campaignId }, data: { workerHeartbeatAt: new Date() } })
    // Escolhe aleatoriamente uma variação se a randomização estiver ativa
    let messageToSend = recipient.renderedMessage || recipient.name
    if (config.randomize && config.variations && Array.isArray(config.variations) && config.variations.length > 0) {
      const randomIndex = Math.floor(Math.random() * config.variations.length)
      const selectedVariation = config.variations[randomIndex]
      
      // Busca agendamentos apenas quando temos um sourceId válido e explícito,
      // evitando que filtros undefined façam o Prisma retornar agendamentos de outros clientes/leads.
      let upcomingAppt = null
      let pastAppt = null

      if (recipient.sourceId) {
        const apptFilter: any = {
          ...(recipient.sourceType === 'client' && { clientId: recipient.sourceId }),
          ...(recipient.sourceType === 'lead' && { leadId: recipient.sourceId }),
        }

        // Só busca se pelo menos um filtro de identidade foi definido
        if (Object.keys(apptFilter).length > 0) {
          upcomingAppt = await prisma.appointment.findFirst({
            where: {
              ...apptFilter,
              startTime: { gte: new Date() },
              status: { in: ['agendado', 'confirmado'] }
            },
            orderBy: { startTime: 'asc' }
          })

          pastAppt = await prisma.appointment.findFirst({
            where: {
              ...apptFilter,
              status: 'concluido'
            },
            orderBy: { startTime: 'desc' }
          })
        }
      }

      messageToSend = renderMessage(selectedVariation, recipient, upcomingAppt, pastAppt)
    }

    try {
      const result = await sendWhatsAppMessage(config, recipient.phone, messageToSend, recipient)

      if (result.success) {
        const conversationMessage = config.provider === 'meta'
          ? renderMetaTemplateMessage(config, messageToSend, recipient)
          : messageToSend
        try {
          await processOutgoingMessage({
            companyId: config.companyId,
            ownerId: config.ownerId,
            phone: formatPhoneForWhatsApp(recipient.phone, config.provider),
            pushName: recipient.name || 'Contato WhatsApp',
            messageText: conversationMessage,
            rawPayload: {
              campaignId,
              campaignRecipientId: recipient.id,
              templateName: config.metaTemplate?.name || null,
              ...(config.metaTemplate?.headerMediaUrl ? {
                mediaUrl: config.metaTemplate.headerMediaUrl,
                mediaType: config.metaTemplate.headerMediaType,
              } : {}),
            },
            origin: config.provider === 'meta' ? 'Campanha WhatsApp Meta' : 'Campanha WhatsApp',
            providerMessageId: result.providerMessageId || null,
            mediaUrl: config.metaTemplate?.headerMediaUrl || null,
            mediaType: config.metaTemplate?.headerMediaType || null,
            providerMediaType: config.metaTemplate?.headerMediaType || null,
          })
        } catch (persistError) {
          console.error('[campaigns] mensagem enviada, mas nao registrada na conversa:', persistError)
        }

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'sent', sentAt: new Date(), providerMessageId: result.providerMessageId || null, processingAt: null }
        })
        sentCount++
      } else {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', failedAt: new Date(), processingAt: null, errorMessage: result.error || 'Falha no envio' }
        })
        failedCount++
      }
    } catch (err: any) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'failed', failedAt: new Date(), processingAt: null, errorMessage: err.message || 'Erro desconhecido' }
      })
      failedCount++
    }

    // Atualiza progresso
    await prisma.messageCampaign.update({
      where: { id: campaignId },
      data: { sentCount, failedCount }
    })

    // Delay variável para evitar bloqueio do WhatsApp
    const minD = config.minDelay ?? 180
    const maxD = config.maxDelay ?? 200
    const delaySeconds = minD === maxD ? minD : Math.floor(Math.random() * (maxD - minD + 1)) + minD
    if (recipientIndex === recipients.length - 1) continue
    
    let remainingDelay = delaySeconds * 1000
    while (remainingDelay > 0) {
      const slice = Math.min(remainingDelay, 30_000)
      await new Promise(resolve => setTimeout(resolve, slice))
      remainingDelay -= slice
      if (remainingDelay > 0) {
        await prisma.messageCampaign.update({ where: { id: campaignId }, data: { workerHeartbeatAt: new Date() } })
      }
    }
  }

  // Finaliza a campanha
  await prisma.messageCampaign.update({
    where: { id: campaignId },
    data: {
      status: sentCount > 0 ? 'completed' : 'failed',
      completedAt: new Date(),
      sentCount,
      failedCount
    }
  })

}

export async function resumeInterruptedCampaigns() {
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000)
  const campaigns = await prisma.messageCampaign.findMany({
    where: {
      status: 'sending',
      OR: [{ workerHeartbeatAt: null }, { workerHeartbeatAt: { lt: staleBefore } }],
    },
    include: {
      recipients: { where: { status: { in: ['pending', 'processing'] }, attempts: { lt: 4 } } },
      template: true,
      company: {
        select: {
          id: true,
          ownerId: true,
          whatsappProvider: true,
          evolutionApiUrl: true,
          apiKey: true,
          evolutionInstance: true,
          uazapiToken: true,
          metaToken: true,
          metaPhoneNumberId: true,
        },
      },
    },
    take: 5,
  })

  for (const campaign of campaigns) {
    const claimed = await prisma.messageCampaign.updateMany({
      where: {
        id: campaign.id,
        status: 'sending',
        OR: [{ workerHeartbeatAt: null }, { workerHeartbeatAt: { lt: staleBefore } }],
      },
      data: { workerHeartbeatAt: new Date() },
    })
    if (claimed.count === 0) continue

    await prisma.campaignRecipient.updateMany({
      where: { campaignId: campaign.id, status: 'processing', processingAt: { lt: staleBefore } },
      data: { status: 'pending', processingAt: null },
    })
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, status: 'pending', attempts: { lt: 4 } },
    })
    const provider = normalizeCampaignProvider(campaign.providerSnapshot || campaign.company.whatsappProvider) || 'evolution'
    const mediaUrl = normalizeMediaUrlPayload(campaign.mediaUrl)

    void processCampaignSend(campaign.id, recipients, {
      companyId: campaign.company.id,
      ownerId: campaign.company.ownerId,
      provider,
      evolutionUrl: campaign.company.evolutionApiUrl || '',
      evolutionKey: campaign.company.apiKey || '',
      evolutionInstance: campaign.company.evolutionInstance || '',
      uazapiUrl: process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL || '',
      uazapiToken: campaign.company.uazapiToken || '',
      metaToken: campaign.company.metaToken || '',
      metaPhoneId: campaign.company.metaPhoneNumberId || '',
      metaTemplate: getMetaTemplateFromCampaign(campaign, mediaUrl),
      mediaUrl,
      mediaType: campaign.mediaType,
      minDelay: campaign.minDelay,
      maxDelay: campaign.maxDelay,
      randomize: campaign.randomize,
      variations: Array.isArray(campaign.variations) ? campaign.variations as string[] : undefined,
    }).catch((error) => console.error('[campaigns] resume failed:', error))
  }
}
import { actionPermissions } from '../middleware/action-permissions.js'
