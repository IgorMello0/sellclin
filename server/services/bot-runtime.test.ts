// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('../prisma.js', () => ({ prisma: {} }))
vi.mock('./billing.js', () => ({ canCompanyAccessModule: vi.fn() }))
vi.mock('./google-calendar.js', () => ({ syncAppointmentToGoogle: vi.fn() }))
const booking = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('./bot-agenda.js', () => ({ confirmBotAppointment: booking.confirm, botCatalog: vi.fn(), availableBotSlots: vi.fn() }))
import { processBotRun, setConversationBot } from './bot-runtime.js'
import { BotProviderError } from './bot-provider.js'

let db: any, deps: any, session: any, run: any, agent: any, clock: number
const copy = (o: any) => structuredClone(o)
beforeEach(() => {
  clock = Date.now()
  const tick = () => new Date(++clock)
  run = { id: 1, companyId: 2, agentId: 3, conversationId: 10, messageId: 20, status: 'pending' }
  session = { conversationId: 10, companyId: 2, paused: false, state: {}, responseCount: 0, busyUntil: null, updatedAt: tick() }
  agent = { id: 3, companyId: 2, isActive: true, activatedAt: new Date(clock - 10000), updatedAt: tick(), basePrompt: 'Ajude', configuracao: { apiKey: 'test', verifiedAt: new Date(), dailyLimit: 200 } }
  let transactionTail = Promise.resolve()
  db = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 10 }]),
    $transaction: (fn: any) => { const result = transactionTail.then(() => fn(db)); transactionTail = result.catch(() => {}); return result },
    botRun: {
      findUnique: vi.fn(async () => copy(run)), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(1),
      update: vi.fn(async ({ data }: any) => Object.assign(run, data)),
      updateMany: vi.fn(async ({ where, data }: any) => { if (where.status && run.status !== where.status) return { count: 0 }; Object.assign(run, data); return { count: 1 } }),
    },
    botSession: {
      upsert: vi.fn(async () => copy(session)), findUnique: vi.fn(async () => copy(session)),
      update: vi.fn(async ({ data }: any) => { Object.assign(session, data, { updatedAt: tick() }); return copy(session) }),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(session, data); return { count: 1 } }),
    },
    agenteIa: { findFirst: vi.fn(async () => agent.isActive ? copy(agent) : null) },
    conversa: { findFirst: vi.fn(async () => ({ id: 10, companyId: 2, leadId: 5, botSession: copy(session), status: 'OPEN', phone: '5511000000000', lastInboundAt: new Date() })), update: vi.fn() },
    mensagem: { findFirst: vi.fn(async () => ({ id: 20, content: 'Olá', createdAt: new Date(clock), rawJson: {} })), findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    empresa: { findUnique: vi.fn().mockResolvedValue({ id: 2, isActive: true, whatsappProvider: 'meta' }) },
    lead: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, leadActivity: { create: vi.fn() }, conversationEvent: { create: vi.fn() },
  }
  deps = { db, prepare: vi.fn().mockResolvedValue({ reply: 'Olá!', state: {}, handoff: null, fields: {}, confirmSlot: null, inputTokens: 3, outputTokens: 1 }), send: vi.fn().mockResolvedValue('provider-1'), access: vi.fn().mockResolvedValue({ hasAccess: true }), sync: vi.fn() }
  booking.confirm.mockReset().mockResolvedValue({ id: 31 })
})
it('sends and persists one bot response despite competing workers and repeated events', async () => {
  await Promise.all([processBotRun(1, deps), processBotRun(1, deps)])
  await processBotRun(1, deps)
  expect(deps.send).toHaveBeenCalledTimes(1)
  expect(db.mensagem.upsert.mock.calls[0][0].create.sender).toBe('bot')
  expect(run.status).toBe('sent')
})
it('does not run AI or send after human takeover', async () => {
  session.paused = true
  await processBotRun(1, deps)
  expect(deps.prepare).not.toHaveBeenCalled()
  expect(deps.send).not.toHaveBeenCalled()
  expect(run.status).toBe('skipped')
})
it('rechecks human control after the model responds', async () => {
  deps.prepare.mockImplementation(async () => { session.paused = true; return { reply: 'Não enviar', fields: {}, state: {} } })
  await processBotRun(1, deps)
  expect(deps.send).not.toHaveBeenCalled()
  expect(db.lead.updateMany).not.toHaveBeenCalled()
})
it('hands provider failures to the team with a safe error code', async () => {
  deps.prepare.mockRejectedValue(new BotProviderError('quota'))
  await processBotRun(1, deps)
  expect(run.status).toBe('failed')
  expect(run.errorCode).toBe('quota')
  expect(db.botSession.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ paused: true, reason: 'quota' }) }))
  expect(deps.send).not.toHaveBeenCalled()
})
it('never retries an ambiguous send automatically', async () => {
  deps.send.mockRejectedValue(new Error('timeout with sensitive provider payload'))
  await processBotRun(1, deps)
  await processBotRun(1, deps)
  expect(run.status).toBe('uncertain')
  expect(run.errorCode).toBe('execution_failed')
  expect(deps.send).toHaveBeenCalledTimes(1)
})
it('updates qualification only in the current clinic and records it in the lead history', async () => {
  deps.prepare.mockResolvedValue({ reply: 'Qual serviço?', state: { collected: { nome: 'Ana' } }, fields: { nome: 'Ana', interesse: 'Avaliação' }, inputTokens: 1, outputTokens: 1 })
  await processBotRun(1, deps)
  expect(db.lead.updateMany).toHaveBeenCalledWith({ where: { id: 5, companyId: 2 }, data: { name: 'Ana' } })
  expect(db.leadActivity.create).toHaveBeenCalledTimes(1)
})
it('books once on confirmation and consumes the proposal before sending', async () => {
  deps.prepare.mockResolvedValue({ reply: '', state: {}, fields: {}, confirmSlot: { label: 'Avaliação 10:00' }, inputTokens: 0, outputTokens: 0 })
  deps.sync.mockResolvedValue(null)
  await processBotRun(1, deps)
  await processBotRun(1, deps)
  expect(booking.confirm).toHaveBeenCalledTimes(1)
  expect(session.state).toEqual({ collected: {}, appointmentId: 31 })
  expect(deps.send.mock.calls[0][2]).toContain('Agendamento confirmado')
})
it('does not send when the clinic loses access or exceeds the daily limit', async () => {
  deps.access.mockResolvedValue({ hasAccess: false })
  await processBotRun(1, deps)
  expect(deps.send).not.toHaveBeenCalled()
  expect(run.errorCode).toBe('subscription_unavailable')
})
it('rejects a foreign or inactive bot when resuming a conversation', async () => {
  agent.isActive = false
  await expect(setConversationBot(2, 10, 999, db)).rejects.toThrow('Ative e teste')
  expect(db.agenteIa.findFirst.mock.calls[0][0].where).toEqual({ id: 999, companyId: 2, isActive: true })
  expect(db.conversa.update).not.toHaveBeenCalled()
})
