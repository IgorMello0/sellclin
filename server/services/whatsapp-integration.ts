import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../prisma.js'
import { updateWhatsAppMessageStatus } from './whatsapp-messages.js'
import { getWhatsAppConnection } from './whatsapp-connections.js'
import { chooseSdrForCompany } from './sdr-routing.js'

type CompanyRef = {
  id: number
  ownerId: number | null
  name: string
  isActive?: boolean
  webhookToken?: string | null
  evolutionInstance?: string | null
  evolutionMode?: string | null
  evolutionApiUrl?: string | null
  apiKey?: string | null
}

type WhatsAppStatus = {
  status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'ERROR'
  qrcode?: string | null
  pairingCode?: string | null
  qrcodeStatus?: 'ready' | 'empty' | 'error'
  qrcodeEndpoint?: string | null
  qrcodeError?: string | null
  instance?: string | null
  evolutionMode?: 'managed' | 'custom'
  webhookUrl?: string | null
  webhookStatus?: 'configured' | 'error' | 'pending' | 'not_configured'
  webhookEndpoint?: string | null
  webhookError?: string | null
  diagnostics?: EvolutionDiagnostic | null
  message?: string
}

type EvolutionAttemptResult = {
  label: string
  method: string
  url: string
  status?: number
  ok: boolean
  response?: string
  error?: string
}

type EvolutionDiagnostic = {
  configured: boolean
  baseUrl?: string
  testedBaseUrls?: string[]
  instance?: string | null
  apiReachable: boolean
  apiKeyAccepted: boolean
  webhookUrl?: string | null
  webhookStatus: 'configured' | 'error' | 'pending' | 'not_configured'
  webhookEndpoint?: string | null
  message?: string
  attempts: EvolutionAttemptResult[]
}

type EvolutionRuntime = {
  mode: 'managed' | 'custom'
  baseUrl: string
  apiKey: string
  controlApiKey?: string
  instance: string
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function getPublicAppUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'https://sellclin.com'
  ).replace(/\/$/, '')
}

function getCandidateBaseUrls(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl)
  const withoutManager = normalized.replace(/\/manager$/i, '')
  const candidates = withoutManager && withoutManager !== normalized
    ? [withoutManager, normalized]
    : [normalized]
  if (withoutManager && withoutManager !== normalized) candidates.push(withoutManager)
  return Array.from(new Set(candidates))
}

function isHtmlResponse(text: string) {
  const normalized = String(text || '').trim().toLowerCase()
  return normalized.startsWith('<!doctype') || normalized.startsWith('<html') || normalized.includes('<body')
}

function isCustomEvolutionConfigured(company: Pick<CompanyRef, 'evolutionApiUrl' | 'apiKey' | 'evolutionInstance'>) {
  return Boolean(company.evolutionApiUrl && company.apiKey && company.evolutionInstance)
}

function hasManagedEvolutionConfig() {
  return Boolean(process.env.EVOLUTION_CENTRAL_API_URL && process.env.EVOLUTION_CENTRAL_API_KEY)
}

function isUuidLike(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
}

function buildManagedEvolutionInstance(company: Pick<CompanyRef, 'id' | 'webhookToken'>) {
  const token = (company.webhookToken || String(company.id)).replace(/-/g, '').slice(0, 8)
  return `sellclin-company-${company.id}-${token}`
}

function getEvolutionMode(company: Pick<CompanyRef, 'evolutionMode' | 'evolutionApiUrl' | 'apiKey' | 'evolutionInstance'>): 'managed' | 'custom' {
  if (company.evolutionMode === 'managed') return 'managed'
  if (hasManagedEvolutionConfig()) return 'managed'
  if (isCustomEvolutionConfigured(company)) return 'custom'
  return 'custom'
}

function evolutionHeaders(apiKey: string, extraHeaders?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    ...(extraHeaders || {}),
  }
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({}))
}

async function responseSnippet(response: Response) {
  const text = await response.text().catch(() => '')
  return text.slice(0, 220)
}

async function fetchEvolutionJson(
  url: string,
  apiKey: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: any,
  extraHeaders?: Record<string, string>
) {
  const response = await fetch(url, {
    method,
    headers: evolutionHeaders(apiKey, extraHeaders),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text().catch(() => '')
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  return { response, data, text }
}

function isConnectedPayload(payload: any) {
  const state = payload?.instance?.state || payload?.state || payload?.connectionState || payload?.status || payload?.data?.status
  return payload?.data?.connected === true
    || payload?.connected === true
    || String(state || '').toLowerCase() === 'open'
    || String(state || '').toLowerCase() === 'connected'
}

function normalizeQrCode(value: any): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:image/')) return trimmed
  if (trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('PHN2Zy')) return trimmed
  if (trimmed.length > 500 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) return trimmed
  return null
}

function extractQrCode(payload: any): string | null {
  return normalizeQrCode(
    payload?.base64 ||
    payload?.raw ||
    payload?.data?.qrcode ||
    payload?.data?.qrCode ||
    payload?.data?.base64 ||
    payload?.data?.code ||
    payload?.qrcode?.base64 ||
    payload?.qrcode?.code ||
    payload?.qrcode ||
    payload?.qrCode?.base64 ||
    payload?.qrCode?.code ||
    payload?.qrCode ||
    payload?.qr ||
    payload?.code
  )
}

function extractPairingCode(payload: any): string | null {
  const value =
    payload?.pairingCode ||
    payload?.pairing_code ||
    payload?.codePairing ||
    payload?.data?.PairingCode ||
    payload?.data?.pairingCode ||
    payload?.data?.pairing_code ||
    payload?.data?.code ||
    payload?.pairing?.code ||
    payload?.pairing?.pairingCode ||
    payload?.code ||
    null

  if (!value || typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 40 || normalized.startsWith('data:image/')) return null
  return normalized
}

function getWebhookUrl(token?: string | null) {
  if (!token) return null
  return `${getPublicAppUrl()}/api/webhooks/evolution/${token}`
}

export function normalizePhone(raw: string): string {
  return String(raw || '').replace(/@.*$/, '').replace(/\D/g, '')
}

type WhatsAppPersistence = Pick<
  typeof prisma,
  'empresa' | 'usuario' | 'lead' | 'conversa' | 'mensagem' | 'leadActivity' | 'whatsAppWebhookEvent'
>

type IncomingMediaType = 'image' | 'video' | 'audio'

type MetaMediaAttachment = {
  mediaUrl: string
  mediaType: IncomingMediaType
  mimeType: string
  size: number
}

type MetaMediaResolver = (input: {
  companyId: number
  mediaId: string
  mediaType: IncomingMediaType
  declaredMimeType?: string | null
}) => Promise<MetaMediaAttachment>

const META_GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || 'v19.0').replace(/^v?/, 'v')
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`
const META_MEDIA_TYPES = new Map<string, { extension: string; mediaType: IncomingMediaType; maxBytes: number }>([
  ['image/jpeg', { extension: 'jpg', mediaType: 'image', maxBytes: 5 * 1024 * 1024 }],
  ['image/png', { extension: 'png', mediaType: 'image', maxBytes: 5 * 1024 * 1024 }],
  ['image/webp', { extension: 'webp', mediaType: 'image', maxBytes: 5 * 1024 * 1024 }],
  ['image/gif', { extension: 'gif', mediaType: 'image', maxBytes: 5 * 1024 * 1024 }],
  ['video/mp4', { extension: 'mp4', mediaType: 'video', maxBytes: 16 * 1024 * 1024 }],
  ['video/3gpp', { extension: '3gp', mediaType: 'video', maxBytes: 16 * 1024 * 1024 }],
  ['audio/aac', { extension: 'aac', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
  ['audio/amr', { extension: 'amr', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
  ['audio/mpeg', { extension: 'mp3', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
  ['audio/mp4', { extension: 'm4a', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
  ['audio/ogg', { extension: 'ogg', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
  ['audio/opus', { extension: 'opus', mediaType: 'audio', maxBytes: 16 * 1024 * 1024 }],
])

async function getMetaMediaAccessToken(companyId: number) {
  const [connection, company] = await Promise.all([
    getWhatsAppConnection(companyId),
    prisma.empresa.findUnique({ where: { id: companyId }, select: { metaToken: true } }),
  ])
  const accessToken = connection?.provider === 'meta' ? connection.accessToken : company?.metaToken
  if (!accessToken) throw new Error('Token da Meta indisponivel para baixar a midia recebida.')
  return accessToken
}

async function resolveMetaMedia(input: Parameters<MetaMediaResolver>[0]): Promise<MetaMediaAttachment> {
  const accessToken = await getMetaMediaAccessToken(input.companyId)
  const metadataResponse = await fetch(`${META_GRAPH_BASE_URL}/${encodeURIComponent(input.mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  })
  const metadataText = await metadataResponse.text()
  let metadata: any = null
  try { metadata = metadataText ? JSON.parse(metadataText) : null } catch { metadata = null }
  if (!metadataResponse.ok || !metadata?.url) {
    throw new Error(metadata?.error?.message || `Meta nao retornou a URL da midia (HTTP ${metadataResponse.status}).`)
  }

  const mediaResponse = await fetch(String(metadata.url), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!mediaResponse.ok) {
    throw new Error(`Falha ao baixar a midia da Meta (HTTP ${mediaResponse.status}).`)
  }

  const mimeType = String(
    mediaResponse.headers.get('content-type') || metadata?.mime_type || input.declaredMimeType || '',
  ).split(';')[0].trim().toLowerCase()
  const mediaConfig = META_MEDIA_TYPES.get(mimeType)
  if (!mediaConfig || mediaConfig.mediaType !== input.mediaType) {
    throw new Error(`Formato de midia recebido nao suportado: ${mimeType || input.mediaType}.`)
  }

  const declaredSize = Number(mediaResponse.headers.get('content-length') || metadata?.file_size || 0)
  if (declaredSize > mediaConfig.maxBytes) {
    throw new Error(`Midia recebida excede o limite de ${Math.floor(mediaConfig.maxBytes / 1024 / 1024)} MB.`)
  }

  const buffer = Buffer.from(await mediaResponse.arrayBuffer())
  if (buffer.length > mediaConfig.maxBytes) {
    throw new Error(`Midia recebida excede o limite de ${Math.floor(mediaConfig.maxBytes / 1024 / 1024)} MB.`)
  }

  const relativeDirectory = path.posix.join('media', String(input.companyId))
  const uploadDirectory = path.join(process.cwd(), 'uploads', ...relativeDirectory.split('/'))
  const storedFilename = `${randomUUID()}.${mediaConfig.extension}`
  await fs.mkdir(uploadDirectory, { recursive: true })
  await fs.writeFile(path.join(uploadDirectory, storedFilename), buffer, { flag: 'wx' })

  const mediaUrl = `${getPublicAppUrl()}/uploads/${relativeDirectory}/${storedFilename}`
  console.info('[Webhook/Meta] Midia recebida salva', {
    companyId: input.companyId,
    mediaType: mediaConfig.mediaType,
    size: buffer.length,
  })
  return { mediaUrl, mediaType: mediaConfig.mediaType, mimeType, size: buffer.length }
}

function getMetaMediaDescriptor(message: any) {
  const requestedType = String(message?.type || '').toLowerCase()
  const mediaType: IncomingMediaType | null = requestedType === 'image'
    ? 'image'
    : requestedType === 'sticker'
      ? 'image'
    : requestedType === 'video'
      ? 'video'
      : requestedType === 'audio'
        ? 'audio'
        : null
  if (!mediaType) return null

  const media = requestedType === 'sticker' ? message?.sticker : message?.[mediaType]
  if (!media?.id) return null
  return {
    mediaId: String(media.id),
    mediaType,
    declaredMimeType: media.mime_type ? String(media.mime_type) : null,
    providerMediaType: requestedType,
  }
}

export async function findCompanyByInstance(instance: string) {
  const trimmed = instance.trim()
  return prisma.empresa.findFirst({
    where: {
      evolutionInstance: {
        equals: trimmed,
        mode: 'insensitive',
      },
      isActive: true,
    },
    select: { id: true, ownerId: true, name: true },
  })
}

export async function findCompanyByMetaPhoneId(
  phoneNumberId: string,
  db: WhatsAppPersistence = prisma,
) {
  return db.empresa.findFirst({
    where: { metaPhoneNumberId: phoneNumberId, isActive: true },
    select: { id: true, ownerId: true, name: true },
  })
}

async function ensureCompanyWhatsappToken(companyId: number) {
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
      isActive: true,
    },
  })

  if (!company) {
    throw new Error('Empresa nao encontrada.')
  }

  const mode = getEvolutionMode(company)
  const managedInstance = isUuidLike(company.evolutionInstance)
    ? company.evolutionInstance
    : buildManagedEvolutionInstance(company)
  const managedInstanceToken = company.apiKey || randomBytes(24).toString('hex')

  if (mode === 'managed') {
    return prisma.empresa.update({
      where: { id: companyId },
      data: {
        whatsappProvider: 'evolution',
        evolutionMode: 'managed',
        evolutionInstance: managedInstance,
        apiKey: managedInstanceToken,
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        webhookToken: true,
        evolutionInstance: true,
        evolutionMode: true,
        evolutionApiUrl: true,
        apiKey: true,
        isActive: true,
      },
    })
  }

  return company
}

function getEvolutionRuntime(company: CompanyRef): EvolutionRuntime {
  const mode = getEvolutionMode(company)
  const instance = mode === 'managed'
    ? (isUuidLike(company.evolutionInstance) ? company.evolutionInstance : buildManagedEvolutionInstance(company))
    : company.evolutionInstance

  if (mode === 'managed') {
    const baseUrl = process.env.EVOLUTION_CENTRAL_API_URL
    const controlApiKey = process.env.EVOLUTION_CENTRAL_API_KEY
    const instanceApiKey = company.apiKey || controlApiKey
    if (!baseUrl || !controlApiKey || !instance || !instanceApiKey) {
      throw new Error('Evolution central nao configurada. Defina EVOLUTION_CENTRAL_API_URL e EVOLUTION_CENTRAL_API_KEY no ambiente da VPS.')
    }

    return {
      mode,
      baseUrl: trimTrailingSlash(baseUrl),
      apiKey: instanceApiKey,
      controlApiKey,
      instance,
    }
  }

  if (!isCustomEvolutionConfigured(company) || !instance || !company.evolutionApiUrl || !company.apiKey) {
    throw new Error('Evolution propria nao configurada. Informe URL da Evolution, API key e nome da instancia.')
  }

  return {
    mode,
    baseUrl: trimTrailingSlash(company.evolutionApiUrl),
    apiKey: company.apiKey,
    instance,
  }
}

async function createEvolutionInstanceIfNeeded(runtime: EvolutionRuntime) {
  return createEvolutionInstance(
    { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey },
    runtime.instance,
    runtime.apiKey
  )
}

async function ensureEvolutionInstanceReady(company: CompanyRef, runtime: EvolutionRuntime) {
  if (runtime.mode === 'managed' && isUuidLike(runtime.instance)) {
    return {
      ok: true,
      alreadyExists: true,
      data: null,
      endpoint: null,
      instanceId: runtime.instance,
      instanceName: company.name,
      instanceToken: runtime.apiKey,
    }
  }

  const result = await createEvolutionInstanceIfNeeded(runtime)
  if (runtime.mode === 'managed' && result.instanceId && result.instanceId !== runtime.instance) {
    const instanceToken = result.instanceToken || runtime.apiKey
    await prisma.empresa.update({
      where: { id: company.id },
      data: {
        evolutionInstance: result.instanceId,
        apiKey: instanceToken,
      },
    })
    company.evolutionInstance = result.instanceId
    company.apiKey = instanceToken
    runtime.instance = result.instanceId
    runtime.apiKey = instanceToken
  }

  return result
}

function extractEvolutionInstanceInfo(data: any, fallbackToken?: string) {
  const payload = data?.data || data || {}
  return {
    id: typeof payload.id === 'string' ? payload.id : null,
    name: typeof payload.name === 'string' ? payload.name : null,
    token: typeof payload.token === 'string' ? payload.token : fallbackToken || null,
  }
}

async function createEvolutionInstance(
  config: { baseUrl: string; apiKey: string },
  instance: string,
  instanceToken?: string,
  attempts: EvolutionAttemptResult[] = []
) {
  const candidates = getCandidateBaseUrls(config.baseUrl).flatMap((baseUrl) => [
    {
      label: 'go instance create',
      url: `${baseUrl}/instance/create`,
      body: { name: instance, token: instanceToken },
    },
    {
      label: 'instance create baileys',
      url: `${baseUrl}/instance/create`,
      body: { instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
    },
    {
      label: 'instance create default',
      url: `${baseUrl}/instance/create`,
      body: { instanceName: instance, qrcode: true },
    },
  ])

  for (const candidate of candidates) {
    try {
      const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, 'POST', candidate.body)
      const errorText = JSON.stringify(data).toLowerCase()
      attempts.push({
        label: candidate.label,
        method: 'POST',
        url: candidate.url,
        status: response.status,
        ok: response.ok && !isHtmlResponse(text),
        response: text.slice(0, 220),
      })

      if ((response.ok && !isHtmlResponse(text)) || response.status === 409 || errorText.includes('already') || errorText.includes('existe')) {
        const instanceInfo = extractEvolutionInstanceInfo(data, instanceToken)
        return {
          ok: response.ok && !isHtmlResponse(text),
          alreadyExists: response.status === 409 || errorText.includes('already') || errorText.includes('existe'),
          data,
          endpoint: candidate.url,
          instanceId: instanceInfo.id,
          instanceName: instanceInfo.name,
          instanceToken: instanceInfo.token,
        }
      }
    } catch (error: any) {
      attempts.push({ label: candidate.label, method: 'POST', url: candidate.url, ok: false, error: error.message })
    }
  }

  return { ok: false, alreadyExists: false, data: null, endpoint: null }
}

export async function setupEvolutionWebhookForCompany(company: CompanyRef) {
  const runtime = getEvolutionRuntime(company)
  const instance = runtime.instance
  const webhookUrl = getWebhookUrl(company.webhookToken)
  if (!instance || !webhookUrl) {
    throw new Error('Instancia ou webhook token ausente para configurar webhook.')
  }

  const result = await tryConfigureEvolutionWebhook(
    { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey },
    instance,
    webhookUrl
  )
  if (result.ok) {
    return { webhookUrl, endpoint: result.endpoint }
  }

  throw new Error(formatWebhookFailure(result.attempts))
}

function buildWebhookAttempts(baseUrl: string, instance: string, webhookUrl: string) {
  const events = ['MESSAGES_UPSERT']
  const webhookObject = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhook_by_events: true,
      webhookByEvents: true,
      events,
    },
  }
  const flatSnake = { url: webhookUrl, enabled: true, webhook_by_events: true, events }
  const flatCamel = { url: webhookUrl, enabled: true, webhookByEvents: true, events }

  return [
    {
      label: 'go instance connect webhook',
      url: `${baseUrl}/instance/connect`,
      body: { webhookUrl, subscribe: ['ALL'], immediate: true },
      headers: { instanceId: instance },
    },
    { label: 'v2 webhook/set object', url: `${baseUrl}/webhook/set/${instance}`, body: webhookObject },
    { label: 'v2 webhook/set snake', url: `${baseUrl}/webhook/set/${instance}`, body: flatSnake },
    { label: 'v2 webhook/set camel', url: `${baseUrl}/webhook/set/${instance}`, body: flatCamel },
    { label: 'legacy webhook/manage', url: `${baseUrl}/webhook/manage/${instance}`, body: flatCamel },
    { label: 'legacy webhook/instance', url: `${baseUrl}/webhook/instance/${instance}`, body: flatSnake },
  ]
}

async function tryConfigureEvolutionWebhook(
  config: { baseUrl: string; apiKey: string },
  instance: string,
  webhookUrl: string
): Promise<{ ok: true; endpoint: string; attempts: EvolutionAttemptResult[] } | { ok: false; attempts: EvolutionAttemptResult[] }> {
  const attempts: EvolutionAttemptResult[] = []
  const candidates = getCandidateBaseUrls(config.baseUrl).flatMap((baseUrl) =>
    buildWebhookAttempts(baseUrl, instance, webhookUrl)
  )

  for (const attempt of candidates) {
    try {
      const response = await fetch(attempt.url, {
        method: 'POST',
        headers: evolutionHeaders(config.apiKey, attempt.headers),
        body: JSON.stringify(attempt.body),
      })
      const body = await responseSnippet(response)
      const result: EvolutionAttemptResult = {
        label: attempt.label,
        method: 'POST',
        url: attempt.url,
        status: response.status,
        ok: response.ok,
        response: body,
      }
      attempts.push(result)

      if (response.ok) {
        return { ok: true, endpoint: attempt.url, attempts }
      }
    } catch (error: any) {
      attempts.push({
        label: attempt.label,
        method: 'POST',
        url: attempt.url,
        ok: false,
        error: error.message,
      })
    }
  }

  return { ok: false, attempts }
}

function formatWebhookFailure(attempts: EvolutionAttemptResult[]) {
  const last = attempts[attempts.length - 1]
  const notFoundCount = attempts.filter((attempt) => attempt.status === 404).length
  const hint = notFoundCount === attempts.length
    ? 'A Evolution respondeu 404 para todos os endpoints de webhook. Verifique se a URL da Evolution aponta para a raiz da API, sem /manager, ou se a versao da Evolution usa outro endpoint.'
    : 'Verifique URL, API key e permissao de webhook da Evolution.'
  const detail = last
    ? `${last.url} HTTP ${last.status || 'sem resposta'}: ${last.response || last.error || 'sem detalhes'}`
    : 'nenhum endpoint testado'
  return `Webhook nao configurado. ${hint} Ultima tentativa: ${detail}`
}

async function probeEvolutionApi(config: { baseUrl: string; apiKey: string }, instance?: string | null) {
  const attempts: EvolutionAttemptResult[] = []
  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const urls = [
      { url: `${baseUrl}/instance/all`, headers: undefined },
      instance ? { url: `${baseUrl}/instance/status`, headers: { instanceId: instance } } : null,
      `${baseUrl}/instance/fetchInstances`,
      instance ? { url: `${baseUrl}/instance/connectionState/${instance}`, headers: undefined } : null,
    ].filter(Boolean) as string[]

    for (const candidate of urls as any[]) {
      const url = typeof candidate === 'string' ? candidate : candidate.url
      const extraHeaders = typeof candidate === 'string' ? undefined : candidate.headers
      try {
        const response = await fetch(url, { method: 'GET', headers: evolutionHeaders(config.apiKey, extraHeaders) })
        const body = await responseSnippet(response)
        const result = {
          label: 'api probe',
          method: 'GET',
          url,
          status: response.status,
          ok: response.ok && !isHtmlResponse(body),
          response: body,
        }
        attempts.push(result)
        if (response.ok && !isHtmlResponse(body)) return { ok: true, baseUrl, attempts }
      } catch (error: any) {
        attempts.push({ label: 'api probe', method: 'GET', url, ok: false, error: error.message })
      }
    }
  }
  return { ok: false, baseUrl: getCandidateBaseUrls(config.baseUrl)[0], attempts }
}

async function getEvolutionConnectionState(config: { baseUrl: string; apiKey: string }, instance: string) {
  const attempts: EvolutionAttemptResult[] = []

  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const candidates = [
      { url: `${baseUrl}/instance/status`, headers: { instanceId: instance } },
      { url: `${baseUrl}/instance/connectionState/${instance}`, headers: undefined },
    ]
    for (const candidate of candidates) {
    try {
      const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, 'GET', undefined, candidate.headers)
      attempts.push({
        label: 'connection state',
        method: 'GET',
        url: candidate.url,
        status: response.status,
        ok: response.ok,
        response: text.slice(0, 220),
      })

      if (response.ok && isConnectedPayload(data)) {
        return { connected: true, endpoint: candidate.url, attempts }
      }
    } catch (error: any) {
      attempts.push({ label: 'connection state', method: 'GET', url: candidate.url, ok: false, error: error.message })
    }
    }
  }

  return { connected: false, endpoint: null, attempts }
}

async function requestEvolutionQrCode(config: { baseUrl: string; apiKey: string }, instance: string, allowRecreate = false) {
  const attempts: EvolutionAttemptResult[] = []
  let lastOkEndpoint: string | null = null

  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const encodedInstance = encodeURIComponent(instance)
    const candidates = [
      { method: 'GET' as const, url: `${baseUrl}/instance/qr`, headers: { instanceId: instance } },
      { method: 'GET' as const, url: `${baseUrl}/instance/qr/${encodedInstance}` },
      { method: 'GET' as const, url: `${baseUrl}/instance/qr?instance=${encodedInstance}` },
      { method: 'GET' as const, url: `${baseUrl}/instance/qr?instanceName=${encodedInstance}` },
      { method: 'POST' as const, url: `${baseUrl}/instance/qr`, body: { instanceName: instance } },
      { method: 'POST' as const, url: `${baseUrl}/instance/qr`, body: { instance } },
      { method: 'GET' as const, url: `${baseUrl}/instance/connect/${instance}` },
      { method: 'POST' as const, url: `${baseUrl}/instance/connect/${instance}` },
    ]

    for (const candidate of candidates) {
      try {
        const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, candidate.method, candidate.body, candidate.headers)
        const qrcode = extractQrCode(data)
        const pairingCode = extractPairingCode(data)
        attempts.push({
          label: 'qrcode connect',
          method: candidate.method,
          url: candidate.url,
          status: response.status,
          ok: response.ok,
          response: text.slice(0, 220),
        })
        if (response.ok) lastOkEndpoint = candidate.url

        if (response.ok && isConnectedPayload(data)) {
          return { connected: true, qrcode: null, pairingCode: null, endpoint: candidate.url, attempts }
        }

        if (response.ok && (qrcode || pairingCode)) {
          return { connected: false, qrcode, pairingCode, endpoint: candidate.url, attempts }
        }
      } catch (error: any) {
        attempts.push({ label: 'qrcode connect', method: candidate.method, url: candidate.url, ok: false, error: error.message })
      }
    }
  }

  if (allowRecreate) {
    const recreated = await recreateEvolutionInstanceForQr(config, instance, attempts)
    if (recreated.qrcode || recreated.pairingCode || recreated.connected) {
      return recreated
    }

    return { connected: false, qrcode: null, pairingCode: null, endpoint: recreated.endpoint || lastOkEndpoint, attempts }
  }

  return { connected: false, qrcode: null, pairingCode: null, endpoint: lastOkEndpoint, attempts }
}

async function requestEvolutionPairingCode(config: { baseUrl: string; apiKey: string }, instance: string, phone: string) {
  const attempts: EvolutionAttemptResult[] = []
  const number = normalizePhone(phone)
  let lastOkEndpoint: string | null = null

  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const encodedNumber = encodeURIComponent(number)
    const candidates = [
      { method: 'POST' as const, url: `${baseUrl}/instance/connect`, body: { webhookUrl: undefined, subscribe: ['ALL'], immediate: true, phone: number }, headers: { instanceId: instance } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { phone: number, subscribe: ['ALL'] }, headers: { instanceId: instance } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instanceName: instance, number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instanceName: instance, phoneNumber: number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instanceName: instance, phone: number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instance, number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instance, phoneNumber: number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/pair`, body: { instance, phone: number } },
      { method: 'GET' as const, url: `${baseUrl}/instance/connect/${instance}?number=${encodedNumber}` },
      { method: 'GET' as const, url: `${baseUrl}/instance/connect/${instance}?phoneNumber=${encodedNumber}` },
      { method: 'GET' as const, url: `${baseUrl}/instance/connect/${instance}?phone=${encodedNumber}` },
      { method: 'POST' as const, url: `${baseUrl}/instance/connect/${instance}`, body: { number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/connect/${instance}`, body: { phoneNumber: number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/connect/${instance}`, body: { phone: number } },
      { method: 'POST' as const, url: `${baseUrl}/instance/connect/${instance}`, body: { number, pairingCode: true, qrcode: false } },
    ]

    for (const candidate of candidates) {
      try {
        const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, candidate.method, candidate.body, candidate.headers)
        const pairingCode = extractPairingCode(data)
        const qrcode = extractQrCode(data)
        attempts.push({
          label: 'pairing code connect',
          method: candidate.method,
          url: candidate.url,
          status: response.status,
          ok: response.ok,
          response: text.slice(0, 220),
        })
        if (response.ok) lastOkEndpoint = candidate.url

        if (response.ok && isConnectedPayload(data)) {
          return { connected: true, qrcode: null, pairingCode: null, endpoint: candidate.url, attempts }
        }

        if (response.ok && (pairingCode || qrcode)) {
          return { connected: false, qrcode, pairingCode, endpoint: candidate.url, attempts }
        }
      } catch (error: any) {
        attempts.push({ label: 'pairing code connect', method: candidate.method, url: candidate.url, ok: false, error: error.message })
      }
    }
  }

  return { connected: false, qrcode: null, pairingCode: null, endpoint: lastOkEndpoint, attempts }
}

async function recreateEvolutionInstanceForQr(config: { baseUrl: string; apiKey: string }, instance: string, attempts: EvolutionAttemptResult[]) {
  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const cleanup = [
      { method: 'DELETE' as const, label: 'instance logout', url: `${baseUrl}/instance/logout/${instance}` },
      { method: 'DELETE' as const, label: 'instance delete', url: `${baseUrl}/instance/delete/${instance}` },
    ]

    for (const candidate of cleanup) {
      try {
        const { response, text } = await fetchEvolutionJson(candidate.url, config.apiKey, candidate.method)
        attempts.push({
          label: candidate.label,
          method: candidate.method,
          url: candidate.url,
          status: response.status,
          ok: response.ok,
          response: text.slice(0, 220),
        })
      } catch (error: any) {
        attempts.push({ label: candidate.label, method: candidate.method, url: candidate.url, ok: false, error: error.message })
      }
    }
  }

  const created = await createEvolutionInstance(config, instance, undefined, attempts)
  const qrcode = extractQrCode(created.data)
  const pairingCode = extractPairingCode(created.data)

  if (created.data && isConnectedPayload(created.data)) {
    return { connected: true, qrcode: null, pairingCode: null, endpoint: created.endpoint, attempts }
  }

  if (qrcode || pairingCode) {
    return { connected: false, qrcode, pairingCode, endpoint: created.endpoint, attempts }
  }

  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const url = `${baseUrl}/instance/connect/${instance}`
    try {
      const { response, data, text } = await fetchEvolutionJson(url, config.apiKey)
      const connectQr = extractQrCode(data)
      const connectPairingCode = extractPairingCode(data)
      attempts.push({
        label: 'qrcode after recreate',
        method: 'GET',
        url,
        status: response.status,
        ok: response.ok,
        response: text.slice(0, 220),
      })

      if (response.ok && isConnectedPayload(data)) {
        return { connected: true, qrcode: null, pairingCode: null, endpoint: url, attempts }
      }

      if (response.ok && (connectQr || connectPairingCode)) {
        return { connected: false, qrcode: connectQr, pairingCode: connectPairingCode, endpoint: url, attempts }
      }
    } catch (error: any) {
      attempts.push({ label: 'qrcode after recreate', method: 'GET', url, ok: false, error: error.message })
    }
  }

  return { connected: false, qrcode: null, pairingCode: null, endpoint: created.endpoint, attempts }
}

function formatQrFailure(attempts: EvolutionAttemptResult[]) {
  const last = attempts[attempts.length - 1]
  const okWithoutQr = attempts.some((attempt) => attempt.ok)
  if (okWithoutQr) {
    return 'A Evolution respondeu, mas nao retornou QR Code. Tente reiniciar a instancia e gerar novamente.'
  }

  if (!last) {
    return 'Nenhum endpoint de QR Code foi testado.'
  }

  return `Nao foi possivel gerar QR Code. Ultima tentativa: ${last.url} HTTP ${last.status || 'sem resposta'}: ${last.response || last.error || 'sem detalhes'}`
}

export async function diagnoseCentralEvolution(companyId: number): Promise<EvolutionDiagnostic> {
  const company = await ensureCompanyWhatsappToken(companyId)
  let runtime: EvolutionRuntime

  try {
    runtime = getEvolutionRuntime(company)
  } catch (error: any) {
    return {
      configured: false,
      apiReachable: false,
      apiKeyAccepted: false,
      webhookStatus: 'not_configured',
      instance: company.evolutionInstance,
      message: error.message || 'Evolution propria nao configurada.',
      attempts: [],
    }
  }

  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }
  const instance = runtime.instance
  const webhookUrl = getWebhookUrl(company.webhookToken)
  const probe = await probeEvolutionApi(config, instance)
  let webhookResult: Awaited<ReturnType<typeof tryConfigureEvolutionWebhook>> | null = null

  if (webhookUrl) {
    webhookResult = await tryConfigureEvolutionWebhook(config, instance, webhookUrl)
  }

  const attempts = [...probe.attempts, ...(webhookResult?.attempts || [])]
  return {
    configured: true,
    baseUrl: config.baseUrl,
    testedBaseUrls: getCandidateBaseUrls(config.baseUrl),
    instance,
    apiReachable: probe.attempts.some((attempt) => attempt.status !== undefined),
    apiKeyAccepted: probe.ok,
    webhookUrl,
    webhookStatus: webhookResult?.ok ? 'configured' : 'error',
    webhookEndpoint: webhookResult?.ok ? webhookResult.endpoint : null,
    message: webhookResult?.ok
      ? 'Evolution respondeu e webhook foi configurado.'
      : formatWebhookFailure(webhookResult?.attempts || []),
    attempts,
  }
}

export async function getCentralWhatsappStatus(companyId: number): Promise<WhatsAppStatus> {
  const company = await ensureCompanyWhatsappToken(companyId)
  let runtime: EvolutionRuntime
  try {
    runtime = getEvolutionRuntime(company)
  } catch (error: any) {
    return {
      status: 'NOT_CONFIGURED',
      evolutionMode: getEvolutionMode(company),
      instance: company.evolutionInstance,
      webhookStatus: 'not_configured',
      message: error.message,
    }
  }

  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }
  let instance = runtime.instance
  const webhookUrl = getWebhookUrl(company.webhookToken)
  let webhookStatus: WhatsAppStatus['webhookStatus'] = webhookUrl ? 'pending' : 'not_configured'
  let webhookEndpoint: string | null = null
  let webhookError: string | null = null

  try {
    await ensureEvolutionInstanceReady(company, runtime)
    instance = runtime.instance
    const webhook = await setupEvolutionWebhookForCompany(company)
    webhookStatus = 'configured'
    webhookEndpoint = webhook.endpoint
  } catch (error) {
    console.warn('[WhatsApp] Falha ao preparar instancia/webhook:', error)
    webhookStatus = 'error'
    webhookError = error instanceof Error ? error.message : 'Webhook nao configurado.'
  }

  const state = await getEvolutionConnectionState(config, instance)
  if (state.connected) {
    return {
      status: 'CONNECTED',
      instance,
      evolutionMode: runtime.mode,
      webhookUrl,
      webhookStatus,
      webhookEndpoint,
      webhookError,
      message: 'WhatsApp conectado na instancia Evolution.',
    }
  }

  return {
    status: 'DISCONNECTED',
    instance,
    evolutionMode: runtime.mode,
    webhookUrl,
    webhookStatus,
    webhookEndpoint,
    webhookError,
    message: runtime.mode === 'managed'
      ? 'WhatsApp ainda nao conectado. Gere o QR Code ou use o codigo de pareamento pelo telefone.'
      : 'WhatsApp ainda nao conectado na Evolution. Conecte o numero pelo painel da sua Evolution e atualize o status no SellClin.',
  }
}

export async function startCentralWhatsappConnection(companyId: number) {
  const company = await ensureCompanyWhatsappToken(companyId)
  const runtime = getEvolutionRuntime(company)
  const webhookUrl = getWebhookUrl(company.webhookToken)
  let webhookStatus: WhatsAppStatus['webhookStatus'] = webhookUrl ? 'pending' : 'not_configured'
  let webhookEndpoint: string | null = null
  let webhookError: string | null = null

  await ensureEvolutionInstanceReady(company, runtime)
  try {
    const webhook = await setupEvolutionWebhookForCompany(company)
    webhookStatus = 'configured'
    webhookEndpoint = webhook.endpoint
  } catch (error) {
    console.warn('[WhatsApp Connect] Webhook nao configurado:', error)
    webhookStatus = 'error'
    webhookError = error instanceof Error ? error.message : 'Webhook nao configurado.'
  }

  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }
  const qr = await requestEvolutionQrCode(config, runtime.instance, true)
  if (qr.connected) {
    return {
      status: 'CONNECTED',
      instance: runtime.instance,
      evolutionMode: runtime.mode,
      webhookUrl,
      webhookStatus,
      webhookEndpoint,
      webhookError,
      message: 'WhatsApp conectado na instancia Evolution.',
    } satisfies WhatsAppStatus
  }

  return {
    status: 'DISCONNECTED',
    qrcode: qr.qrcode,
    pairingCode: qr.pairingCode,
    qrcodeStatus: qr.qrcode || qr.pairingCode ? 'ready' : 'empty',
    qrcodeEndpoint: qr.endpoint,
    qrcodeError: qr.qrcode || qr.pairingCode ? null : formatQrFailure(qr.attempts),
    instance: runtime.instance,
    evolutionMode: runtime.mode,
    webhookUrl,
    webhookStatus,
    webhookEndpoint,
    webhookError,
    message: qr.qrcode || qr.pairingCode
      ? 'Escaneie o QR Code ou use o codigo de pareamento para conectar o WhatsApp.'
      : 'A Evolution respondeu, mas nao retornou QR Code.',
  } satisfies WhatsAppStatus
}

export async function startCentralWhatsappPairingCode(companyId: number, phone: string) {
  const normalizedPhone = normalizePhone(phone)
  if (normalizedPhone.length < 10) {
    throw new Error('Informe um telefone com DDI e DDD para gerar o codigo de pareamento.')
  }

  const company = await ensureCompanyWhatsappToken(companyId)
  const runtime = getEvolutionRuntime(company)
  const webhookUrl = getWebhookUrl(company.webhookToken)
  let webhookStatus: WhatsAppStatus['webhookStatus'] = webhookUrl ? 'pending' : 'not_configured'
  let webhookEndpoint: string | null = null
  let webhookError: string | null = null

  await ensureEvolutionInstanceReady(company, runtime)
  try {
    const webhook = await setupEvolutionWebhookForCompany(company)
    webhookStatus = 'configured'
    webhookEndpoint = webhook.endpoint
  } catch (error) {
    console.warn('[WhatsApp Pairing] Webhook nao configurado:', error)
    webhookStatus = 'error'
    webhookError = error instanceof Error ? error.message : 'Webhook nao configurado.'
  }

  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }
  const pairing = await requestEvolutionPairingCode(config, runtime.instance, normalizedPhone)
  if (pairing.connected) {
    return {
      status: 'CONNECTED',
      instance: runtime.instance,
      evolutionMode: runtime.mode,
      webhookUrl,
      webhookStatus,
      webhookEndpoint,
      webhookError,
      message: 'WhatsApp conectado na instancia Evolution.',
    } satisfies WhatsAppStatus
  }

  return {
    status: 'DISCONNECTED',
    qrcode: pairing.qrcode,
    pairingCode: pairing.pairingCode,
    qrcodeStatus: pairing.qrcode || pairing.pairingCode ? 'ready' : 'empty',
    qrcodeEndpoint: pairing.endpoint,
    qrcodeError: pairing.qrcode || pairing.pairingCode ? null : formatQrFailure(pairing.attempts),
    instance: runtime.instance,
    evolutionMode: runtime.mode,
    webhookUrl,
    webhookStatus,
    webhookEndpoint,
    webhookError,
    message: pairing.pairingCode
      ? 'Use o codigo de pareamento no WhatsApp para conectar este numero.'
      : pairing.qrcode
        ? 'A Evolution retornou QR Code como alternativa ao codigo de pareamento.'
        : 'A Evolution nao retornou codigo de pareamento.',
  } satisfies WhatsAppStatus
}

export async function getCentralEvolutionRuntime(companyId: number) {
  const company = await ensureCompanyWhatsappToken(companyId)
  const runtime = getEvolutionRuntime(company)
  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }
  await ensureEvolutionInstanceReady(company, runtime)
  const probe = await probeEvolutionApi(config, runtime.instance)

  return {
    mode: runtime.mode,
    baseUrl: probe.ok ? probe.baseUrl : getCandidateBaseUrls(config.baseUrl)[0],
    apiKey: config.apiKey,
    instance: runtime.instance,
  }
}

export async function restartCentralWhatsapp(companyId: number) {
  const company = await ensureCompanyWhatsappToken(companyId)
  const runtime = getEvolutionRuntime(company)
  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }

  let lastError = 'Erro ao reiniciar instancia Evolution.'
  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const candidates = [
      { url: `${baseUrl}/instance/restart`, headers: { instanceId: runtime.instance } },
      { url: `${baseUrl}/instance/restart/${runtime.instance}`, headers: undefined },
    ]
    for (const candidate of candidates) {
      const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, 'POST', undefined, candidate.headers)
      if (response.ok) return data
      lastError = data?.message || data?.error || `HTTP ${response.status}: ${text.slice(0, 180)}`
    }
  }

  throw new Error(lastError)
}

export async function disconnectCentralWhatsapp(companyId: number) {
  const company = await ensureCompanyWhatsappToken(companyId)
  const runtime = getEvolutionRuntime(company)
  const config = { baseUrl: runtime.baseUrl, apiKey: runtime.controlApiKey || runtime.apiKey }

  let lastError = 'Erro ao desconectar WhatsApp.'
  for (const baseUrl of getCandidateBaseUrls(config.baseUrl)) {
    const candidates = [
      { url: `${baseUrl}/instance/logout`, headers: { instanceId: runtime.instance } },
      { url: `${baseUrl}/instance/logout/${runtime.instance}`, headers: undefined },
    ]
    for (const candidate of candidates) {
      const { response, data, text } = await fetchEvolutionJson(candidate.url, config.apiKey, 'DELETE', undefined, candidate.headers)
      if (response.ok) return data
      lastError = data?.message || data?.error || `HTTP ${response.status}: ${text.slice(0, 180)}`
    }
  }

  throw new Error(lastError)
}

type PersistWhatsAppMessageOptions = {
  companyId: number
  ownerId: number | null
  phone: string
  pushName: string
  messageText: string
  rawPayload: any
  origin: string
  providerMessageId?: string | null
  mediaUrl?: string | null
  mediaType?: IncomingMediaType | null
  providerMediaType?: string | null
  messageAt?: Date | null
  avatarUrl?: string | null
}

async function persistWhatsAppMessage(
  opts: PersistWhatsAppMessageOptions,
  sender: 'cliente' | 'profissional',
  db: WhatsAppPersistence = prisma,
) {
  const {
    companyId, ownerId, phone, pushName, messageText, rawPayload, origin, providerMessageId, mediaUrl, mediaType,
    providerMediaType, messageAt, avatarUrl,
  } = opts
  const isIncoming = sender === 'cliente'
  const occurredAt = messageAt || new Date()

  if (!ownerId) {
    console.warn(`[Webhook] Empresa #${companyId} sem ownerId. Ignorando.`)
    return { action: 'ignored', reason: 'no_owner' }
  }

  let lead = await db.lead.findFirst({
    where: { phone, companyId },
  })

  let action: 'created' | 'existing' | 'duplicate_message' = 'existing'

  if (!lead) {
    const sdrId = isIncoming ? await chooseSdrForCompany(db, companyId) : null
    lead = await db.lead.create({
      data: {
        professionalId: ownerId,
        companyId,
        sdrId,
        name: pushName || 'Contato WhatsApp',
        phone,
        avatar: avatarUrl || null,
        status: 'prospect_lead',
        origin,
        notes: messageText ? `Primeira mensagem: ${messageText}` : null,
        tags: ['whatsapp-auto'],
        isScheduled: false,
        value: 0,
      },
    })

    action = 'created'
  }

  let conversa = await db.conversa.findFirst({
    where: { phone, companyId },
  })

  // Existing contacts may predate automatic routing. Route them when a new inbound
  // message arrives, unless a manager has already assigned the conversation manually.
  if (isIncoming && action === 'existing' && !lead.sdrId && !conversa?.assignedUserId && !conversa?.assignedProfessionalId) {
    const sdrId = await chooseSdrForCompany(db, companyId)
    if (sdrId) {
      lead = await db.lead.update({ where: { id: lead.id }, data: { sdrId } })
    }
  }

  if (!conversa) {
    conversa = await db.conversa.create({
      data: {
        companyId,
        leadId: lead.id,
        professionalId: ownerId,
        assignedUserId: lead.sdrId || null,
        phone,
        app: 'whatsapp',
        channel: origin,
        startedAt: occurredAt,
        lastMessageAt: occurredAt,
        lastInboundAt: isIncoming ? occurredAt : null,
        unreadCount: 0,
      },
    })
  } else if (!conversa.leadId || (lead.sdrId && (conversa.assignedUserId !== lead.sdrId || conversa.assignedProfessionalId))) {
    conversa = await db.conversa.update({
      where: { id: conversa.id },
      data: {
        leadId: lead.id,
        ...(lead.sdrId ? { assignedUserId: lead.sdrId, assignedProfessionalId: null } : {}),
      },
    })
  }

  if (providerMessageId) {
    const existingMessage = await db.mensagem.findFirst({
      where: { conversationId: conversa.id, providerMessageId },
      select: { id: true },
    })

    if (existingMessage) {
      return { action: 'duplicate_message', leadId: lead.id, conversaId: conversa.id, messageId: existingMessage.id }
    }
  }

  const mensagem = await db.mensagem.create({
    data: {
      conversationId: conversa.id,
      sender,
      content: messageText || '(midia)',
      providerMessageId: providerMessageId || null,
      rawJson: mediaUrl
        ? {
          ...(rawPayload && typeof rawPayload === 'object' ? rawPayload : {}),
          mediaUrl,
          mediaType,
          providerMediaType: providerMediaType || mediaType,
          isSticker: providerMediaType === 'sticker',
        }
        : rawPayload,
      origin,
      ...(sender === 'profissional' ? { deliveryStatus: 'sent', sentAt: occurredAt } : {}),
      ...(messageAt ? { createdAt: occurredAt } : {}),
    },
  })

  await db.conversa.update({
    where: { id: conversa.id },
    data: {
      updatedAt: new Date(),
      lastMessageAt: occurredAt,
      ...(isIncoming ? {
        lastInboundAt: occurredAt,
        unreadCount: { increment: 1 },
      } : {}),
      status: 'OPEN',
      resolvedAt: null,
    },
  })

  if (isIncoming) {
    await db.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'sistema',
        content: action === 'created'
          ? `Lead criado automaticamente via ${origin}. Nome: "${pushName || 'Contato WhatsApp'}".`
          : `Novo contato recebido via ${origin}: "${messageText?.substring(0, 120) || '(midia)'}"`,
        createdBy: 'Sistema',
      },
    })
  }

  return { action, leadId: lead.id, conversaId: conversa.id, messageId: mensagem.id }
}

export async function processIncomingMessage(
  opts: PersistWhatsAppMessageOptions,
  db: WhatsAppPersistence = prisma,
) {
  return persistWhatsAppMessage(opts, 'cliente', db)
}

export async function processOutgoingMessage(
  opts: PersistWhatsAppMessageOptions,
  db: WhatsAppPersistence = prisma,
) {
  return persistWhatsAppMessage(opts, 'profissional', db)
}

function getMetaTimestamp(value: any) {
  const timestamp = Number(value?.timestamp || 0)
  return timestamp > 0 ? new Date(timestamp * 1000) : null
}

function getMetaText(value: any) {
  return value?.text?.body
    || value?.image?.caption
    || value?.video?.caption
    || value?.document?.caption
    || value?.sticker?.caption
    || value?.button?.text
    || value?.interactive?.button_reply?.title
    || value?.interactive?.list_reply?.title
    || ''
}

function getMetaEchoPhone(msg: any, contacts: any[]) {
  const candidates = [
    msg?.to,
    msg?.recipient,
    msg?.recipient_id,
    msg?.customer?.wa_id,
    msg?.customer?.phone,
    msg?.contact?.wa_id,
    msg?.contact?.phone,
    msg?.context?.to,
    msg?.context?.recipient,
    msg?.context?.recipient_id,
    contacts?.[0]?.wa_id,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (typeof candidate === 'object') {
      const phone = normalizePhone(candidate.wa_id || candidate.phone || candidate.id || '')
      if (phone) return phone
      continue
    }
    const phone = normalizePhone(candidate)
    if (phone) return phone
  }

  return ''
}

function getMetaContactAvatar(contactInfo: any, msg: any) {
  return contactInfo?.profile?.picture
    || contactInfo?.profile?.profile_picture_url
    || contactInfo?.profile_pic_url
    || contactInfo?.picture
    || msg?.profile?.picture
    || msg?.profile_pic_url
    || null
}

export async function handleEvolutionPayload(
  body: any,
  empresa: { id: number; ownerId: number | null; name: string },
  db: WhatsAppPersistence = prisma,
) {
  const event = body.event || ''
  if (!event.includes('messages') && !event.includes('MESSAGES')) {
    return { received: true, ignored: true, reason: 'not_message_event' }
  }

  const data = body.data || body
  const key = data.key || {}

  const remoteJid = key.remoteJid || data.remoteJid || ''
  if (remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
    return { received: true, ignored: true, reason: 'group' }
  }

  const phone = normalizePhone(remoteJid)
  const pushName = data.pushName || data.senderName || ''
  const messageObj = data.message || {}
  const messageText = messageObj.conversation
    || messageObj.extendedTextMessage?.text
    || messageObj.imageMessage?.caption
    || messageObj.videoMessage?.caption
    || ''
  const providerMessageId = key.id || data.messageId || data.id || null

  if (!phone) {
    return { received: true, ignored: true, reason: 'no_phone' }
  }

  const processMessage = key.fromMe === true ? processOutgoingMessage : processIncomingMessage
  const result = await processMessage({
    companyId: empresa.id,
    ownerId: empresa.ownerId,
    phone,
    pushName,
    messageText,
    rawPayload: body,
    origin: 'WhatsApp',
    providerMessageId,
  }, db)

  return { success: true, ...result }
}

export async function handleUazapiPayload(
  body: any,
  empresa: { id: number; ownerId: number | null; name: string },
  db: WhatsAppPersistence = prisma,
) {
  const event = String(body?.event || body?.EventType || body?.eventType || '').toLowerCase()
  if (event && event !== 'messages' && event !== 'message') {
    return { received: true, ignored: true, reason: 'not_message_event' }
  }

  const message = body?.message || body?.data?.message || body?.data || body
  if (!message || typeof message !== 'object') {
    return { received: true, ignored: true, reason: 'no_message' }
  }

  if (message.wasSentByApi === true) {
    return { received: true, ignored: true, reason: 'sent_by_api' }
  }

  const chatId = String(message.chatid || message.chatId || message.remoteJid || '')
  if (message.isGroup === true || chatId.includes('@g.us') || chatId.includes('@broadcast')) {
    return { received: true, ignored: true, reason: 'group' }
  }

  // UAZAPI may send a privacy-protected LID in sender. chatid contains the real contact JID.
  const phone = normalizePhone(chatId || message.sender || message.from || '')
  if (!phone) {
    return { received: true, ignored: true, reason: 'no_phone' }
  }

  const content = message.content || {}
  const messageText = message.text
    || message.body
    || message.caption
    || content.text
    || content.caption
    || content.conversation
    || ''
  const pushName = message.senderName
    || message.pushName
    || message.chatName
    || body?.senderName
    || ''
  const providerMessageId = message.messageid || message.messageId || message.id || body?.id || null

  const processMessage = message.fromMe === true ? processOutgoingMessage : processIncomingMessage
  const result = await processMessage({
    companyId: empresa.id,
    ownerId: empresa.ownerId,
    phone,
    pushName,
    messageText,
    rawPayload: body,
    origin: 'WhatsApp',
    providerMessageId,
  }, db)

  return { success: true, ...result }
}

async function beginMetaWebhookEvent(
  db: WhatsAppPersistence,
  data: {
    companyId: number
    eventKey: string
    eventType: string
    payload: any
  },
) {
  try {
    await db.whatsAppWebhookEvent.create({
      data: {
        ...data,
        provider: 'meta',
        status: 'processing',
        attempts: 1,
      },
    })
    return true
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
  }

  const existing = await db.whatsAppWebhookEvent.findUnique({
    where: { eventKey: data.eventKey },
    select: { status: true },
  })
  if (existing?.status === 'processed') return false

  await db.whatsAppWebhookEvent.update({
    where: { eventKey: data.eventKey },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
      errorMessage: null,
      processedAt: null,
      payload: data.payload,
    },
  })
  return true
}

async function failMetaWebhookEvent(db: WhatsAppPersistence, eventKey: string, error: unknown) {
  await db.whatsAppWebhookEvent.update({
    where: { eventKey },
    data: {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  }).catch(() => undefined)
}

export async function handleMetaMessages(
  body: any,
  empresaOverride?: { id: number; ownerId: number | null; name: string },
  db: WhatsAppPersistence = prisma,
  dependencies: { resolveMedia?: MetaMediaResolver } = {},
) {
  const summary = { processed: 0, duplicates: 0, ignored: 0 }
  if (!body.entry || !Array.isArray(body.entry)) return summary

  for (const entry of body.entry) {
    const changes = entry.changes || []
    for (const change of changes) {
      const isMessageField = change.field === 'messages'
      const isMessageEchoField = change.field === 'smb_message_echoes'
      if (!isMessageField && !isMessageEchoField) {
        summary.ignored += 1
        continue
      }

      const value = change.value || {}
      const metadata = value.metadata || {}
      const phoneNumberId = metadata.phone_number_id || ''
      const messages = isMessageEchoField
        ? (value.message_echoes || value.smb_message_echoes || value.messages || value.echoes || [])
        : (value.messages || [])
      const statuses = isMessageField ? (value.statuses || []) : []
      const contacts = value.contacts || []
      if (isMessageEchoField) {
        console.info('[Webhook/Meta] Echo recebido', {
          phoneNumberId,
          count: Array.isArray(messages) ? messages.length : 0,
          keys: Object.keys(value),
        })
      }

      let empresa = empresaOverride
      if (!empresa) {
        if (!phoneNumberId) {
          summary.ignored += 1
          continue
        }
        empresa = await findCompanyByMetaPhoneId(phoneNumberId, db)
        if (!empresa) {
          console.warn(`[Webhook/Meta] phone_number_id "${phoneNumberId}" nao pertence a uma clinica ativa.`)
          summary.ignored += 1
          continue
        }
      }

      for (const statusEvent of statuses) {
        const providerMessageId = String(statusEvent?.id || '')
        if (!providerMessageId) continue
        const status = String(statusEvent?.status || '').toLowerCase()
        const eventKey = `meta:status:${providerMessageId}:${status}:${statusEvent?.timestamp || ''}`
        const shouldProcess = await beginMetaWebhookEvent(db, {
          companyId: empresa.id,
          eventKey,
          eventType: `message.${status}`,
          payload: statusEvent,
        })
        if (!shouldProcess) {
          summary.duplicates += 1
          continue
        }

        try {
          const errorInfo = statusEvent?.errors?.[0]
          const errorDetails = errorInfo?.error_data?.details || errorInfo?.details || null
          const errorMessage = [errorInfo?.title || errorInfo?.message || null, errorDetails]
            .filter(Boolean)
            .join(': ')
          await updateWhatsAppMessageStatus({
            providerMessageId,
            status,
            errorCode: errorInfo?.code ? String(errorInfo.code) : null,
            errorMessage: errorMessage || null,
            occurredAt: statusEvent?.timestamp
              ? new Date(Number(statusEvent.timestamp) * 1000)
              : new Date(),
          })
          await db.whatsAppWebhookEvent.update({
            where: { eventKey },
            data: { status: 'processed', processedAt: new Date(), errorMessage: null },
          })
          summary.processed += 1
        } catch (error) {
          await failMetaWebhookEvent(db, eventKey, error)
          throw error
        }
      }

      for (const msg of messages) {
        if (msg.type === 'status') continue

        const outgoingPhone = getMetaEchoPhone(msg, contacts)
        const incomingPhone = normalizePhone(msg.from || '')
        const phone = isMessageEchoField ? outgoingPhone : incomingPhone
        if (!phone) {
          console.warn('[Webhook/Meta] Mensagem sem telefone de contato.', {
            field: change.field,
            messageId: msg.id || null,
            messageKeys: Object.keys(msg || {}),
            contacts,
          })
          summary.ignored += 1
          continue
        }

        const eventDirection = isMessageEchoField ? 'echo' : 'message'
        const eventKey = `meta:${eventDirection}:${msg.id || `${phone}:${msg.timestamp || ''}`}`
        const shouldProcess = await beginMetaWebhookEvent(db, {
          companyId: empresa.id,
          eventKey,
          eventType: isMessageEchoField ? 'message.sent_from_phone' : 'message.received',
          payload: msg,
        })
        if (!shouldProcess) {
          summary.duplicates += 1
          continue
        }

        try {
          const contactInfo = contacts.find((contact: any) => normalizePhone(contact.wa_id) === phone)
          const pushName = contactInfo?.profile?.name || ''
          const avatarUrl = getMetaContactAvatar(contactInfo, msg)
          const messageText = getMetaText(msg)
          const mediaDescriptor = getMetaMediaDescriptor(msg)
          const attachment = mediaDescriptor
            ? await (dependencies.resolveMedia || resolveMetaMedia)({
              companyId: empresa.id,
              ...mediaDescriptor,
            })
            : null

          const processMessage = isMessageEchoField ? processOutgoingMessage : processIncomingMessage
          const result = await processMessage({
            companyId: empresa.id,
            ownerId: empresa.ownerId,
            phone,
            pushName,
            messageText,
            rawPayload: msg,
            origin: 'WhatsApp Official',
            providerMessageId: msg.id || null,
            mediaUrl: attachment?.mediaUrl || null,
            mediaType: attachment?.mediaType || null,
            providerMediaType: mediaDescriptor?.providerMediaType || null,
            messageAt: getMetaTimestamp(msg),
            avatarUrl,
          }, db)
          if (result.action === 'ignored') {
            throw new Error(`Mensagem ignorada: ${result.reason || 'motivo desconhecido'}.`)
          }
          await db.whatsAppWebhookEvent.update({
            where: { eventKey },
            data: { status: 'processed', processedAt: new Date(), errorMessage: null },
          })
          console.log(`[Webhook/Meta] Mensagem ${msg.id || eventKey} salva na clinica #${empresa.id}.`)
          summary.processed += 1
        } catch (error) {
          await failMetaWebhookEvent(db, eventKey, error)
          throw error
        }
      }
    }
  }

  return summary
}
