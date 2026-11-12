import type { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import type { AuthUser } from '../middleware/auth.js'
import { prospectingStages, stageBehavior } from '../utils/funnel-stages.js'
import { resolveOperationStage } from './funnel-operations.js'

export const proposalInput = z.object({
  title: z.string().trim().min(1).max(500),
  value: z.coerce.number().finite().min(0).max(99999999.99),
  validUntil: z.coerce.date(),
  salespersonId: z.number().int().positive().nullable().optional(),
  specialistId: z.number().int().positive().nullable().optional(),
  sdrId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).optional(),
  treatment: z.string().trim().max(10000).nullable().optional(),
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

export async function proposalAuthor(db: Prisma.TransactionClient, user: AuthUser) {
  const where = { id: user.id }
  const select = { name: true }
  const author = user.type === 'usuario' ? await db.usuario.findUnique({ where, select })
    : user.type === 'profissional' ? await db.professional.findUnique({ where, select }) : null
  return { authorId: user.id, authorType: user.type, authorName: author?.name ?? null }
}

export async function createLeadProposals(db: PrismaClient, leadId: number, input: unknown, actor: AuthUser) {
  const proposals = z.array(proposalInput).min(1).max(50).parse(input)
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } })
    const author = await proposalAuthor(tx, actor)
    const saved = []
    for (const data of proposals) {
      await validateProposalTeam(tx, lead.companyId!, data)
      saved.push(await tx.proposal.create({ data: { ...data, ...author, leadId, title: data.title!, value: data.value!, validUntil: data.validUntil! } }))
      await tx.leadActivity.create({ data: {
        leadId, type: 'proposta', content: `${data.title} - Valor: R$ ${data.value.toFixed(2)}`, createdBy: String(actor.id),
      } })
    }
    const last = proposals[proposals.length - 1]
    const advance = prospectingStages.includes(stageBehavior(lead.status))
    const target = advance ? await resolveOperationStage(tx, lead.companyId, lead.status, 'commercial', 'comercial_proposal') : null
    await tx.lead.update({ where: { id: leadId }, data: {
      value: last.value,
      ...(last.sdrId ? { sdrId: last.sdrId } : {}),
      ...(last.salespersonId ? { closerId: last.salespersonId } : {}),
      ...(advance ? { proposalAt: lead.proposalAt || new Date() } : {}),
      ...(target ? { status: target } : {}),
    } })
    return { proposals: saved, advancedTo: target }
  })
}
