// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ fetch: vi.fn(), uazapi: vi.fn() }))
vi.mock('./integration-http.js', () => ({ integrationHttpClient: { fetch: state.fetch } }))
vi.mock('./uazapi-whatsapp.js', () => ({ sendUazapiRequest: state.uazapi }))
import { generateBotDecision } from './bot-provider.js'
import { sendBotWhatsApp } from './bot-whatsapp.js'
const config = { provider: 'openai', model: 'test-model', apiKey: 'secret-test', prompt: 'Ajude', knowledge: 'Endereço: Rua A' }
const decision = { action: 'answer', reply: 'Rua A', evidence: 'Rua A', fields: [] }
beforeEach(() => vi.resetAllMocks())
it('supports OpenAI responses with bounded history, no provider persistence and token counts', async () => {
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(decision) }] }], usage: { input_tokens: 12, output_tokens: 5 } })))
  expect(await generateBotDecision(config, [{ role: 'user', content: 'Onde?' }])).toMatchObject({ decision, inputTokens: 12, outputTokens: 5 })
  const request = JSON.parse(state.fetch.mock.calls[0][1].body)
  expect(request.store).toBe(false)
  expect(request.instructions).not.toContain('secret-test')
})
it('supports Anthropic messages and parses structured responses', async () => {
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(decision) }] })))
  expect((await generateBotDecision({ ...config, provider: 'anthropic' }, [{ role: 'user', content: 'Olá' }])).decision.action).toBe('answer')
  expect(state.fetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
})
it('fails closed on invalid output, permissions, quota and transport failures without exposing secrets', async () => {
  for (const [status, code] of [[401, 'credentials'], [429, 'quota'], [500, 'provider_unavailable']] as const) {
    state.fetch.mockResolvedValue(new Response('secret-test', { status }))
    await expect(generateBotDecision(config, [])).rejects.toThrow(code)
  }
  state.fetch.mockRejectedValue(new Error('secret-test'))
  await expect(generateBotDecision(config, [])).rejects.toThrow('invalid_response')
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: '{"action":"run_sql"}' }] }] })))
  await expect(generateBotDecision(config, [])).rejects.toThrow('invalid_response')
})
it('sends text through Meta and Uazapi and rejects closed windows', async () => {
  const conversation = { phone: '+55 (11) 99999-9999', lastInboundAt: new Date() }
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'meta-1' }] })))
  expect(await sendBotWhatsApp(conversation, { whatsappProvider: 'meta', metaToken: 'token', metaPhoneNumberId: '123' }, 'Olá')).toBe('meta-1')
  expect(JSON.parse(state.fetch.mock.calls[0][1].body).to).toBe('5511999999999')
  process.env.UAZAPI_API_URL = 'https://example.test'
  state.uazapi.mockResolvedValue({ response: { ok: true }, data: { messageid: 'uaz-1' } })
  expect(await sendBotWhatsApp(conversation, { whatsappProvider: 'uazapi', uazapiToken: 'token' }, 'Olá')).toBe('uaz-1')
  await expect(sendBotWhatsApp({ ...conversation, lastInboundAt: new Date(0) }, { whatsappProvider: 'meta' }, 'Olá')).rejects.toThrow('window_closed')
  delete process.env.UAZAPI_API_URL
})
