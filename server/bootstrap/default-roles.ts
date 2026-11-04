import type { Prisma, PrismaClient } from '@prisma/client'

export const DEFAULT_ROLES = [
  { name: 'Administrador', value: 'admin', flags: { isAdmin: true } },
  { name: 'Comercial', value: 'comercial', flags: {} },
  { name: 'SDR', value: 'sdr', flags: { isSDR: true } },
  { name: 'Closer', value: 'closer', flags: { isCloser: true } },
] as const

export function isDefaultRole(value: string) {
  return DEFAULT_ROLES.some(role => role.value === value)
}

export async function ensureDefaultRoles(db: PrismaClient | Prisma.TransactionClient, companyId: number, ownerId: number) {
  const modules = await db.module.findMany({ where: { isActive: true }, select: { id: true } })
  for (const template of DEFAULT_ROLES) {
    const role = await db.role.upsert({
      where: { companyId_value: { companyId, value: template.value } },
      // Existing clinic-specific names, flags and assignments belong to the
      // owner. Defaults are initial settings, not a recurring permissions reset.
      update: {},
      create: { companyId, professionalId: ownerId, name: template.name, value: template.value, ...template.flags },
    })
    for (const module of modules) {
      await db.rolePermission.upsert({
        where: { roleId_moduleId: { roleId: role.id, moduleId: module.id } },
        update: {},
        create: { roleId: role.id, moduleId: module.id, hasAccess: true },
      })
    }
  }
}
