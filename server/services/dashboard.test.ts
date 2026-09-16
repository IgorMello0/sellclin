import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import { buildTeamFilter, parseDashboardQuery } from './dashboard-filters.js'
import { createDashboardMetricsHandler } from './dashboard.js'

const now = new Date('2026-09-14T15:00:00Z')
const custom = { filter: 'custom', startDate: '2026-09-01', endDate: '2026-09-14' }

describe('dashboard periods', () => {
  for (const [filter, start, days] of [
    ['today', '2026-09-14', 1], ['7days', '2026-09-08', 7], ['30days', '2026-08-16', 30],
    ['this_month', '2026-09-01', 30],
  ] as const) {
    it(`${filter} uses the displayed calendar interval`, () => {
      const range = parseDashboardQuery({ filter }, now)
      assert.equal(range.startDate.toISOString(), `${start}T03:00:00.000Z`)
      assert.equal((range.endDate.getTime() - range.startDate.getTime()) / 86400000, days)
    })
  }
  it('uses Sao Paulo calendar day even before UTC 03:00', () => {
    const range = parseDashboardQuery({ filter: 'today' }, new Date('2026-09-14T01:00:00Z'))
    assert.equal(range.period.start, '2026-09-13')
  })
  it('includes all milliseconds on the last day and excludes next midnight', () => {
    const range = parseDashboardQuery(custom, now)
    assert(new Date('2026-09-15T02:59:59.999Z') < range.endDate)
    assert.equal(range.endDate.toISOString(), '2026-09-15T03:00:00.000Z')
  })
  it('accepts leap day and handles month/year boundaries', () => {
    assert.equal(parseDashboardQuery({ ...custom, startDate: '2024-02-29', endDate: '2024-02-29' }).period.end, '2024-02-29')
    assert.equal(parseDashboardQuery({ filter: '7days' }, new Date('2026-01-02T12:00:00Z')).period.start, '2025-12-27')
  })
  for (const query of [
    { filter: 'custom' }, { ...custom, startDate: '' }, { ...custom, endDate: '2026-08-31' },
    { ...custom, startDate: '2026-02-30' }, { ...custom, endDate: ['2026-09-14'] },
    { filter: 'unknown' }, { sdrId: '-1' }, { closerId: '12junk' }, { sdrId: '9007199254740992' },
  ]) {
    it(`rejects invalid input ${JSON.stringify(query)}`, () => assert.throws(() => parseDashboardQuery(query, now)))
  }
})

// Small in-memory Prisma test double for the query operators used by this endpoint.
function matches(row: any, where: any): boolean {
  if (where === null) return row == null
  if (row == null) return false
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === 'AND') return condition.every((part: any) => matches(row, part))
    if (key === 'OR') return condition.some((part: any) => matches(row, part))
    const value = row[key]
    if (condition === null) return value == null
    if (typeof condition !== 'object') return value === condition
    if ('in' in condition) return condition.in.includes(value)
    if ('gte' in condition) return value >= condition.gte && value < condition.lt
    if ('some' in condition) return (value || []).some((item: any) => matches(item, condition.some))
    return matches(value, condition)
  })
}

const lead = (id: number, fields = {}) => ({
  id, professionalId: 1, companyId: 2, sdrId: 8, closerId: 9, proposals: [], value: 100,
  status: 'comercial_closed', createdAt: new Date('2026-09-05T12:00:00Z'),
  attendedAt: new Date('2026-09-06T12:00:00Z'), proposalAt: new Date('2026-09-07T12:00:00Z'),
  closedAt: new Date('2026-09-08T12:00:00Z'), origin: 'Google', ...fields,
})

async function execute(options: { query?: any; user?: any; globalRole?: any; activeRole?: any; leads?: any[] } = {}) {
  const calls: Array<{ model: string; where: any }> = []
  const rows = options.leads || [lead(1), lead(2, { sdrId: 5 })]
  const queryRows = (where: any) => rows.filter(row => matches(row, where))
  const db = {
    professional: { findMany: async () => [{ id: 1 }] },
    empresa: { findUnique: async () => ({ ownerId: 1 }) },
    usuario: { findUnique: async () => ({ role: options.globalRole || { isManager: true, permissions: [] } }) },
    userCompanyAccess: { findUnique: async () => options.activeRole ? { role: options.activeRole } : null },
    funnelConfig: { findMany: async () => [] },
    lead: {
      count: async ({ where }: any) => { calls.push({ model: 'lead', where }); return queryRows(where).length },
      aggregate: async ({ where }: any) => ({ _sum: { value: queryRows(where).reduce((sum, row) => sum + row.value, 0) } }),
      groupBy: async ({ where, by }: any) => {
        calls.push({ model: by[0], where })
        const groups = new Map<string, number>()
        queryRows(where).forEach(row => groups.set(row[by[0]], (groups.get(row[by[0]]) || 0) + 1))
        return [...groups].map(([key, count]) => ({ [by[0]]: key, _count: { id: count } }))
      },
    },
    appointment: { count: async ({ where }: any) => { calls.push({ model: 'appointment', where }); return 0 } },
    payment: { groupBy: async ({ where }: any) => { calls.push({ model: 'payment', where }); return [] } },
  }
  let status = 200
  let body: any
  const response = { status: (value: number) => { status = value; return response }, json: (value: any) => { body = value } }
  await createDashboardMetricsHandler(db as unknown as PrismaClient)(
    { query: options.query || custom, user: options.user || { id: 5, companyId: 2, type: 'usuario', role: 'sdr' } } as Request,
    response as Response,
  )
  return { status, body, calls }
}

describe('dashboard access and metrics', () => {
  it('never loses leads when expanding a contained period with the same team filters', async () => {
    const timestamps = [
      '2026-08-15T23:59:59.999-03:00', // before every selected period
      '2026-08-16T00:00:00-03:00',
      '2026-09-07T23:59:59.999-03:00',
      '2026-09-08T00:00:00-03:00',
      '2026-09-13T12:00:00-03:00',
      '2026-09-14T00:00:00-03:00',
      '2026-09-14T23:59:59.999-03:00',
      '2026-09-15T00:00:00-03:00', // exclusive end of every selected period
    ]
    const rows = timestamps.map((date, index) => lead(index + 1, { createdAt: new Date(date) }))
    rows.push(lead(20, { createdAt: new Date('2026-09-14T12:00:00-03:00'), companyId: 3 }))
    rows.push(lead(21, { createdAt: new Date('2026-09-14T12:00:00-03:00'), sdrId: 5, closerId: 6 }))

    for (const teamFilters of [{}, { sdrId: '8' }, { closerId: '9' }, { sdrId: '8', closerId: '9' }]) {
      const counts: number[] = []
      for (const startDate of ['2026-09-14', '2026-09-08', '2026-08-16']) {
        const { status, body } = await execute({
          leads: rows,
          query: { ...custom, startDate, ...teamFilters },
        })
        assert.equal(status, 200)
        const data = body.data
        counts.push(data.leads)
        assert.equal(data.funil.novos, data.leads)
        assert.equal(data.origem.reduce((total: number, origin: any) => total + origin.count, 0), data.leads)
      }
      assert.deepEqual(counts, Object.keys(teamFilters).length ? [2, 4, 6] : [3, 5, 7])
      assert(counts[0] <= counts[1] && counts[1] <= counts[2])
    }
  })
  it('restricts a global manager who is SDR in the active clinic', async () => {
    const result = await execute({ activeRole: { isSDR: true, permissions: [] } })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.leads, 1)
    for (const model of ['appointment', 'payment']) assert(result.calls.find(call => call.model === model)?.where.AND.length)
  })
  it('allows the whole team for an active-clinic manager with a global SDR role', async () => {
    const result = await execute({ globalRole: { isSDR: true, permissions: [] }, activeRole: { isManager: true, permissions: [] } })
    assert.equal(result.body.data.leads, 2)
  })
  it('restricts accounts without a role and preserves the clinic boundary', async () => {
    const result = await execute({ globalRole: { permissions: [] }, leads: [lead(1, { sdrId: 5 }), lead(2, { sdrId: 5, companyId: 3 })] })
    assert.equal(result.body.data.leads, 1)
  })
  it('masks billing using the active role, including the legacy fallback', async () => {
    for (const roles of [
      { activeRole: { isManager: true, permissions: [{ subPermissions: { verFaturamento: false } }] } },
      { globalRole: { isManager: true, permissions: [{ subPermissions: { verFaturamento: false } }] } },
    ]) {
      const { body } = await execute(roles)
      assert.equal(body.data.leads, 2)
      for (const field of ['faturamento', 'faturamentoFechado', 'ticketOrcado', 'ticketFechado']) assert.equal(body.data[field], 0)
    }
  })
  it('uses the same creation period for lead totals, origins and funnel', async () => {
    const { body } = await execute({ leads: [lead(1), lead(2, { createdAt: new Date('2025-01-01'), origin: 'Antiga' })] })
    assert.equal(body.data.leads, 1)
    assert.deepEqual(body.data.origem, [{ origin: 'Google', count: 1 }])
    assert.equal(body.data.funil.novos, 1)
  })
  it('combines SDR and closer filters and keeps permission restrictions', async () => {
    const { body } = await execute({ query: { ...custom, sdrId: '8', closerId: '9' }, activeRole: { isSDR: true, permissions: [] } })
    assert.equal(body.data.leads, 0)
  })
  it('rejects invalid periods with HTTP 400 before querying metrics', async () => {
    const result = await execute({ query: { filter: 'custom' } })
    assert.equal(result.status, 400)
    assert.equal(result.calls.length, 0)
  })
})

describe('team assignment filters', () => {
  for (const kind of ['sdr', 'closer'] as const) {
    const field = kind === 'sdr' ? 'sdrId' : 'closerId'
    const proposalField = kind === 'sdr' ? 'sdrId' : 'salespersonId'
    it(`does not classify assigned ${kind} leads as unassigned because of an old proposal`, () => {
      const condition = buildTeamFilter(kind, 'none')
      const assigned = lead(1, { [field]: 8, proposals: [{ [proposalField]: null }] })
      assert.equal(matches(assigned, condition.lead), false)
      assert.equal(matches({ ...assigned, [field]: null }, condition.lead), true)
      assert.equal(matches({ appointment: null, client: { originLead: assigned } }, condition.payment), false)
    })
    it(`includes proposal-only ${kind} attribution in leads, appointments and payments`, () => {
      const condition = buildTeamFilter(kind, '5')
      const attributed = lead(1, { [field]: 8, proposals: [{ [proposalField]: 5 }] })
      assert(matches(attributed, condition.lead))
      assert(matches({ sdrId: null, especialistaId: null, lead: attributed }, condition.appointment))
      assert(matches({ appointment: null, client: { originLead: attributed } }, condition.payment))
    })
  }
})
