// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { leadTransferPreview, transferMemberLeads } from './lead-transfer'

let db: any
let leads: any[]
let conversations: any[]
let members: any[]
const matches = (lead: any, where: any): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
  if (key === 'OR') return value.some((condition: any) => matches(lead, condition))
  if (key === 'status') return !value.notIn.includes(lead.status)
  if (key === 'isPaid') return Boolean(lead.isPaid) === value
  if (key === 'sales') return !(lead.sales || []).some((sale: any) => sale.voidedAt == null)
  if (key === 'proposals') return !(lead.proposals || []).some((p: any) => value.none.status.in.includes(p.status))
  return lead[key] === value
})

beforeEach(() => {
  leads = [
    { id: 1, companyId: 4, sdrId: 10, closerId: 10, especialistaId: 3 },
    { id: 2, companyId: 4, sdrId: 10, closerId: 7, especialistaId: null },
    { id: 3, companyId: 5, sdrId: 10, closerId: null, especialistaId: null },
  ]
  conversations = [
    { id: 1, companyId: 4, leadId: 1, assignedUserId: 10 },
    { id: 2, companyId: 4, leadId: 2, assignedUserId: 7 },
    { id: 3, companyId: 5, leadId: 3, assignedUserId: 10 },
  ]
  members = [
    { id: 20, name: 'Destino', role: null, companyAccess: [{ role: { isSDR: true, isCloser: true } }] },
    { id: 21, name: 'SDR apenas', role: { isSDR: true }, companyAccess: [] },
    { id: 22, name: 'Cargo de outra clínica', role: { isSDR: true, isCloser: true }, companyAccess: [{ role: { isSDR: true } }] },
  ]
  db = {
    $executeRaw: vi.fn(),
    usuario: {
      findFirst: vi.fn().mockResolvedValue({ id: 10, name: 'Origem' }),
      findMany: vi.fn(async () => members),
    },
    lead: {
      count: vi.fn(async ({ where }) => leads.filter(lead => matches(lead, where)).length),
      updateMany: vi.fn(async ({ where, data }) => {
        const selected = leads.filter(lead => matches(lead, where))
        selected.forEach(lead => Object.assign(lead, data))
        return { count: selected.length }
      }),
    },
    conversa: { updateMany: vi.fn(async ({ where, data }) => {
      conversations.filter(c => c.companyId === where.companyId && c.assignedUserId === where.assignedUserId && leads.some(l => l.id === c.leadId && matches(l, where.lead)))
        .forEach(c => Object.assign(c, data))
    }) },
    $transaction: vi.fn(async fn => {
      const snapshot = structuredClone({ leads, conversations })
      try { return await fn(db) } catch (error) { leads = snapshot.leads; conversations = snapshot.conversations; throw error }
    }),
  }
})
it('counts unique leads, includes every operational role and uses the active clinic role', async () => {
  const preview = await leadTransferPreview(db, 4, 10)
  expect(preview.total).toBe(2)
  expect(preview.counts).toEqual({ sdrId: 2, closerId: 1, especialistaId: 0 })
  expect(preview.targets).toEqual([{ id: 20, name: 'Destino' }])
  expect(db.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isActive: true, emailVerified: true }) }))
})
it('transfers current assignments and matching conversation ownership only in the current clinic', async () => {
  expect(await transferMemberLeads(db, 4, 10, 20, 2)).toEqual({ transferred: 2 })
  const [sql, companyId] = db.$executeRaw.mock.calls[0]
  expect(sql.join('?')).toBe('SELECT pg_advisory_xact_lock(?::int4, 724020::int4)')
  expect(companyId).toBe(4)
  expect(leads[0]).toMatchObject({ sdrId: 20, closerId: 20, especialistaId: 3 })
  expect(leads[1]).toMatchObject({ sdrId: 20, closerId: 7 })
  expect(leads[2].sdrId).toBe(10)
  expect(conversations.map(c => c.assignedUserId)).toEqual([20, 7, 10])
})
it('rejects incompatible or unavailable destinations and self assignment without changing leads', async () => {
  for (const target of [10, 21, 22, 99]) await expect(transferMemberLeads(db, 4, 10, target, 2)).rejects.toThrow()
  expect(db.lead.updateMany).not.toHaveBeenCalled()
})
it('requires a fresh confirmation if the number of leads changed', async () => {
  await expect(transferMemberLeads(db, 4, 10, 20, 1)).rejects.toMatchObject({ status: 409 })
  expect(db.lead.updateMany).not.toHaveBeenCalled()
})
it('rolls back conversation and lead transfers if any update fails', async () => {
  db.lead.updateMany.mockImplementationOnce(async () => { throw new Error('write failed') })
  await expect(transferMemberLeads(db, 4, 10, 20, 2)).rejects.toThrow('write failed')
  expect(conversations[0].assignedUserId).toBe(10)
  expect(leads[0].sdrId).toBe(10)
})
it('rejects a member outside the active clinic', async () => {
  db.usuario.findFirst.mockResolvedValue(null)
  await expect(leadTransferPreview(db, 4, 10)).rejects.toMatchObject({ status: 404 })
})

it('transfers closed contacts without rewriting historical proposals or sales', async () => {
  leads.push(...[
    { id: 4, status: 'comercial_closed' }, { id: 5, isPaid: true },
    { id: 6, status: 'comercial_follow', sales: [{ voidedAt: null }] },
    { id: 7, status: 'comercial_follow', proposals: [{ status: 'accepted' }] },
  ].map(l => ({ companyId: 4, closerId: 10, ...l })))
  conversations.push({ id: 4, companyId: 4, leadId: 4, assignedUserId: 10 })
  expect((await leadTransferPreview(db, 4, 10)).total).toBe(6)
  const historical = structuredClone(leads.slice(3).map(l => ({ proposals: l.proposals, sales: l.sales })))
  await transferMemberLeads(db, 4, 10, 20, 6)
  expect(leads.slice(3).map(l => l.closerId)).toEqual([20, 20, 20, 20])
  expect(conversations[3].assignedUserId).toBe(20)
  expect(leads.slice(3).map(l => ({ proposals: l.proposals, sales: l.sales }))).toEqual(historical)
})
