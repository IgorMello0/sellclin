import { createHash } from 'node:crypto'
import { flowSchema, validateFlow } from './bot-flow-definition.js'
import { HANDOFF_REPLY, verifiedFields, type BotState } from './bot-policy.js'

// A bounded traversal handles synchronous blocks, then persists at a question.
// Delivery, lead updates and appointment writes remain in the existing worker.
export function advanceBotFlow(config: any, message: string, previous: BotState) {
  if (validateFlow(config.flowDefinition).length) throw new Error('invalid_flow')
  const graph = flowSchema.parse(config.flowDefinition)
  const revision = createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 20)
  const state: BotState = { ...previous, collected: { ...previous.collected } }
  let cursor = state.flow?.revision === revision ? state.flow : { revision, nodeId: graph.nodes.find(n => n.type === 'start')!.id, waiting: false }
  const replies: string[] = []
  const fields: Record<string, string> = {}
  const next = (from: string, port = 'next') => {
    const edge = graph.edges.find(e => e.from === from && e.port === port)
    if (!edge) throw new Error('invalid_flow')
    cursor = { revision, nodeId: edge.to, waiting: false }
  }
  const finish = (kind: 'reply' | 'ai', handoff: string | null = null) => ({ kind, reply: replies.join('\n\n'), state: { ...state, flow: cursor }, fields, handoff })
  for (let steps = 0; steps < 60; steps++) {
    const node = graph.nodes.find(n => n.id === cursor.nodeId)
    if (!node) throw new Error('invalid_flow')
    if (node.type === 'start') { next(node.id); continue }
    if (node.type === 'message') { replies.push(node.text); next(node.id); continue }
    if (node.type === 'ai') return finish('ai')
    if (node.type === 'handoff') { replies.push(node.text || HANDOFF_REPLY); return finish('reply', 'flow_handoff') }
    if (node.type === 'end') { replies.push(node.text || 'Atendimento concluído. Se precisar, nossa equipe está à disposição.'); return finish('reply') }
    if (node.type === 'condition') {
      const value = state.collected?.[node.field] || ''
      next(node.id, value.trim().toLocaleLowerCase('pt-BR') === node.value.trim().toLocaleLowerCase('pt-BR') ? 'yes' : 'no'); continue
    }
    if (node.type === 'collect') {
      if (!config.qualifyEnabled || !config.qualificationFields?.includes(node.field)) {
        replies.push(HANDOFF_REPLY); return finish('reply', 'qualification_unavailable')
      }
      if (!cursor.waiting) { cursor.waiting = true; replies.push(node.text); return finish('reply') }
      const captured = verifiedFields([{ key: node.field, value: message.trim().slice(0, 500) }], config.qualificationFields, message)
      if (!captured[node.field]) { replies.push(`Não consegui validar essa informação. ${node.text}`); return finish('reply') }
      Object.assign(fields, captured); Object.assign(state.collected!, captured); next(node.id); continue
    }
    if (node.type === 'menu') {
      const prompt = `${node.text}\n${node.options.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nResponda com o número da opção.`
      if (!cursor.waiting) { cursor.waiting = true; replies.push(prompt); return finish('reply') }
      const option = /^\d+$/.test(message.trim()) ? Number(message.trim()) - 1 : node.options.findIndex(o => o.toLocaleLowerCase('pt-BR') === message.trim().toLocaleLowerCase('pt-BR'))
      if (option < 0 || option >= node.options.length) { replies.push(prompt); return finish('reply') }
      next(node.id, String(option + 1)); continue
    }
  }
  throw new Error('invalid_flow')
}
