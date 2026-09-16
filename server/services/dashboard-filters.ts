import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { z } from 'zod'

export const DASHBOARD_TIME_ZONE = 'America/Sao_Paulo'

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data inválida')

const teamId = z.union([z.literal('all'), z.literal('none'), z.string().regex(/^[1-9]\d*$/)
  .refine(value => Number.isSafeInteger(Number(value)))]).default('all')

const querySchema = z.object({
  filter: z.enum(['today', '7days', '30days', 'this_month', 'custom']).default('this_month'),
  startDate: calendarDate.optional(),
  endDate: calendarDate.optional(),
  sdrId: teamId,
  closerId: teamId,
}).superRefine((query, context) => {
  if (query.filter === 'custom' && (!query.startDate || !query.endDate || query.startDate > query.endDate)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um período válido: a data inicial deve ser anterior ou igual à final.' })
  }
})

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function parseDashboardQuery(input: unknown, now = new Date()) {
  const query = querySchema.parse(input)
  const today = formatInTimeZone(now, DASHBOARD_TIME_ZONE, 'yyyy-MM-dd')
  let start = today
  let end = today
  if (query.filter === '7days') start = addCalendarDays(today, -6)
  if (query.filter === '30days') start = addCalendarDays(today, -29)
  if (query.filter === 'this_month') {
    start = `${today.slice(0, 7)}-01`
    const nextMonth = new Date(`${start}T12:00:00Z`)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    end = addCalendarDays(nextMonth.toISOString().slice(0, 10), -1)
  }
  if (query.filter === 'custom') {
    start = query.startDate!
    end = query.endDate!
  }
  return {
    ...query,
    startDate: fromZonedTime(`${start}T00:00:00`, DASHBOARD_TIME_ZONE),
    // Exclusive end includes sub-second timestamps on the last selected day.
    endDate: fromZonedTime(`${addCalendarDays(end, 1)}T00:00:00`, DASHBOARD_TIME_ZONE),
    period: { start, end, timeZone: DASHBOARD_TIME_ZONE },
  }
}

export function buildTeamFilter(kind: 'sdr' | 'closer', selection: string) {
  const leadField = kind === 'sdr' ? 'sdrId' : 'closerId'
  const proposalField = kind === 'sdr' ? 'sdrId' : 'salespersonId'
  const appointmentField = kind === 'sdr' ? 'sdrId' : 'especialistaId'

  if (selection === 'none') {
    // "Leads sem responsável" refers to the current assignment, not old proposals.
    const lead = { [leadField]: null }
    const appointment = {
      [appointmentField]: null,
      OR: [{ lead: null }, { lead }],
    }
    const payment = { AND: [
      { OR: [{ appointment: null }, { appointment }] },
      { OR: [{ client: { originLead: null } }, { client: { originLead: lead } }] },
    ] }
    return { lead, appointment, payment }
  }

  const id = Number(selection)
  const lead = { OR: [
    { [leadField]: id },
    { proposals: { some: { [proposalField]: id } } },
  ] }
  const appointment = { OR: [{ [appointmentField]: id }, { lead }] }
  const payment = { OR: [{ appointment }, { client: { originLead: lead } }] }
  return { lead, appointment, payment }
}
