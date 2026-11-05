import { Router } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { generateBotDecision, BotProviderError, providerErrorMessage } from '../services/bot-provider.js'
import { prepareBotTurn } from '../services/bot-turn.js'
import { canCompanyAccessModule } from '../services/billing.js'

export const router = Router()
router.use(auth(), requireModule('conversas'))
const manage = requireCompanyOwner()
const aiLimit = rateLimit({ windowMs: 60000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => `bot:${req.user?.companyId || req.user?.id}`, message: createErrorResponse('Limite de testes atingido. Tente novamente em um minuto.', 429) })
const agentSchema = z.object({ name: z.string().trim().min(1).max(120), basePrompt: z.string().trim().min(1).max(20000), temperature: z.number().min(0).max(2).default(0.7), mode: z.string().max(40).nullable().optional() })
const configSchema = z.object({ provider: z.enum(['openai', 'anthropic']), model: z.string().trim().min(1).max(150), apiKey: z.string().trim().max(1000).optional(), removeKey: z.boolean().optional(),
  knowledge: z.string().max(40000).default(''), maxResponses: z.number().int().min(1).max(100).default(10), dailyLimit: z.number().int().min(1).max(10000).default(200),
  qualificationFields: z.array(z.string().trim().min(1).max(60)).max(12).default(['nome', 'email', 'interesse']), handoffTerms: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  qualifyEnabled: z.boolean().default(true), bookingEnabled: z.boolean().default(true), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: v }); return true } catch { return false } }).default('America/Sao_Paulo'),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
})
const historySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(16)
const clinic = (req: any) => Number(req.user?.companyId) || -1
const safeConfig = (c: any) => c ? { provider: c.provider, model: c.model, knowledge: c.knowledge, maxResponses: c.maxResponses, dailyLimit: c.dailyLimit,
  qualificationFields: c.qualificationFields || ['nome', 'email', 'interesse'], handoffTerms: c.handoffTerms || [], qualifyEnabled: c.qualifyEnabled, bookingEnabled: c.bookingEnabled,
  timezone: c.timezone, workingDays: c.workingDays || [1, 2, 3, 4, 5], hasApiKey: Boolean(c.apiKey), verifiedAt: c.verifiedAt, playgroundAt: c.playgroundAt } : null
router.param('id', async (req, res, next, value) => {
  if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(404).json(createErrorResponse('Bot não encontrado', 404))
  const agent = await prisma.agenteIa.findFirst({ where: { id: Number(value), companyId: clinic(req) } })
  if (!agent) return res.status(404).json(createErrorResponse('Bot não encontrado', 404))
  res.locals.bot = agent; next()
})
router.get('/', async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const where = { companyId: clinic(req) }
  const [items, total] = await Promise.all([prisma.agenteIa.findMany({ skip, take, where, orderBy: { updatedAt: 'desc' } }), prisma.agenteIa.count({ where })])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})
router.get('/:id', (req, res) => { res.json(createSuccessResponse(res.locals.bot)) })
router.post('/', manage, async (req, res) => {
  const parsed = agentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(createErrorResponse('Informe nome e instruções válidos.', 400))
  const item = await prisma.agenteIa.create({ data: { ...parsed.data, name: parsed.data.name!, basePrompt: parsed.data.basePrompt!, companyId: clinic(req), isActive: false } })
  res.status(201).json(createSuccessResponse(item))
})
router.put('/:id', manage, async (req, res) => {
  if (req.body.isActive === true) return res.status(409).json(createErrorResponse('Teste e ative o bot pela ação Ativar.', 409))
  const parsed = agentSchema.safeParse({ ...res.locals.bot, ...req.body })
  if (!parsed.success) return res.status(400).json(createErrorResponse('Informe nome e instruções válidos.', 400))
  const updated = await prisma.$transaction(async tx => {
    const item = await tx.agenteIa.update({ where: { id: res.locals.bot.id }, data: { ...parsed.data, isActive: false } })
    if (req.body.basePrompt !== undefined) await tx.botConfiguracao.updateMany({ where: { agentId: item.id }, data: { playgroundAt: null } })
    return item
  })
  res.json(createSuccessResponse(updated))
})
router.post('/:id/ativar', manage, async (req, res) => {
  if (req.body?.approveCosts !== true) return res.status(400).json(createErrorResponse('Confirme o provedor, o custo da sua chave e as respostas do Playground.', 400))
  const readiness: any[] = await prisma.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'agentes_ia_um_ativo_por_clinica') AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'sellclin_bot_message_received' AND NOT tgisinternal) AS ready`
  if (!readiness[0]?.ready) return res.status(503).json(createErrorResponse('Aplique a migração dos bots antes de ativar o atendimento.', 503))
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${clinic(req)} FOR UPDATE`
    const agent = await tx.agenteIa.findFirst({ where: { id: res.locals.bot.id, companyId: clinic(req) }, include: { configuracao: true } })
    const config = agent?.configuracao
    if (!config?.apiKey || !config.verifiedAt || !config.playgroundAt) return null
    const company = await tx.empresa.findUnique({ where: { id: clinic(req) }, select: { whatsappProvider: true } })
    if (!['meta', 'uazapi'].includes(company?.whatsappProvider || '')) return null
    await tx.agenteIa.updateMany({ where: { companyId: clinic(req), isActive: true }, data: { isActive: false } })
    return tx.agenteIa.update({ where: { id: agent!.id }, data: { isActive: true, activatedAt: new Date() } })
  })
  if (!result) return res.status(409).json(createErrorResponse('Configure Meta ou Uazapi, teste a chave e uma conversa no Playground antes de ativar.', 409))
  res.json(createSuccessResponse(result))
})
router.post('/:id/duplicate', manage, async (req, res) => {
  const original = res.locals.bot
  const copy = await prisma.$transaction(async tx => {
    const item = await tx.agenteIa.create({ data: { companyId: clinic(req), name: `${original.name.slice(0, 110)} (cópia)`, basePrompt: original.basePrompt, temperature: original.temperature, mode: original.mode, isActive: false } })
    const config = await tx.botConfiguracao.findUnique({ where: { agentId: original.id } })
    if (config) {
      const { agentId, updatedAt, verifiedAt, playgroundAt, qualificationFields, handoffTerms, workingDays, ...settings } = config
      await tx.botConfiguracao.create({ data: { ...settings, agentId: item.id, qualificationFields: qualificationFields || [], handoffTerms: handoffTerms || [], workingDays: workingDays || [1, 2, 3, 4, 5] } })
    }
    return item
  })
  res.status(201).json(createSuccessResponse(copy))
})
router.get('/:id/configuracao', manage, async (_req, res) => {
  res.json(createSuccessResponse(safeConfig(await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } }))))
})
router.put('/:id/configuracao', manage, async (req, res) => {
  const parsed = configSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(createErrorResponse('Confira modelo, limites, campos e fuso horário.', 400))
  const { apiKey, removeKey, ...settings } = parsed.data
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM agentes_ia WHERE id = ${res.locals.bot.id} FOR UPDATE`
    const previous = await tx.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } })
    const reset = Boolean(apiKey || removeKey || previous?.provider !== settings.provider || previous?.model !== settings.model)
    const keyChange = removeKey || previous && previous.provider !== settings.provider && !apiKey ? { apiKey: null } : apiKey ? { apiKey } : {}
    const data = { ...settings, ...keyChange, playgroundAt: null, ...(reset ? { verifiedAt: null } : {}) }
    await tx.botConfiguracao.upsert({ where: { agentId: res.locals.bot.id }, create: { agentId: res.locals.bot.id, ...data }, update: data })
    await tx.agenteIa.update({ where: { id: res.locals.bot.id }, data: { isActive: false } })
  })
  res.json(createSuccessResponse({ saved: true }))
})
router.post('/:id/test-key', manage, aiLimit, async (_req, res) => {
  const config = await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } })
  if (!config?.apiKey) return res.status(409).json(createErrorResponse('Salve uma chave primeiro.', 409))
  try {
    const usage = await generateBotDecision({ ...config, apiKey: config.apiKey, prompt: 'Teste de conexão', knowledge: '' }, [{ role: 'user', content: 'Olá' }])
    await prisma.botRun.create({ data: { companyId: res.locals.bot.companyId, agentId: config.agentId, mode: 'key_test', status: 'sent', inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } })
    const result = await prisma.botConfiguracao.updateMany({ where: { agentId: config.agentId, updatedAt: config.updatedAt }, data: { verifiedAt: new Date() } })
    if (!result.count) return res.status(409).json(createErrorResponse('A configuração mudou durante o teste. Teste novamente.', 409))
    res.json(createSuccessResponse({ verified: true }))
  } catch (error) { res.status(502).json(createErrorResponse(providerErrorMessage(error instanceof BotProviderError ? error.code : ''), 502)) }
})
router.post('/:id/playground', manage, aiLimit, async (req, res) => {
  const message = z.string().trim().min(1).max(4000).safeParse(req.body.message)
  const history = historySchema.safeParse(req.body.history || [])
  if (!message.success || !history.success || JSON.stringify(req.body.state || {}).length > 16000) return res.status(400).json(createErrorResponse('Mensagem ou histórico inválido.', 400))
  const config = await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } })
  if (!config?.apiKey || !config.verifiedAt) return res.status(409).json(createErrorResponse('Salve a configuração e teste a chave primeiro.', 409))
  if (config.bookingEnabled && !(await canCompanyAccessModule(clinic(req), 'agendamentos')).hasAccess) config.bookingEnabled = false
  if (config.qualifyEnabled && !(await canCompanyAccessModule(clinic(req), 'funnel')).hasAccess) config.qualifyEnabled = false
  const started = Date.now()
  try {
    const result = await prepareBotTurn({ agent: res.locals.bot, config, companyId: clinic(req), message: message.data, history: history.data.map(h => ({ role: h.role!, content: h.content! })), state: req.body.state || {}, responseCount: history.data.filter(h => h.role === 'assistant').length })
    if (result.confirmSlot) { result.reply = `[Simulação] Agendamento confirmado: ${result.confirmSlot.label}. Nenhum agendamento foi gravado.`; result.state = {} }
    await prisma.botRun.create({ data: { companyId: clinic(req), agentId: res.locals.bot.id, mode: 'playground', status: 'sent', inputTokens: result.inputTokens, outputTokens: result.outputTokens, durationMs: Date.now() - started, errorCode: result.handoff } })
    await prisma.botConfiguracao.updateMany({ where: { agentId: config.agentId, updatedAt: config.updatedAt }, data: { playgroundAt: new Date() } })
    res.json(createSuccessResponse({ reply: result.reply, state: result.state, handoff: result.handoff, collected: result.fields }))
  } catch (error) {
    await prisma.botRun.create({ data: { companyId: clinic(req), agentId: res.locals.bot.id, mode: 'playground', status: 'failed', errorCode: 'provider_error', durationMs: Date.now() - started } })
    res.status(502).json(createErrorResponse(providerErrorMessage(error instanceof BotProviderError ? error.code : ''), 502))
  }
})
router.get('/:id/usage', manage, async (req, res) => {
  const where = { companyId: clinic(req), agentId: res.locals.bot.id, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }
  const [totals, runs] = await Promise.all([prisma.botRun.aggregate({ where, _count: true, _sum: { inputTokens: true, outputTokens: true } }), prisma.botRun.findMany({ where, orderBy: { id: 'desc' }, take: 50 })])
  res.json(createSuccessResponse({ totals, runs }))
})
router.delete('/:id', manage, async (_req, res) => {
  const id = res.locals.bot.id
  await prisma.$transaction(async tx => {
    await tx.agenteIa.update({ where: { id }, data: { isActive: false } })
    await tx.botRun.updateMany({ where: { agentId: id, status: 'pending' }, data: { status: 'skipped', errorCode: 'bot_deleted' } })
    await tx.conversa.updateMany({ where: { agentId: id }, data: { agentId: null } })
    await tx.agenteIa.delete({ where: { id } })
  })
  res.json(createSuccessResponse({ id }))
})
router.use((error: any, _req: any, res: any, _next: any) => {
  const schemaMissing = ['P2021', 'P2022'].includes(error?.code)
  res.status(schemaMissing ? 503 : 500).json(createErrorResponse(schemaMissing ? 'Aplique a migração dos bots no banco antes de usar esta página.' : 'Não foi possível salvar a configuração do bot. Confira também a chave de criptografia do servidor.', schemaMissing ? 503 : 500))
})
