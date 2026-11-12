import { z } from 'zod'

export const flowNodeTypes = ['start', 'message', 'menu', 'collect', 'condition', 'ai', 'handoff', 'end'] as const
export const flowSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), type: z.enum(flowNodeTypes),
    x: z.number().min(0).max(5000), y: z.number().min(0).max(5000),
    text: z.string().max(3000).default(''), field: z.string().max(60).default(''), value: z.string().max(300).default(''),
    options: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
  })).min(2).max(60),
  edges: z.array(z.object({ from: z.string(), to: z.string(), port: z.string().max(30).default('next') })).max(120),
})
export type BotFlow = z.infer<typeof flowSchema>
export type FlowNode = BotFlow['nodes'][number]
export const nodeLabels: Record<FlowNode['type'], string> = { start: 'Início', message: 'Enviar mensagem', menu: 'Menu de opções', collect: 'Coletar informação', condition: 'Condição', ai: 'Assistente de IA', handoff: 'Transferir para equipe', end: 'Encerrar' }
export function nodePorts(node: FlowNode): string[] {
  return node.type === 'menu' ? node.options.map((_, i) => String(i + 1)) : node.type === 'condition' ? ['yes', 'no'] : ['end', 'handoff', 'ai'].includes(node.type) ? [] : ['next']
}
export function validateFlow(value: unknown): string[] {
  const parsed = flowSchema.safeParse(value)
  if (!parsed.success) return ['Confira os blocos e os limites do fluxo.']
  const { nodes, edges } = parsed.data
  const errors: string[] = []
  const ids = new Set(nodes.map(n => n.id))
  if (ids.size !== nodes.length) errors.push('Há blocos com identificadores repetidos.')
  const starts = nodes.filter(n => n.type === 'start')
  if (starts.length !== 1) errors.push('O fluxo precisa de exatamente um início.')
  for (const n of nodes) {
    if (['message', 'menu', 'collect'].includes(n.type) && !n.text.trim()) errors.push(`${nodeLabels[n.type]}: escreva a mensagem.`)
    if (['collect', 'condition'].includes(n.type) && !n.field.trim()) errors.push(`${nodeLabels[n.type]}: escolha um campo.`)
    if (n.type === 'menu' && n.options.length < 2) errors.push('O menu precisa de pelo menos duas opções.')
    for (const port of nodePorts(n)) if (edges.filter(e => e.from === n.id && e.port === port).length !== 1) errors.push(`${nodeLabels[n.type]}: conecte a saída ${port}.`)
  }
  for (const edge of edges) {
    const from = nodes.find(n => n.id === edge.from)
    if (!from || !ids.has(edge.to) || !nodePorts(from).includes(edge.port) || nodes.find(n => n.id === edge.to)?.type === 'start') errors.push('Há uma conexão inválida.')
  }
  const visited = new Set<string>(), stack = new Set<string>()
  function visit(id: string) {
    if (stack.has(id)) { errors.push('Remova o ciclo de conexões. Use o assistente de IA para continuar uma conversa.'); return }
    if (visited.has(id)) return
    visited.add(id); stack.add(id)
    edges.filter(e => e.from === id).forEach(e => visit(e.to)); stack.delete(id)
  }
  if (starts.length === 1) visit(starts[0].id)
  if (visited.size !== nodes.length) errors.push('Conecte todos os blocos ao início.')
  return [...new Set(errors)]
}
export function flowTemplate(kind = 'blank'): BotFlow {
  const node = (id: string, type: FlowNode['type'], text = '', field = '', options: string[] = []): FlowNode => ({ id, type, text, field, options, value: '', x: 80, y: 60 })
  let nodes = [node('start', 'start')]
  if (kind === 'welcome') nodes.push(node('welcome', 'message', 'Olá! Seja bem-vindo(a). Como podemos ajudar?'), node('assistant', 'ai'))
  else if (kind === 'qualification') nodes.push(node('name', 'collect', 'Como você se chama?', 'nome'), node('interest', 'collect', 'Qual serviço você procura?', 'interesse'), node('team', 'handoff'))
  else if (kind === 'menu') {
    nodes.push(node('menu', 'menu', 'Como podemos ajudar?', '', ['Dúvidas e agendamento', 'Falar com a equipe']), node('assistant', 'ai'), node('team', 'handoff'))
    nodes.forEach((n, i) => { n.y += i * 170 })
    return { version: 1, nodes, edges: [{ from: 'start', to: 'menu', port: 'next' }, { from: 'menu', to: 'assistant', port: '1' }, { from: 'menu', to: 'team', port: '2' }] }
  } else nodes.push(node('assistant', 'ai'))
  nodes.forEach((n, i) => { n.y += i * 170 })
  return { version: 1, nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id, port: 'next' })) }
}
