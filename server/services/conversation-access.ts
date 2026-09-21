import { prisma } from '../prisma.js'

type AuthenticatedUser = { id: number; type: string; companyId?: number | null; role?: string }

export async function conversationScope(user: AuthenticatedUser) {
  const companyId = Number(user.companyId)
  if (!companyId) return { where: { companyId: -1 }, canManage: false }
  if (user.type === 'profissional') {
    const owner = await prisma.empresa.findFirst({ where: { id: companyId, ownerId: user.id }, select: { id: true } })
    if (owner || user.role === 'admin') return { where: { companyId }, canManage: true }
    return { where: { companyId, assignedProfessionalId: user.id }, canManage: false }
  }
  if (user.type !== 'usuario') return { where: { companyId: -1 }, canManage: false }

  const [account, access] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: user.id }, include: { role: true } }),
    prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } }, include: { role: true },
    }),
  ])
  if (!account?.isActive || access?.isActive === false || (!access && account.companyId !== companyId)) {
    return { where: { companyId: -1 }, canManage: false }
  }
  const role = access?.role || account.role
  if (role?.isAdmin || role?.isManager) return { where: { companyId }, canManage: true }
  // A lead's current SDR is authoritative, including after a transfer in the funnel.
  return {
    where: { companyId, OR: [
      { lead: { sdrId: user.id } },
      { leadId: null, assignedUserId: user.id },
      { lead: { sdrId: null }, assignedUserId: user.id },
    ] },
    canManage: false,
  }
}
