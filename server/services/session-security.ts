import jwt from 'jsonwebtoken'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function passwordSessionStamp(passwordHash: string, secret: string) {
  return createHmac('sha256', secret).update('sellclin-session-v1\0').update(passwordHash).digest('hex')
}

export function isCurrentPasswordSession(stamp: unknown, passwordHash: string, secret: string) {
  if (typeof stamp !== 'string' || !/^[a-f0-9]{64}$/.test(stamp)) return false
  return timingSafeEqual(Buffer.from(stamp, 'hex'), Buffer.from(passwordSessionStamp(passwordHash, secret), 'hex'))
}

export function verifySessionToken(token: string, secret: string) {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
  if (typeof payload === 'string' || !Number.isSafeInteger(payload.id) || payload.id <= 0 ||
      !['profissional', 'usuario', 'cliente'].includes(payload.type) || typeof payload.exp !== 'number') {
    throw new Error('Token inválido')
  }
  return payload
}

export async function claimEmailToken(
  id: number,
  type: string,
  claim: (where: { id: number; type: string; usedAt: null; expiresAt: { gt: Date } }, usedAt: Date) => Promise<{ count: number }>,
) {
  const now = new Date()
  const result = await claim({ id, type, usedAt: null, expiresAt: { gt: now } }, now)
  if (result.count !== 1) throw new Error('Link invalido ou ja utilizado.')
}
