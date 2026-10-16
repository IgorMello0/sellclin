import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../prisma.js'
import { notifyFailure } from './failure-alerts.js'

test('alerts target clinic owner and active admins, persist deduplication after reading', async () => {
  const original = prisma.$transaction
  const rows: any[] = []
  const tx = {
    $executeRaw: async () => 1,
    notification: {
      findFirst: async ({ where }: any) => rows.find(row => row.companyId === where.companyId && row.type === where.type),
      createMany: async ({ data }: any) => { rows.push(...data) },
    },
    empresa: { findUnique: async () => ({ ownerId: 7 }) },
    userCompanyAccess: { findMany: async ({ where }: any) => {
      assert.equal(where.companyId, 42)
      assert.equal(where.isActive, true)
      assert.equal(where.user.isActive, true)
      assert.equal(where.role.isAdmin, true)
      return [{ userId: 8 }]
    } },
    usuario: { findMany: async () => [{ id: 8 }, { id: 9 }] },
  }
  prisma.$transaction = (async (fn: any) => fn(tx)) as any
  try {
    await notifyFailure(42, 'campaign:10', 'Falha', 'Confira a campanha')
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map(row => row.recipientId || row.recipientUserId), [7, 8, 9])
    rows.forEach(row => { row.read = true })
    await notifyFailure(42, 'campaign:10', 'Falha', 'Confira a campanha')
    assert.equal(rows.length, 3)
    await notifyFailure(42, 'campaign:11', 'Falha', 'Confira a campanha')
    assert.equal(rows.length, 6)
  } finally { prisma.$transaction = original }
})
