// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ permission: null as any, individual: null as any, activeRole: null as any, globalCompanyId: 1, moduleActive: true }))
vi.mock('../services/billing.js', () => ({ canCompanyAccessModule: async () => ({ hasAccess: true }) }))
vi.mock('../prisma.js', () => ({ prisma: {
  module: { findUnique: async () => ({ id: 1, isActive: state.moduleActive }) },
  professionalPermission: { findUnique: async () => state.permission },
  userCompanyPermission: { findUnique: async () => state.individual },
  userCompanyAccess: { findUnique: async () => ({ role: state.activeRole }) },
  usuario: { findUnique: async () => ({ companyId: state.globalCompanyId, role: { permissions: state.permission ? [state.permission] : [] } }) },
} }))
import { requireModule, requirePermission } from './auth.js'
beforeEach(() => { state.permission = null; state.individual = null; state.activeRole = null; state.globalCompanyId = 1; state.moduleActive = true })
async function call(granular = false, user: any = { id: 1, type: 'usuario', companyId: 1, role: 'admin' }) {
  const next = vi.fn()
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json() { return this } }
  await (granular ? requirePermission('clientes', 'verClientes') : requireModule('clientes'))({ user } as any, res, next)
  return { accepted: next.mock.calls.length === 1, code: res.code }
}
it('denies missing permissions even to an admin role name', async () => {
  expect(await call()).toEqual({ accepted: false, code: 403 })
  expect(await call(true)).toEqual({ accepted: false, code: 403 })
})
it('requires an explicit granular grant and preserves explicit denials', async () => {
  state.permission = { hasAccess: true, subPermissions: {} }
  expect((await call()).accepted).toBe(true)
  expect((await call(true)).accepted).toBe(false)
  state.permission.subPermissions.verClientes = true
  expect((await call(true)).accepted).toBe(true)
  state.individual = { hasAccess: false }
  expect((await call()).accepted).toBe(false)
  expect((await call(true)).accepted).toBe(false)
})
it('never borrows the primary clinic role while operating in another clinic', async () => {
  state.permission = { hasAccess: true, subPermissions: { verClientes: true } }
  state.globalCompanyId = 2
  expect((await call()).accepted).toBe(false)
  expect((await call(true)).accepted).toBe(false)
})
it('preserves verified owner access, not arbitrary professional access', async () => {
  const user = { id: 1, type: 'profissional', companyId: 1, isCompanyOwner: true }
  expect((await call(true, user)).accepted).toBe(true)
  expect((await call(true, { ...user, isCompanyOwner: false })).accepted).toBe(false)
  state.moduleActive = false
  expect((await call(false, user)).accepted).toBe(false)
})
