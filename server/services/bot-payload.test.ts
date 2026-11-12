import { expect, it, vi } from 'vitest'
vi.mock('../prisma.js', () => ({ prisma: {} }))
import { workflowPayload } from './bot-n8n.js'
import { botIdentity } from './bot-identity.js'
it('fills the legacy text message fields without provider credentials', () => {
  const p = workflowPayload({ mode: 'live', ...botIdentity(4, 8, 'live', '5531999999999', 10), message: { text: 'Oi', message_id: 'provider-1', timestamp: '2026-11-12T10:00:00Z' } }, 'run-1')
  expect(p.message).toMatchObject({ message_id: 'provider-1', chat_id: '5531999999999@s.whatsapp.net', content_type: 'text', content: 'Oi', text: 'Oi', timestamp: '2026-11-12T10:00:00Z', content_url: '', event: 'incoming' })
  expect(p.body.event).toBe('messages.upsert')
  expect(p.telefone).toBe(p.message.chat_id)
  expect(p).not.toHaveProperty('evoAPIKey')
})
it('supports a simulation phone but keeps its memory separate from live', () => {
  const test = workflowPayload({ mode: 'playground', ...botIdentity(4, 8, 'playground', '5531999999999'), message: { text: 'Oi' } }, 'test-1')
  expect(test.message.chat_id).toBe('5531999999999@s.whatsapp.net')
  expect(test.message.message_id).toBe('test-1')
  expect(test.conversation.memoryKey).toContain('test:')
  expect(test.conversation.isTest).toBe(true)
  expect(test.message.timestamp).toBeTruthy()
})
it('uses a clearly synthetic chat id when no test phone is supplied', () => {
  const p = workflowPayload({ ...botIdentity(4, 8, 'connection_test'), message: { text: 'Olá' } }, 'test-1')
  expect(p.message.chat_id).toBe('test:clinic:4:bot:8:connection_test')
})
