import type { PrismaClient } from '@prisma/client'

export async function leadVisibility(prisma: PrismaClient, user: any, companyId: number) {
  if (user?.type === 'profissional') return { companyId }
  if (user?.type !== 'usuario') return { companyId, id: -1 }
  const [account, access] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: user.id }, include: { role: true } }),
    prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } }, include: { role: true },
    }),
  ])
  if (!account?.isActive || access?.isActive === false || (!access && account.companyId !== companyId)) {
    return { companyId, id: -1 }
  }
  const role = access?.role || account.role
  if (role?.isAdmin || role?.isManager) return { companyId }
  return { companyId, OR: [
    { sdrId: user.id }, { closerId: user.id },
    { proposals: { some: { sdrId: user.id } } },
    { proposals: { some: { salespersonId: user.id } } },
    { sdrId: null, closerId: null },
  ] }
}
