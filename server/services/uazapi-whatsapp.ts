import { integrationHttpClient } from './integration-http.js'
import { prisma } from '../prisma.js'

type UazapiCompany = {
  id: number
  name: string
  ownerId: number | null
  webhookToken: string | null
  uazapiInstanceId: string | null
  uazapiInstanceName: string | null
  uazapiToken: string | null
  uazapiConnectionStatus: string | null
}

type UazapiResponse = {
  response: Response
  data: any
  text: string
}

type NormalizedConnection = ReturnType<typeof normalizeConnectionPayload>

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function getPublicAppUrl() {
  return trimTrailingSlash(
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'https://sellclin.com'
  )
}

function getUazapiBaseUrl() {
  const value = process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL
  if (!value) {
    throw new Error('UAZAPI nao configurada na VPS. Defina UAZAPI_API_URL e UAZAPI_ADMIN_TOKEN.')
  }
  return trimTrailingSlash(/^https?:\/\//i.test(value) ? value : `https://${value}`)
}

function getUazapiAdminToken() {
  const value = process.env.UAZAPI_ADMIN_TOKEN
  if (!value) {
    throw new Error('UAZAPI nao configurada na VPS. Defina UAZAPI_API_URL e UAZAPI_ADMIN_TOKEN.')
  }
  return value
}

function isServerConfigured() {
  return Boolean(
    (process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL) &&
    process.env.UAZAPI_ADMIN_TOKEN
  )
}

function buildInstanceName(company: Pick<UazapiCompany, 'id' | 'webhookToken'>) {
  const suffix = String(company.webhookToken || company.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
  return `sellclin-company-${company.id}-${suffix}`
}

export function buildUazapiWebhookUrl(webhookToken?: string | null) {
  return webhookToken ? `${getPublicAppUrl()}/api/webhooks/uazapi/${webhookToken}` : null
}

async function parseResponse(response: Response): Promise<UazapiResponse> {
  const text = await response.text().catch(() => '')
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { response, data, text }
}

async function requestUazapi(params: {
  path: string
  method?: string
  token?: string
  admin?: boolean
  body?: any
  acceptedStatuses?: number[]
}) {
  const baseUrl = getUazapiBaseUrl()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (params.admin) {
    headers.admintoken = getUazapiAdminToken()
  } else if (params.token) {
    headers.token = params.token
  }

  const response = await integrationHttpClient.fetch(`${baseUrl}${params.path}`, {
    method: params.method || 'GET',
    headers,
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  })

  const result = await parseResponse(response)
  if (!response.ok && !params.acceptedStatuses?.includes(response.status)) {
    const message = result.data?.message || result.data?.error || result.text || `HTTP ${response.status}`
    throw new Error(`UAZAPI ${params.path} (HTTP ${response.status}): ${message}`)
  }

  return result.data
}

async function getCompany(companyId: number): Promise<UazapiCompany> {
  const company = await prisma.empresa.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      webhookToken: true,
      uazapiInstanceId: true,
      uazapiInstanceName: true,
      uazapiToken: true,
      uazapiConnectionStatus: true,
    },
  })

  if (!company) throw new Error('Clinica nao encontrada.')
  return company
}

function extractText(value: any, keys: string[]): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return null

  for (const key of keys) {
    const nested = value[key]
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }

  return null
}

function normalizeConnectionPayload(payload: any) {
  const instance = payload?.instance || payload?.data?.instance || payload?.data || {}
  const status = payload?.status || payload?.data?.status || {}
  const state = String(
    instance?.status ||
    payload?.state ||
    (typeof payload?.status === 'string' ? payload.status : '')
  ).toLowerCase()
  const connected = status?.connected === true || payload?.connected === true || state === 'connected'
  const loggedIn = status?.loggedIn === true || payload?.loggedIn === true || connected
  const qrcode =
    extractText(instance?.qrcode, ['base64', 'qrcode', 'qrCode', 'code']) ||
    extractText(instance?.qrCode, ['base64', 'qrcode', 'qrCode', 'code']) ||
    extractText(instance?.base64, ['base64']) ||
    extractText(payload?.qrcode, ['base64', 'qrcode', 'qrCode', 'code']) ||
    extractText(payload?.qrCode, ['base64', 'qrcode', 'qrCode', 'code']) ||
    extractText(payload?.base64, ['base64'])
  const pairingCode =
    extractText(instance?.paircode, ['paircode', 'pairingCode', 'code']) ||
    extractText(instance?.pairingCode, ['paircode', 'pairingCode', 'code']) ||
    extractText(payload?.paircode, ['paircode', 'pairingCode', 'code']) ||
    extractText(payload?.pairingCode, ['paircode', 'pairingCode', 'code'])

  return {
    connected,
    loggedIn,
    status: connected ? 'CONNECTED' : state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED',
    providerStatus: state || (connected ? 'connected' : 'disconnected'),
    qrcode,
    pairingCode,
    profileName: instance?.profileName || null,
    profilePicUrl: instance?.profilePicUrl || null,
    owner: instance?.owner || status?.jid?.user || null,
  }
}

function hasConnectionArtifact(connection: NormalizedConnection) {
  return connection.connected || Boolean(connection.qrcode || connection.pairingCode)
}

async function waitForConnectionArtifact(
  company: UazapiCompany,
  initialPayload: any,
  maxAttempts = 10
) {
  let normalized = normalizeConnectionPayload(initialPayload)
  if (hasConnectionArtifact(normalized)) return normalized

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const statusPayload = await requestUazapi({
      path: '/instance/status',
      token: company.uazapiToken || undefined,
    })
    normalized = normalizeConnectionPayload(statusPayload)
    if (hasConnectionArtifact(normalized)) return normalized
  }

  return normalized
}

async function createInstance(company: UazapiCompany) {
  if (company.uazapiToken && company.uazapiInstanceId) return company

  const instanceName = company.uazapiInstanceName || buildInstanceName(company)
  const data = await requestUazapi({
    path: '/instance/create',
    method: 'POST',
    admin: true,
    body: {
      name: instanceName,
      adminField01: `sellclin-company-${company.id}`,
      adminField02: company.webhookToken || '',
    },
  })

  const token = data?.token || data?.instance?.token
  const instanceId = data?.instance?.id || data?.id
  if (!token || !instanceId) {
    throw new Error('UAZAPI criou a instancia, mas nao retornou token e ID.')
  }

  return prisma.empresa.update({
    where: { id: company.id },
    data: {
      whatsappProvider: 'uazapi',
      uazapiInstanceId: String(instanceId),
      uazapiInstanceName: data?.name || data?.instance?.name || instanceName,
      uazapiToken: String(token),
      uazapiConnectionStatus: 'disconnected',
      uazapiConnectedAt: null,
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      webhookToken: true,
      uazapiInstanceId: true,
      uazapiInstanceName: true,
      uazapiToken: true,
      uazapiConnectionStatus: true,
    },
  })
}

async function setupWebhook(company: UazapiCompany) {
  if (!company.uazapiToken) throw new Error('Instancia UAZAPI ainda nao criada.')
  const url = buildUazapiWebhookUrl(company.webhookToken)
  if (!url) throw new Error('Clinica sem token de webhook.')

  await requestUazapi({
    path: '/webhook',
    method: 'POST',
    token: company.uazapiToken,
    body: {
      enabled: true,
      url,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi', 'fromMeYes', 'isGroupYes'],
      addUrlEvents: false,
      addUrlTypesMessages: false,
    },
  })

  return url
}

export async function getUazapiStatus(companyId: number) {
  const company = await getCompany(companyId)
  const webhookUrl = buildUazapiWebhookUrl(company.webhookToken)

  if (!isServerConfigured()) {
    return {
      serverConfigured: false,
      configured: false,
      status: 'NOT_CONFIGURED',
      webhookUrl,
      message: 'Conexao por QR Code indisponivel.',
    }
  }

  if (!company.uazapiToken || !company.uazapiInstanceId) {
    return {
      serverConfigured: true,
      configured: false,
      status: 'NOT_CONFIGURED',
      webhookUrl,
      message: 'Clique em conectar para criar a instancia desta clinica.',
    }
  }

  try {
    const data = await requestUazapi({ path: '/instance/status', token: company.uazapiToken })
    const normalized = normalizeConnectionPayload(data)
    await prisma.empresa.update({
      where: { id: company.id },
      data: {
        whatsappProvider: 'uazapi',
        uazapiConnectionStatus: normalized.providerStatus,
        ...(normalized.connected ? { uazapiConnectedAt: new Date() } : {}),
      },
    })

    return {
      serverConfigured: true,
      configured: true,
      instanceId: company.uazapiInstanceId,
      instanceName: company.uazapiInstanceName,
      webhookUrl,
      ...normalized,
      message: normalized.connected ? 'WhatsApp conectado.' : 'Conexao criada. Use o QR Code ou codigo de pareamento.',
    }
  } catch (error: any) {
    return {
      serverConfigured: true,
      configured: true,
      instanceId: company.uazapiInstanceId,
      instanceName: company.uazapiInstanceName,
      webhookUrl,
      status: 'ERROR',
      connected: false,
      message: 'Nao foi possivel consultar a conexao do WhatsApp.',
    }
  }
}

export async function connectUazapi(companyId: number, phone?: string) {
  let company = await getCompany(companyId)
  company = await createInstance(company)
  const webhookUrl = await setupWebhook(company)
  const normalizedPhone = String(phone || '').replace(/\D/g, '')

  if (phone && (normalizedPhone.length < 10 || normalizedPhone.length > 15)) {
    throw new Error('Informe o telefone com DDI e DDD para gerar o codigo de pareamento.')
  }

  const data = await requestUazapi({
    path: '/instance/connect',
    method: 'POST',
    token: company.uazapiToken || undefined,
    body: normalizedPhone ? { phone: normalizedPhone, browser: 'auto' } : { browser: 'auto' },
  })
  const normalized = await waitForConnectionArtifact(company, data)

  await prisma.empresa.update({
    where: { id: company.id },
    data: {
      whatsappProvider: 'uazapi',
      uazapiConnectionStatus: normalized.providerStatus,
      ...(normalized.connected ? { uazapiConnectedAt: new Date() } : {}),
    },
  })

  return {
    serverConfigured: true,
    configured: true,
    instanceId: company.uazapiInstanceId,
    instanceName: company.uazapiInstanceName,
    webhookUrl,
    ...normalized,
    message: normalized.connected
      ? 'WhatsApp conectado.'
      : normalized.pairingCode
        ? 'Use o codigo de pareamento no WhatsApp.'
        : normalized.qrcode
          ? 'Escaneie o QR Code com o WhatsApp.'
          : 'A conexao foi iniciada, mas ainda nao retornou QR Code ou codigo.',
  }
}

export async function setupUazapiWebhook(companyId: number) {
  let company = await getCompany(companyId)
  company = await createInstance(company)
  const webhookUrl = await setupWebhook(company)
  return { configured: true, webhookUrl }
}

export async function disconnectUazapi(companyId: number) {
  const company = await getCompany(companyId)
  if (company.uazapiToken) {
    // The provider may reject deletion while a connection attempt is still active.
    // Closing the session first also makes removal reliable for pending QR codes.
    try {
      await requestUazapi({
        path: '/instance/disconnect',
        method: 'POST',
        token: company.uazapiToken,
      })
    } catch (error) {
      console.warn('[WhatsApp Disconnect] Session was already closed or unavailable:', error)
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      await requestUazapi({
        path: '/instance',
        method: 'DELETE',
        token: company.uazapiToken,
        acceptedStatuses: [404, 410],
      })
    } catch (error) {
      // Some provider nodes need a moment to release the session after disconnect.
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await requestUazapi({
        path: '/instance',
        method: 'DELETE',
        token: company.uazapiToken,
        acceptedStatuses: [404, 410],
      })
    }
  }

  await prisma.empresa.update({
    where: { id: companyId },
    data: {
      whatsappProvider: null,
      uazapiInstanceId: null,
      uazapiInstanceName: null,
      uazapiToken: null,
      uazapiConnectionStatus: null,
      uazapiConnectedAt: null,
    },
  })

  return { disconnected: true }
}

export async function sendUazapiRequest(params: {
  baseUrl: string
  token: string
  path: '/send/text' | '/send/media'
  body: any
}) {
  const baseUrl = trimTrailingSlash(/^https?:\/\//i.test(params.baseUrl) ? params.baseUrl : `https://${params.baseUrl}`)
  const response = await integrationHttpClient.fetch(`${baseUrl}${params.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: params.token },
    body: JSON.stringify(params.body),
  })
  return parseResponse(response)
}
