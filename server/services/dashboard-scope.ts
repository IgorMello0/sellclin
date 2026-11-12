import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '../middleware/auth.js'
import { buildTeamFilter, parseDashboardQuery } from './dashboard-filters.js'
import { parseCopiedFunnel, stageBehavior } from '../utils/funnel-stages.js'

export const paymentStatuses = ['pago', 'pendente', 'atrasado'] as const
export const originKey = (origin: string | null) => origin?.trim().toLowerCase() || 'desconhecido'
export const boletoGroupBy = ['saleId', 'clientId', 'appointmentId'] as const

export async function getDashboardScope(
  prisma: PrismaClient | Prisma.TransactionClient,
  user: AuthUser,
  { sdrId, closerId, startDate, endDate }: ReturnType<typeof parseDashboardQuery>,
  readDetails = false,
) {
  // 1. Isolamento Multi-Tenant (SaaS)
  const companyId = user?.companyId;
  let professionalIds: number[] = [];

  if (companyId) {
    const professionalsInCompany = await prisma.professional.findMany({
      where: { companyId },
      select: { id: true }
    });
    professionalIds = professionalsInCompany.map(p => p.id);
    
    const empresa = await prisma.empresa.findUnique({
      where: { id: companyId },
      select: { ownerId: true }
    });
    if (empresa?.ownerId && !professionalIds.includes(empresa.ownerId)) {
      professionalIds.push(empresa.ownerId);
    }
  } else {
    // Fallback para quando o token não tem companyId (ex: Administrador ou profissional autônomo)
    professionalIds = [user.id];
  }

  const dateRange = { gte: startDate, lt: endDate };
  const clinicScope = { professionalId: { in: professionalIds }, ...(companyId && { companyId }) };
  const leadExtraFilters: Prisma.LeadWhereInput = {};
  const leadConditions: Prisma.LeadWhereInput[] = [];
  const appointmentConditions: Prisma.AppointmentWhereInput[] = [];
  const paymentConditions: Prisma.PaymentWhereInput[] = [];

  let hasBillingPermission = true;
  let canReadDetails = true;
  let canReadBillingDetails = true;

  // Regra de Visibilidade de Leads
  if (user?.type === 'usuario') {
    const roleInclude = { include: { permissions: { where: { module: { code: 'dashboard' } } } } };
    const [dbUser, companyAccess] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: user.id }, include: { role: roleInclude } }),
      prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: companyId || 0 } },
        include: { role: roleInclude },
      }),
    ]);
    const activeRole = companyAccess?.role || dbUser?.role;
    const subPermissions = activeRole?.permissions[0]?.subPermissions as Record<string, boolean> | null;
    hasBillingPermission = activeRole?.value === 'admin' || subPermissions?.verFaturamento !== false;
    if (readDetails) {
      const override = companyId ? await prisma.userCompanyPermission.findFirst({
        where: { userId: user.id, companyId, module: { code: 'dashboard' } }, select: { hasAccess: true },
      }) : null;
      canReadDetails = Boolean(dbUser) && (override?.hasAccess ?? activeRole?.permissions[0]?.hasAccess ?? true);
      canReadBillingDetails = canReadDetails && subPermissions?.verFaturamento !== false;
    }
    if (!activeRole?.isAdmin && !activeRole?.isManager) {
      // Se não for Admin nem Gestor Comercial, só vê leads atribuídos a si mesmo (como SDR ou Closer) ou propostas vinculadas a si
      leadExtraFilters.OR = [
        { sdrId: user.id },
        { closerId: user.id },
        { proposals: { some: { sdrId: user.id } } },
        { proposals: { some: { salespersonId: user.id } } },
        { proposals: { some: { specialistId: user.id } } }
      ];

      appointmentConditions.push({
        OR: [
          { sdrId: user.id },
          { especialistaId: user.id },
          { lead: { closerId: user.id } }
        ]
      });

      paymentConditions.push({
        OR: [
          { appointment: { sdrId: user.id } },
          { appointment: { especialistaId: user.id } },
          { appointment: { lead: { closerId: user.id } } },
          { client: { originLead: { sdrId: user.id } } },
          { client: { originLead: { closerId: user.id } } },
          { client: { originLead: { proposals: { some: { sdrId: user.id } } } } },
          { client: { originLead: { proposals: { some: { salespersonId: user.id } } } } },
          { client: { originLead: { proposals: { some: { specialistId: user.id } } } } }
        ]
      });
    }
  }

  for (const [kind, selection] of [['sdr', sdrId], ['closer', closerId]] as const) {
    if (selection === 'all') continue;
    const condition = buildTeamFilter(kind, selection);
    leadConditions.push(condition.lead);
    appointmentConditions.push(condition.appointment);
    paymentConditions.push(condition.payment);
  }

  const leadScope: Prisma.LeadWhereInput = {
    ...clinicScope, ...leadExtraFilters, ...(leadConditions.length > 0 && { AND: leadConditions }),
  };
  const appointmentScope: Prisma.AppointmentWhereInput = {
    ...clinicScope, AND: appointmentConditions,
    status: { in: ['agendado', 'confirmado', 'concluido'] },
  };
  const appointmentWhere: Prisma.AppointmentWhereInput = { ...appointmentScope, createdAt: dateRange };

  // Busca os funis configurados para pegar os estágios dinâmicos
  const funnels = await prisma.funnelConfig.findMany({
    where: companyId ? { companyId } : {},
    include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' } } }
  });

  const prospectStages = funnels.find(f => f.code === 'prospecting')?.stages.map(s => s.code) || [];
  const commercialStages = funnels.find(f => f.code === 'commercial')?.stages.map(s => s.code) || [];

  // Fallbacks
  const finalProspectStages = prospectStages.length > 0 ? prospectStages : ['prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended'];
  const finalCommercialStages = commercialStages.length > 0 ? commercialStages : ['comercial_proposal', 'comercial_follow', 'comercial_closed'];
  const copiedFunnels = funnels.filter(funnel => parseCopiedFunnel(funnel.code))
  const uncontactedStatuses = [
    finalProspectStages[0],
    ...copiedFunnels.flatMap(funnel => parseCopiedFunnel(funnel.code)?.template === 'prospecting' && funnel.stages[0]
      ? [funnel.stages[0].code] : []),
  ]

  const stageNames = Object.fromEntries(funnels.flatMap(f => f.stages.map(stage => [stage.code, stage.label])));

  // Attended: 'prospect_attended' + todos do commercial
  const attendedStages = [
    'prospect_attended', ...finalCommercialStages,
    ...copiedFunnels.flatMap(funnel => funnel.stages
      .filter(stage => parseCopiedFunnel(funnel.code)?.template === 'commercial' || stageBehavior(stage.code) === 'prospect_attended')
      .map(stage => stage.code)),
  ]

  const proposalWhere: Prisma.ProposalWhereInput = { lead: leadScope, createdAt: dateRange };
  const activeSale: Prisma.SaleWhereInput = { confirmedAt: dateRange, voidedAt: null };
  const saleWhere: Prisma.SaleWhereInput = { ...activeSale, lead: leadScope };
  const discountWhere: Prisma.ProposalWhereInput = {
    lead: leadScope, discountApplied: true, sales: { some: activeSale },
  };
  const leadWhere: Prisma.LeadWhereInput = { ...leadScope, createdAt: dateRange };
  const attendedWhere: Prisma.LeadWhereInput = { ...leadScope, attendedAt: dateRange, status: { in: attendedStages } };
  const funnelScheduledWhere: Prisma.LeadWhereInput = { ...leadWhere, appointments: { some: appointmentScope } };
  const funnelClosedWhere: Prisma.LeadWhereInput = { ...leadWhere, sales: { some: { voidedAt: null } } };
  const paymentWhere: Prisma.PaymentWhereInput = {
    ...clinicScope, createdAt: dateRange, saleVoidedAt: null, ...(paymentConditions.length > 0 && { AND: paymentConditions }),
  };
  return {
    appointmentWhere, proposalWhere, saleWhere, discountWhere,
    leadWhere, attendedWhere, funnelScheduledWhere, funnelClosedWhere, paymentWhere,
    hasBillingPermission, canReadDetails, canReadBillingDetails, uncontactedStatuses, stageNames,
  };
}
