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
  const assignments: any[] = []
  if (role?.isSDR) assignments.push({ sdrId: user.id })
  if (role?.isCloser) assignments.push({ closerId: user.id })
  if (role?.isSpecialist) assignments.push({ especialistaId: user.id })
  return { companyId, OR: [
    ...assignments,
    { visibilityGrants: { some: { userId: user.id, companyId } } },
    { sdrId: null, closerId: null },
  ] }
}
