// @vitest-environment node
import express from 'express'
import type { Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ db: {} as any, owner: true }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../middleware/auth.js', () => ({
  auth: () => (req: any, _res: any, next: any) => { req.user = { id: 7, companyId: 2 }; next() },
  requireModule: () => (_req: any, _res: any, next: any) => next(),
  requireCompanyOwner: () => (_req: any, res: any, next: any) => state.owner ? next() : res.status(403).json({ success: false }),
}))
vi.mock('../services/bot-provider.js', () => ({ generateBotDecision: vi.fn().mockResolvedValue({ decision: {}, inputTokens: 1, outputTokens: 1 }), BotProviderError: class extends Error {}, providerErrorMessage: () => 'Falha da IA' }))
vi.mock('../services/bot-turn.js', () => ({ prepareBotTurn: vi.fn().mockResolvedValue({ reply: 'Teste', state: {}, inputTokens: 1, outputTokens: 1 }) }))
import { router } from './agentes-ia.js'
let server: Server, base: string, agents: any[], configs: any[], counter: number
const matches = (o: any, where: any) => Object.entries(where).every(([k,v]) => v instanceof Date ? o[k]?.getTime() === v.getTime() : o[k] === v)
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/bots', router)
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  base = `http://127.0.0.1:${(server.address() as any).port}/bots`
})
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())) })
beforeEach(() => {
  state.owner = true; counter = 10
  agents = [1,2,3].map(id => ({ id, companyId: id === 3 ? 9 : 2, name: `Bot ${id}`, basePrompt: 'Ajude', temperature: 0.7, isActive: false, updatedAt: new Date() }))
  configs = agents.map(a => ({ agentId: a.id, provider: 'openai', model: 'test', apiKey: 'private-test-key', knowledge: 'Rua A', maxResponses: 5, dailyLimit: 50, verifiedAt: new Date(), playgroundAt: new Date(), updatedAt: new Date() }))
  let tail = Promise.resolve()
  Object.assign(state.db, {
    $queryRaw: vi.fn().mockResolvedValue([{ ready: true }]),
    $transaction: (fn: any) => { const result = tail.then(() => fn(state.db)); tail = result.catch(() => {}); return result },
    agenteIa: {
      findFirst: vi.fn(async ({ where, include }: any) => { const agent = agents.find(a => matches(a,where)); return agent ? { ...agent, ...(include ? { configuracao: configs.find(c => c.agentId === agent.id) } : {}) } : null }),
      findMany: vi.fn(async ({ where }: any) => agents.filter(a => matches(a,where))), count: vi.fn().mockResolvedValue(2),
      create: vi.fn(async ({ data }: any) => { const agent = { id: ++counter, ...data }; agents.push(agent); return agent }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(agents.find(a => a.id === where.id),data)),
      updateMany: vi.fn(async ({ where, data }: any) => { const items = agents.filter(a => matches(a,where)); items.forEach(a => Object.assign(a,data)); return { count: items.length } }),
      delete: vi.fn(async ({ where }: any) => { agents = agents.filter(a => a.id !== where.id) }),
    },
    botConfiguracao: { findUnique: vi.fn(async ({ where }: any) => configs.find(c => c.agentId === where.agentId)),
      create: vi.fn(async ({ data }: any) => { configs.push(data); return data }),
      updateMany: vi.fn(async ({ where, data }: any) => { const items = configs.filter(c => matches(c,where)); items.forEach(c => Object.assign(c,data)); return { count: items.length } }),
      upsert: vi.fn(async ({ where, create, update }: any) => { const c = configs.find(c => c.agentId === where.agentId); if (c) Object.assign(c, update); else configs.push(create) }),
    },
    empresa: { findUnique: vi.fn().mockResolvedValue({ whatsappProvider: 'meta' }) },
    conversa: { updateMany: vi.fn() }, botRun: { updateMany: vi.fn(), create: vi.fn(), aggregate: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  })
})
async function call(path = '', method = 'GET', data?: any) { const response = await fetch(base+path, { method, headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }); return { status: response.status, body: await response.json() } }
it('saves n8n without an AI key, never exposes its token, and invalidates it when changing destinations', async () => {
  const data = { executionMode: 'n8n', n8nWebhookUrl: 'https://workflow.example.com/webhook/a', n8nSecret: 'workflow-private-token' }
  expect((await call('/1/configuracao', 'PUT', data)).status).toBe(200)
  const saved = (await call('/1/configuracao')).body.data
  expect(saved.hasN8nSecret).toBe(true)
  expect(JSON.stringify(saved)).not.toContain('workflow-private-token')
  expect(configs[0].verifiedAt).toBe(null)
  expect((await call('/1/configuracao', 'PUT', { ...data, n8nSecret: '' })).status).toBe(200)
  expect(configs[0].n8nSecret).toBe('workflow-private-token')
  await call('/1/configuracao', 'PUT', { ...data, n8nSecret: '', n8nWebhookUrl: 'https://other.example.com/webhook/b' })
  expect(configs[0].n8nSecret).toBe(null)
  expect((await call('/1/ativar', 'POST', { approveCosts: true })).status).toBe(409)
})
it('allows one verified n8n bot to replace a native bot without needing an AI key', async () => {
  agents[1].isActive = true
  Object.assign(configs[0], { executionMode: 'n8n', apiKey: null, n8nWebhookUrl: 'https://workflow.example.com/webhook/a', n8nSecret: 'test' })
  expect((await call('/1/ativar', 'POST', { approveCosts: true })).status).toBe(200)
  expect(agents.filter(a => a.isActive).map(a => a.id)).toEqual([1])
})
it('lists only the authenticated clinic and ignores a client-supplied companyId on create', async () => {
  expect((await call()).body.data).toHaveLength(2)
  const created = await call('', 'POST', { name: 'Novo', basePrompt: 'Ajude', companyId: 9, isActive: true })
  expect(created.status).toBe(201)
  expect(created.body.data).toMatchObject({ companyId: 2, isActive: false })
})
it('denies foreign agents and non-owner writes or credentials', async () => {
  expect((await call('/3/configuracao')).status).toBe(404)
  expect((await call('/3', 'DELETE')).status).toBe(404)
  state.owner = false
  expect((await call('/1/configuracao')).status).toBe(403)
  expect((await call('/1', 'PUT', { name: 'bad' })).status).toBe(403)
})
it('never returns the saved key and preserves it on a blank update', async () => {
  const result = await call('/1/configuracao')
  expect(JSON.stringify(result.body)).not.toContain('private-test-key')
  expect(result.body.data.hasApiKey).toBe(true)
  expect((await call('/1/configuracao', 'PUT', { provider: 'openai', model: 'test', apiKey: '', knowledge: 'new' })).status).toBe(200)
  expect(configs[0].apiKey).toBe('private-test-key')
  expect(configs[0].playgroundAt).toBeNull()
})
it('clears obsolete keys on provider switch and invalidates activation after edits', async () => {
  agents[0].isActive = true
  await call('/1/configuracao', 'PUT', { provider: 'anthropic', model: 'new' })
  expect(configs[0].apiKey).toBeNull()
  expect(configs[0].verifiedAt).toBeNull()
  expect(agents[0].isActive).toBe(false)
  expect((await call('/1/ativar', 'POST', { approveCosts: true })).status).toBe(409)
})
it('serializes concurrent activations, leaving exactly one active agent in this clinic', async () => {
  const responses = await Promise.all([call('/1/ativar', 'POST', { approveCosts: true }), call('/2/ativar', 'POST', { approveCosts: true })])
  expect(responses.map(r => r.status)).toEqual([200,200])
  expect(agents.filter(a => a.companyId === 2 && a.isActive)).toHaveLength(1)
  expect(agents[2].isActive).toBe(false)
})
it('duplicates settings into an inactive bot without returning the key', async () => {
  agents[0].isActive = true
  const result = await call('/1/duplicate', 'POST')
  expect(result.status).toBe(201)
  expect(result.body.data.isActive).toBe(false)
  expect(JSON.stringify(result.body)).not.toContain('private-test-key')
  expect(configs.at(-1)).toMatchObject({ agentId: result.body.data.id, knowledge: 'Rua A' })
})
it('deletes an owned bot and clears its queued runs and conversation links', async () => {
  expect((await call('/1', 'DELETE')).status).toBe(200)
  expect(agents.find(a => a.id === 1)).toBeUndefined()
  expect(state.db.botRun.updateMany).toHaveBeenCalled()
  expect(state.db.conversa.updateMany).toHaveBeenCalledWith({ where: { agentId: 1 }, data: { agentId: null } })
})
