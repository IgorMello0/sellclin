import type { RequestHandler } from 'express'
import manifest from '../config/route-manifest.json' with { type: 'json' }
import { auth, requireCompany } from './auth.js'
import { createErrorResponse } from '../utils/response.js'

// Public means no browser session; providers/signatures/OAuth state are checked
// inside their handlers. Never exempt an entire router or URL prefix.
export const SESSION_EXCEPTIONS = new Set([
  'GET /api/health', 'GET /api/billing/catalog', 'POST /api/billing/signup-checkout',
  'POST /api/profissionais', 'POST /api/profissionais/login', 'POST /api/usuarios/login',
  'POST /api/auth/forgot-password', 'POST /api/auth/google', 'POST /api/auth/resend-verification',
  'POST /api/auth/reset-password', 'POST /api/auth/team-invite/accept', 'GET /api/auth/verify-email',
  'GET /api/google-calendar/callback', 'GET /api/whatsapp/meta/callback',
  'GET /api/campaigns/media/:campaignId/:index',
  'POST /api/webhooks/abacate-pay', 'POST /api/webhooks/evolution',
  'POST /api/webhooks/evolution/:token', 'POST /api/webhooks/uazapi/:token',
  'POST /api/webhooks/leads/:apiKey', 'GET /api/webhooks/meta', 'POST /api/webhooks/meta',
  'GET /api/webhooks/meta/:token', 'POST /api/webhooks/meta/:token',
])
const routes = manifest.map(route => ({ ...route, pattern: new RegExp('^' + route.path.split('/').map(part => part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$', 'i') }))
const authenticate = auth()

export const routePolicy: RequestHandler = (req, res, next) => {
  if (!/^\/api(?:\/|$)/i.test(req.path)) return next()
  const method = req.method === 'HEAD' ? 'GET' : req.method
  const route = routes.find(route => route.method === method && route.pattern.test(req.path))
  if (!route) return void res.status(404).json(createErrorResponse('Rota não encontrada', 404))
  if (SESSION_EXCEPTIONS.has(`${route.method} ${route.path}`)) return next()
  return authenticate(req, res, error => error ? next(error) : requireCompany(req, res, next))
}
