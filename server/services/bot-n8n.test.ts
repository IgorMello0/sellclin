import { beforeEach, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./integration-http.js', async importOriginal => ({ ...await importOriginal<any>(), integrationHttpClient: transport }))
vi.mock('../prisma.js', () => ({ prisma: {} }))
import { callBotWorkflow, validWorkflowUrl } from './bot-n8n.js'
import { prepareBotTurn } from './bot-turn.js'
import { resolveIntegrationTarget } from './integration-http.js'
import { protectCredentialData, readCredentialData } from './integration-encryption.js'
import { safeIntegrationOutput } from '../middleware/integration-output.js'
const config = { executionMode: 'n8n', n8nWebhookUrl: 'https://workflow.example.com/webhook/bot', n8nSecret: 'private-test-token', n8nTimeoutSeconds: 10, knowledge: 'Rua A, 10.', maxResponses: 5, qualifyEnabled: true, bookingEnabled: false, qualificationFields: ['nome'], timezone: 'America/Sao_Paulo' }
beforeEach(() => transport.fetch.mockReset())
it('authenticates using headers, requires public pinned transport and never puts credentials in the event', async () => {
  transport.fetch.mockResolvedValue(Response.json({ action: 'handoff', reply: 'Equipe' }))
  await callBotWorkflow(config, { eventId: 'bot-run-1', mode: 'live' })
  const [url, request, , policy] = transport.fetch.mock.calls[0]
  expect(url).toBe(config.n8nWebhookUrl)
  expect(request.headers.Authorization).toBe('Bearer private-test-token')
  expect(request.headers['X-SellClin-Event-Id']).toBe('bot-run-1')
  expect(request.body).not.toContain('private-test-token')
  expect(policy).toEqual({ publicOnly: true, maxResponseBytes: 65536 })
})
it('rejects redirects, forbidden actions, oversized responses, authentication failures and timeouts without replay', async () => {
  for (const response of [new Response('', { status: 302 }), new Response('secret', { status: 401 }), Response.json({ action: 'book', reply: 'Booked' }), Response.json({ action: 'answer', reply: 'x', companyId: 9 }), new Response('x'.repeat(65537))]) {
    transport.fetch.mockResolvedValueOnce(response)
    await expect(callBotWorkflow(config, {})).rejects.toThrow(/^workflow_/)
  }
  transport.fetch.mockRejectedValueOnce(new Error('private-test-token'))
  await expect(callBotWorkflow(config, {})).rejects.toThrow('workflow_invalid_response')
  expect(transport.fetch).toHaveBeenCalledTimes(6)
})
it('blocks private resolution even when another integration could trust that host', async () => {
  for (const url of ['http://example.com/webhook/a', 'https://user:pass@example.com/a', 'https://example.com/webhook-test/a', 'https://example.com/a?token=x']) expect(validWorkflowUrl(url)).toBe(false)
  await expect(resolveIntegrationTarget('https://private.example.com/a', async () => [{ address: '127.0.0.1', family: 4 }], [])).rejects.toThrow()
})
it('uses the same evidence, qualification and human-control rules as the native bot', async () => {
  const input = { agent: { name: 'Recepção', basePrompt: 'Ajude' }, config, companyId: 2, message: 'Meu nome é Ana', history: [], state: {}, responseCount: 0, eventId: 'run-2', mode: 'live' }
  transport.fetch.mockResolvedValueOnce(Response.json({ action: 'qualify', reply: 'Qual serviço?', fields: [{ key: 'nome', value: 'Ana' }, { key: 'companyId', value: '2' }] }))
  const deps = { db: {}, generate: vi.fn() }
  expect((await prepareBotTurn(input, deps)).fields).toEqual({ nome: 'Ana' })
  transport.fetch.mockResolvedValueOnce(Response.json({ action: 'answer', reply: 'Preço inventado', evidence: 'inexistente' }))
  expect((await prepareBotTurn(input, deps)).handoff).toBe('knowledge_missing')
  expect((await prepareBotTurn({ ...input, message: 'Quero um atendente' }, deps)).handoff).toBe('requested_human')
  expect(transport.fetch).toHaveBeenCalledTimes(2)
  expect(deps.generate).not.toHaveBeenCalled()
})
it('encrypts workflow credentials and removes them even from owner responses', () => {
  const key = Buffer.alloc(32, 7)
  const encrypted = protectCredentialData('BotConfiguracao', { n8nSecret: config.n8nSecret }, key)
  expect(JSON.stringify(encrypted)).not.toContain(config.n8nSecret)
  expect(readCredentialData(encrypted, key)).toEqual({ n8nSecret: config.n8nSecret })
  expect(safeIntegrationOutput({ n8nSecret: config.n8nSecret }, true)).toEqual({})
})
it('applies migration twice preserving native configuration and ships an authenticated inactive workflow', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE bot_configuracoes(agent_id INT PRIMARY KEY); CREATE TABLE bot_runs(id INT PRIMARY KEY); INSERT INTO bot_configuracoes VALUES(1)')
    const sql = await readFile(new URL('../../database/bot-n8n.sql', import.meta.url), 'utf8')
    await db.exec(sql); await db.exec(sql)
    expect((await db.query('SELECT execution_mode FROM bot_configuracoes')).rows).toEqual([{ execution_mode: 'native' }])
  } finally { await db.close() }
  const workflow = JSON.parse(await readFile(new URL('../../public/examples/sellclin-n8n.json', import.meta.url), 'utf8'))
  expect(workflow.active).toBe(false)
  expect(workflow.nodes[0].parameters.authentication).toBe('headerAuth')
  expect(workflow.nodes[2].parameters.responseBody).toBe('={{ $json }}')
})
