import { Prisma, PrismaClient } from '@prisma/client'
import { ensureCompanySubscription } from '../services/billing.js'

type PrismaExecutor = PrismaClient | Prisma.TransactionClient

export const DEFAULT_MODULES = [
  {
    code: 'dashboard',
    name: 'Dashboard',
    description: 'Visao geral e metricas do sistema',
    icon: 'LayoutDashboard',
  },
  {
    code: 'agendamentos',
    name: 'Agendamentos',
    description: 'Gerenciamento de agendamentos',
    icon: 'Calendar',
  },
  {
    code: 'clientes',
    name: 'Clientes',
    description: 'Cadastro e gestao de clientes e leads',
    icon: 'Users',
  },
  {
    code: 'relatorios',
    name: 'Relatorios',
    description: 'Visualizacao de relatorios e analises',
    icon: 'BarChart3',
  },
  {
    code: 'pagamentos',
    name: 'Pagamentos',
    description: 'Gestao financeira e pagamentos',
    icon: 'DollarSign',
  },
  {
    code: 'conversas',
    name: 'Conversas',
    description: 'Chat e mensagens com clientes',
    icon: 'MessageCircle',
  },
  {
    code: 'catalogos',
    name: 'Catalogos',
    description: 'Gerenciamento de servicos e produtos',
    icon: 'Package',
  },
  {
    code: 'contratos',
    name: 'Contratos',
    description: 'Contratos e documentos',
    icon: 'FileText',
  },
  {
    code: 'funnel',
    name: 'Funil de Vendas',
    description: 'Gestao de funil de vendas e conversao',
    icon: 'Filter',
  },
  {
    code: 'metas',
    name: 'Metas',
    description: 'Engenharia reversa e simulador de metas',
    icon: 'TrendingUp',
  },
  {
    code: 'tarefas',
    name: 'Tarefas',
    description: 'Gestao de tarefas, prazos e alertas',
    icon: 'CheckSquare',
  },
  {
    code: 'campanhas',
    name: 'Campanhas',
    description: 'Campanhas de mensagens em massa',
    icon: 'Megaphone',
  },
  {
    code: 'integrations',
    name: 'Integracoes',
    description: 'Configuracao de canais, agendas e automacoes',
    icon: 'Plug',
  },
]

const DEFAULT_ROLES = [
  { name: 'Administrador', value: 'admin' },
  { name: 'Comercial', value: 'comercial' },
]

export const DEFAULT_PLANS = [
  {
    code: 'start',
    name: 'Start',
    description: 'Plano inicial com todos os modulos operacionais atuais',
    priceCents: null,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Plano completo com Start e modulos premium futuros',
    priceCents: null,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Plano gerenciado manualmente para operacoes sob consulta',
    priceCents: null,
  },
]

export async function ensureDefaultModules(prisma: PrismaExecutor) {
  for (const module of DEFAULT_MODULES) {
    await prisma.module.upsert({
      where: { code: module.code },
      update: {
        name: module.name,
        description: module.description,
        icon: module.icon,
        isActive: true,
      },
      create: module,
    })
  }
}

let defaultsEnsured = false

export async function ensureDefaultPlans(prisma: PrismaExecutor) {
  if (defaultsEnsured) {
    console.log('    [plans] Defaults already ensured. Skipping.')
    return
  }
  console.log('    [plans] Ensuring default modules...')
  await ensureDefaultModules(prisma)
  console.log('    [plans] Default modules ensured. Upserting plans...')

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        isActive: true,
      },
      create: plan,
    })
  }

  const currentModules = await prisma.module.findMany({
    where: {
      isActive: true,
      code: { in: DEFAULT_MODULES.map((module) => module.code) },
    },
    select: { id: true },
  })

  for (const planCode of ['start', 'pro', 'enterprise']) {
    for (const module of currentModules) {
      await prisma.planModule.upsert({
        where: {
          planCode_moduleId: {
            planCode,
            moduleId: module.id,
          },
        },
        update: {},
        create: {
          planCode,
          moduleId: module.id,
        },
      })
    }
  }
  defaultsEnsured = true
}

export async function ensureCompanyDefaults(
  prisma: PrismaExecutor,
  companyId: number,
  professionalId?: number | null
) {
  console.log(`  [company ${companyId}] Ensuring default plans...`);
  await ensureDefaultPlans(prisma)
  console.log(`  [company ${companyId}] Ensuring company subscription...`);
  await ensureCompanySubscription(prisma, companyId)

  const ownerId = professionalId ?? await resolveCompanyOwnerId(prisma, companyId)
  if (!ownerId) return

  const modules = await prisma.module.findMany({ where: { isActive: true } })

  for (const roleTemplate of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        companyId_value: {
          companyId,
          value: roleTemplate.value,
        },
      },
      update: {
        name: roleTemplate.name,
        professionalId: ownerId,
      },
      create: {
        companyId,
        professionalId: ownerId,
        name: roleTemplate.name,
        value: roleTemplate.value,
      },
    })

    for (const module of modules) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_moduleId: {
            roleId: role.id,
            moduleId: module.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          moduleId: module.id,
          hasAccess: false,
        },
      })
    }
  }

  await ensureUsersHaveRole(prisma, companyId)
}

export async function bootstrapSystemDefaults(prisma: PrismaClient) {
  console.log('[bootstrap] Ensuring default plans...');
  await ensureDefaultPlans(prisma)
  console.log('[bootstrap] Default plans ensured. Querying companies...');

  const companies = await prisma.empresa.findMany({
    select: { id: true, ownerId: true },
  })
  console.log(`[bootstrap] Found ${companies.length} companies. Starting company defaults bootstrap...`);

  for (const company of companies) {
    console.log(`[bootstrap] Ensuring defaults for company ID: ${company.id}...`);
    await ensureCompanyDefaults(prisma, company.id, company.ownerId)
    console.log(`[bootstrap] Company ID ${company.id} defaults ensured.`);
  }
}

async function resolveCompanyOwnerId(prisma: PrismaExecutor, companyId: number) {
  const company = await prisma.empresa.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  })

  if (company?.ownerId) return company.ownerId

  const professional = await prisma.professional.findFirst({
    where: { companyId },
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  return professional?.id
}

async function ensureUsersHaveRole(prisma: PrismaExecutor, companyId: number) {
  const defaultRole = await prisma.role.findUnique({
    where: {
      companyId_value: {
        companyId,
        value: 'comercial',
      },
    },
  })

  if (!defaultRole) return

  await prisma.usuario.updateMany({
    where: {
      companyId,
      roleId: null,
    },
    data: {
      roleId: defaultRole.id,
    },
  })

  const accesses = await prisma.userCompanyAccess.findMany({
    where: {
      companyId,
      roleId: null,
    },
    select: {
      userId: true,
      companyId: true,
    },
  })

  for (const access of accesses) {
    await prisma.userCompanyAccess.update({
      where: {
        userId_companyId: {
          userId: access.userId,
          companyId: access.companyId,
        },
      },
      data: {
        roleId: defaultRole.id,
      },
    })
  }
}
