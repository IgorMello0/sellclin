// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ active: true, accessActive: true, role: { isSDR: true, isAdmin: false, isManager: false } }))
vi.mock('../prisma.js', () => ({ prisma: {
  empresa: { findFirst: async () => ({ id: 2 }) },
  usuario: { findUnique: async () => ({ id: 7, companyId: 2, isActive: state.active, role: state.role }) },
  userCompanyAccess: { findUnique: async () => ({ isActive: state.accessActive, role: state.role }) },
} }))
import { conversationScope } from './conversation-access.js'

beforeEach(() => { state.active = true; state.accessActive = true; state.role = { isSDR: true, isAdmin: false, isManager: false } })

it('limits SDRs to conversations whose lead is assigned to them', async () => {
  const scope = await conversationScope({ id: 7, type: 'usuario', companyId: 2 })
  expect(scope).toEqual({ canManage: false, where: { companyId: 2, OR: [
    { lead: { sdrId: 7 } }, { leadId: null, assignedUserId: 7 },
    { lead: { sdrId: null }, assignedUserId: 7 },
  ] } })
})

it('allows managers and clinic professionals to oversee all conversations', async () => {
  state.role.isManager = true
  expect(await conversationScope({ id: 7, type: 'usuario', companyId: 2 })).toEqual({ canManage: true, where: { companyId: 2 } })
  expect(await conversationScope({ id: 10, type: 'profissional', companyId: 2 })).toEqual({ canManage: true, where: { companyId: 2 } })
})

it('blocks inactive users and access to a missing clinic', async () => {
  state.accessActive = false
  expect((await conversationScope({ id: 7, type: 'usuario', companyId: 2 })).where).toEqual({ companyId: -1 })
  expect((await conversationScope({ id: 7, type: 'usuario' })).where).toEqual({ companyId: -1 })
})
