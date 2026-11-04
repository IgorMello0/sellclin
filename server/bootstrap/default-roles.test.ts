import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureDefaultRoles, isDefaultRole } from './default-roles.js'

test('all clinics receive four functional roles without duplicates or overwriting customization', async () => {
  const roles: any[] = []
  const permissions: any[] = []
  const db: any = {
    module: { findMany: async () => [{ id: 1 }, { id: 2 }] },
    role: { upsert: async ({ where, create, update }: any) => {
      let role = roles.find(r => r.companyId === where.companyId_value.companyId && r.value === where.companyId_value.value)
      if (role) Object.assign(role, update)
      else { role = { id: roles.length + 1, ...create }; roles.push(role) }
      return role
    } },
    rolePermission: { upsert: async ({ where, create, update }: any) => {
      const permission = permissions.find(p => p.roleId === where.roleId_moduleId.roleId && p.moduleId === where.roleId_moduleId.moduleId)
      if (permission) Object.assign(permission, update)
      else permissions.push({ ...create })
    } },
  }
  await ensureDefaultRoles(db, 10, 1)
  await ensureDefaultRoles(db, 20, 2)
  assert.equal(roles.length, 8)
  for (const companyId of [10, 20]) {
    const clinic = roles.filter(r => r.companyId === companyId)
    assert.deepEqual(clinic.map(r => r.value), ['admin', 'comercial', 'sdr', 'closer'])
    assert.equal(clinic.find(r => r.value === 'admin').isAdmin, true)
    assert.equal(clinic.find(r => r.value === 'sdr').isSDR, true)
    assert.equal(clinic.find(r => r.value === 'closer').isCloser, true)
  }
  const oldSDR = roles.find(r => r.companyId === 10 && r.value === 'sdr')
  oldSDR.name = 'Pré-vendas personalizado'
  oldSDR.isCloser = true
  permissions.find(p => p.roleId === oldSDR.id).hasAccess = false
  permissions.find(p => p.roleId === oldSDR.id).subPermissions = { excluirContatos: false }
  const before = structuredClone({ roles, permissions })
  await ensureDefaultRoles(db, 10, 1)
  assert.deepEqual({ roles, permissions }, before)
  assert.equal(permissions.length, 16)
})

test('only the four standard values are protected from deletion', () => {
  for (const value of ['admin', 'comercial', 'sdr', 'closer']) assert.equal(isDefaultRole(value), true)
  assert.equal(isDefaultRole('gerente_personalizado'), false)
})
