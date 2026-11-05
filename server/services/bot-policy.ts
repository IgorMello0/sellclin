import { z } from 'zod'

export const botDecisionSchema = z.object({
  action: z.enum(['answer', 'handoff', 'qualify', 'slots']),
  reply: z.string().min(1).max(3000),
  evidence: z.string().max(2000).default(''),
  clinical: z.boolean().default(false),
  serviceId: z.number().int().positive().nullable().default(null),
  specialistId: z.number().int().positive().nullable().default(null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  fields: z.array(z.object({ key: z.string().max(60), value: z.string().max(500) })).max(12).default([]),
}).strict()
export type BotDecision = z.infer<typeof botDecisionSchema>
export type Slot = { serviceId: number; professionalId: number; specialistId?: number | null; label: string; start: string; end: string }
export type BotState = { offers?: Slot[]; pending?: Slot; offeredAt?: string; collected?: Record<string, string>; appointmentId?: number }
export const normalizeBotText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export function needsHuman(message: string, terms: string[] = []) {
  const text = normalizeBotText(message)
  return /\b(humano|atendente|recepcionista|diagnostico|medicamento|dosagem|sangramento|suicidio|falta de ar|dor no peito)\b/.test(text)
    || /falar (com|com a|com o) (pessoa|equipe|medic|doutor)/.test(text)
    || terms.some(term => term.trim() && text.includes(normalizeBotText(term)))
}
export function bookingInput(message: string, state: BotState, now = Date.now()) {
  const normalized = normalizeBotText(message).replace(/[.!]$/, '')
  if (normalized === 'cancelar') return { kind: 'cancel' as const }
  const fresh = state.offeredAt && now - new Date(state.offeredAt).getTime() < 15 * 60_000
  if (!fresh && (state.pending || state.offers?.length)) return { kind: 'expired' as const }
  if (normalized === 'confirmar' && state.pending) return { kind: 'confirm' as const, slot: state.pending }
  if (/^[1-9]\d?$/.test(normalized) && state.offers?.[Number(normalized) - 1]) return { kind: 'select' as const, slot: state.offers[Number(normalized) - 1] }
  return { kind: 'message' as const }
}
export function verifiedFields(fields: BotDecision['fields'], allowed: string[], message: string) {
  return Object.fromEntries(fields.filter(f => allowed.includes(f.key) && f.value.trim() && normalizeBotText(message).includes(normalizeBotText(f.value)))
    .filter(f => f.key !== 'email' || z.string().email().safeParse(f.value).success).map(f => [f.key, f.value.trim()]))
}
export function groundedReply(decision: BotDecision, knowledge: string) {
  return Boolean(decision.evidence.trim() && normalizeBotText(knowledge).includes(normalizeBotText(decision.evidence)))
}
export const HANDOFF_REPLY = 'Vou encaminhar sua conversa para a equipe da clínica continuar o atendimento.'
