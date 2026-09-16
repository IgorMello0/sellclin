import type { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'

export const proposalInput = z.object({
  title: z.string().trim().min(1).max(500),
  value: z.coerce.number().finite().min(0).max(99999999.99),
  validUntil: z.coerce.date(),
  salespersonId: z.number().int().positive().nullable().optional(),
  specialistId: z.number().int().positive().nullable().optional(),
  sdrId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).optional(),
  justification: z.string().nullable().optional(),
  discountApplied: z.boolean().optional(),
})

export async function validateProposalTeam(db: Prisma.TransactionClient, companyId: number, data: z.infer<typeof proposalInput> | Record<string, any>) {
  for (const id of new Set([data.salespersonId, data.specialistId, data.sdrId].filter(Boolean))) {
    const member = await db.usuario.findFirst({ where: { id, isActive: true, OR: [
      { companyId }, { companyAccess: { some: { companyId, isActive: true } } },
    ] }, select: { id: true } })
    if (!member) throw new Error('Responsável não pertence à clínica ativa.')
  }
}

export async function createLeadProposals(db: PrismaClient, leadId: number, input: unknown, createdBy: string) {
  const proposals = z.array(proposalInput).min(1).max(50).parse(input)
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } })
    const saved = []
    for (const data of proposals) {
      await validateProposalTeam(tx, lead.companyId!, data)
      saved.push(await tx.proposal.create({ data: { ...data, leadId, title: data.title!, value: data.value!, validUntil: data.validUntil! } }))
      await tx.leadActivity.create({ data: {
        leadId, type: 'proposta', content: `${data.title} - Valor: R$ ${data.value.toFixed(2)}`, createdBy,
      } })
    }
    const last = proposals[proposals.length - 1]
    const advance = ['prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended'].includes(lead.status)
    await tx.lead.update({ where: { id: leadId }, data: {
      value: last.value,
      ...(last.sdrId ? { sdrId: last.sdrId } : {}),
      ...(last.salespersonId ? { closerId: last.salespersonId } : {}),
      ...(advance ? { status: 'comercial_proposal', proposalAt: lead.proposalAt || new Date(), attendedAt: lead.attendedAt || new Date() } : {}),
    } })
    return saved
  })
}
