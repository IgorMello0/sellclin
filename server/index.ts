import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { refreshResponseMedia, protectStoredMedia } from './middleware/media-access.js'
import { protectIntegrationOutput } from './middleware/integration-output.js'
import { corsOptions, installAuthLimits } from './middleware/public-security.js'
import { json, urlencoded } from 'express'
import { assertProductionSecurityConfig } from './config/security.js'
import { router as professionalsRouter } from './routes/professionals.js'
import { router as clientsRouter } from './routes/clients.js'
import { router as categoriesRouter } from './routes/categories.js'
import { router as catalogItemsRouter } from './routes/catalog-items.js'
import { router as appointmentsRouter } from './routes/appointments.js'
import { router as paymentsRouter } from './routes/payments.js'
import { router as fichaTemplatesRouter } from './routes/ficha-templates.js'
import { router as fichasRouter } from './routes/fichas.js'
import { router as empresasRouter } from './routes/empresas.js'
import { router as usuariosRouter } from './routes/usuarios.js'
import { router as agentesIaRouter } from './routes/agentes-ia.js'
import { router as conversasRouter } from './routes/conversas.js'
import { router as mensagensRouter } from './routes/mensagens.js'
import { router as uploadRouter } from './routes/upload.js'
import { router as modulesRouter } from './routes/modules.js'
import { router as permissionsRouter } from './routes/permissions.js'
import { router as dashboardRouter } from './routes/dashboard.js'
import { router as leadsRouter } from './routes/leads.js'
import { router as metasRouter } from './routes/metas.js'
import { router as webhooksRouter } from './routes/webhooks.js'
import { router as rolesRouter } from './routes/roles.js'
import { router as funnelConfigRouter } from './routes/funnelConfig.js'
import { router as notificationsRouter } from './routes/notifications.js'
import { router as tasksRouter } from './routes/tasks.js'
import { router as campaignsRouter, resumeInterruptedCampaigns } from './routes/campaigns.js'
import { router as authRouter } from './routes/auth.js'
import { router as billingRouter } from './routes/billing.js'
import { router as googleCalendarRouter } from './routes/google-calendar.js'
import { router as whatsappMetaRouter } from './routes/whatsapp-meta.js'
import { router as whatsappUazapiRouter } from './routes/whatsapp-uazapi.js'
import { router as whatsappTemplatesRouter } from './routes/whatsapp-templates.js'
import leadStatusesRouter from './routes/lead-statuses.js'
import { router as cadenceRouter } from './routes/cadence.js'
import { createErrorResponse } from './utils/response.js'
import { prisma } from './prisma.js'
import { bootstrapSystemDefaults } from './bootstrap/defaults.js'
import { expirePastDueBillingRecords } from './services/billing.js'
import path from 'path'
import rateLimit from 'express-rate-limit'

assertProductionSecurityConfig()

const app = express()

// Traefik and Nginx run on private Docker networks. Trusting only private proxy
// hops lets rate limiting use the real client IP from X-Forwarded-For.
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])

// Basic Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl === '/api/health' || req.originalUrl.startsWith('/api/webhooks/'),
  handler: (_req, res) => {
    res.status(429).json(createErrorResponse('Muitas requisicoes. Aguarde um instante e tente novamente.', 429))
  },
})

app.use(cors(corsOptions()))
app.disable('x-powered-by')
app.use(apiLimiter)
app.use('/api/webhooks', rateLimit({
  windowMs: 60_000, limit: 3000, standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json(createErrorResponse('Muitas requisições. Tente novamente em um minuto.', 429)),
}))
app.use(json({
  limit: '20mb',
  verify: (req, _res, buffer) => {
    ;(req as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8')
  },
}))
app.use(urlencoded({ limit: '20mb', extended: true }))
installAuthLimits(app)
app.use(protectIntegrationOutput)
app.use(refreshResponseMedia)


app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ success: true, data: { status: 'ok', database: 'connected' } })
  } catch (error) {
    console.error('[health] database unavailable:', error)
    res.status(503).json(createErrorResponse('Banco de dados indisponivel', 503))
  }
})

app.use('/api/profissionais', professionalsRouter)
app.use('/api/clientes', clientsRouter)
app.use('/api/categorias', categoriesRouter)
app.use('/api/catalogo', catalogItemsRouter)
app.use('/api/agendamentos', appointmentsRouter)
app.use('/api/pagamentos', paymentsRouter)
app.use('/api/ficha-templates', fichaTemplatesRouter)
app.use('/api/fichas', fichasRouter)
app.use('/api/empresas', empresasRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/agentes-ia', agentesIaRouter)
app.use('/api/conversas', conversasRouter)
app.use('/api/mensagens', mensagensRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/modules', modulesRouter)
app.use('/api/permissions', permissionsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/metas', metasRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/funnel-config', funnelConfigRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/auth', authRouter)
import { leadOriginsRouter } from './routes/lead-origins.js'

app.use('/api/billing', billingRouter)
app.use('/api/google-calendar', googleCalendarRouter)
app.use('/api/whatsapp/meta', whatsappMetaRouter)
app.use('/api/whatsapp/uazapi', whatsappUazapiRouter)
app.use('/api/whatsapp/templates', whatsappTemplatesRouter)
app.use('/api/lead-statuses', leadStatusesRouter)
app.use('/api/lead-origins', leadOriginsRouter)
app.use('/api/cadence', cadenceRouter)
// Servir arquivos estáticos da pasta uploads
app.use('/uploads', protectStoredMedia, express.static(path.join(process.cwd(), 'uploads'), { dotfiles: 'deny' }))

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599 ? err.status : 500
  console.error('[server] request failed:', err)
  const message = status === 403 ? 'Acesso não autorizado' : status === 413 ? 'Conteúdo muito grande' : status < 500 ? 'Requisição inválida' : 'Erro interno'
  res.status(status).json(createErrorResponse(message, status))
})

const port = process.env.PORT || 4000

async function startServer() {
  await bootstrapSystemDefaults(prisma)

  await expirePastDueBillingRecords().catch((error) => {
    console.error('[billing] initial expiration reconciliation failed:', error)
  })
  setInterval(() => {
    void expirePastDueBillingRecords().catch((error) => {
      console.error('[billing] scheduled expiration reconciliation failed:', error)
    })
  }, 15 * 60_000).unref()

  await resumeInterruptedCampaigns().catch((error) => {
    console.error('[campaigns] initial resume failed:', error)
  })
  setInterval(() => {
    void resumeInterruptedCampaigns().catch((error) => console.error('[campaigns] scheduled resume failed:', error))
  }, 60_000).unref()

  app.listen(Number(port), '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://0.0.0.0:${port}`)
  })
}
// No Vercel (serverless), o app é exportado sem listen.
// Em todos os outros ambientes (Docker, dev local), o servidor escuta normalmente.
if (!process.env.VERCEL) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[server] failed to start:', error)
    process.exit(1)
  })
}

export default app
