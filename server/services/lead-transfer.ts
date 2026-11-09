import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient
const assignments = [
  { field: 'sdrId', role: 'isSDR', label: 'SDR' },
  { field: 'closerId', role: 'isCloser', label: 'Closer' },
  { field: 'especialistaId', role: 'isSpecialist', label: 'Especialista' },
] as const

// Completed negotiations stay with their original owner during team transfers.
export const transferableLeadWhere: Prisma.LeadWhereInput = {
  status: { notIn: ['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'] },
  isPaid: false,
  sales: { none: { voidedAt: null } },
  proposals: { none: { status: { in: ['accepted', 'comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'] } } },
}

export class LeadTransferError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function leadTransferPreview(db: Db, companyId: number, sourceId: number) {
  const source = await db.usuario.findFirst({
    where: { id: sourceId, OR: [
      { companyAccess: { some: { companyId, isActive: true } } },
      { companyId, companyAccess: { none: {} } },
    ] }, select: { id: true, name: true },
  })
  if (!source) throw new LeadTransferError('Membro não encontrado na clínica atual.', 404)
  const counts = await Promise.all(assignments.map(a => db.lead.count({ where: { ...transferableLeadWhere, companyId, [a.field]: sourceId } })))
  const total = await db.lead.count({ where: { ...transferableLeadWhere, companyId, OR: assignments.map(a => ({ [a.field]: sourceId })) } })
  const members = await db.usuario.findMany({
    where: { id: { not: sourceId }, isActive: true, emailVerified: true, OR: [
      { companyAccess: { some: { companyId, isActive: true } } },
      { companyId, companyAccess: { none: {} } },
    ] },
    select: { id: true, name: true, role: true, companyAccess: {
      where: { companyId, isActive: true }, select: { role: true },
    } }, orderBy: { name: 'asc' },
  })
  const targets = members.filter(member => {
    const role = member.companyAccess.length ? member.companyAccess[0].role : member.role
    return assignments.every((a, index) => !counts[index] || role?.[a.role])
  }).map(member => ({ id: member.id, name: member.name }))
  return { source, companyId, total, counts: Object.fromEntries(assignments.map((a, i) => [a.field, counts[i]])), targets }
}

export async function transferMemberLeads(db: PrismaClient, companyId: number, sourceId: number, targetId: number, expectedTotal: number) {
  if (sourceId === targetId) throw new LeadTransferError('Selecione outro membro para receber os leads.')
  return db.$transaction(async tx => {
    // Prisma binds JS integers as int8; the two-argument PostgreSQL overload
    // requires int4, int4. Explicit casts avoid SQLSTATE 42883 in production.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${companyId}::int4, 724020::int4)`
    const preview = await leadTransferPreview(tx, companyId, sourceId)
    if (!preview.targets.some(member => member.id === targetId)) {
      throw new LeadTransferError('O destino precisa estar ativo nesta clínica e ter as funções necessárias para receber estes leads.')
    }
    if (preview.total !== expectedTotal) throw new LeadTransferError('A quantidade de leads mudou. Atualize a prévia e confirme novamente.', 409)
    if (!preview.total) throw new LeadTransferError('Este membro não possui leads para transferir nesta clínica.')
    // Move only explicit conversation ownership for affected leads; preserve
    // other team members' assignments and all historical financial attribution.
    await tx.conversa.updateMany({ where: {
      companyId, assignedUserId: sourceId,
      lead: { ...transferableLeadWhere, companyId, OR: assignments.map(a => ({ [a.field]: sourceId })) },
    }, data: { assignedUserId: targetId } })
    const changed = []
    for (const assignment of assignments) {
      changed.push(await tx.lead.updateMany({
        where: { ...transferableLeadWhere, companyId, [assignment.field]: sourceId }, data: { [assignment.field]: targetId },
      }))
    }
    if (changed.some((result, index) => result.count !== preview.counts[assignments[index].field])) {
      throw new LeadTransferError('Os responsáveis mudaram durante a transferência. Atualize a prévia e tente novamente.', 409)
    }
    return { transferred: preview.total }
  }, { isolationLevel: 'Serializable' })
}
