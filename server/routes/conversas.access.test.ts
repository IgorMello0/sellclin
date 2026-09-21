// @vitest-environment node
import express from 'express'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { Server } from 'node:http'

const state = vi.hoisted(() => ({
  userId: 7,
  conversationVisible: false,
  lastListWhere: null as unknown,
  lastLookupWhere: null as unknown,
}))

vi.mock('../middleware/auth.js', () => ({
  auth: () => (req: any, _res: any, next: any) => {
    req.user = { id: state.userId, type: 'usuario', companyId: 2 }
    next()
  },
  requireModule: () => (_req: any, _res: any, next: any) => next(),
}))
vi.mock('../services/conversation-access.js', () => ({
  conversationScope: async (user: { id: number }) => ({
    where: { companyId: 2, lead: { sdrId: user.id } },
    canManage: false,
  }),
}))
vi.mock('../prisma.js', () => ({
  prisma: {
    conversa: {
      findMany: async ({ where }: { where: unknown }) => {
        state.lastListWhere = where
        return []
      },
      count: async () => 0,
      findFirst: async ({ where }: { where: unknown }) => {
        state.lastLookupWhere = where
        return state.conversationVisible ? { id: 10 } : null
      },
    },
  },
}))

import { router } from './conversas.js'

let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/conversas', router)
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server address unavailable')
  baseUrl = `http://127.0.0.1:${address.port}`
})
afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
})
beforeEach(() => {
  state.userId = 7
  state.conversationVisible = false
  state.lastListWhere = null
  state.lastLookupWhere = null
})

it('applies the SDR scope to the conversation list', async () => {
  const response = await fetch(`${baseUrl}/conversas`)
  expect(response.status).toBe(200)
  expect(state.lastListWhere).toEqual({ companyId: 2, lead: { sdrId: 7 } })
})

it('blocks a direct conversation URL before the detail handler runs', async () => {
  const response = await fetch(`${baseUrl}/conversas/10`)
  expect(response.status).toBe(404)
  expect(state.lastLookupWhere).toEqual({ companyId: 2, lead: { sdrId: 7 }, id: 10 })
})

it('blocks a direct message request to another SDR conversation', async () => {
  const response = await fetch(`${baseUrl}/conversas/10/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'teste' }),
  })
  expect(response.status).toBe(404)
  expect(state.lastLookupWhere).toEqual({ companyId: 2, lead: { sdrId: 7 }, id: 10 })
})

it('prevents SDRs from transferring conversations through the API', async () => {
  state.conversationVisible = true
  const response = await fetch(`${baseUrl}/conversas/10/assign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assigneeType: 'user', assigneeId: 8 }),
  })
  expect(response.status).toBe(403)
})
