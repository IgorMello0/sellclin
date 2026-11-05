import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { ensureDefaultRoles } from '../bootstrap/default-roles.js'

const db = new PrismaClient({ log: [] })
const rollback = new Error('intentional-rollback')
let ownerId: number | undefined
async function main() {
  try {
    await db.$transaction(async tx => {
      const owner = await tx.professional.create({ data: { name: 'Teste cargos (rollback)', email: `roles-${randomUUID()}@example.invalid`, passwordHash: 'test-no-login' } })
      ownerId = owner.id
      for (let index = 0; index < 2; index++) {
        const company = await tx.empresa.create({ data: { name: 'Teste cargos (rollback)', ownerId: owner.id }, select: { id: true } })
        await ensureDefaultRoles(tx, company.id, owner.id)
        const roles = await tx.role.findMany({ where: { companyId: company.id }, orderBy: { value: 'asc' } })
        assert.deepEqual(roles.map(role => role.value), ['admin', 'closer', 'comercial', 'sdr'])
        assert.equal(roles.find(role => role.value === 'admin')?.isAdmin, true)
        assert.equal(roles.find(role => role.value === 'sdr')?.isSDR, true)
        assert.equal(roles.find(role => role.value === 'closer')?.isCloser, true)
        const sdr = roles.find(role => role.value === 'sdr')!
        await tx.role.update({ where: { id: sdr.id }, data: { name: 'Pré-vendas personalizado' } })
        await tx.rolePermission.updateMany({ where: { roleId: sdr.id }, data: { hasAccess: false } })
        const before = await tx.rolePermission.findMany({ where: { roleId: sdr.id }, orderBy: { id: 'asc' } })
        await ensureDefaultRoles(tx, company.id, owner.id)
        assert.equal(await tx.role.count({ where: { companyId: company.id } }), 4)
        assert.equal((await tx.role.findUniqueOrThrow({ where: { id: sdr.id } })).name, 'Pré-vendas personalizado')
        assert.deepEqual(await tx.rolePermission.findMany({ where: { roleId: sdr.id }, orderBy: { id: 'asc' } }), before)
      }
      throw rollback
    }, { timeout: 60_000 })
  } catch (error) { if (error !== rollback) throw error }
  assert.ok(ownerId)
  assert.equal(await db.professional.count({ where: { id: ownerId } }), 0)
  assert.equal(await db.empresa.count({ where: { ownerId } }), 0)
  console.log('OK: quatro cargos por clínica, funções corretas, sem duplicidade e permissões preservadas. Dados de teste revertidos.')
}
main().catch((error: unknown) => {
  console.error('FALHOU: conferência de cargos não concluída. Código:', error && typeof error === 'object' && 'code' in error ? String(error.code) : 'TEST_ERROR')
  process.exitCode = 1
}).finally(() => db.$disconnect())
