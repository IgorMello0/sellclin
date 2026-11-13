import { Router } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { generateBotDecision, BotProviderError, providerErrorMessage } from '../services/bot-provider.js'
import { prepareBotTurn } from '../services/bot-turn.js'
import { canCompanyAccessModule } from '../services/billing.js'
import { botConnectionReady, callBotWorkflow, validWorkflowUrl } from '../services/bot-n8n.js'
import { clinicBotSchema, effectiveBotConfig } from '../services/bot-clinic-settings.js'
import { botIdentity } from '../services/bot-identity.js'
import { flowSchema, flowTemplate, validateFlow } from '../services/bot-flow-definition.js'

export const router = Router()
router.use(auth(), requireModule('conversas'))
const manage = requireCompanyOwner()
const aiLimit = rateLimit({ windowMs: 60000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => `bot:${req.user?.companyId || req.user?.id}`, message: createErrorResponse('Limite de testes atingido. Tente novamente em um minuto.', 429) })
const agentSchema = z.object({ name: z.string().trim().min(1).max(120), basePrompt: z.string().trim().min(1).max(20000), temperature: z.number().min(0).max(2).default(0.7), mode: z.string().max(40).nullable().optional() })
const configSchema = z.object({ provider: z.enum(['openai', 'anthropic']).default('openai'), model: z.string().trim().max(150).default(''), apiKey: z.string().trim().max(1000).optional(), removeKey: z.boolean().optional(),
  flowDefinition: flowSchema.nullable().optional(),
  executionMode: z.enum(['native', 'n8n']).default('native'), n8nWebhookUrl: z.string().max(2000).optional(), n8nSecret: z.string().trim().max(1000).optional(), removeN8nSecret: z.boolean().optional(), n8nTimeoutSeconds: z.number().int().min(5).max(25).default(20),
  knowledge: z.string().max(40000).default(''), maxResponses: z.number().int().min(1).max(100).default(10), dailyLimit: z.number().int().min(1).max(10000).default(200),
  qualificationFields: z.array(z.string().trim().min(1).max(60)).max(12).default(['nome', 'email', 'interesse']), handoffTerms: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  qualifyEnabled: z.boolean().default(true), bookingEnabled: z.boolean().default(true), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: v }); return true } catch { return false } }).default('America/Sao_Paulo'),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
}).refine(c => c.executionMode === 'n8n' ? validWorkflowUrl(c.n8nWebhookUrl || '') : Boolean(c.model || c.flowDefinition), 'Confira a conexão do bot')
const testPhoneSchema = z.string().trim().regex(/^\d{8,15}$/, 'Informe DDI, DDD e número, somente dígitos.').optional()
const historySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(16)
const clinic = (req: any) => Number(req.user?.companyId) || -1
const safeConfig = (c: any) => c ? { provider: c.provider, model: c.model, knowledge: c.knowledge, maxResponses: c.maxResponses, dailyLimit: c.dailyLimit,
  flowDefinition: c.flowDefinition || null, sharedSettings: Boolean(c.sharedSettings),
  executionMode: c.executionMode || 'native', n8nWebhookUrl: c.n8nWebhookUrl || '', hasN8nSecret: Boolean(c.n8nSecret), n8nTimeoutSeconds: c.n8nTimeoutSeconds || 20,
  qualificationFields: c.qualificationFields || ['nome', 'email', 'interesse'], handoffTerms: c.handoffTerms || [], qualifyEnabled: c.qualifyEnabled, bookingEnabled: c.bookingEnabled,
  timezone: c.timezone, workingDays: c.workingDays || [1, 2, 3, 4, 5], hasApiKey: Boolean(c.apiKey), verifiedAt: c.verifiedAt, playgroundAt: c.playgroundAt } : null
// Static routes precede /:id so settings can be configured before the first flow.
router.get('/settings', manage, async (req, res) => {
  const row = await prisma.botClinicSettings.findUnique({ where: { companyId: clinic(req) } })
  res.json(createSuccessResponse({ ...clinicBotSchema.parse(row?.settings || {}), hasApiKey: Boolean(row?.apiKey), verifiedAt: row?.verifiedAt || null, configured: Boolean(row) }))
})
router.put('/settings', manage, async (req, res) => {
  const parsed = clinicBotSchema.extend({ apiKey: z.string().trim().max(1000).optional(), removeKey: z.boolean().optional() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json(createErrorResponse('Confira os campos da configuração de atendimento.', 400))
  const { apiKey, removeKey, ...settings } = parsed.data
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${clinic(req)} FOR UPDATE`
    const previous = await tx.botClinicSettings.findUnique({ where: { companyId: clinic(req) } })
    const old = previous?.settings as any
    const key = removeKey || (old && old.provider !== settings.provider && !apiKey) ? null : apiKey || previous?.apiKey || null
    await tx.botClinicSettings.upsert({ where: { companyId: clinic(req) }, create: { companyId: clinic(req), settings, apiKey: key }, update: { settings, apiKey: key, verifiedAt: null } })
    // In-flight runs recheck the agent version before performing any side effect.
    const agents = await tx.agenteIa.findMany({ where: { companyId: clinic(req) }, select: { id: true } })
    await tx.botConfiguracao.updateMany({ where: { agentId: { in: agents.map(a => a.id) } }, data: { verifiedAt: null, playgroundAt: null } })
    await tx.agenteIa.updateMany({ where: { companyId: clinic(req) }, data: { isActive: false, updatedAt: new Date() } })
  })
  res.json(createSuccessResponse({ saved: true }))
})
router.post('/settings/test-key', manage, aiLimit, async (req, res) => {
  const row = await prisma.botClinicSettings.findUnique({ where: { companyId: clinic(req) } })
  const settings = clinicBotSchema.parse(row?.settings || {})
  if (!row?.apiKey || !settings.model) return res.status(409).json(createErrorResponse('Salve a chave e o modelo primeiro.', 409))
  try {
    await generateBotDecision({ ...settings, provider: settings.provider!, model: settings.model!, apiKey: row.apiKey, prompt: 'Teste de conexão', knowledge: '' }, [{ role: 'user', content: 'Olá' }])
    const updated = await prisma.botClinicSettings.updateMany({ where: { companyId: clinic(req), updatedAt: row.updatedAt }, data: { verifiedAt: new Date() } })
    if (!updated.count) return res.status(409).json(createErrorResponse('As configurações mudaram durante o teste. Teste novamente.', 409))
    res.json(createSuccessResponse({ verified: true }))
  } catch (error) { res.status(502).json({ success: false, error: { code: 502, message: providerErrorMessage(error instanceof BotProviderError ? error.code : '') } }) }
})
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
  const item = await prisma.$transaction(async tx => {
    const agent = await tx.agenteIa.create({ data: { ...parsed.data, name: parsed.data.name!, basePrompt: parsed.data.basePrompt!, companyId: clinic(req), isActive: false } })
    await tx.botConfiguracao.create({ data: { agentId: agent.id, flowDefinition: flowTemplate(String(req.body.template || 'blank')) } })
    return agent
  })
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
  if (!readiness[0]?.ready) return res.status(503).json({ success: false, error: { code: 503, reason: 'bot_schema_missing', message: 'A atualização do banco do atendimento está incompleta. Aplique as migrações dos bots e reinicie o serviço antes de ativar.' } })
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${clinic(req)} FOR UPDATE`
    const agent = await tx.agenteIa.findFirst({ where: { id: res.locals.bot.id, companyId: clinic(req) }, include: { configuracao: true } })
    const config = await effectiveBotConfig(clinic(req), agent?.configuracao, tx)
    if (!botConnectionReady(config) || !config.verifiedAt || !config.playgroundAt) return null
    const company = await tx.empresa.findUnique({ where: { id: clinic(req) }, select: { whatsappProvider: true } })
    if (!['meta', 'uazapi'].includes(company?.whatsappProvider || '')) return null
    await tx.agenteIa.updateMany({ where: { companyId: clinic(req), isActive: true }, data: { isActive: false } })
    return tx.agenteIa.update({ where: { id: agent!.id }, data: { isActive: true, activatedAt: new Date() } })
  })
  if (!result) return res.status(409).json(createErrorResponse('Configure o WhatsApp da clínica com Meta ou Uazapi, valide a conexão e conclua um teste de conversa antes de ativar.', 409))
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
router.get('/:id/configuracao', manage, async (req, res) => {
  res.json(createSuccessResponse(safeConfig(await effectiveBotConfig(clinic(req), await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } })))))
})
router.put('/:id/configuracao', manage, async (req, res) => {
  const parsed = configSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(createErrorResponse('Confira modelo, limites, campos e fuso horário.', 400))
  const { apiKey, removeKey, n8nSecret, removeN8nSecret, ...settings } = parsed.data
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${clinic(req)} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM agentes_ia WHERE id = ${res.locals.bot.id} FOR UPDATE`
    const previous = await tx.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } })
    const reset = Boolean(apiKey || removeKey || n8nSecret || removeN8nSecret || (previous?.executionMode || 'native') !== settings.executionMode || previous?.n8nWebhookUrl !== settings.n8nWebhookUrl || previous?.provider !== settings.provider || previous?.model !== settings.model)
    const keyChange = removeKey || previous && previous.provider !== settings.provider && !apiKey ? { apiKey: null } : apiKey ? { apiKey } : {}
    const workflowKey = removeN8nSecret ? { n8nSecret: null } : n8nSecret ? { n8nSecret } : previous?.n8nWebhookUrl !== settings.n8nWebhookUrl ? { n8nSecret: null } : {}
    // A flow cannot overwrite the clinic's shared credential or knowledge.
    const shared = await tx.botClinicSettings.findUnique({ where: { companyId: clinic(req) } })
    const data: any = { ...settings, ...keyChange, ...workflowKey, playgroundAt: null, ...(reset ? { verifiedAt: null } : {}) }
    if (shared) { for (const key of Object.keys(clinicBotSchema.shape)) delete data[key]; delete data.apiKey }
    if (data.flowDefinition === null) delete data.flowDefinition
    await tx.botConfiguracao.upsert({ where: { agentId: res.locals.bot.id }, create: { agentId: res.locals.bot.id, ...data }, update: data })
    await tx.agenteIa.update({ where: { id: res.locals.bot.id }, data: { isActive: false } })
  })
  res.json(createSuccessResponse({ saved: true }))
})
router.post('/:id/test-key', manage, aiLimit, async (req, res) => {
  const phone = testPhoneSchema.safeParse(req.body?.testPhone)
  if (!phone.success) return res.status(400).json(createErrorResponse('Telefone de teste inválido. Use DDI, DDD e número, somente dígitos.', 400))
  const config = await effectiveBotConfig(clinic(req), await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } }))
  if (config?.executionMode !== 'n8n' && config?.flowDefinition && validateFlow(config.flowDefinition).length) return res.status(400).json(createErrorResponse(validateFlow(config.flowDefinition).join(' '), 400))
  if (!botConnectionReady(config)) return res.status(409).json(createErrorResponse('Salve a conexão e a credencial primeiro.', 409))
  try {
    const usage = config.executionMode === 'n8n'
      ? await callBotWorkflow(config, { mode: 'connection_test', bot: { name: res.locals.bot.name, instructions: 'Teste de conexão', knowledge: '' }, ...botIdentity(clinic(req), res.locals.bot.id, 'connection_test', phone.data), message: { text: 'Olá' }, history: [], state: {}, services: [], specialists: [], capabilities: { qualification: false, booking: false, handoff: true } })
      : config.flowDefinition && !config.flowDefinition.nodes.some((n: any) => n.type === 'ai') ? { inputTokens: 0, outputTokens: 0 }
      : await generateBotDecision({ ...config, apiKey: config.apiKey, prompt: 'Teste de conexão', knowledge: '' }, [{ role: 'user', content: 'Olá' }])
    await prisma.botRun.create({ data: { companyId: res.locals.bot.companyId, agentId: config.agentId, executionMode: config.executionMode || 'native', httpStatus: 'httpStatus' in usage ? Number(usage.httpStatus) : undefined, mode: 'key_test', status: 'sent', inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } })
    const result = await prisma.botConfiguracao.updateMany({ where: { agentId: config.agentId, updatedAt: config.updatedAt }, data: { verifiedAt: new Date() } })
    if (!result.count) return res.status(409).json(createErrorResponse('A configuração mudou durante o teste. Teste novamente.', 409))
    res.json(createSuccessResponse({ verified: true }))
  } catch (error) { res.status(502).json({ success: false, error: { code: 502, reason: error instanceof BotProviderError ? error.code : 'provider_error', message: providerErrorMessage(error instanceof BotProviderError ? error.code : '') } }) }
})
router.post('/:id/playground', manage, aiLimit, async (req, res) => {
  const phone = testPhoneSchema.safeParse(req.body?.testPhone)
  if (!phone.success) return res.status(400).json(createErrorResponse('Telefone de teste inválido. Use DDI, DDD e número, somente dígitos.', 400))
  const message = z.string().trim().min(1).max(4000).safeParse(req.body.message)
  const history = historySchema.safeParse(req.body.history || [])
  if (!message.success || !history.success || JSON.stringify(req.body.state || {}).length > 16000) return res.status(400).json(createErrorResponse('Mensagem ou histórico inválido.', 400))
  const config = await effectiveBotConfig(clinic(req), await prisma.botConfiguracao.findUnique({ where: { agentId: res.locals.bot.id } }))
  if (!botConnectionReady(config) || !config.verifiedAt) return res.status(409).json(createErrorResponse('Salve a configuração e teste a conexão primeiro.', 409))
  if (config.bookingEnabled && !(await canCompanyAccessModule(clinic(req), 'agendamentos')).hasAccess) config.bookingEnabled = false
  if (config.qualifyEnabled && !(await canCompanyAccessModule(clinic(req), 'funnel')).hasAccess) config.qualifyEnabled = false
  const started = Date.now()
  try {
    const result = await prepareBotTurn({ agent: res.locals.bot, config, companyId: clinic(req), message: message.data, history: history.data.map(h => ({ role: h.role!, content: h.content! })), contact: { phone: phone.data }, state: req.body.state || {}, responseCount: history.data.filter(h => h.role === 'assistant').length })
    if (result.confirmSlot) { result.reply = `[Simulação] Agendamento confirmado: ${result.confirmSlot.label}. Nenhum agendamento foi gravado.`; result.state = {} }
    await prisma.botRun.create({ data: { companyId: clinic(req), agentId: res.locals.bot.id, executionMode: config.executionMode || 'native', httpStatus: result.httpStatus, decisionAction: result.decisionAction, mode: 'playground', status: 'sent', inputTokens: result.inputTokens, outputTokens: result.outputTokens, durationMs: Date.now() - started, errorCode: result.handoff } })
    await prisma.botConfiguracao.updateMany({ where: { agentId: config.agentId, updatedAt: config.updatedAt }, data: { playgroundAt: new Date() } })
    res.json(createSuccessResponse({ reply: result.reply, state: result.state, handoff: result.handoff, collected: result.fields }))
  } catch (error) {
    await prisma.botRun.create({ data: { companyId: clinic(req), agentId: res.locals.bot.id, executionMode: config.executionMode || 'native', httpStatus: error instanceof BotProviderError ? error.httpStatus : undefined, mode: 'playground', status: 'failed', errorCode: error instanceof BotProviderError ? error.code : 'provider_error', durationMs: Date.now() - started } })
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
  if (schemaMissing) {
    console.error('[bots] Banco sem a estrutura necessária para atendimento automático:', error.code)
    return res.status(503).json({ success: false, error: { message: 'O atendimento automático ainda não está disponível. A equipe técnica precisa concluir a atualização do banco de dados.', code: 503, reason: 'bot_schema_missing' } })
  }
  console.error('[bots] Falha na operação:', error?.code || error?.name || 'unknown')
  res.status(500).json(createErrorResponse('Não foi possível concluir a operação.', 500))
})
