import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { prisma } from '../prisma.js'
import { assertAppointmentAvailable, lockAppointmentResource } from './appointment-booking.js'
import type { Slot } from './bot-policy.js'

export async function botCatalog(companyId: number, db: any = prisma) {
  return db.catalogItem.findMany({ where: { status: 'ativo', professional: { OR: [{ companyId }, { ownedCompanies: { some: { id: companyId } } }] } },
    select: { id: true, name: true, price: true, professionalId: true, durationMinutes: true, professional: { select: { name: true } } }, take: 100, orderBy: { name: 'asc' } })
}
export async function botSpecialists(companyId: number, db: any = prisma) {
  return db.usuario.findMany({ where: { isActive: true, emailVerified: true, OR: [
    { companyAccess: { some: { companyId, isActive: true, role: { isSpecialist: true } } } },
    { companyId, companyAccess: { none: {} }, role: { isSpecialist: true } },
  ] }, select: { id: true, name: true }, take: 100, orderBy: { name: 'asc' } })
}
export async function availableBotSlots(companyId: number, serviceId: number, day: string, config: any, db: any = prisma, now = new Date(), specialistId: number | null = null): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
  const zone = config.timezone || 'America/Sao_Paulo'
  const date = fromZonedTime(`${day}T12:00:00`, zone)
  if (!Number.isFinite(date.getTime()) || formatInTimeZone(date, zone, 'yyyy-MM-dd') !== day || date.getTime() > now.getTime() + 90 * 86400000) return []
  const weekday = Number(formatInTimeZone(date, zone, 'i')) % 7
  const days = Array.isArray(config.workingDays) ? config.workingDays : [1, 2, 3, 4, 5]
  if (!days.includes(weekday)) return []
  const company = await db.empresa.findUnique({ where: { id: companyId }, select: { openHour: true, closeHour: true } })
  const service = (await botCatalog(companyId, db)).find((s: any) => s.id === serviceId)
  const specialist = specialistId ? (await botSpecialists(companyId, db)).find((s: any) => s.id === specialistId) : null
  if (specialistId && !specialist) return []
  if (!company || !service || !service.durationMinutes || service.durationMinutes < 5 || service.durationMinutes > 480) return []
  const start = fromZonedTime(`${day}T${company.openHour}:00`, zone)
  const close = fromZonedTime(`${day}T${company.closeHour}:00`, zone)
  const bookings = await db.appointment.findMany({ where: { companyId, ...(specialistId ? { especialistaId: specialistId } : { professionalId: service.professionalId, especialistaId: null }),
    status: { not: 'cancelado' }, startTime: { lt: close }, endTime: { gt: start } }, select: { startTime: true, endTime: true } })
  const slots: Slot[] = []
  for (let t = start.getTime(); t + service.durationMinutes * 60000 <= close.getTime() && slots.length < 8; t += 30 * 60000) {
    const end = t + service.durationMinutes * 60000
    if (t <= now.getTime() + 15 * 60000 || bookings.some((b: any) => new Date(b.startTime).getTime() < end && new Date(b.endTime).getTime() > t)) continue
    slots.push({ serviceId, professionalId: service.professionalId, specialistId, start: new Date(t).toISOString(), end: new Date(end).toISOString(),
      label: `${service.name} • ${specialist?.name || service.professional.name} • ${formatInTimeZone(new Date(t), zone, 'dd/MM/yyyy HH:mm')} (${zone})` })
  }
  return slots
}
export async function confirmBotAppointment(tx: any, conversation: any, slot: Slot, config: any) {
  await lockAppointmentResource(tx, conversation.companyId)
  if (conversation.leadId && !await tx.lead.findFirst({ where: { id: conversation.leadId, companyId: conversation.companyId }, select: { id: true } })) return null
  if (conversation.clientId && !await tx.client.findFirst({ where: { id: conversation.clientId, companyId: conversation.companyId }, select: { id: true } })) return null
  const day = formatInTimeZone(new Date(slot.start), config.timezone, 'yyyy-MM-dd')
  // Revalidate ownership, service duration, clinic hours and conflicts at the time of confirmation.
  const slots = await availableBotSlots(conversation.companyId, slot.serviceId, day, config, tx, new Date(), slot.specialistId || null)
  if (!slots.some(s => s.start === slot.start && s.end === slot.end && s.professionalId === slot.professionalId && s.specialistId === (slot.specialistId || null))) return null
  const data = { companyId: conversation.companyId, professionalId: slot.professionalId, serviceId: slot.serviceId,
    leadId: conversation.leadId, clientId: conversation.clientId, especialistaId: slot.specialistId || null, startTime: new Date(slot.start), endTime: new Date(slot.end), status: 'agendado', notes: 'Confirmado pelo contato no atendimento automático.' }
  await assertAppointmentAvailable(tx, data)
  const created = await tx.appointment.create({ data })
  if (conversation.leadId) await tx.lead.updateMany({ where: { id: conversation.leadId, companyId: conversation.companyId }, data: { isScheduled: true } })
  await tx.conversationEvent.create({ data: { conversationId: conversation.id, type: 'bot_appointment_created', metadata: { appointmentId: created.id } } })
  return created
}
