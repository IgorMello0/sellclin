import type { Prisma, PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import { z, ZodError } from 'zod'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { parseDashboardQuery } from './dashboard-filters.js'
import { boletoGroupBy, getDashboardScope, originKey, paymentStatuses } from './dashboard-scope.js'

const paymentMethods = { boleto: 'transferencia', cartao: 'cartao', pix: 'pix', dinheiro: 'dinheiro' } as const
const detailQuery = z.object({
  indicator: z.enum([
    'leads', 'agendadas', 'comparecidas', 'propostas', 'vendas', 'ticket-orcado', 'ticket-fechado',
    'parcelamento', 'descontos', 'conversao-qtd', 'conversao-valor', 'boleto', 'cartao', 'pix', 'dinheiro',
    'funil-novos', 'funil-contatados', 'funil-agendados', 'funil-fechados', 'origem',
  ]),
  origin: z.string().optional(),
  base: z.enum(['vendas', 'propostas']).default('vendas'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  report: z.literal('pdf').optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).default(''),
  boletoGroup: z.string().regex(/^(?:0|[1-9]\d{0,9}):[1-9]\d{0,9}:(?:0|[1-9]\d{0,9})$/)
    .refine(key => key.split(':').every(id => Number(id) <= 2147483647)).optional(),
})
type DetailQuery = z.infer<typeof detailQuery>
const maxReportRows = 1_000

const billingOnly = new Set<DetailQuery['indicator']>([
  'vendas', 'ticket-orcado', 'ticket-fechado', 'parcelamento', 'descontos', 'conversao-valor',
  'boleto', 'cartao', 'pix', 'dinheiro',
])
const person = { select: { name: true } } as const
const contact = { select: { id: true, companyId: true, name: true } } as const
const proposalSelect = {
  id: true, title: true, createdAt: true, lead: contact,
  sdr: person, salesperson: person, specialist: person, authorName: true,
} as const

type Cell = string | number | Date | null
type RecordLink = { kind: 'lead' | 'appointment' | 'client'; id: number }
type DetailRow = { id: number | string; cells: Cell[]; record?: RecordLink; boletoGroup?: string }
type Column = { label: string; format?: 'money' | 'date' | 'dateTime' }
const col = (label: string, format?: Column['format']): Column => ({ label, format })

async function readDetail(
  db: Prisma.TransactionClient, scope: Awaited<ReturnType<typeof getDashboardScope>>,
  q: DetailQuery, companyId: number,
) {
  const { indicator, search, order } = q
  const page = q.report ? 1 : q.page
  const pageSize = q.report ? maxReportRows : 25
  const pagination = { take: pageSize, skip: (page - 1) * pageSize }
  // Treat user input as literal text when Prisma translates contains to ILIKE.
  const name = { contains: search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const }
  const billing = scope.canReadBillingDetails
  const link = (kind: RecordLink['kind'], entity: { id: number; companyId: number | null } | null) =>
    entity?.companyId === companyId ? { kind, id: entity.id } : undefined
  const scopedName = (entity: { name: string; companyId: number | null } | null) =>
    entity?.companyId === companyId ? entity.name : null
  const statusNames: Record<string, string> = {
    agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído',
    pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado',
    prospect_lead: 'Novo lead', prospect_qualified: 'Qualificado', prospect_scheduled: 'Agendado',
    prospect_attended: 'Compareceu', comercial_proposal: 'Proposta', comercial_follow: 'Acompanhamento',
    comercial_closed: 'Fechado',
  }

  async function list<T>(
    columns: Column[], count: PromiseLike<number>, rows: PromiseLike<T[]>,
    map: (row: T) => DetailRow, total?: number,
  ) {
    const [matching, records] = await Promise.all([count, rows])
    return { columns, rows: records.map(map), matching, total: total ?? matching, page, pageSize }
  }

  const conversion = indicator === 'conversao-qtd' || indicator === 'conversao-valor'
  const financialConversion = indicator === 'conversao-valor'
  const summary = conversion ? await (async () => {
    const [sales, proposals] = await Promise.all([
      db.sale.aggregate({ where: scope.saleWhere, _count: { id: true }, ...(financialConversion && { _sum: { amount: true } }) }),
      db.proposal.aggregate({ where: scope.proposalWhere, _count: { id: true }, ...(financialConversion && { _sum: { value: true } }) }),
    ])
    const numerator = financialConversion ? Number(sales._sum?.amount ?? 0) : sales._count.id
    const denominator = financialConversion ? Number(proposals._sum?.value ?? 0) : proposals._count.id
    return { numerator, denominator, value: denominator > 0 ? (numerator / denominator) * 100 : 0 }
  })() : undefined

  if (indicator === 'vendas' || indicator === 'ticket-fechado' || (conversion && q.base === 'vendas')) {
    const base = scope.saleWhere
    const where: Prisma.SaleWhereInput = search ? { AND: [base, { lead: { name } }] } : base
    const totals = summary ? undefined : await db.sale.aggregate({
      where: base, _count: { id: true }, _sum: { amount: true },
    })
    const amount = Number(totals?._sum.amount ?? 0)
    const total = totals?._count.id
    const result = await list(
      [col('Lead'), col('Proposta'), col('Responsável comercial'), col('Confirmada em', 'dateTime'),
        ...(billing ? [col('Valor', 'money')] : [])],
      db.sale.count({ where }),
      db.sale.findMany({
        where, ...pagination, orderBy: [{ confirmedAt: order }, { id: order }],
        select: { id: true, confirmedAt: true, ...(billing && { amount: true }), lead: contact,
          proposal: { select: { title: true, leadId: true, salesperson: person } } },
      }),
      row => ({
        id: row.id, record: link('lead', row.lead),
        cells: [row.lead.name, row.proposal?.leadId === row.lead.id ? row.proposal.title : null,
          row.proposal?.leadId === row.lead.id ? row.proposal.salesperson?.name ?? null : null, row.confirmedAt,
          ...(billing ? [Number(row.amount)] : [])],
      }), total ?? (summary && !financialConversion ? summary.numerator : undefined),
    )
    if (summary && financialConversion && search) result.total = await db.sale.count({ where: base })
    return { ...result, summary: summary ?? { value: indicator === 'ticket-fechado' && total ? amount / total : amount, amount } }
  }

  if (indicator === 'propostas' || indicator === 'ticket-orcado' || indicator === 'descontos' || conversion) {
    const discount = indicator === 'descontos'
    const base = discount ? scope.discountWhere : scope.proposalWhere
    const where: Prisma.ProposalWhereInput = search ? { AND: [base, { OR: [{ title: name }, { lead: { name } }] }] } : base
    const totals = summary ? undefined : await db.proposal.aggregate({
      where: base, _count: { id: true },
      ...(billing && { _sum: { discountValue: true, value: true } }),
    })
    const amount = Number((discount ? totals?._sum?.discountValue : totals?._sum?.value) ?? 0)
    const total = totals?._count.id
    const result = await list(
      [col('Proposta'), col('Lead'), col('Criada em', 'dateTime'), col('SDR'), col('Responsável comercial'),
        col('Especialista'), col('Criado por'), ...(discount ? [col('Vendas confirmadas')] : []),
        ...(billing ? [col(discount ? 'Desconto' : 'Valor', 'money')] : [])],
      db.proposal.count({ where }),
      db.proposal.findMany({
        where, ...pagination, orderBy: [{ createdAt: order }, { id: order }],
        select: { ...proposalSelect, ...(billing && { value: true }),
          ...(discount && { discountValue: true, _count: { select: { sales: { where: scope.saleWhere } } } }),
        },
      }),
      row => ({
        id: row.id, record: link('lead', row.lead),
        cells: [row.title, row.lead.name, row.createdAt, row.sdr?.name ?? null, row.salesperson?.name ?? null,
          row.specialist?.name ?? null, row.authorName ?? 'Não registrado', ...(discount ? [row._count.sales] : []),
          ...(billing ? [Number(discount ? row.discountValue : row.value)] : [])],
      }), total ?? (summary && !financialConversion ? summary.denominator : undefined),
    )
    if (summary && financialConversion && search) result.total = await db.proposal.count({ where: base })
    return { ...result, summary: summary ?? { value: indicator === 'ticket-orcado' && total ? amount / total : billing ? amount : result.total, ...(billing && { amount }) } }
  }

  if (indicator === 'agendadas') {
    const base = scope.appointmentWhere
    const where: Prisma.AppointmentWhereInput = search ? { AND: [base, { OR: [
      { client: { companyId, name } }, { lead: { companyId, name } },
    ] }] } : base
    const result = await list(
      [col('Lead ou cliente'), col('Cadastrada em', 'dateTime'), col('Data da consulta', 'dateTime'),
        col('Status'), col('SDR'), col('Profissional')],
      db.appointment.count({ where }),
      db.appointment.findMany({ where, ...pagination, orderBy: [{ createdAt: order }, { id: order }],
        select: { id: true, companyId: true, client: contact, lead: contact, createdAt: true, startTime: true,
          status: true, sdr: person, especialista: person, professional: person },
      }),
      row => ({ id: row.id, record: link('appointment', row),
        cells: [scopedName(row.lead) ?? scopedName(row.client), row.createdAt, row.startTime,
          statusNames[row.status] ?? row.status, row.sdr?.name ?? null, row.especialista?.name ?? row.professional.name],
      }), search ? await db.appointment.count({ where: base }) : undefined,
    )
    return { ...result, summary: { value: result.total } }
  }

  if (indicator === 'parcelamento' || Object.hasOwn(paymentMethods, indicator)) {
    const method = indicator === 'parcelamento' ? 'transferencia' : paymentMethods[indicator as keyof typeof paymentMethods]
    const base: Prisma.PaymentWhereInput = { ...scope.paymentWhere, method, status: { in: [...paymentStatuses] } }
    const query: Prisma.PaymentWhereInput = search ? { client: { companyId, name } } : {}
    const [saleId, clientId, appointmentId] = q.boletoGroup?.split(':').map(Number) ?? []
    const group = q.boletoGroup && indicator === 'parcelamento' ? { saleId: saleId || null, clientId, appointmentId: appointmentId || null } : undefined
    const where = { ...base, ...query, ...group }
    if (indicator === 'parcelamento' && !group) {
      const [totals, matchingGroups, rows] = await Promise.all([
        db.payment.groupBy({ by: [...boletoGroupBy], where: base, _count: { id: true } }),
        search ? db.payment.groupBy({ by: [...boletoGroupBy], where }) : undefined,
        db.payment.groupBy({
          by: [...boletoGroupBy], where, _count: { id: true }, ...pagination,
          orderBy: [{ _count: { id: order } }, { saleId: 'asc' }, { clientId: 'asc' }, { appointmentId: 'asc' }],
        }),
      ])
      const clients = await db.client.findMany({
        where: { id: { in: rows.map(row => row.clientId) }, companyId }, select: { id: true, name: true },
      })
      const names = new Map(clients.map(client => [client.id, client.name]))
      const numerator = totals.reduce((sum, row) => sum + row._count.id, 0)
      const denominator = totals.length
      return {
        columns: [col('Cliente'), col('Venda'), col('Agendamento'), col('Boletos')],
        rows: rows.map(row => {
          const key = [row.saleId ?? 0, row.clientId, row.appointmentId ?? 0].join(':')
          return { id: key, boletoGroup: key, cells: [names.get(row.clientId) ?? null, row.saleId, row.appointmentId, row._count.id] }
        }),
        matching: matchingGroups?.length ?? denominator, total: denominator, page, pageSize,
        summary: { numerator, denominator, value: denominator ? Number((numerator / denominator).toFixed(1)) : 0 },
      }
    }

    const totals = await db.payment.aggregate({ where: { ...base, ...group }, _count: { id: true }, _sum: { amount: true } })
    const result = await list(
      [col('Cliente'), col('Valor', 'money'), col('Status'), col('Registrado em', 'dateTime'), col('Data de referência', 'date'), col('Venda')],
      db.payment.count({ where }),
      db.payment.findMany({ where, ...pagination, orderBy: [{ createdAt: order }, { id: order }],
        select: { id: true, client: contact, amount: true, status: true, createdAt: true, date: true, saleId: true },
      }),
      row => ({ id: row.id, record: link('client', row.client),
        cells: [scopedName(row.client), Number(row.amount), statusNames[row.status] ?? row.status, row.createdAt, row.date, row.saleId],
      }), totals._count.id,
    )
    return { ...result, summary: { value: Number(totals._sum.amount ?? 0) } }
  }

  let base = scope.leadWhere
  if (indicator === 'comparecidas') base = scope.attendedWhere
  if (indicator === 'funil-contatados') base = { ...base, status: { not: scope.finalProspectStages[0] } }
  if (indicator === 'funil-agendados') base = scope.funnelScheduledWhere
  if (indicator === 'funil-fechados') base = scope.funnelClosedWhere
  let origins: string[] | undefined
  if (indicator === 'origem') {
    const grouped = await db.lead.groupBy({ by: ['origin'], where: base })
    const labels = new Map(grouped.map(row => [originKey(row.origin), row.origin?.trim() || 'Desconhecido']))
    if (labels.has('desconhecido')) labels.set('desconhecido', 'Desconhecido')
    origins = [...labels.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    if (q.origin !== undefined) {
      const matches = grouped.filter(row => originKey(row.origin) === originKey(q.origin!))
      base = { AND: [base, { OR: matches.map(row => ({ origin: row.origin })) }] }
    }
  }
  const dateKey = indicator === 'comparecidas' ? 'attendedAt' : 'createdAt'
  const isClosed = indicator === 'funil-fechados'
  const where = search ? { AND: [base, { name }] } : base
  const result = await list(
    [col('Lead'), col(dateKey === 'attendedAt' ? 'Compareceu em' : 'Entrada', 'dateTime'), col('Origem'),
      col('Etapa atual'), col('SDR'), col('Closer'), ...(isClosed ? [col('Vendas válidas')] : [])],
    db.lead.count({ where }),
    db.lead.findMany({ where, ...pagination, orderBy: [{ [dateKey]: order }, { id: order }],
      select: { id: true, companyId: true, name: true, createdAt: true, attendedAt: true, origin: true, status: true,
        sdr: person, closer: person, ...(isClosed && { _count: { select: { sales: { where: { voidedAt: null } } } } }),
      },
    }),
    row => ({ id: row.id, record: link('lead', row),
      cells: [row.name, row[dateKey], originKey(row.origin) === 'desconhecido' ? 'Desconhecido' : row.origin!.trim(),
        scope.stageNames[row.status] ?? statusNames[row.status] ?? row.status, row.sdr?.name ?? null, row.closer?.name ?? null,
        ...(isClosed ? [row._count.sales] : [])],
    }), search ? await db.lead.count({ where: base }) : undefined,
  )
  return { ...result, summary: { value: result.total }, origins }
}

export function createDashboardDetailsHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const user = req.user
      const companyId = user?.companyId
      if (!companyId || !user || user.type === 'cliente') {
        return res.status(403).json(createErrorResponse('Selecione uma clínica para acessar os detalhes.', 403))
      }
      const range = parseDashboardQuery(req.query)
      const query = detailQuery.parse(req.query)
      const data = await prisma.$transaction(async db => {
        const scope = await getDashboardScope(db, user, range, true)
        if (!scope.canReadDetails || (billingOnly.has(query.indicator) && !scope.canReadBillingDetails)) return null
        return { ...await readDetail(db, scope, query, companyId), period: range.period, canReadBilling: scope.canReadBillingDetails }
      }, { isolationLevel: 'RepeatableRead' })
      if (!data) return res.status(403).json(createErrorResponse('Você não tem acesso a esse indicador.', 403))
      if (query.report && data.matching > maxReportRows) {
        return res.status(413).json(createErrorResponse('O PDF comporta até 1.000 registros. Reduza o período, filtre pela equipe ou refine a busca.', 413))
      }
      return res.json(createSuccessResponse(data))
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json(createErrorResponse('Filtros do dashboard inválidos.', 400))
      console.error('[Dashboard] Erro ao buscar detalhes:', error)
      return res.status(500).json(createErrorResponse('Não foi possível carregar os detalhes.', 500))
    }
  }
}
