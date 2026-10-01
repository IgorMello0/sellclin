import { createHmac, timingSafeEqual } from 'node:crypto'
import { getJwtSecret } from '../config/security.js'

export const MEDIA_LINK_SECONDS = 24 * 60 * 60
const mediaPattern = /^\/uploads\/media\/([1-9]\d*)\/([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|gif|webp|mp4|3gp|m4a|mp3|aac|ogg|opus|webm|wav))$/

export function localMediaPath(value: string): { path: string; companyId: number } | null {
  let pathname = value
  if (!value.startsWith('/')) {
    let url: URL
    try { url = new URL(value) } catch { return null }
    const origins = new Set(['https://sellclin.com', 'https://www.sellclin.com'])
    for (const configured of [process.env.PUBLIC_APP_URL, process.env.APP_URL, process.env.FRONTEND_URL]) {
      if (configured) origins.add(new URL(configured).origin)
    }
    const development = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!origins.has(url.origin) && !development) return null
    pathname = url.pathname
  } else {
    pathname = value.split('?')[0]
  }
  const match = mediaPattern.exec(pathname)
  return match ? { path: pathname, companyId: Number(match[1]) } : null
}

function signature(pathname: string, expires: number, secret: string) {
  return createHmac('sha256', secret).update(`sellclin-media-v1\0${pathname}\0${expires}`).digest('hex')
}

export function signMediaUrl(value: string, companyId: number, secret = getJwtSecret(), now = Date.now()) {
  const media = localMediaPath(value)
  if (!media) return value
  if (media.companyId !== companyId) throw new Error('Mídia não pertence à clínica ativa')
  const expires = Math.floor(now / 1000) + MEDIA_LINK_SECONDS
  const url = new URL(value, process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || 'https://sellclin.com')
  url.searchParams.set('expires', String(expires))
  url.searchParams.set('mediaSignature', signature(media.path, expires, secret))
  return value.startsWith('/') ? `${url.pathname}${url.search}` : url.toString()
}

export function verifyMediaLink(pathname: string, expiresValue: unknown, token: unknown, secret = getJwtSecret(), now = Date.now()) {
  if (!mediaPattern.test(pathname) || typeof expiresValue !== 'string' || !/^\d+$/.test(expiresValue) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false
  const expires = Number(expiresValue)
  const current = Math.floor(now / 1000)
  if (!Number.isSafeInteger(expires) || expires <= current || expires > current + MEDIA_LINK_SECONDS) return false
  return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(signature(pathname, expires, secret), 'hex'))
}

export function signMediaPayload(value: string, companyId: number): string {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { return signMediaUrl(value, companyId) }
  if (!Array.isArray(parsed)) return signMediaUrl(value, companyId)
  return JSON.stringify(parsed.map(item => item && typeof item.url === 'string' ? { ...item, url: signMediaUrl(item.url, companyId) } : item))
}
