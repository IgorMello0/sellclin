import { prisma } from '../prisma.js'
import { getWhatsAppConnection } from './whatsapp-connections.js'
import { getApprovedWhatsAppTemplate } from './whatsapp-templates.js'

const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || 'v19.0').replace(/^v?/, 'v')
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`

function normalizePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function renderParameter(value: string, variables: Record<string, unknown>) {
  return String(value || '').replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, key) => {
    const normalizedKey = String(key).trim()
    return String(variables[normalizedKey] ?? variables[normalizedKey.toLowerCase()] ?? '')
  })
}

async function getMetaCredentials(companyId: number) {
  const [connection, company] = await Promise.all([
    getWhatsAppConnection(companyId),
    prisma.empresa.findUnique({
      where: { id: companyId },
      select: { metaToken: true, metaPhoneNumberId: true, whatsappProvider: true },
    }),
  ])

  if (!company || company.whatsappProvider !== 'meta') {
    throw new Error('WhatsApp Oficial nao conectado nesta clinica.')
  }

  const accessToken = connection?.provider === 'meta' ? connection.accessToken : company.metaToken
  const phoneNumberId = connection?.provider === 'meta' ? connection.phoneNumberId : company.metaPhoneNumberId
  if (!accessToken || !phoneNumberId) throw new Error('Credenciais do WhatsApp Oficial incompletas.')

  return { accessToken, phoneNumberId, officialMode: connection?.officialMode || 'cloud_api' }
}

function buildTemplateComponents(
  templateComponents: unknown,
  parameterValues: string[],
  variables: Record<string, unknown>,
  headerMediaUrl?: string,
) {
  const source = Array.isArray(templateComponents) ? templateComponents as any[] : []
  const components: any[] = []
  let parameterIndex = 0

  for (const component of source) {
    const type = String(component?.type || '').toUpperCase()
    if (type === 'BODY') {
      const matches = String(component?.text || '').match(/\{\{[^}]+\}\}/g) || []
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map((placeholder: string) => {
            const parameterName = placeholder.replace(/[{}]/g, '').trim()
            return {
              type: 'text',
              text: renderParameter(parameterValues[parameterIndex++] || '', variables),
              ...(!/^\d+$/.test(parameterName) ? { parameter_name: parameterName } : {}),
            }
          }),
        })
      }
    }

    if (type === 'HEADER' && headerMediaUrl) {
      const format = String(component?.format || '').toLowerCase()
      if (['image', 'video', 'document'].includes(format)) {
        components.push({ type: 'header', parameters: [{ type: format, [format]: { link: headerMediaUrl } }] })
      }
    }
  }

  return components
}

export async function sendMetaTemplateMessage(input: {
  companyId: number
  phone: string
  templateId: number
  parameterValues?: string[]
  variables?: Record<string, unknown>
  headerMediaUrl?: string
}) {
  const [template, credentials] = await Promise.all([
    getApprovedWhatsAppTemplate(input.companyId, input.templateId),
    getMetaCredentials(input.companyId),
  ])
  const phone = normalizePhone(input.phone)
  if (!phone) throw new Error('Telefone invalido para envio.')

  const components = buildTemplateComponents(
    template.components,
    input.parameterValues || [],
    input.variables || {},
    input.headerMediaUrl,
  )
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      ...(components.length ? { components } : {}),
    },
  }

  const response = await fetch(`${GRAPH_BASE_URL}/${credentials.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || `Meta Graph API HTTP ${response.status}`)

  return {
    providerMessageId: body?.messages?.[0]?.id || null,
    template,
    payload,
    officialMode: credentials.officialMode,
  }
}

const STATUS_ORDER: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

export async function updateWhatsAppMessageStatus(input: {
  providerMessageId: string
  status: string
  errorCode?: string | null
  errorMessage?: string | null
  occurredAt?: Date
}) {
  const status = String(input.status || '').toLowerCase()
  if (!input.providerMessageId || !(status in STATUS_ORDER)) return
  const occurredAt = input.occurredAt || new Date()

  const message = await prisma.mensagem.findFirst({ where: { providerMessageId: input.providerMessageId } })
  if (message) {
    const current = String(message.deliveryStatus || 'pending').toLowerCase()
    if (status === 'failed' || STATUS_ORDER[status] >= (STATUS_ORDER[current] ?? 0)) {
      await prisma.mensagem.update({
        where: { id: message.id },
        data: {
          deliveryStatus: status,
          ...(status === 'sent' ? { sentAt: occurredAt } : {}),
          ...(status === 'delivered' ? { deliveredAt: occurredAt } : {}),
          ...(status === 'read' ? { readAt: occurredAt } : {}),
          ...(status === 'failed' ? {
            failedAt: occurredAt,
            errorCode: input.errorCode || null,
            errorMessage: input.errorMessage || null,
          } : {}),
        },
      })
    }
  }

  const recipient = await prisma.campaignRecipient.findFirst({ where: { providerMessageId: input.providerMessageId } })
  if (recipient) {
    const current = String(recipient.status).toLowerCase()
    if (status === 'failed' || STATUS_ORDER[status] >= (STATUS_ORDER[current] ?? 0)) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: status as any,
          ...(status === 'sent' ? { sentAt: occurredAt } : {}),
          ...(status === 'delivered' ? { deliveredAt: occurredAt } : {}),
          ...(status === 'read' ? { readAt: occurredAt } : {}),
          ...(status === 'failed' ? {
            failedAt: occurredAt,
            errorCode: input.errorCode || null,
            errorMessage: input.errorMessage || null,
          } : {}),
        },
      })

      const [sentCount, failedCount] = await Promise.all([
        prisma.campaignRecipient.count({
          where: { campaignId: recipient.campaignId, status: { in: ['sent', 'delivered', 'read'] } },
        }),
        prisma.campaignRecipient.count({
          where: { campaignId: recipient.campaignId, status: 'failed' },
        }),
      ])
      await prisma.messageCampaign.update({
        where: { id: recipient.campaignId },
        data: { sentCount, failedCount },
      })
    }
  }
}
