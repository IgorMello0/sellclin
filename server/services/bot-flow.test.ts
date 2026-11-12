import { expect, it } from 'vitest'
import { flowTemplate, validateFlow } from './bot-flow-definition.js'
import { advanceBotFlow } from './bot-flow-runtime.js'

const config = (kind: string) => ({ flowDefinition: flowTemplate(kind), qualifyEnabled: true, qualificationFields: ['nome', 'interesse'] })
it('waits for a numbered menu choice and routes to AI or the team', () => {
  const c = config('menu')
  const first = advanceBotFlow(c, 'Olá', {})
  expect(first.reply).toContain('1. Dúvidas')
  expect(advanceBotFlow(c, 'inválido', first.state).kind).toBe('reply')
  expect(advanceBotFlow(c, '1', first.state).kind).toBe('ai')
  expect(advanceBotFlow(c, '2', first.state).handoff).toBe('flow_handoff')
})
it('collects only the configured fields across turns and hands off', () => {
  const c = config('qualification')
  const first = advanceBotFlow(c, 'Olá', {})
  expect(first.fields).toEqual({})
  const second = advanceBotFlow(c, 'Maria', first.state)
  expect(second.fields).toEqual({ nome: 'Maria' })
  const third = advanceBotFlow(c, 'Avaliação', second.state)
  expect(third.fields).toEqual({ interesse: 'Avaliação' })
  expect(third.state.collected).toEqual({ nome: 'Maria', interesse: 'Avaliação' })
  expect(third.handoff).toBe('flow_handoff')
})
it('rejects loops, disconnected nodes and missing destinations', () => {
  const graph = flowTemplate('welcome')
  graph.edges[1].to = 'welcome'
  expect(validateFlow(graph).join(' ')).toContain('ciclo')
  graph.edges = []
  expect(validateFlow(graph).length).toBeGreaterThan(0)
})
it('does not collect information when qualification is disabled', () => {
  expect(advanceBotFlow({ ...config('qualification'), qualifyEnabled: false }, 'Olá', {}).handoff).toBe('qualification_unavailable')
})
