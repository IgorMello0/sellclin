import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando correção do backfill histórico de métricas...')

  const funnels = await prisma.funnelConfig.findMany({ include: { stages: { orderBy: { order: 'asc' } } } });
  const commercialStages = funnels.find(f => f.code === 'commercial')?.stages.map(s => s.code) || [];
  const finalCommercialStages = commercialStages.length > 0 ? commercialStages : ['comercial_proposal', 'comercial_follow', 'comercial_closed'];
  const attendedStages = ['prospect_attended', ...finalCommercialStages];
  const closedStages = Array.from(new Set(['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post']));

  // Busca leads afetados pelo script do dia 01/08
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { attendedAt: { gte: new Date('2026-08-01T00:00:00.000Z') } },
        { proposalAt: { gte: new Date('2026-08-01T00:00:00.000Z') } },
        { closedAt: { gte: new Date('2026-08-01T00:00:00.000Z') } }
      ],
      createdAt: { lt: new Date('2026-08-01T00:00:00.000Z') } // Apenas os leads velhos que ganharam data nova
    },
    include: {
      proposals: { orderBy: { createdAt: 'asc' }, take: 1 },
      appointments: { orderBy: { createdAt: 'asc' }, take: 1 }
    }
  });

  console.log(`[+] Encontrados ${leads.length} leads corrompidos pelo script de sábado para corrigir.`);

  for (const lead of leads) {
    let attended = lead.attendedAt;
    let proposal = lead.proposalAt;
    let closed = lead.closedAt;

    // Use appointment for attended
    if (lead.appointments.length > 0) {
      attended = lead.appointments[0].createdAt;
    } else {
      attended = new Date(lead.createdAt.getTime() + 1 * 24 * 60 * 60 * 1000); // +1 day
    }

    // Use proposal for proposalAt
    if (lead.proposals.length > 0) {
      proposal = lead.proposals[0].createdAt;
    } else {
      proposal = new Date(attended.getTime() + 1 * 24 * 60 * 60 * 1000); // +1 day after attended
    }

    // Use heuristic for closedAt
    closed = new Date(proposal.getTime() + 1 * 24 * 60 * 60 * 1000); // +1 day after proposal

    // Don't set dates in the future
    const now = new Date();
    if (attended > now) attended = now;
    if (proposal > now) proposal = now;
    if (closed > now) closed = now;

    const updateData: any = {};
    if (attendedStages.includes(lead.status) && lead.attendedAt && lead.attendedAt >= new Date('2026-08-01T00:00:00.000Z')) {
       updateData.attendedAt = attended;
    }
    if (finalCommercialStages.includes(lead.status) && lead.proposalAt && lead.proposalAt >= new Date('2026-08-01T00:00:00.000Z')) {
       updateData.proposalAt = proposal;
    }
    if (closedStages.includes(lead.status) && lead.closedAt && lead.closedAt >= new Date('2026-08-01T00:00:00.000Z')) {
       updateData.closedAt = closed;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: updateData
      });
    }
  }

  console.log('Correção concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
