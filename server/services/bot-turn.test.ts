// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../prisma.js', () => ({ prisma: {} }))
import { prepareBotTurn } from './bot-turn.js'
import { bookingInput, verifiedFields } from './bot-policy.js'
import { availableBotSlots, confirmBotAppointment } from './bot-agenda.js'
import { createAppointmentSafely, updateAppointmentSafely } from './appointment-booking.js'
import { protectCredentialData, readCredentialData } from './integration-encryption.js'
import { safeIntegrationOutput } from '../middleware/integration-output.js'

const config = { provider: 'openai', model: 'test', apiKey: 'test-only', knowledge: 'O endereço é Rua A, 10.', maxResponses: 10, qualificationFields: ['nome', 'email', 'interesse'], handoffTerms: ['reclamação'], qualifyEnabled: true, bookingEnabled: true, timezone: 'America/Sao_Paulo', workingDays: [1,2,3,4,5] }
let db: any, generate: any
const input = (message = 'Qual o endereço?', state: any = {}) => ({ agent: { id: 3, basePrompt: 'Ajude' }, config, companyId: 2, message, history: [], state, responseCount: 0 })
afterEach(() => vi.useRealTimers())
beforeEach(() => {
  db = { catalogItem: { findMany: vi.fn().mockResolvedValue([{ id: 5, name: 'Avaliação', price: 100, professionalId: 7, durationMinutes: 30, professional: { name: 'Equipe' } }]) }, empresa: { findUnique: vi.fn().mockResolvedValue({ openHour: '08:00', closeHour: '18:00' }) }, appointment: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 20 }), update: vi.fn().mockResolvedValue({}) }, $queryRaw: vi.fn().mockResolvedValue([{ id: 2 }]), lead: { updateMany: vi.fn() }, conversationEvent: { create: vi.fn() } }
  db.$transaction = (fn: any) => fn(db)
  db.usuario = { findMany: vi.fn().mockResolvedValue([{ id: 8, name: 'Especialista' }]) }
  generate = vi.fn().mockResolvedValue({ decision: { action: 'answer', reply: 'Rua A, 10.', evidence: 'O endereço é Rua A, 10.', clinical: false, fields: [] }, inputTokens: 10, outputTokens: 5 })
})
it('answers grounded questions and sends missing knowledge to the team', async () => {
  expect((await prepareBotTurn(input(), { db, generate })).reply).toBe('Rua A, 10.')
  generate.mockResolvedValue({ decision: { action: 'answer', reply: 'Custa 1000', evidence: 'inventado', fields: [] } })
  expect((await prepareBotTurn(input(), { db, generate })).handoff).toBe('knowledge_missing')
})
it('hands off human requests, clinical topics, custom terms and response limits without consulting AI', async () => {
  for (const text of ['Quero um atendente', 'Qual medicamento usar?', 'Minha reclamação']) expect((await prepareBotTurn(input(text), { db, generate })).handoff).toBeTruthy()
  expect((await prepareBotTurn({ ...input(), responseCount: 10 }, { db, generate })).handoff).toBe('response_limit')
  expect(generate).not.toHaveBeenCalled()
})
it('qualifies only configured fields literally supplied by the contact', async () => {
  const fields = [{ key: 'nome', value: 'Ana' }, { key: 'email', value: 'inventado@example.com' }, { key: 'companyId', value: '2' }]
  generate.mockResolvedValue({ decision: { action: 'qualify', reply: 'Qual o serviço desejado?', fields }, inputTokens: 1, outputTokens: 1 })
  const result = await prepareBotTurn(input('Meu nome é Ana, 2'), { db, generate })
  expect(result.fields).toEqual({ nome: 'Ana' })
  expect(verifiedFields([{ key: 'email', value: 'errado' }], ['email'], 'errado')).toEqual({})
})
it('keeps all service and schedule lookups scoped to the clinic', async () => {
  const day = '2026-11-09'
  const slots = await availableBotSlots(2, 5, day, config, db, new Date('2026-11-08T10:00:00Z'))
  expect(slots).toHaveLength(8)
  expect(slots[0].start).toBe('2026-11-09T11:00:00.000Z')
  expect(db.catalogItem.findMany.mock.calls[0][0].where.professional.OR[0]).toEqual({ companyId: 2 })
  expect(db.appointment.findMany.mock.calls[0][0].where.companyId).toBe(2)
  expect(await availableBotSlots(2, 999, day, config, db)).toEqual([])
})
it('requires an explicit choice followed by CONFIRMAR and expires old offers', async () => {
  const slot = { serviceId: 5, professionalId: 7, label: 'Avaliação 10:00', start: '2026-11-09T13:00:00Z', end: '2026-11-09T13:30:00Z' }
  const offeredAt = new Date().toISOString()
  expect(bookingInput('confirmar', { offers: [slot], offeredAt }).kind).toBe('message')
  const choice = await prepareBotTurn(input('1', { offers: [slot], offeredAt }), { db, generate })
  expect(choice.reply).toContain('CONFIRMAR')
  expect(choice.confirmSlot).toBeNull()
  expect((await prepareBotTurn(input('sim', choice.state), { db, generate })).confirmSlot).toBeNull()
  expect((await prepareBotTurn(input('CONFIRMAR', choice.state), { db, generate })).confirmSlot).toEqual(slot)
  expect(bookingInput('confirmar', { pending: slot, offeredAt: '2020-01-01' }).kind).toBe('expired')
  expect(db.appointment.create).not.toHaveBeenCalled()
})
it('rechecks conflicts inside the shared transaction used by manual bookings', async () => {
  db.appointment.findFirst.mockResolvedValue({ id: 88 })
  await expect(createAppointmentSafely({ data: { companyId: 2, professionalId: 7, startTime: new Date(), endTime: new Date(Date.now()+3600000) } }, db)).rejects.toThrow('ocupado')
  expect(db.$queryRaw).toHaveBeenCalled()
  expect(db.appointment.create).not.toHaveBeenCalled()
})
it('refuses a stale or foreign booking confirmation', async () => {
  const result = await confirmBotAppointment(db, { id: 11, companyId: 2 }, { serviceId: 999, professionalId: 8, label: 'fake', start: '2026-11-09T13:00:00Z', end: '2026-11-09T13:30:00Z' }, config)
  expect(result).toBeNull()
  expect(db.appointment.create).not.toHaveBeenCalled()
})
it('encrypts bot keys at rest and strips them from API output', () => {
  const key = Buffer.alloc(32, 5)
  const encrypted: any = protectCredentialData('BotConfiguracao', { apiKey: 'test-secret', model: 'test' }, key)
  expect(encrypted.apiKey).not.toContain('test-secret')
  expect(readCredentialData(encrypted, key)).toEqual({ apiKey: 'test-secret', model: 'test' })
  expect(safeIntegrationOutput({ nested: encrypted }, true)).toEqual({ nested: { model: 'test' } })
})
it('confirms a real offered slot, saves the selected specialist and refuses the same occupied slot', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-08T10:00:00Z'))
  const slot = (await availableBotSlots(2, 5, '2026-11-09', config, db, new Date(), 8))[0]
  expect(slot.specialistId).toBe(8)
  db.lead.findFirst = vi.fn().mockResolvedValue({ id: 44 })
  const conversation = { id: 11, companyId: 2, leadId: 44 }
  expect(await confirmBotAppointment(db, conversation, slot, config)).toEqual({ id: 20 })
  expect(db.appointment.create.mock.calls[0][0].data).toMatchObject({ companyId: 2, serviceId: 5, especialistaId: 8, leadId: 44 })
  db.appointment.findMany.mockResolvedValue([{ startTime: slot.start, endTime: slot.end }])
  expect(await confirmBotAppointment(db, conversation, slot, config)).toBeNull()
  expect(db.appointment.create).toHaveBeenCalledTimes(1)
  expect(await availableBotSlots(2, 5, '2026-11-09', config, db, new Date(), 999)).toEqual([])
})
it('serializes concurrent manual and bot booking writes so only one slot is reserved', async () => {
  let tail = Promise.resolve(), booked = false
  db.$transaction = (fn: any) => { const result = tail.then(() => fn(db)); tail = result.catch(() => {}); return result }
  db.appointment.findFirst.mockImplementation(async () => booked ? { id: 20 } : null)
  db.appointment.create.mockImplementation(async () => { booked = true; return { id: 20 } })
  const args = { data: { companyId: 2, professionalId: 7, startTime: new Date(), endTime: new Date(Date.now()+3600000) } }
  const results = await Promise.allSettled([createAppointmentSafely(args, db), createAppointmentSafely(args, db)])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(db.appointment.create).toHaveBeenCalledTimes(1)
})
