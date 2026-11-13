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
it('uses a fixed simulation phone and keeps its memory separate from live', () => {
  const test = workflowPayload({ mode: 'playground', ...botIdentity(4, 8, 'playground', '5531999999999'), message: { text: 'Oi' } }, 'test-1')
  expect(test.message.chat_id).toBe('5500000000000@s.whatsapp.net')
  expect(test.message.message_id).toBe('test-1')
  expect(test.conversation.memoryKey).toContain('test:')
  expect(test.conversation.isTest).toBe(true)
  expect(test.message.timestamp).toBeTruthy()
})
it('uses the fixed fictional phone when none is supplied', () => {
  const p = workflowPayload({ ...botIdentity(4, 8, 'connection_test'), message: { text: 'Olá' } }, 'test-1')
  expect(p.message.chat_id).toBe('5500000000000@s.whatsapp.net')
})

it('preserves audio download metadata in the webhook JSON', () => {
  const p = workflowPayload({ mode: 'live', ...botIdentity(2, 3, 'live', '5511000000000', 10), message: {
    text: '', content_type: 'audio', content_url: 'https://sellclin.com/uploads/media/2/test.mp3?mediaSignature=signed', mime_type: 'audio/mpeg', file_name: 'test.mp3',
  } }, 'run-audio')
  expect(p.message).toMatchObject({ content_type: 'audio', content: '', mime_type: 'audio/mpeg', file_name: 'test.mp3' })
  expect(p.message.content_url).toContain('mediaSignature=')
  expect(p.telefone).toBe('5511000000000@s.whatsapp.net')
})

it.each(['audio', 'image', 'video', 'sticker', 'document'])('keeps %s Base64 intact across JSON serialization and webhook enveloping', content_type => {
  const bytes = Buffer.from([0, 255, 128, 10, 13, 1])
  const payload = workflowPayload({ message: { text: '', content_type, base64: bytes.toString('base64'), encoding: 'base64' } }, 'media-run')
  const webhook = { body: JSON.parse(JSON.stringify(payload)) }
  expect(webhook.body.message.content_type).toBe(content_type)
  expect(Buffer.from(webhook.body.message.base64, 'base64')).toEqual(bytes)
})
