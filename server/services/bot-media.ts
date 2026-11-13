import fs from 'node:fs/promises'
import path from 'node:path'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { integrationHttpClient } from './integration-http.js'
import { publicMediaClient } from './public-download.js'
import { localMediaPath, signMediaUrl } from './media-access.js'

export type BotMedia = { content_type: 'audio' | 'image' | 'video' | 'document' | 'sticker'; base64: string; encoding: 'base64'; file_size: number; content_url: string; mime_type: string; file_name: string }
export const MAX_BOT_MEDIA_BYTES = 10 * 1024 * 1024
const formats: Record<string, string> = {
  'audio/amr': 'amr', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'audio/opus': 'opus', 'audio/wav': 'wav', 'audio/webm': 'webm',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'application/pdf': 'pdf',
}
const matchesType = (mime: string, type: BotMedia['content_type']) => type === 'document' ? mime === 'application/pdf' : mime.startsWith(`${type === 'sticker' ? 'image' : type}/`)
const mimeFor = (url: string, type: BotMedia['content_type']) => Object.entries(formats).find(([mime, ext]) => matchesType(mime, type) && url.split('?')[0].endsWith(`.${ext}`))?.[0]
const encoded = (buffer: Buffer) => {
  if (!buffer.length || buffer.length > MAX_BOT_MEDIA_BYTES) throw new Error('bot_media_too_large_or_empty')
  return { base64: buffer.toString('base64'), encoding: 'base64' as const, file_size: buffer.length }
}
export const botMediaDependencies = { read: async (file: string) => {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > MAX_BOT_MEDIA_BYTES || !stat.size) throw new Error('bot_media_too_large_or_empty')
    const buffer = Buffer.alloc(stat.size + 1)
    let total = 0
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total)
      if (!bytesRead) break
      total += bytesRead
    }
    if (total !== stat.size) throw new Error('bot_media_changed')
    return buffer.subarray(0, total)
  } finally { await handle.close() }
}, fetch: integrationHttpClient.fetch, download: publicMediaClient.download, write: async (file: string, data: Buffer) => {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, data, { flag: 'wx' })
} }

export function botMediaType(message: any): BotMedia['content_type'] | null {
  const raw = message.rawJson || {}
  const source = raw.message || raw.data?.message || raw.data || raw
  const declared = String(raw.mediaType || raw.providerMediaType || source.mediaType || source.messageType || source.type || '').toLowerCase()
  const mimeHint = String(source.content?.mimetype || source.mimetype || '').toLowerCase()
  if (/sticker/.test(String(raw.providerMediaType || '')) || raw.isSticker === true || /sticker/.test(declared)) return 'sticker'
  return /audio|ptt|voice/.test(declared) || mimeHint.startsWith('audio/') ? 'audio'
    : /image|sticker/.test(declared) ? 'image' : /video/.test(declared) ? 'video' : /document/.test(declared) ? 'document' : null
}

// Resolve provider media in the backend. Only decoded file bytes and a signed local URL reach n8n;
// neither provider credentials nor encrypted WhatsApp URLs leave this boundary.
export async function resolveBotMedia(message: any, companyId: number, db: any, deps = botMediaDependencies): Promise<BotMedia | null> {
  const raw = message.rawJson || {}
  const source = raw.message || raw.data?.message || raw.data || raw
  const type = botMediaType(message)
  if (!type) return null
  const stored = typeof raw.mediaUrl === 'string' ? localMediaPath(raw.mediaUrl) : null
  if (stored) {
    if (stored.companyId !== companyId) throw new Error('bot_media_wrong_clinic')
    const mime = mimeFor(stored.path, type)
    if (!mime || !matchesType(mime, type)) throw new Error('bot_media_invalid_type')
    const buffer = await deps.read(path.join(process.cwd(), ...stored.path.split('/').filter(Boolean)))
    const base = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://sellclin.com'
    return { ...encoded(buffer), content_type: type, content_url: new URL(signMediaUrl(stored.path, companyId), base).toString(), mime_type: mime, file_name: path.posix.basename(stored.path) }
  }
  const company = await db.empresa.findUnique({ where: { id: companyId }, select: { whatsappProvider: true, uazapiToken: true } })
  const id = source.id || source.messageid || source.messageId || message.providerMessageId
  const base = process.env.UAZAPI_API_URL || process.env.UAZAPI_BASE_URL
  if (company?.whatsappProvider !== 'uazapi' || !company.uazapiToken || !id || !base) throw new Error('bot_media_unavailable')
  const configuredBase = /^https?:\/\//i.test(base) ? base : `https://${base}`
  const endpoint = new URL(`${configuredBase.replace(/\/$/, '')}/message/download`)
  const response = await deps.fetch(endpoint.toString(), {
    method: 'POST', headers: { 'Content-Type': 'application/json', token: company.uazapiToken },
    body: JSON.stringify({ id, return_link: true, return_base64: false, ...(type === 'audio' ? { generate_mp3: true } : {}) }),
  })
  if (!response.ok) throw new Error('bot_media_download_failed')
  const result: any = await response.json()
  if (typeof result.fileURL !== 'string') throw new Error('bot_media_download_failed')
  const file = await deps.download(result.fileURL, { maxBytes: MAX_BOT_MEDIA_BYTES, httpsOnly: true, timeoutMs: 30_000 })
  const mime = String(file.headers['content-type'] || result.mimetype || '').split(';')[0].trim().toLowerCase()
  const extension = formats[mime]
  if (!extension || !matchesType(mime, type) || !file.buffer.length || file.buffer.length > MAX_BOT_MEDIA_BYTES) throw new Error('bot_media_invalid_type')
  const data = encoded(file.buffer)
  const name = `${randomUUID()}.${extension}`
  const storedPath = `/uploads/media/${companyId}/${name}`
  await deps.write(path.join(process.cwd(), 'uploads', 'media', String(companyId), name), file.buffer)
  const app = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://sellclin.com'
  return { ...data, content_type: type, content_url: new URL(signMediaUrl(storedPath, companyId), app).toString(), mime_type: mime, file_name: name }
}
