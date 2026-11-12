import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import { buildTeamFilter, parseDashboardQuery } from './dashboard-filters.js'
import { createDashboardDetailsHandler } from './dashboard-details.js'
import { createDashboardMetricsHandler } from './dashboard.js'
import { copiedFunnelCode, copiedStageCode } from '../utils/funnel-stages.js'

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
    if ('contains' in condition) return value?.toLowerCase().includes(condition.contains.toLowerCase()) ?? false
    if ('not' in condition) return value !== condition.not
    if ('notIn' in condition) return !condition.notIn.includes(value)
    if ('in' in condition) return condition.in.includes(value)
    if ('gte' in condition) return value >= condition.gte && value < condition.lt
    if ('some' in condition) return (value || []).some((item: any) => matches(item, condition.some))
    return matches(value, condition)
  })
}

const lead = (id: number, fields = {}) => ({
  id, name: `Lead ${id}`, professionalId: 1, companyId: 2, sdrId: 8, closerId: 9, proposals: [], value: 100,
  status: 'comercial_closed', isPaid: true, createdAt: new Date('2026-09-05T12:00:00Z'),
  attendedAt: new Date('2026-09-06T12:00:00Z'), proposalAt: new Date('2026-09-07T12:00:00Z'),
  closedAt: new Date('2026-09-08T12:00:00Z'), origin: 'Google', ...fields,
})

async function execute(options: { query?: any; user?: any; globalRole?: any; activeRole?: any; leads?: any[]; paymentGroups?: any[]; payments?: any[]; accessOverride?: boolean; detail?: boolean; funnels?: any[] } = {}) {
  const calls: Array<{ model: string; where: any }> = []
  const rows = options.leads || [lead(1), lead(2, { sdrId: 5 })]
  const queryRows = (where: any) => rows.filter(row => matches(row, where))
  const proposals = rows.flatMap(row => row.proposals.map((proposal: any) => ({ ...proposal, lead: row })))
  const sales = rows.flatMap(row => (row.sales || []).map((sale: any) => ({ ...sale, lead: row })))
  const queryProposals = (where: any) => proposals.filter(row => matches(row, where))
  const querySales = (where: any) => sales.filter(row => matches(row, where))
  const queryPayments = (where: any) => (options.payments ?? []).filter(row => matches(row, where))
  const selectPage = (rows: any[], { skip, take, select }: any) =>
    rows.slice(skip, skip + take).map(row => Object.fromEntries(Object.keys(select).map(key => [key, row[key]])))
  const db = {
    $transaction: async (read: (client: typeof db) => Promise<unknown>) => read(db),
    userCompanyPermission: { findFirst: async () => options.accessOverride === undefined ? null : { hasAccess: options.accessOverride } },
    professional: { findMany: async () => [{ id: 1 }] },
    empresa: { findUnique: async () => ({ ownerId: 1 }) },
    usuario: { findUnique: async () => ({ companyId: 2, role: options.globalRole || { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } }) },
    userCompanyAccess: { findUnique: async () => options.activeRole ? { role: options.activeRole } : null },
    funnelConfig: { findMany: async () => options.funnels || [] },
    lead: {
      findMany: async (args: any) => selectPage(queryRows(args.where), args),
      count: async ({ where }: any) => { calls.push({ model: 'lead', where }); return queryRows(where).length },
      aggregate: async ({ where }: any) => ({ _sum: { value: queryRows(where).reduce((sum, row) => sum + row.value, 0) } }),
      groupBy: async ({ where, by }: any) => {
        calls.push({ model: by[0], where })
        const groups = new Map<string, number>()
        queryRows(where).forEach(row => groups.set(row[by[0]], (groups.get(row[by[0]]) || 0) + 1))
        return [...groups].map(([key, count]) => ({ [by[0]]: key, _count: { id: count } }))
      },
    },
    proposal: {
      findMany: async (args: any) => {
        calls.push({ model: 'proposal-select', where: args.select })
        return selectPage(queryProposals(args.where), args)
      },
      count: async ({ where }: any) => queryProposals(where).length,
      aggregate: async ({ where, _sum }: any) => {
        const selected = queryProposals(where)
        return { _count: { id: selected.length }, _sum: _sum && Object.fromEntries(Object.keys(_sum).map(field => [field, selected.reduce((sum, row) => sum + Number(row[field] || 0), 0)])) }
      },
    },
    sale: {
      findMany: async (args: any) => selectPage(querySales(args.where), args),
      count: async ({ where }: any) => querySales(where).length,
      aggregate: async ({ where }: any) => ({ _count: { id: querySales(where).length }, _sum: { amount: querySales(where).reduce((sum, row) => sum + Number(row.amount), 0) } }),
    },
    appointment: { count: async ({ where }: any) => { calls.push({ model: 'appointment', where }); return 0 } },
    client: { findMany: async () => (options.payments ?? []).map(payment => payment.client) },
    payment: {
      count: async ({ where }: any) => queryPayments(where).length,
      findMany: async (args: any) => selectPage(queryPayments(args.where), args),
      aggregate: async ({ where }: any) => {
        const rows = queryPayments(where)
        return { _count: { id: rows.length }, _sum: { amount: rows.reduce((sum, row) => sum + row.amount, 0) } }
      },
      groupBy: async ({ where, by, skip, take }: any) => {
        calls.push({ model: 'payment', where })
        if (!options.payments) return by.includes('method') ? (options.paymentGroups || []) : []
        const groups = new Map()
        for (const payment of queryPayments(where)) {
          const values = Object.fromEntries(by.map(key => [key, payment[key]]))
          const key = JSON.stringify(values)
          const group = groups.get(key) ?? { ...values, _count: { id: 0 }, _sum: { amount: 0 } }
          group._count.id++
          group._sum.amount += payment.amount
          groups.set(key, group)
        }
        return [...groups.values()].slice(skip ?? 0, take == null ? undefined : (skip ?? 0) + take)
      },
    },
  }
  let status = 200
  let body: any
  const response = { status: (value: number) => { status = value; return response }, json: (value: any) => { body = value } }
  const handler = options.detail ? createDashboardDetailsHandler : createDashboardMetricsHandler
  await handler(db as unknown as PrismaClient)(
    { query: options.query || custom, user: options.user || { id: 5, companyId: 2, type: 'usuario', role: 'sdr' } } as Request,
    response as Response,
  )
  return { status, body, calls }
}

describe('dashboard access and metrics', () => {
  it('hides financial metrics without an explicit grant even for an administrator', async () => {
    const { body } = await execute({ activeRole: { value: 'admin', isAdmin: true, permissions: [] } })
    assert.equal(body.data.faturamento, 0)
    assert.equal(body.data.faturamentoFechado, 0)
    assert.equal(body.data.totalDiscount, 0)
  })
  it('counts a closed sale only after its payment method is confirmed', async () => {
    const confirmedAt = new Date('2026-09-08T12:00:00Z')
    const { body } = await execute({ leads: [lead(1, { isPaid: false }), lead(2, { isPaid: true, sales: [{ amount: 100, confirmedAt, voidedAt: null }] })], activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } })
    assert.equal(body.data.contratos, 1)
    assert.equal(body.data.faturamentoFechado, 100)
    assert.equal(body.data.funil.fechados, 1)
  })
  it('counts each proposal and each active sale independently for the same lead', async () => {
    const createdAt = new Date('2026-09-08T12:00:00Z')
    const rows = [lead(1, {
      proposals: [
        { id: 10, value: 300, createdAt, sales: [{ voidedAt: null }] },
        { id: 11, value: 500, createdAt, sales: [{ voidedAt: null }] },
        { id: 12, value: 200, createdAt, sales: [] },
      ],
      sales: [
        { amount: 300, confirmedAt: createdAt, voidedAt: null },
        { amount: 500, confirmedAt: createdAt, voidedAt: null },
      ],
    })]
    const { body } = await execute({ leads: rows, activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } })
    assert.equal(body.data.oportunidades, 3)
    assert.equal(body.data.faturamento, 1000)
    assert.equal(body.data.contratos, 2)
    assert.equal(body.data.faturamentoFechado, 800)
    assert.equal(body.data.funil.fechados, 1)
  })
  it('sums discounts only from active sales confirmed in the selected period', async () => {
    const confirmedAt = new Date('2026-09-08T12:00:00Z')
    const outside = new Date('2025-09-08T12:00:00Z')
    const rows = [lead(1, {
      proposals: [
        { id: 10, value: 300, discountApplied: true, discountValue: 30, createdAt: confirmedAt, sales: [{ confirmedAt, voidedAt: null }] },
        { id: 11, value: 500, discountApplied: true, discountValue: 50, createdAt: confirmedAt, sales: [{ confirmedAt: outside, voidedAt: null }] },
        { id: 12, value: 200, discountApplied: true, discountValue: 20, createdAt: confirmedAt, sales: [{ confirmedAt, voidedAt: confirmedAt }] },
      ],
      sales: [{ amount: 270, confirmedAt, voidedAt: null }],
    })]
    const { body } = await execute({ leads: rows, activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } })
    assert.equal(body.data.totalDiscount, 30)
  })
  it('calculates closed/proposals from contracts and proposals in their displayed periods', async () => {
    const createdAt = new Date('2026-09-08T12:00:00Z')
    const rows = [lead(1, {
      proposals: [{ id: 10, value: 300, createdAt, sales: [{ voidedAt: null }] }],
      sales: [
        { amount: 300, confirmedAt: createdAt, voidedAt: null },
        { amount: 500, confirmedAt: createdAt, voidedAt: null },
      ],
    })]
    const { body } = await execute({ leads: rows, activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } })
    assert.equal(body.data.oportunidades, 1)
    assert.equal(body.data.contratos, 2)
    assert.equal(body.data.conversaoPropostas, '200.0')
  })
  it('keeps overdue installments in the payment-method totals', async () => {
    const { body } = await execute({
      activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] },
      paymentGroups: [
        { method: 'transferencia', status: 'atrasado', _sum: { amount: 599 } },
        { method: 'pix', status: 'pago', _sum: { amount: 400 } },
        { method: 'cartao', status: 'cancelado', _sum: { amount: 900 } },
      ],
    })
    assert.equal(body.data.metodos.boleto.gerados, 599)
    assert.equal(body.data.metodos.pix, 400)
    assert.equal(body.data.metodos.cartao, 0)
  })
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
    const result = await execute({ globalRole: { isSDR: true, permissions: [] }, activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: true } }] } })
    assert.equal(result.body.data.leads, 2)
  })
  it('restricts accounts without a role and preserves the clinic boundary', async () => {
    const result = await execute({ globalRole: { permissions: [] }, leads: [lead(1, { sdrId: 5 }), lead(2, { sdrId: 5, companyId: 3 })] })
    assert.equal(result.body.data.leads, 1)
  })
  it('masks billing using the active role, including the legacy fallback', async () => {
    for (const roles of [
      { activeRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: false } }] } },
      { globalRole: { isManager: true, permissions: [{ hasAccess: true, subPermissions: { verFaturamento: false } }] } },
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


describe('dashboard details', () => {
  it('counts copied prospecting leads only after the first stage and reconciles the card with the detail', async () => {
    const first = copiedStageCode('social-selling', 'prospecting', 'prospect_lead')
    const second = copiedStageCode('social-selling', 'prospecting', 'prospect_qualified')
    const funnels = [{ code: copiedFunnelCode('social-selling', 'prospecting'), stages: [
      { code: first, label: 'Novo' }, { code: second, label: 'Qualificado' },
    ] }]
    const leads = [lead(1, { status: 'prospect_lead' }), lead(2, { status: first }), lead(3, { status: second })]
    const metrics = await execute({ leads, funnels })
    const detail = await execute({ leads, funnels, detail: true, query: { ...custom, indicator: 'funil-contatados' } })
    assert.equal(metrics.body.data.funil.contatados, 1)
    assert.deepEqual(detail.body.data.rows.map(row => row.id), [3])
  })

  it('requires a valid appointment for the scheduled funnel count and details', async () => {
    const appointment = { companyId: 2, professionalId: 1, status: 'agendado' }
    const leads = [
      lead(1, { status: 'comercial_proposal', attendedAt: null }),
      lead(2, { appointments: [appointment, appointment] }),
      lead(3, { appointments: [{ ...appointment, status: 'cancelado' }] }),
      lead(4, { appointments: [{ ...appointment, companyId: 3 }] }),
    ]
    const metrics = await execute({ leads })
    const detail = await execute({ leads, detail: true, query: { ...custom, indicator: 'funil-agendados' } })
    assert.equal(metrics.body.data.funil.agendamentos, 1)
    assert.equal(detail.body.data.total, 1)
    assert.deepEqual(detail.body.data.rows.map(row => row.id), [2])
  })

  it('exports all matching rows across pages and rejects oversized reports', async () => {
    const leads = Array.from({ length: 40 }, (_, i) => lead(i + 1, {
      sdrId: i < 32 ? 5 : 6, closerId: i < 30 ? 9 : 8,
    }))
    const query = { ...custom, indicator: 'leads', sdrId: '5', closerId: '9', page: '2', report: 'pdf' }
    const report = await execute({ detail: true, leads, query })
    assert.equal(report.status, 200)
    assert.equal(report.body.data.page, 1)
    assert.equal(report.body.data.rows.length, 30)
    assert.equal(report.body.data.total, 30)
    const oversized = await execute({
      detail: true, query,
      leads: Array.from({ length: 1001 }, (_, i) => lead(i + 1, { sdrId: 5, closerId: 9 })),
    })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.body.data, undefined)
  })

  it('matches the card with clinic and team filters and keeps totals outside search and pagination', async () => {
    const leads = Array.from({ length: 30 }, (_, i) => lead(i + 1, { sdrId: 5 }))
    leads.push(lead(100, { sdrId: 5, companyId: 3 }), lead(101, { sdrId: 6 }))
    const query = { ...custom, sdrId: '5' }
    const metrics = await execute({ query, leads })
    const details = await execute({ query: { ...query, indicator: 'leads', page: '2' }, leads, detail: true })
    assert.equal(details.status, 200)
    assert.equal(details.body.data.total, metrics.body.data.leads)
    assert.equal(details.body.data.rows.length, 5)
    assert(!details.body.data.rows.some(row => row.id > 30))
    const search = await execute({ query: { ...query, indicator: 'leads', search: 'Lead 25' }, leads, detail: true })
    assert.equal(search.body.data.total, 30)
    assert.equal(search.body.data.matching, 1)
  })

  it('groups normalized origin labels like the dashboard', async () => {
    const leads = [
      lead(1, { origin: ' Google ' }), lead(2, { origin: 'google' }), lead(3, { origin: null }),
      lead(4, { origin: 'DESCONHECIDO' }), lead(5, { origin: ' ', companyId: 3 }),
    ]
    const metrics = await execute({ leads })
    for (const { origin, count } of metrics.body.data.origem) {
      const detail = await execute({ detail: true, leads, query: { ...custom, indicator: 'origem', origin } })
      assert.equal(detail.body.data.total, count)
    }
  })

  it('shows proposal authors independently of sales assignment and hides values without billing permission', async () => {
    const createdAt = new Date('2026-09-05T12:00:00Z')
    const leads = [lead(1, { proposals: [
      { id: 1, title: 'Plano A', createdAt, value: 300, authorName: 'Ana', salesperson: { name: 'Bruno' } },
      { id: 2, title: 'Plano B', createdAt, value: 700, authorName: null },
    ] })]
    const options = {
      detail: true, leads, activeRole: { value: 'admin', isAdmin: true, permissions: [
        { hasAccess: true, subPermissions: { verFaturamento: false } },
      ] },
    }
    const detail = await execute({ ...options, query: { ...custom, indicator: 'propostas' } })
    const withValues = await execute({ detail: true, leads, query: { ...custom, indicator: 'propostas' } })
    assert.equal(withValues.body.data.columns[1].label, 'Valor da proposta')
    assert.equal(withValues.body.data.columns[1].format, 'money')
    assert.equal(withValues.body.data.rows[0].cells[1], 300)
    assert.equal(withValues.body.data.rows[1].cells[1], 700)
    assert(!detail.body.data.columns.some(column => column.format === 'money'))
    assert.equal(detail.body.data.total, 2)
    assert.equal(detail.body.data.summary.amount, undefined)
    assert.equal(detail.calls.find(call => call.model === 'proposal-select')?.where.value, undefined)
    assert(detail.body.data.rows[0].cells.includes('Ana'))
    assert(detail.body.data.rows[0].cells.includes('Bruno'))
    assert(detail.body.data.rows[1].cells.includes('Não registrado'))
    const denied = await execute({ ...options, query: { ...custom, indicator: 'vendas' } })
    assert.equal(denied.status, 403)
    const override = await execute({ ...options, accessOverride: false, query: { ...custom, indicator: 'propostas' } })
    assert.equal(override.status, 403)
  })

  it('keeps both conversion bases and excludes estornos from the sales list', async () => {
    const createdAt = new Date('2026-09-05T12:00:00Z')
    const leads = [lead(1, { proposals: [{ id: 1, title: 'Plano A', createdAt, value: 300 }], sales: [
      { id: 1, amount: 200, confirmedAt: createdAt, voidedAt: null },
      { id: 2, amount: 200, confirmedAt: createdAt, voidedAt: null },
      { id: 3, amount: 900, confirmedAt: createdAt, voidedAt: createdAt },
    ] })]
    for (const base of ['propostas', 'vendas']) {
      const result = await execute({ detail: true, leads, query: { ...custom, indicator: 'conversao-qtd', base } })
      assert.deepEqual(result.body.data.summary, { numerator: 2, denominator: 1, value: 200 })
      assert.equal(result.body.data.rows.length, base === 'vendas' ? 2 : 1)
      assert(!result.body.data.rows.some(row => row.id === 3))
    }
  })

  it('reconciles boleto totals and installments while excluding estornos and other clinics', async () => {
    const createdAt = new Date('2026-09-05T12:00:00Z')
    const payment = { professionalId: 1, companyId: 2, clientId: 10, saleId: 5, appointmentId: null,
      method: 'transferencia', status: 'pendente', saleVoidedAt: null, amount: 150, createdAt, date: createdAt,
      client: { id: 10, companyId: 2, name: 'Cliente' },
    }
    const payments = [
      { ...payment, id: 1 }, { ...payment, id: 2, status: 'atrasado' }, { ...payment, id: 3, saleId: null },
      { ...payment, id: 4, companyId: 3 }, { ...payment, id: 5, saleVoidedAt: createdAt },
    ]
    const metrics = await execute({ payments })
    const groups = await execute({ detail: true, payments, query: { ...custom, indicator: 'parcelamento' } })
    assert.deepEqual(groups.body.data.summary, { value: metrics.body.data.parcelamentoMedioBoleto, numerator: 3, denominator: 2 })
    const group = await execute({ detail: true, payments, query: { ...custom, indicator: 'parcelamento', boletoGroup: '5:10:0' } })
    assert.equal(group.body.data.total, 2)
    assert.equal(group.body.data.summary.value, 300)
    const boletos = await execute({ detail: true, payments, query: { ...custom, indicator: 'boleto' } })
    assert.equal(boletos.body.data.summary.value, metrics.body.data.metodos.boleto.gerados)
    assert.equal(boletos.body.data.total, 3)
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
