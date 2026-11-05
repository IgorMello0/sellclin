// @vitest-environment node
import express from 'express'
import jwt from 'jsonwebtoken'
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Server } from 'node:http'

const state = vi.hoisted(() => ({ db: {} as any, writes: [] as any[], calls: [] as any[], grants: true }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../services/billing.js', () => ({ canCompanyAccessModule: async () => ({ hasAccess: true }) }))
vi.mock('../utils/audit.js', () => ({ logAudit: vi.fn() }))

import { passwordSessionStamp } from '../services/session-security.js'
import { getJwtSecret } from '../config/security.js'
import { routePolicy } from '../middleware/route-policy.js'
import { router as messages } from './mensagens.js'
import { router as catalog } from './catalog-items.js'
import { router as templates } from './ficha-templates.js'
import { router as fichas } from './fichas.js'
import { router as professionals } from './professionals.js'
import { router as notifications } from './notifications.js'
import { router as conversations } from './conversas.js'
import { router as categories } from './categories.js'
import { router as roles } from './roles.js'

function matches(row: any, where: any): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true
    if (key === 'OR') return value.some((part: any) => matches(row, part))
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((part: any) => matches(row, part))
    if (value && typeof value === 'object') {
      if ('some' in value) return (row[key] || []).some((item: any) => matches(item, value.some))
      return matches(row[key] || {}, value)
    }
    return row[key] === value
  })
}
function model(name: string, rows: any[]) {
  const read = (args: any = {}) => {
    state.calls.push({ model: name, ...args })
    return rows.filter(row => matches(row, args.where))
  }
  return {
    findFirst: vi.fn(async (args: any) => read(args)[0] || null),
    findUnique: vi.fn(async (args: any) => read(args)[0] || null),
    findMany: vi.fn(async (args: any) => read(args)),
    count: vi.fn(async (args: any) => read(args).length),
    create: vi.fn(async ({ data }: any) => { state.writes.push({ model: name, data }); return { id: 999, ...data } }),
    update: vi.fn(async (args: any) => { state.writes.push({ model: name, ...args }); return { ...read(args)[0], ...args.data } }),
    delete: vi.fn(async (args: any) => { state.writes.push({ model: name, ...args }); return read(args)[0] }),
  }
}
let server: Server
let base: string
beforeAll(async () => {
  const app = express()
  app.use(express.json(), routePolicy)
  for (const [prefix, router] of Object.entries({ mensagens: messages, catalogo: catalog, 'ficha-templates': templates, fichas, profissionais: professionals, notifications, conversas: conversations, categorias: categories, roles })) app.use(`/api/${prefix}`, router)
  app.get('/api/unregistered', (_req, res) => res.json({ leaked: true }))
  app.use((error: any, _req: any, res: any, _next: any) => res.status(400).json({ error: error.message }))
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  base = `http://127.0.0.1:${(server.address() as any).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())) })
beforeEach(() => {
  state.writes = []; state.calls = []; state.grants = true
  const role = { value: 'sdr', companyId: 1, isSDR: true, permissions: [{ hasAccess: true, subPermissions: { editarContatos: true, verClientes: true } }] }
  const account = { id: 7, companyId: 1, isActive: true, passwordHash: 'test-password-hash', role, company: { id: 1, isActive: true }, companyAccess: [] }
  state.db.usuario = model('usuario', [account])
  state.db.professional = model('professional', [{ ...account, id: 7, ownedCompanies: [{ id: 1, isActive: true }, { id: 2, isActive: true }] }])
  state.db.userCompanyAccess = { findUnique: async () => null }
  state.db.module = { findUnique: async () => ({ id: 1, isActive: true }) }
  state.db.userCompanyPermission = { findUnique: async () => state.grants ? { hasAccess: true } : { hasAccess: false } }
  state.db.professionalPermission = { findUnique: async () => null }
  state.db.empresa = model('empresa', [{ id: 1, ownerId: 7, isActive: true }, { id: 2, ownerId: 7, isActive: true }])
  const own = { id: 10, companyId: 1, lead: { sdrId: 7, closerId: null, visibilityGrants: [] }, assignedUserId: 7 }
  const colleague = { id: 11, companyId: 1, lead: { sdrId: 8, closerId: null, visibilityGrants: [] }, assignedUserId: 8 }
  const other = { ...own, id: 20, companyId: 2 }
  state.db.conversa = model('conversa', [own, colleague, other])
  state.db.mensagem = model('mensagem', [own, colleague, other].map(conversation => ({ id: conversation.id, conversationId: conversation.id, conversation, content: 'fixture' })))
  state.db.client = model('client', [{ id: 1, companyId: 1 }, { id: 2, companyId: 2 }])
  state.db.agenteIa = model('agenteIa', [{ id: 1, companyId: 1 }, { id: 2, companyId: 2 }])
  for (const name of ['category', 'catalogItem', 'fichaTemplate']) state.db[name] = model(name, [{ id: 1, companyId: 1, professionalId: 7, createdBy: 7 }, { id: 2, companyId: 2, professionalId: 7, createdBy: 7 }])
  state.db.ficha = model('ficha', [{ id: 1, client: { companyId: 1 } }, { id: 2, client: { companyId: 2 } }])
  state.db.notification = model('notification', [{ id: 1, companyId: 1, recipientUserId: 7 }, { id: 2, companyId: 2, recipientUserId: 7 }])
})
function request(path: string, options: { method?: string; body?: any; type?: string; company?: number; anonymous?: boolean } = {}) {
  const token = jwt.sign({ id: 7, type: options.type || 'usuario', companyId: 1, allowedCompanies: [1, 2, 999], passwordStamp: passwordSessionStamp('test-password-hash', getJwtSecret()) }, getJwtSecret(), { expiresIn: '1h' })
  return fetch(base + path, { method: options.method || 'GET', headers: { 'content-type': 'application/json', ...(!options.anonymous ? { authorization: `Bearer ${token}` } : {}), ...(options.company ? { 'x-company-id': String(options.company) } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) })
}
it('denies missing sessions, forged tenant membership and unregistered routes', async () => {
  expect((await request('/api/mensagens', { anonymous: true })).status).toBe(401)
  expect((await request('/api/mensagens', { company: 2 })).status).toBe(403)
  expect((await request('/api/unregistered')).status).toBe(404)
  expect(state.writes).toEqual([])
})
it('lists only visible messages and allows a visible detail', async () => {
  expect((await (await request('/api/mensagens')).json()).data.map((row: any) => row.id)).toEqual([10])
  expect((await request('/api/mensagens/10')).status).toBe(200)
})
it.each([11, 20])('blocks read/update/delete and creation in forbidden conversation %s', async id => {
  for (const method of ['GET', 'PUT', 'DELETE']) expect((await request(`/api/mensagens/${id}`, { method, ...(method === 'PUT' ? { body: { content: 'attack' } } : {}) })).status).toBe(404)
  expect((await request('/api/mensagens', { method: 'POST', body: { conversationId: id, content: 'attack' } })).status).toBe(404)
  expect(state.writes).toEqual([])
})
it('allows visible message writes and honors explicit module denial', async () => {
  expect((await request('/api/mensagens/10', { method: 'PUT', body: { content: 'allowed' } })).status).toBe(200)
  expect(state.writes[0].where.conversation.companyId).toBe(1)
  state.grants = false
  expect((await request('/api/mensagens')).status).toBe(403)
})
it.each(['/api/profissionais/me', '/api/profissionais/onboarding/complete'])('rejects account-type collision on %s', async path => {
  const method = path.endsWith('complete') ? 'POST' : 'GET'
  expect((await request(path, { method })).status).toBe(403)
  if (method === 'GET') expect((await request(path, { method: 'PUT', body: { name: 'attack' } })).status).toBe(403)
  expect(state.writes).toEqual([])
})
it.each(['/api/catalogo', '/api/categorias', '/api/ficha-templates'])('isolates shared-owner records in %s', async path => {
  expect((await (await request(path)).json()).data.map((row: any) => row.id)).toEqual([1])
  expect((await request(`${path}/2`)).status).toBe(404)
  expect((await request(`${path}/2`, { method: 'DELETE', type: 'profissional' })).status).toBe(404)
  expect((await request(`${path}/2`, { type: 'profissional', company: 2 })).status).toBe(200)
  expect(state.writes).toEqual([])
  for (const call of state.calls) {
    expect(call.include?.appointments).not.toBe(true)
    expect(call.include?.fichas).not.toBe(true)
  }
})
it('rejects cross-clinic category/template relationships', async () => {
  expect((await request('/api/catalogo', { method: 'POST', type: 'profissional', body: { name: 'test', categoryId: 2 } })).status).toBe(400)
  expect((await request('/api/fichas/1', { method: 'PUT', body: { templateId: 2 } })).status).toBe(400)
  expect(state.writes).toEqual([])
})
it('rejects cross-clinic conversation relationships', async () => {
  for (const body of [{ clientId: 2 }, { agentId: 2 }]) expect((await request('/api/conversas', { method: 'POST', body })).status).toBe(400)
  expect(state.writes).toEqual([])
})
it('does not return another clinic notification, even to its recipient', async () => {
  expect((await request('/api/notifications/2/read', { method: 'PUT' })).status).toBe(404)
  expect(state.writes).toEqual([])
})
it('does not allow employees to grant themselves roles', async () => {
  expect((await request('/api/roles', { method: 'POST', body: { name: 'Admin', isAdmin: true } })).status).toBe(403)
  expect(state.writes).toEqual([])
})
