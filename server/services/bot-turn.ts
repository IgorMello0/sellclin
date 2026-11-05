import { generateBotDecision, type BotHistory } from './bot-provider.js'
import { bookingInput, groundedReply, HANDOFF_REPLY, needsHuman, verifiedFields, type BotState, type Slot } from './bot-policy.js'
import { botCatalog, botSpecialists, availableBotSlots } from './bot-agenda.js'
import { prisma } from '../prisma.js'

export async function prepareBotTurn(input: { agent: any; config: any; companyId: number; message: string; history: BotHistory; state: BotState; responseCount: number },
  deps = { db: prisma as any, generate: generateBotDecision }) {
  const { agent, config, companyId, message, history, responseCount } = input
  const state = { ...input.state }
  const result = { reply: '', state, handoff: null as string | null, fields: {} as Record<string, string>, confirmSlot: null as Slot | null, inputTokens: 0, outputTokens: 0 }
  const handoff = (reason: string) => ({ ...result, state: { collected: state.collected || {} }, handoff: reason, reply: HANDOFF_REPLY })
  const recentInbound = history.slice(history.map(m => m.role).lastIndexOf('assistant') + 1).filter(m => m.role === 'user').map(m => m.content).join('\n')
  if (needsHuman(`${recentInbound}\n${message}`, Array.isArray(config.handoffTerms) ? config.handoffTerms : [])) return handoff('requested_human')
  if (responseCount >= config.maxResponses) return handoff('response_limit')
  const booking = bookingInput(message, state)
  if (booking.kind === 'cancel' || booking.kind === 'expired') return { ...result, state: { collected: state.collected || {} }, reply: booking.kind === 'cancel' ? 'Seleção cancelada. Qual serviço e data você prefere?' : 'Vou consultar a disponibilidade novamente. Qual serviço e data você prefere?' }
  if (config.bookingEnabled && booking.kind === 'select') return { ...result, state: { ...state, pending: booking.slot, offers: undefined }, reply: `Você escolheu: ${booking.slot.label}. Para reservar, responda CONFIRMAR. Para mudar, responda CANCELAR.` }
  if (config.bookingEnabled && booking.kind === 'confirm') return { ...result, confirmSlot: booking.slot }
  const catalog = config.bookingEnabled ? await botCatalog(companyId, deps.db) : []
  const specialists = config.bookingEnabled ? await botSpecialists(companyId, deps.db) : []
  const fields = Array.isArray(config.qualificationFields) ? config.qualificationFields : ['nome', 'email', 'interesse']
  const knowledge = `${config.knowledge}\nCatálogo de serviços: ${JSON.stringify(catalog)}`
  const answer = await deps.generate({ provider: config.provider, model: config.model, apiKey: config.apiKey, prompt: agent.basePrompt, knowledge },
    [...history.slice(-14), { role: 'user', content: message }], JSON.stringify({ today: new Date().toISOString(), timezone: config.timezone, specialists, fields: config.qualifyEnabled ? fields : [], collected: state.collected || {}, bookingEnabled: config.bookingEnabled }))
  Object.assign(result, { inputTokens: answer.inputTokens, outputTokens: answer.outputTokens })
  const decision = answer.decision
  if (decision.clinical || decision.action === 'handoff') return handoff(decision.clinical ? 'clinical_topic' : 'knowledge_missing')
  if (config.qualifyEnabled) {
    result.fields = verifiedFields(decision.fields, fields, message)
    result.state = { ...state, collected: { ...state.collected, ...result.fields } }
  }
  if (decision.action === 'slots') {
    if (!config.bookingEnabled) return handoff('booking_disabled')
    if (!decision.serviceId || !decision.date) return { ...result, reply: 'Qual serviço e data você deseja agendar?' }
    const slots = await availableBotSlots(companyId, decision.serviceId, decision.date, config, deps.db, new Date(), decision.specialistId)
    return { ...result, state: { ...result.state, offers: slots, pending: undefined, offeredAt: new Date().toISOString() }, reply: slots.length
      ? `Horários disponíveis:\n${slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\nResponda com o número do horário desejado.`
      : 'Não encontrei horários disponíveis para esse serviço nessa data. Informe outra data ou peça atendimento humano.' }
  }
  if (decision.action === 'answer' && !groundedReply(decision, knowledge)) return handoff('knowledge_missing')
  // A qualification action can only ask for information. Factual answers require evidence.
  if (decision.action === 'qualify' && !decision.reply.includes('?')) return { ...result, reply: 'Como posso ajudar? Você pode perguntar sobre a clínica, informar seu serviço de interesse ou pedir um agendamento.' }
  return { ...result, reply: decision.reply }
}
