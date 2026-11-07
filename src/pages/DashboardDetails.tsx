import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi, usuariosApi } from '@/lib/api'
import { loadDashboardTeam } from '@/lib/dashboard'
import { DashboardSelect } from '@/components/dashboard/DashboardSelect'
import {
  dashboardFilterParams, dashboardIndicators, readDashboardFilters, type DashboardDetailsResult, type DashboardIndicator,
} from '@/lib/dashboard-details'

const LeadRecord = lazy(() => import('@/components/dashboard/DashboardLeadRecord'))
const AppointmentRecord = lazy(() => import('@/components/AppointmentQuickView').then(m => ({ default: m.AppointmentQuickView })))
const ClientRecord = lazy(() => import('@/components/ClientDossierModal').then(m => ({ default: m.ClientDossierModal })))

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const timeZone = 'America/Sao_Paulo'
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone })
const calendarDate = (value: string) => value.split('-').reverse().join('/')

type Row = DashboardDetailsResult['rows'][number]
type RecordLink = NonNullable<Row['record']>

function formatCell(cell: Row['cells'][number], format: DashboardDetailsResult['columns'][number]['format']) {
  if (cell == null || cell === '') return '—'
  if (format === 'money') return money.format(Number(cell))
  if (format === 'date' || format === 'dateTime') return (format === 'date' ? date : dateTime).format(new Date(cell))
  return cell
}

const indicatorSections: { label: string; keys: DashboardIndicator[] }[] = [
  { label: 'Operação comercial', keys: ['leads', 'agendadas', 'comparecidas', 'propostas'] },
  { label: 'Vendas e conversão', keys: ['vendas', 'ticket-orcado', 'ticket-fechado', 'descontos', 'conversao-qtd', 'conversao-valor'] },
  { label: 'Pagamentos', keys: ['boleto', 'parcelamento', 'cartao', 'pix', 'dinheiro'] },
  { label: 'Funil e origens', keys: ['funil-novos', 'funil-contatados', 'funil-agendados', 'funil-fechados', 'origem'] },
]

function formatResult(format: 'money' | 'count' | 'percent' | 'installments', data: DashboardDetailsResult) {
  if (format === 'money') return money.format(data.summary.value)
  if (format === 'percent') return number.format(data.summary.value) + '%'
  if (format === 'installments') return number.format(data.summary.value) + '×'
  return number.format(data.total)
}

function DashboardDetailsContent() {
  const [params, setParams] = useSearchParams()
  const { professional, hasPermission, hasModuleAccess } = useAuth()
  const billing = hasPermission('dashboard', 'verFaturamento')
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [reportError, setReportError] = useState('')
  const exportRequest = useRef<AbortController | null>(null)
  useEffect(() => () => exportRequest.current?.abort(), [])
  const [record, setRecord] = useState<RecordLink>()
  const [inspectedRow, setInspectedRow] = useState<{ row: Row; columns: DashboardDetailsResult['columns']; label: string }>()
  const search = params.get('search')?.slice(0, 120) ?? ''
  const [input, setInput] = useState(search)
  const filters = readDashboardFilters(params)
  const filterParams = dashboardFilterParams(filters)
  const selected = params.get('indicator')
  const indicator = selected && Object.prototype.hasOwnProperty.call(dashboardIndicators, selected) ? selected as DashboardIndicator : 'leads'
  const config = dashboardIndicators[indicator]
  const allowed = !('billing' in config) || billing
  const conversion = indicator === 'conversao-qtd' || indicator === 'conversao-valor'
  const base = params.get('base') === 'propostas' ? 'propostas' : 'vendas'
  const origin = indicator === 'origem' ? params.get('origin') : null
  const boletoGroup = indicator === 'parcelamento' ? params.get('boletoGroup') : null
  const order = params.get('order') === 'asc' ? 'asc' : 'desc'
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1_000_000 ? rawPage : 1
  const query = new URLSearchParams(filterParams)
  query.set('indicator', indicator)
  query.set('page', String(page))
  query.set('order', order)
  if (search) query.set('search', search)
  if (conversion) query.set('base', base)
  if (origin !== null) query.set('origin', origin)
  if (boletoGroup) query.set('boletoGroup', boletoGroup)

  const team = useQuery({
    queryKey: ['dashboard-team', professional?.id, professional?.companyId],
    enabled: Boolean(professional?.companyId),
    retry: false,
    queryFn: ({ signal }) => loadDashboardTeam(professional!.companyId!, usuariosApi.getAll, signal),
  })
  const teamOptions = (kind: 'SDR' | 'Closer', value: string) => {
    const members = kind === 'SDR' ? team.data?.sdrs : team.data?.closers
    const options = [
      { value: 'all', label: kind === 'SDR' ? 'Todos os SDRs' : 'Todos os Closers' },
      { value: 'none', label: 'Sem ' + kind },
      ...[...(members ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map(member => ({ value: String(member.id), label: member.name })),
    ]
    if (!options.some(option => option.value === value)) options.push({ value, label: 'Responsável #' + value })
    return options
  }
  const sdrOptions = teamOptions('SDR', filters.sdrId)
  const closerOptions = teamOptions('Closer', filters.closerId)

  const dataQuery = useQuery({
    queryKey: ['dashboard-details', professional?.id, professional?.companyId, billing, query.toString()],
    enabled: Boolean(professional?.companyId) && allowed,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await dashboardApi.getDetails(query, signal)
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Não foi possível carregar os detalhes.')
      return response.data
    },
  })

  const data = dataQuery.data
  const lastPage = Math.max(1, Math.ceil((data?.matching ?? 0) / (data?.pageSize ?? 25)))

  useEffect(() => { setInput(search) }, [search])
  useEffect(() => {
    if (data && page > lastPage) {
      const next = new URLSearchParams(params)
      next.set('page', String(lastPage))
      setParams(next, { replace: true })
    }
  }, [data, lastPage, page, params, setParams])

  function update(changes: Record<string, string | null>) {
    setReportError('')
    const next = new URLSearchParams(params)
    next.delete('page')
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { preventScrollReset: true })
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', professional?.id, professional?.companyId] })
    void dataQuery.refetch()
  }

  const recordAllowed = (item: RecordLink) => {
    // The source dialogs can contain financial fields beyond this dashboard projection.
    if (!billing || !data?.canReadBilling) return false
    if (item.kind === 'appointment') return hasModuleAccess('agendamentos')
    return hasModuleAccess('clientes') && hasPermission('clientes', item.kind === 'lead' ? 'verLeads' : 'verClientes')
  }
  const summaryFormat = boletoGroup ? 'money' : config.format
  const value = data ? formatResult(summaryFormat, data) : ''

  async function exportPdf() {
    if (exportRequest.current || !data) return
    const controller = new AbortController()
    exportRequest.current = controller
    setExporting(true)
    setReportError('')
    try {
      const reportQuery = new URLSearchParams(query)
      reportQuery.set('report', 'pdf')
      reportQuery.delete('page')
      const [response, { makeDashboardReport }, logo] = await Promise.all([
        dashboardApi.getDetails(reportQuery, controller.signal),
        import('@/lib/dashboard-report'),
        fetch('/logo-site.png', { signal: controller.signal })
          .then(async res => res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined).catch(() => undefined),
      ])
      controller.signal.throwIfAborted()
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'Não foi possível gerar o PDF.')
      const report = response.data
      const teamLabel = (options: typeof sdrOptions, selected: string) => options.find(option => option.value === selected)?.label
      const scope = [
        ['SDR · ' + teamLabel(sdrOptions, filters.sdrId), 'Closer · ' + teamLabel(closerOptions, filters.closerId)].join('  /  '),
        ...(origin ? ['Origem · ' + (report.origins?.find(item => item.toLowerCase() === origin.toLowerCase()) ?? origin)] : []),
        ...(conversion ? ['Base detalhada · ' + (base === 'vendas' ? 'Vendas' : 'Propostas')] : []),
        ...(search ? ['Busca aplicada · ' + search + '  /  ' + number.format(report.total) + ' no indicador'] : []),
      ]
      const title = boletoGroup ? 'Boletos do grupo' : config.label
      const { amount, numerator, denominator } = report.summary
      const resultDetail = indicator === 'conversao-valor' && numerator !== undefined
        ? money.format(numerator) + ' confirmados / ' + money.format(denominator ?? 0) + ' orçados'
        : numerator !== undefined
          ? number.format(numerator) + (conversion ? ' vendas / ' : ' boletos / ')
            + number.format(denominator ?? 0) + (conversion ? ' propostas' : ' grupos')
          : amount !== undefined && (indicator === 'propostas' || indicator.startsWith('ticket-'))
            ? money.format(amount) + (indicator === 'ticket-fechado' ? ' confirmados' : ' orçados') : undefined
      const pdf = makeDashboardReport({
        title, logo, clinic: professional?.companyName ?? 'Clínica SellClin',
        period: calendarDate(report.period.start) + ' a ' + calendarDate(report.period.end),
        scope, result: formatResult(summaryFormat, report), resultDetail,
        rule: boletoGroup ? 'Parcelas registradas no período para o grupo selecionado.' : config.rule,
        columns: report.columns, rows: report.rows.map(row => row.cells.map((cell, i) => String(formatCell(cell, report.columns[i].format)))),
        generatedAt: dateTime.format(new Date()),
      })
      pdf.save(`sellclin-${indicator}-${report.period.end}.pdf`)
    } catch (error) {
      if (!controller.signal.aborted) setReportError(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.')
    } finally {
      exportRequest.current = null
      if (!controller.signal.aborted) setExporting(false)
    }
  }
  const countLabel = (count: number) => {
    if (indicator === 'vendas' || indicator === 'ticket-fechado') return count === 1 ? 'venda confirmada' : 'vendas confirmadas'
    if (indicator === 'propostas' || indicator === 'ticket-orcado') return count === 1 ? 'proposta' : 'propostas'
    if (indicator === 'parcelamento' && !boletoGroup) return count === 1 ? 'grupo' : 'grupos'
    return count === 1 ? 'registro' : 'registros'
  }
  const rowLabel = conversion ? (base === 'vendas' ? 'Venda' : 'Proposta')
    : indicator === 'propostas' || indicator === 'ticket-orcado' || indicator === 'descontos' ? 'Proposta'
    : indicator === 'vendas' || indicator === 'ticket-fechado' ? 'Venda'
    : summaryFormat === 'money' ? 'Pagamento'
    : indicator === 'agendadas' ? 'Agendamento' : 'Lead'
  const openLabel = (item: RecordLink) => item.kind === 'appointment' ? 'Abrir agendamento' : item.kind === 'client' ? 'Abrir cliente' : 'Abrir lead'
  const viewRecords = (row: Row) => row.boletoGroup
    ? <Button type="button" size="sm" variant="ghost" onClick={() => update({ boletoGroup: row.boletoGroup!, search: null })}>Ver boletos</Button>
    : <Button type="button" size="sm" variant="ghost" onClick={() => {
        if (data) setInspectedRow({ row, columns: data.columns, label: rowLabel })
      }}>Abrir {rowLabel.toLowerCase()}</Button>

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <header className="space-y-3">
        <Link to={'/painel?' + filterParams} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar ao dashboard
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Dashboard detalhado</h1>
            <p className="mt-1 text-sm text-muted-foreground">Confira os registros que compõem cada indicador do painel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!allowed || dataQuery.isFetching || !professional?.companyId} onClick={refresh}>
              <RefreshCw aria-hidden="true" /> Atualizar
            </Button>
            <Button disabled={!allowed || !data || dataQuery.isFetching || exporting} onClick={() => void exportPdf()}>
              <FileDown aria-hidden="true" /> {exporting ? 'Gerando PDF…' : 'Gerar PDF'}
            </Button>
          </div>
        </div>
        {reportError && <p role="alert" className="text-sm text-destructive">{reportError}</p>}
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-label="Filtros do relatório">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
          <DashboardSelect id="dashboard-indicator" label="Indicador" value={allowed ? indicator : ''}
            groups={indicatorSections.map(section => ({
              label: section.label,
              options: section.keys.filter(key => billing || !('billing' in dashboardIndicators[key]))
                .map(key => ({ value: key, label: dashboardIndicators[key].label })),
            }))}
            onChange={item => update({ indicator: item, origin: null, base: null, boletoGroup: null, search: null, order: null })}
          />
          <DashboardSelect id="dashboard-sdr" label="SDR" value={filters.sdrId} groups={[{ options: sdrOptions }]}
            onChange={item => update({ sdrId: item === 'all' ? null : item, boletoGroup: null })}
          />
          <DashboardSelect id="dashboard-closer" label="Closer" value={filters.closerId} groups={[{ options: closerOptions }]}
            onChange={item => update({ closerId: item === 'all' ? null : item, boletoGroup: null })}
          />
          {indicator === 'origem' && (
            <DashboardSelect id="dashboard-origin" label="Origem" value={origin === null ? 'all' : 'origin:' + origin.toLowerCase()}
              groups={[{ options: [{ value: 'all', label: 'Todas as origens' }, ...(data?.origins ?? []).map(item => ({ value: 'origin:' + item.toLowerCase(), label: item }))] }]}
              onChange={item => update({ origin: item === 'all' ? null : item.slice(7) })}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {data ? calendarDate(data.period.start) + ' a ' + calendarDate(data.period.end) : 'Período selecionado no dashboard'}
          </p>
          {(filters.sdrId !== 'all' || filters.closerId !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => update({ sdrId: null, closerId: null, boletoGroup: null })}>
              <X aria-hidden="true" /> Limpar filtros de equipe
            </Button>
          )}
        </div>
        {team.isError && <p className="text-sm text-muted-foreground" role="status">
          Não foi possível carregar a equipe. <button className="font-medium text-primary underline" type="button" onClick={() => void team.refetch()}>Tentar novamente</button>
        </p>}
        {allowed && <p className="max-w-3xl text-sm text-muted-foreground">{config.rule}</p>}
      </section>

      {!professional?.companyId ? <p role="status" className="text-sm">Selecione uma clínica para consultar os indicadores.</p>
        : !allowed ? <p role="alert" className="text-sm">Você não tem acesso a esse indicador.</p>
        : dataQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">Carregando detalhes…</p>
        : dataQuery.isError ? (
          <div className="space-y-3 rounded-xl border bg-card p-5" role="alert">
            <p>{dataQuery.error.message}</p>
            <Button size="sm" variant="outline" onClick={refresh}>Tentar novamente</Button>
          </div>
        ) : data && (
          <section className="space-y-4" aria-label="Registros do indicador">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {boletoGroup && <Button size="sm" variant="ghost" onClick={() => update({ boletoGroup: null, search: null })}><ArrowLeft /> Voltar aos grupos</Button>}
              <h2 className="font-headline text-lg font-bold text-primary">{boletoGroup ? 'Boletos do grupo' : config.label}</h2>
              <span className="text-xl font-bold tabular-nums text-primary">{value}</span>
              {!conversion && summaryFormat !== 'count' &&
                <span className="text-sm text-muted-foreground">{number.format(data.total)} {countLabel(data.total)}</span>}
              {data.summary.amount !== undefined && (indicator === 'propostas' || indicator.startsWith('ticket-')) && (
                <span className="text-sm text-muted-foreground">{money.format(data.summary.amount)} {indicator === 'ticket-fechado' ? 'confirmados' : 'orçados'}</span>
              )}
              {data.summary.numerator !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {indicator === 'conversao-valor'
                    ? money.format(data.summary.numerator) + ' confirmados / ' + money.format(data.summary.denominator ?? 0) + ' orçados'
                    : number.format(data.summary.numerator) + (conversion ? ' vendas / ' : ' boletos / ')
                      + number.format(data.summary.denominator ?? 0) + (conversion ? ' propostas' : ' grupos')}
                  {!data.summary.denominator && ' · Base de divisão vazia'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              {conversion && (
                <div className="flex gap-1 rounded-lg border bg-muted/50 p-1" aria-label="Base da conversão">
                  <Button size="sm" variant={base === 'vendas' ? 'default' : 'ghost'} aria-pressed={base === 'vendas'} onClick={() => update({ base: 'vendas', search: null })}>Vendas</Button>
                  <Button size="sm" variant={base === 'propostas' ? 'default' : 'ghost'} aria-pressed={base === 'propostas'} onClick={() => update({ base: 'propostas', search: null })}>Propostas</Button>
                </div>
              )}
              <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); update({ search: input.trim() || null }) }}>
                <Input className="w-48 sm:w-56" aria-label="Buscar nos registros" value={input} maxLength={120} placeholder="Buscar por nome" onChange={event => setInput(event.target.value)} />
                <Button size="sm" type="submit" variant="outline"><Search aria-hidden="true" /> Buscar</Button>
                {search && <Button size="sm" type="button" variant="ghost" onClick={() => update({ search: null })}>Limpar</Button>}
              </form>
              <div className="w-full sm:w-56">
                <DashboardSelect id="dashboard-order" label="Ordenar registros" value={order} groups={[{ options: [
                  { value: 'desc', label: indicator === 'parcelamento' && !boletoGroup ? 'Mais boletos primeiro' : 'Mais recentes primeiro' },
                  { value: 'asc', label: indicator === 'parcelamento' && !boletoGroup ? 'Menos boletos primeiro' : 'Mais antigos primeiro' },
                ] }]} onChange={item => update({ order: item })} />
              </div>
            </div>

            {data.rows.length === 0 ? (
              <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                {search ? 'Nenhum registro corresponde à busca.' : 'Nenhum registro para este recorte.'}
              </p>
            ) : (
              <>
              <ul className="divide-y rounded-xl border bg-card md:hidden" aria-label="Registros do indicador">
                {data.rows.map(row => (
                  <li key={row.id} className="space-y-3 p-4 text-sm">
                    <p className="break-words font-semibold text-primary">{formatCell(row.cells[0], data.columns[0].format)}</p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {data.columns.slice(1).map((column, index) => (
                        <div key={column.label} className="min-w-0">
                          <dt className="text-xs text-muted-foreground">{column.label}</dt>
                          <dd className="break-words tabular-nums">{formatCell(row.cells[index + 1], column.format)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="-ml-3">{viewRecords(row)}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border bg-card md:block" tabIndex={0} role="region" aria-label="Tabela de registros">
                <table className="w-full min-w-[38rem] text-left text-sm">
                  <thead className="border-b bg-muted/60">
                    <tr>
                      {data.columns.map(column => <th scope="col" key={column.label} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}</th>)}
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rows.map(row => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        {row.cells.map((cell, i) => (
                          <td key={data.columns[i].label} className={'px-4 py-3 tabular-nums ' + (i === 0 ? 'min-w-36 font-medium' : 'text-muted-foreground')}>
                            {formatCell(cell, data.columns[i].format)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2">{viewRecords(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span role="status">{search ? number.format(data.matching) + ' de ' : ''}{number.format(data.total)} {countLabel(data.total)}</span>
              {lastPage > 1 && (
                <nav className="flex items-center gap-2" aria-label="Páginas do indicador">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}><ChevronLeft aria-hidden="true" /> Anterior</Button>
                  <span className="tabular-nums">{page} / {lastPage}</span>
                  <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => update({ page: String(page + 1) })}>Próxima <ChevronRight aria-hidden="true" /></Button>
                </nav>
              )}
            </div>
          </section>
        )}

      {inspectedRow && (
        <Dialog open onOpenChange={open => { if (!open) setInspectedRow(undefined) }}>
          <DialogContent role="dialog" aria-modal="true" aria-labelledby="dashboard-record-title" tabIndex={-1}
            ref={element => { element?.focus() }}>
            <DialogHeader><DialogTitle id="dashboard-record-title">{inspectedRow.label} #{inspectedRow.row.id}</DialogTitle></DialogHeader>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {inspectedRow.columns.map((column, i) => (
                <div key={column.label} className="min-w-0">
                  <dt className="text-muted-foreground">{column.label}</dt>
                  <dd className="break-words font-medium">{formatCell(inspectedRow.row.cells[i], column.format)}</dd>
                </div>
              ))}
            </dl>
            {inspectedRow.row.record && recordAllowed(inspectedRow.row.record) && (
              <Button variant="outline" onClick={() => {
                setRecord(inspectedRow.row.record)
                setInspectedRow(undefined)
              }}>{openLabel(inspectedRow.row.record)}</Button>
            )}
          </DialogContent>
        </Dialog>
      )}
      {record && recordAllowed(record) && (
        <Suspense fallback={<p role="status" className="text-sm">Carregando registro…</p>}>
          {record.kind === 'lead' && <LeadRecord id={record.id} onClose={() => setRecord(undefined)} onUpdate={refresh} />}
          {record.kind === 'appointment' && <AppointmentRecord isOpen appointmentId={record.id} onClose={() => setRecord(undefined)} onUpdate={refresh} />}
          {record.kind === 'client' && <ClientRecord open clientId={record.id} onOpenChange={open => { if (!open) { setRecord(undefined); refresh() } }} />}
        </Suspense>
      )}
    </div>
  )
}

export default function DashboardDetails() {
  const { professional, hasPermission } = useAuth()
  const billing = hasPermission('dashboard', 'verFaturamento')
  return <DashboardDetailsContent key={`${professional?.id}:${professional?.companyId}:${billing}`} />
}
