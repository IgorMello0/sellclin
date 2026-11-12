import { expect, it } from 'vitest'
import { botIdentity } from './bot-identity.js'
it('keeps the same customer memory across messages and scopes it by clinic', () => {
  const first = botIdentity(4, 7, 'live', '+55 (31) 99999-9999', 18)
  expect(first.contact.phone).toBe('5531999999999')
  expect(first.conversation.memoryKey).toBe('clinic:4:phone:5531999999999')
  expect(botIdentity(4, 7, 'live', '5531999999999@s.whatsapp.net', 19).conversation.memoryKey).toBe(first.conversation.memoryKey)
  expect(botIdentity(5, 7, 'live', '5531999999999', 18).conversation.memoryKey).not.toBe(first.conversation.memoryKey)
  expect(first.conversation.id).toBe('clinic:4:conversation:18')
})
it('separates test history and never invents a real customer phone', () => {
  const test = botIdentity(4, 7, 'connection_test')
  expect(test.contact.phone).toBeNull()
  expect(test.conversation.isTest).toBe(true)
  expect(test.conversation.memoryKey).toBe('test:clinic:4:bot:7:connection_test')
  expect(botIdentity(4, 7, 'playground').conversation.memoryKey).not.toBe(test.conversation.memoryKey)
})
it('does not interpret a WhatsApp LID as a phone', () => {
  expect(botIdentity(4, 7, 'live', '123456789123@lid', 18).contact.phone).toBeNull()
  expect(botIdentity(4, 7, 'live', '123456789123@lid', 18).conversation.memoryKey).toBe('clinic:4:conversation:18')
})
