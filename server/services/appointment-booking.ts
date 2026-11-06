import { prisma } from '../prisma.js'

export class AppointmentConflict extends Error {
  status = 409
  constructor() { super('Este horário já está ocupado. Escolha outro horário.') }
}
export async function lockAppointmentResource(tx: any, companyId: number) {
  await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${companyId} FOR UPDATE`
}
export async function assertAppointmentAvailable(tx: any, item: any, excludeId?: number) {
  if (item.status === 'cancelado') return
  const occupied = await tx.appointment.findFirst({ where: {
    companyId: item.companyId, ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(item.especialistaId ? { especialistaId: item.especialistaId } : { professionalId: item.professionalId, especialistaId: null }),
    status: { not: 'cancelado' }, startTime: { lt: new Date(item.endTime) }, endTime: { gt: new Date(item.startTime) },
  }, select: { id: true } })
  if (occupied) throw new AppointmentConflict()
}
// All schedule writes use the same database lock; checking outside a transaction is not sufficient.
export async function createAppointmentSafely(args: any, db: any = prisma) {
  return db.$transaction(async (tx: any) => {
    await lockAppointmentResource(tx, args.data.companyId)
    await assertAppointmentAvailable(tx, args.data)
    return tx.appointment.create(args)
  })
}
export async function updateAppointmentSafely(args: any, companyId: number, db: any = prisma) {
  return db.$transaction(async (tx: any) => {
    await lockAppointmentResource(tx, companyId)
    const existing = await tx.appointment.findFirst({ where: { ...args.where, companyId } })
    if (!existing) throw new Error('Agendamento não encontrado')
    const changes = Object.fromEntries(Object.entries(args.data).filter(([, v]) => v !== undefined))
    await assertAppointmentAvailable(tx, { ...existing, ...changes }, existing.id)
    return tx.appointment.update(args)
  })
}
