import { isValidDashboardRange, type DashboardFilter } from './dashboard'

export const dashboardIndicators = {
  leads: { label: 'Total de Leads', rule: 'Leads cadastrados no período.', format: 'count' },
  agendadas: { label: 'Avaliações Agendadas', rule: 'Agendamentos cadastrados no período com status agendado, confirmado ou concluído.', format: 'count' },
  comparecidas: { label: 'Avaliações Comparecidas', rule: 'Leads com comparecimento registrado no período e etapa atual de comparecimento ou comercial.', format: 'count' },
  propostas: { label: 'Propostas Geradas', rule: 'Propostas criadas no período. O total orçado soma o valor dessas propostas.', format: 'count' },
  vendas: { label: 'Faturamento Realizado', rule: 'Valor das vendas confirmadas no período, excluindo estornos. Cada registro é contado como um fechamento.', format: 'money', billing: true },
  'ticket-orcado': { label: 'Ticket Orçado', rule: 'Total orçado dividido pela quantidade de propostas criadas no período.', format: 'money', billing: true },
  'ticket-fechado': { label: 'Ticket Fechado', rule: 'Valor confirmado dividido pelo número de vendas confirmadas no período.', format: 'money', billing: true },
  parcelamento: { label: 'Parcelamento Médio de Boleto', rule: 'Boletos registrados no período divididos pelos grupos de venda, cliente e agendamento.', format: 'installments', billing: true },
  descontos: { label: 'Desconto Concedido', rule: 'Descontos de propostas com venda válida confirmada no período. Cada proposta entra uma vez.', format: 'money', billing: true },
  'conversao-qtd': { label: 'Fechados / Propostas', rule: 'Vendas confirmadas divididas por propostas criadas no período. As bases são independentes, então o resultado pode superar 100%.', format: 'percent' },
  'conversao-valor': { label: 'Fechado / Orçado', rule: 'Valor confirmado dividido pelo valor orçado no período. As bases são independentes, então o resultado pode superar 100%.', format: 'percent', billing: true },
  boleto: { label: 'Boletos Gerados', rule: 'Boletos pagos, pendentes ou atrasados registrados no período, excluindo vendas estornadas.', format: 'money', billing: true },
  cartao: { label: 'Cartão', rule: 'Pagamentos de cartão registrados no período, incluindo pagos, pendentes e atrasados. Exclui vendas estornadas.', format: 'money', billing: true },
  pix: { label: 'Pix / Débito', rule: 'Registros Pix pagos, pendentes ou atrasados cadastrados no período, excluindo vendas estornadas.', format: 'money', billing: true },
  dinheiro: { label: 'Dinheiro', rule: 'Pagamentos em dinheiro registrados no período, incluindo pagos, pendentes e atrasados. Exclui vendas estornadas.', format: 'money', billing: true },
  'funil-novos': { label: 'Funil · Novos', rule: 'Todos os leads criados no período.', format: 'count' },
  'funil-contatados': { label: 'Funil · Contatados', rule: 'Leads criados no período cuja etapa atual é diferente da primeira etapa de prospecção.', format: 'count' },
  'funil-agendados': { label: 'Funil · Agendados', rule: 'Leads criados no período que estão fora das duas primeiras etapas de prospecção.', format: 'count' },
  'funil-fechados': { label: 'Funil · Fechados', rule: 'Leads criados no período com ao menos uma venda válida. A venda pode ter sido confirmada fora do período.', format: 'count' },
  origem: { label: 'Leads por Origem', rule: 'Leads criados no período. Origens vazias são agrupadas em Desconhecido.', format: 'count' },
} satisfies Record<string, { label: string; rule: string; format: 'count' | 'money' | 'percent' | 'installments'; billing?: boolean }>

export type DashboardIndicator = keyof typeof dashboardIndicators

export interface DashboardDetailsResult {
  columns: { label: string; format?: 'date' | 'dateTime' | 'money' }[]
  rows: {
    id: string | number
    cells: (string | number | null)[]
    record?: { kind: 'lead' | 'appointment' | 'client'; id: number }
    boletoGroup?: string
  }[]
  matching: number
  total: number
  page: number
  pageSize: number
  summary: { value: number; amount?: number; numerator?: number; denominator?: number }
  period: { start: string; end: string; timeZone: string }
  origins?: string[]
  canReadBilling: boolean
}

const teamSelection = (value: string | null) => value && /^(all|none|[1-9]\d{0,9})$/.test(value) ? value : 'all'

export function readDashboardFilters(params: URLSearchParams) {
  const value = params.get('filter')
  const start = params.get('startDate') || ''
  const end = params.get('endDate') || ''
  const filter: DashboardFilter = value === 'custom' && isValidDashboardRange(start, end) ? 'custom'
    : value === 'today' || value === '7days' || value === '30days' ? value : 'this_month'
  return { filter, start, end, sdrId: teamSelection(params.get('sdrId')), closerId: teamSelection(params.get('closerId')) }
}

export function dashboardFilterParams({ filter, start, end, sdrId, closerId }: ReturnType<typeof readDashboardFilters>) {
  const params = new URLSearchParams({ filter })
  if (filter === 'custom') {
    params.set('startDate', start)
    params.set('endDate', end)
  }
  if (sdrId !== 'all') params.set('sdrId', sdrId)
  if (closerId !== 'all') params.set('closerId', closerId)
  return params
}
