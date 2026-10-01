import type { RequestHandler } from 'express'
import { localMediaPath, signMediaPayload, signMediaUrl, verifyMediaLink } from '../services/media-access.js'

const mediaKeys = new Set(['mediaUrl', 'url', 'publicPath', 'photoUrl', 'avatar', 'logoUrl'])

export function signResponseMedia(value: unknown, companyId: number, key = ''): unknown {
  if (typeof value === 'string' && mediaKeys.has(key)) {
    if (key === 'mediaUrl' && value.startsWith('[')) return signMediaPayload(value, companyId)
    const media = localMediaPath(value)
    return media?.companyId === companyId ? signMediaUrl(value, companyId) : value
  }
  if (Array.isArray(value)) return value.map(item => signResponseMedia(item, companyId, key))
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return value
  return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, signResponseMedia(child, companyId, name)]))
}

export const refreshResponseMedia: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res)
  res.json = body => json(req.user?.companyId ? signResponseMedia(body, req.user.companyId) : body)
  next()
}

export const protectStoredMedia: RequestHandler = (req, res, next) => {
  // Temporary converter inputs and dotfiles must never be served.
  if (req.path.includes('.source.') || req.path.split('/').some(part => part.startsWith('.'))) return void res.sendStatus(404)
  if (!req.path.startsWith('/media/')) return next() // Existing public logos/profile images.
  if (!verifyMediaLink(`/uploads${req.path}`, req.query.expires, req.query.mediaSignature)) return void res.sendStatus(403)
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
}
