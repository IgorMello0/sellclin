import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Express } from 'express'
import type { CorsOptions } from 'cors'
import rateLimit from 'express-rate-limit'
import { createErrorResponse } from '../utils/response.js'

export function corsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const origins = new Set(['https://sellclin.com', 'https://www.sellclin.com'])
  for (const value of [env.PUBLIC_APP_URL, ...(env.CORS_ALLOWED_ORIGINS || '').split(',')]) {
    if (value?.trim()) origins.add(new URL(value.trim()).origin)
  }
  return {
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true)
      if (env.NODE_ENV !== 'production') {
        try {
          const url = new URL(origin)
          if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return callback(null, true)
        } catch { /* Reject malformed origins. */ }
      }
      callback(Object.assign(new Error('Origem não autorizada'), { status: 403 }))
    },
  }
}

export function verifyMetaBody(rawBody: unknown, signature: unknown, secret: string | undefined): boolean {
  if (!secret || typeof rawBody !== 'string' || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), expected)
}

export function installAuthLimits(app: Express, limits = { loginIp: 30, loginAccount: 10, emailIp: 20, emailAccount: 3, tokenIp: 20 }) {
  const limiter = (limit: number, account = false) => rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(account ? {
      keyGenerator: (req) => createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex'),
      skip: (req) => typeof req.body?.email !== 'string' || !req.body.email.trim(),
    } : {}),
    handler: (_req, res) => res.status(429).json(createErrorResponse('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429)),
  })
  app.post(['/api/profissionais/login', '/api/usuarios/login'], limiter(limits.loginIp), limiter(limits.loginAccount, true))
  app.post(['/api/auth/forgot-password', '/api/auth/resend-verification'], limiter(limits.emailIp), limiter(limits.emailAccount, true))
  app.post(['/api/auth/reset-password', '/api/auth/team-invite/accept', '/api/auth/google'], limiter(limits.tokenIp))
}
