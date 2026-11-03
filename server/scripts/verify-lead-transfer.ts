import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { leadTransferPreview, transferMemberLeads } from '../services/lead-transfer.js'

// All writes are test fixtures inside one transaction that ALWAYS rolls back.
// No existing clinic, user, lead or conversation is selected or changed.
const db = new PrismaClient({ log: [] })
const rollback = new Error('intentional-test-rollback')
let ids: { ownerId: number; companyIds: number[]; userIds: number[]; leadIds: number[] } | undefined

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('database-not-configured')
  try {
    await db.$transaction(async tx => {
      const tag = randomUUID()
      const owner = await tx.professional.create({ data: {
        name: 'Teste de transferência (rollback)', email: `transfer-${tag}@example.invalid`, passwordHash: 'test-no-login',
      } })
      const company = await tx.empresa.create({ data: { name: 'Teste transferência (rollback)', ownerId: owner.id }, select: { id: true } })
      const other = await tx.empresa.create({ data: { name: 'Teste isolamento (rollback)', ownerId: owner.id }, select: { id: true } })
      const role = await tx.role.create({ data: { name: 'SDR/Closer teste', value: `test-${tag}`, companyId: company.id, professionalId: owner.id, isSDR: true, isCloser: true } })
      const source = await tx.usuario.create({ data: { name: 'Origem teste', email: `source-${tag}@example.invalid`, passwordHash: 'test-no-login', companyId: company.id, roleId: role.id, emailVerified: true } })
      const target = await tx.usuario.create({ data: { name: 'Destino teste', email: `target-${tag}@example.invalid`, passwordHash: 'test-no-login', companyId: company.id, roleId: role.id, emailVerified: true } })
      await tx.userCompanyAccess.createMany({ data: [source, target].map(user => ({ userId: user.id, companyId: company.id, roleId: role.id })) })
      const lead = await tx.lead.create({ data: { name: 'Lead teste', phone: '00000000000', status: 'prospect', professionalId: owner.id, companyId: company.id, sdrId: source.id, closerId: source.id } })
      const otherLead = await tx.lead.create({ data: { name: 'Lead outra clínica teste', phone: '00000000000', status: 'prospect', professionalId: owner.id, companyId: other.id, sdrId: source.id } })
      ids = { ownerId: owner.id, companyIds: [company.id, other.id], userIds: [source.id, target.id], leadIds: [lead.id, otherLead.id] }
      const conversation = await tx.conversa.create({ data: { companyId: company.id, leadId: lead.id, professionalId: owner.id, assignedUserId: source.id, startedAt: new Date() } })
      const proposal = await tx.proposal.create({ data: { leadId: lead.id, title: 'Histórico teste', value: 100, validUntil: new Date(), sdrId: source.id, salespersonId: source.id } })
      const preview = await leadTransferPreview(tx, company.id, source.id)
      assert.equal(preview.total, 1)
      assert.equal(preview.counts.sdrId, 1)
      assert.equal(preview.counts.closerId, 1)
      assert.ok(preview.targets.some(user => user.id === target.id))
      // Reuse this transaction rather than starting a nested transaction.
      const scoped = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient
      await assert.rejects(() => transferMemberLeads(scoped, company.id, source.id, target.id, 2), { status: 409 })
      const result = await transferMemberLeads(scoped, company.id, source.id, target.id, 1)
      assert.equal(result.transferred, 1)
      const transferred = await tx.lead.findUniqueOrThrow({ where: { id: lead.id } })
      assert.equal(transferred.sdrId, target.id)
      assert.equal(transferred.closerId, target.id)
      assert.equal((await tx.lead.findUniqueOrThrow({ where: { id: otherLead.id } })).sdrId, source.id)
      assert.equal((await tx.conversa.findUniqueOrThrow({ where: { id: conversation.id } })).assignedUserId, target.id)
      const history = await tx.proposal.findUniqueOrThrow({ where: { id: proposal.id } })
      assert.equal(history.sdrId, source.id)
      assert.equal(history.salespersonId, source.id)
      assert.equal((await leadTransferPreview(tx, company.id, source.id)).total, 0)
      throw rollback
    }, { isolationLevel: 'Serializable', timeout: 60_000 })
  } catch (error) { if (error !== rollback) throw error }
  assert.ok(ids)
  assert.equal(await db.professional.count({ where: { id: ids.ownerId } }), 0)
  assert.equal(await db.empresa.count({ where: { id: { in: ids.companyIds } } }), 0)
  assert.equal(await db.usuario.count({ where: { id: { in: ids.userIds } } }), 0)
  assert.equal(await db.lead.count({ where: { id: { in: ids.leadIds } } }), 0)
  console.log('OK: PostgreSQL validou transferência, isolamento por clínica, preservação do histórico e rollback. Dados de teste não persistiram.')
}

main().catch((error: unknown) => {
  // Raw Prisma errors may contain data and connection details. Never print them.
  const cause = error instanceof assert.AssertionError ? error.actual : error
  const safe = cause && typeof cause === 'object' ? cause as { code?: unknown; meta?: { code?: unknown } } : {}
  console.error('FALHOU: teste não concluído; a transação foi revertida. Código:',
    error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof assert.AssertionError ? 'ASSERTION' : 'TEST_ERROR')
  if (typeof safe.code === 'string') console.error('Código original:', safe.code)
  if (typeof safe.meta?.code === 'string') console.error('Código PostgreSQL:', safe.meta.code)
  process.exitCode = 1
}).finally(() => db.$disconnect())
