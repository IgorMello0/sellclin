import { prisma } from '../prisma.js'
import { canCompanyAccessModule } from './billing.js'
import { prepareBotTurn } from './bot-turn.js'
import { sendBotWhatsApp } from './bot-whatsapp.js'
import { confirmBotAppointment } from './bot-agenda.js'
import { syncAppointmentToGoogle } from './google-calendar.js'
import { BotProviderError } from './bot-provider.js'

export async function lockBotConversation(tx: any, companyId: number, id: number) {
  const rows = await tx.$queryRaw`SELECT id FROM conversas WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`
  if (!rows.length) throw new Error('conversation_not_found')
}
export async function pauseBot(tx: any, companyId: number, conversationId: number, reason: string) {
  await lockBotConversation(tx, companyId, conversationId)
  await tx.botSession.upsert({ where: { conversationId }, create: { conversationId, companyId, paused: true, reason }, update: { paused: true, reason, state: {} } })
  await tx.conversa.update({ where: { id: conversationId }, data: { agentId: null, ...(reason === 'manual' ? {} : { status: 'PENDING' }) } })
  await tx.botRun.updateMany({ where: { conversationId, companyId, status: 'pending' }, data: { status: 'skipped', errorCode: reason } })
  await tx.conversationEvent.create({ data: { conversationId, type: 'bot_paused', metadata: { reason } } })
}
export async function setConversationBot(companyId: number, conversationId: number, agentId: number | null, db: any = prisma) {
  return db.$transaction(async (tx: any) => {
    await lockBotConversation(tx, companyId, conversationId)
    if (!agentId) { await pauseBot(tx, companyId, conversationId, 'manual'); return }
    const agent = await tx.agenteIa.findFirst({ where: { id: agentId, companyId, isActive: true }, include: { configuracao: true } })
    if (!agent?.configuracao?.verifiedAt) throw new Error('Ative e teste o bot na página Bots de atendimento primeiro.')
    await tx.botSession.upsert({ where: { conversationId }, create: { conversationId, companyId }, update: { paused: false, reason: null, responseCount: 0, state: {} } })
    await tx.botRun.updateMany({ where: { conversationId, status: 'pending' }, data: { status: 'skipped', errorCode: 'resumed_from_next_message' } })
    await tx.conversa.update({ where: { id: conversationId }, data: { agentId, status: 'OPEN' } })
    await tx.conversationEvent.create({ data: { conversationId, type: 'bot_resumed', metadata: { agentId } } })
  })
}

export const botDependencies = { db: prisma as any, prepare: prepareBotTurn, send: sendBotWhatsApp, access: canCompanyAccessModule, sync: syncAppointmentToGoogle }
export async function processBotRun(id: number, deps = botDependencies) {
  const { db } = deps
  const started = Date.now()
  const candidate = await db.botRun.findUnique({ where: { id } })
  if (!candidate || candidate.status !== 'pending' || !candidate.conversationId) return
  const run = await db.$transaction(async (tx: any) => {
    await lockBotConversation(tx, candidate.companyId, candidate.conversationId)
    const session = await tx.botSession.upsert({ where: { conversationId: candidate.conversationId }, create: { conversationId: candidate.conversationId, companyId: candidate.companyId }, update: {} })
    if (session.busyUntil && session.busyUntil > new Date()) return null
    const changed = await tx.botRun.updateMany({ where: { id, status: 'pending' }, data: { status: 'processing' } })
    if (!changed.count) return null
    if (session.paused) {
      await tx.botRun.update({ where: { id }, data: { status: 'skipped', errorCode: 'human_control' } }); return null
    }
    await tx.botSession.update({ where: { conversationId: candidate.conversationId }, data: { busyUntil: new Date(Date.now() + 300000), runningRunId: id } })
    return candidate
  })
  if (!run) return
  let stage = 'processing'
  try {
    const agent = await db.agenteIa.findFirst({ where: { id: run.agentId, companyId: run.companyId, isActive: true }, include: { configuracao: true } })
    const config = agent?.configuracao
    const conversation = await db.conversa.findFirst({ where: { id: run.conversationId, companyId: run.companyId }, include: { botSession: true } })
    const message = await db.mensagem.findFirst({ where: { id: run.messageId, conversationId: run.conversationId, sender: 'cliente' } })
    if (!config?.apiKey || !config.verifiedAt || !conversation || !message || !agent.activatedAt || message.createdAt < agent.activatedAt || conversation.status === 'RESOLVED') throw new Error('bot_unavailable')
    if (!(await deps.access(run.companyId, 'conversas')).hasAccess) throw new Error('subscription_unavailable')
    if (config.bookingEnabled && !(await deps.access(run.companyId, 'agendamentos')).hasAccess) config.bookingEnabled = false
    if (config.qualifyEnabled && !(await deps.access(run.companyId, 'funnel')).hasAccess) config.qualifyEnabled = false
    // Coalesce a burst without discarding its content: the latest event reads the recent conversation.
    const newer = await db.botRun.findFirst({ where: { conversationId: run.conversationId, status: 'pending', id: { gt: id } }, orderBy: { id: 'desc' }, select: { id: true } })
    if (newer) {
      await db.botRun.updateMany({ where: { conversationId: run.conversationId, status: 'pending', id: { lt: newer.id } }, data: { status: 'skipped', errorCode: 'coalesced' } })
      await db.botRun.update({ where: { id }, data: { status: 'skipped', errorCode: 'coalesced' } }); return
    }
    const limited = await db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${run.companyId} FOR UPDATE`
      const count = await tx.botRun.count({ where: { companyId: run.companyId, mode: 'live', createdAt: { gte: new Date(Date.now() - 86400000) }, status: { in: ['processing', 'sending', 'sent', 'failed', 'uncertain'] } } })
      return count > config.dailyLimit
    })
    if (limited) throw new Error('daily_limit')
    const recent = await db.mensagem.findMany({ where: { conversationId: run.conversationId, id: { lt: message.id } }, orderBy: { id: 'desc' }, take: 14 })
    const history = recent.reverse().map((m: any) => ({ role: m.sender === 'cliente' ? 'user' as const : 'assistant' as const, content: m.content }))
    const media = message.rawJson?.mediaType || message.rawJson?.providerMediaType
    const prepared = media ? { reply: 'Recebi seu arquivo. Vou encaminhá-lo para a equipe da clínica.', handoff: 'media_requires_human', state: {}, fields: {}, confirmSlot: null, inputTokens: 0, outputTokens: 0 }
      : await deps.prepare({ agent, config, companyId: run.companyId, message: message.content, history, state: conversation.botSession?.state || {}, responseCount: conversation.botSession?.responseCount || 0 })
    let appointmentId: number | undefined
    const expectedSession = await db.$transaction(async (tx: any) => {
      await lockBotConversation(tx, run.companyId, run.conversationId)
      const session = await tx.botSession.findUnique({ where: { conversationId: run.conversationId } })
      const liveAgent = await tx.agenteIa.findFirst({ where: { id: agent.id, companyId: run.companyId, isActive: true } })
      if (session?.paused || session.runningRunId !== id || session.updatedAt.getTime() !== conversation.botSession.updatedAt.getTime() || !liveAgent || liveAgent.updatedAt.getTime() !== agent.updatedAt.getTime()) throw new Error('human_control')
      if (prepared.confirmSlot) {
        const booked = await confirmBotAppointment(tx, conversation, prepared.confirmSlot, config)
        prepared.reply = booked ? `Agendamento confirmado: ${prepared.confirmSlot.label}.` : 'Esse horário não está mais disponível. Informe uma nova data para consultar outros horários.'
        prepared.state = { collected: prepared.state.collected || {}, ...(booked ? { appointmentId: booked.id } : {}) }
        appointmentId = booked?.id
      }
      if (conversation.leadId && Object.keys(prepared.fields).length) {
        const updatedLead = await tx.lead.updateMany({ where: { id: conversation.leadId, companyId: run.companyId }, data: {
          ...(prepared.fields.nome ? { name: prepared.fields.nome } : {}), ...(prepared.fields.email ? { email: prepared.fields.email } : {}),
        } })
        if (updatedLead.count) await tx.leadActivity.create({ data: { leadId: conversation.leadId, type: 'sistema', createdBy: agent.name, content: `Qualificação pelo bot: ${JSON.stringify(prepared.fields)}` } })
      }
      const updated = await tx.botSession.update({ where: { conversationId: run.conversationId }, data: { state: JSON.parse(JSON.stringify(prepared.state)) } })
      await tx.botRun.update({ where: { id }, data: { status: 'sending', inputTokens: prepared.inputTokens, outputTokens: prepared.outputTokens } })
      return updated.updatedAt
    })
    stage = 'sending'
    if (appointmentId) await deps.sync(appointmentId).catch(() => undefined)
    // A committed sending marker means an interrupted send is never replayed blindly.
    await db.$transaction(async (tx: any) => {
      await lockBotConversation(tx, run.companyId, run.conversationId)
      await tx.$queryRaw`SELECT id FROM agentes_ia WHERE id = ${agent.id} FOR SHARE`
      const session = await tx.botSession.findUnique({ where: { conversationId: run.conversationId } })
      const active = await tx.agenteIa.findFirst({ where: { id: agent.id, companyId: run.companyId, isActive: true } })
      if (session.paused || session.runningRunId !== id || session.updatedAt.getTime() !== expectedSession.getTime() || !active || active.updatedAt.getTime() !== agent.updatedAt.getTime()) throw new Error('human_control')
      const company = await tx.empresa.findUnique({ where: { id: run.companyId } })
      if (!company?.isActive) throw new Error('company_inactive')
      const providerMessageId = await deps.send(conversation, company, prepared.reply)
      await tx.mensagem.upsert({ where: { providerMessageId_conversationId: { providerMessageId, conversationId: run.conversationId } },
        create: { conversationId: run.conversationId, sender: 'bot', content: prepared.reply, providerMessageId, deliveryStatus: 'sent', sentAt: new Date(), origin: 'SellClin Bot' },
        update: { sender: 'bot', content: prepared.reply, origin: 'SellClin Bot' } })
      await tx.conversa.update({ where: { id: run.conversationId }, data: { agentId: agent.id, lastMessageAt: new Date() } })
      await tx.botSession.update({ where: { conversationId: run.conversationId }, data: { responseCount: { increment: 1 } } })
      if (prepared.handoff) await pauseBot(tx, run.companyId, run.conversationId, prepared.handoff)
      await tx.botRun.update({ where: { id }, data: { status: 'sent', errorCode: prepared.handoff, durationMs: Date.now() - started } })
    }, { timeout: 45000, maxWait: 10000 })
  } catch (error) {
    const known = error instanceof BotProviderError ? error.code : error instanceof Error && ['human_control', 'daily_limit', 'bot_unavailable', 'subscription_unavailable'].includes(error.message) ? error.message : 'execution_failed'
    await db.$transaction(async (tx: any) => {
      await tx.botRun.update({ where: { id }, data: { status: known === 'human_control' ? 'skipped' : stage === 'sending' ? 'uncertain' : 'failed', errorCode: known, durationMs: Date.now() - started } })
      if (known !== 'human_control') await pauseBot(tx, run.companyId, run.conversationId, known)
    })
  } finally {
    await db.botSession.updateMany({ where: { conversationId: run.conversationId, companyId: run.companyId, runningRunId: id }, data: { busyUntil: null, runningRunId: null } })
  }
}

let workerRunning = false
export async function botWorkerTick() {
  if (workerRunning) return
  workerRunning = true
  try {
    const stale = await prisma.botRun.findMany({ where: { status: { in: ['processing', 'sending'] }, updatedAt: { lt: new Date(Date.now() - 180000) } }, take: 20 })
    for (const run of stale) await prisma.$transaction(async tx => {
      if (!run.conversationId) return
      await lockBotConversation(tx, run.companyId, run.conversationId)
      const changed = await tx.botRun.updateMany({ where: { id: run.id, status: run.status, updatedAt: run.updatedAt }, data: { status: run.status === 'sending' ? 'uncertain' : 'failed', errorCode: 'worker_interrupted' } })
      if (changed.count) { await pauseBot(tx, run.companyId, run.conversationId, 'worker_interrupted'); await tx.botSession.updateMany({ where: { conversationId: run.conversationId, runningRunId: run.id }, data: { busyUntil: null, runningRunId: null } }) }
    })
    // Recover a process that committed a terminal result but crashed before releasing its lease.
    await prisma.$executeRaw`UPDATE bot_sessions s SET busy_until = NULL, running_run_id = NULL WHERE s.busy_until < CURRENT_TIMESTAMP AND NOT EXISTS(SELECT 1 FROM bot_runs r WHERE r.id = s.running_run_id AND r.status IN ('processing','sending'))`
    const runs = await prisma.botRun.findMany({ where: { mode: 'live', status: 'pending', createdAt: { lt: new Date(Date.now() - 2000) } }, orderBy: { id: 'asc' }, take: 10 })
    await Promise.allSettled(runs.map(run => processBotRun(run.id)))
  } finally { workerRunning = false }
}
export async function startBotWorker() {
  const ready: any[] = await prisma.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'agentes_ia_um_ativo_por_clinica') AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'sellclin_bot_message_received' AND NOT tgisinternal) AS ready`
  if (!ready[0]?.ready) { console.warn('[bots] Aplique database/bot-configuracoes.sql e reinicie para habilitar a fila de bots.'); return }
  const tick = () => botWorkerTick().catch(() => console.warn('[bots] Processamento indisponível. Confira a migração e a conexão com o banco.'))
  void tick()
  return setInterval(() => { void tick() }, 3000).unref()
}
