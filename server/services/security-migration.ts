import type { Prisma, Category, CatalogItem, FichaTemplate } from '@prisma/client'
import { ownerSubPermissions } from '../config/permission-keys.js'

// Called only by the explicit maintenance command, inside one transaction.
// No patient content or credential value is logged.
export async function migrateSecurityIsolation(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(724019, 20261029)')
  await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS sellclin_security_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  const applied = await tx.$queryRaw<Array<{ version: string }>>`SELECT version FROM sellclin_security_migrations WHERE version = '20261029-route-isolation'`
  if (applied.length) return { alreadyApplied: true }

  for (const table of ['categories', 'catalog_items', 'ficha_templates']) {
    await tx.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES empresas(id) ON DELETE RESTRICT ON UPDATE CASCADE`)
  }

  const companies = await tx.empresa.findMany({ select: { id: true, ownerId: true }, orderBy: { id: 'asc' } })
  const destinations = (ownerId: number) => {
    const ids = companies.filter(company => company.ownerId === ownerId).map(company => company.id)
    if (!ids.length) throw new Error(`Cadastro sem clínica proprietária: profissional ${ownerId}. Resolver antes da migração.`)
    return ids
  }
  const categoryMap = new Map<string, number>()
  // The generated client requires companyId; legacy rows are still NULL at this
  // point. Read them explicitly until the backfill makes the new schema valid.
  const categories = await tx.$queryRaw<Category[]>`SELECT id, professional_id AS "professionalId", company_id AS "companyId", name, description, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM categories ORDER BY id`
  for (const item of categories) {
    const targets = item.companyId ? [item.companyId] : destinations(item.professionalId)
    for (const [index, companyId] of targets.entries()) {
      const { id, ...data } = item
      const copy = index === 0
        ? await tx.category.update({ where: { id }, data: { companyId } })
        : await tx.category.create({ data: { ...data, companyId } })
      categoryMap.set(`${id}:${companyId}`, copy.id)
    }
  }
  const services = await tx.$queryRaw<CatalogItem[]>`SELECT id, professional_id AS "professionalId", company_id AS "companyId", category_id AS "categoryId", name, description, price, image_url AS "imageUrl", status, duration_minutes AS "durationMinutes", created_at AS "createdAt", updated_at AS "updatedAt" FROM catalog_items ORDER BY id`
  for (const item of services) {
    const targets = item.companyId ? [item.companyId] : destinations(item.professionalId)
    if (await tx.appointment.count({ where: { serviceId: item.id, OR: [{ companyId: null }, { companyId: { notIn: targets } }] } })) {
      throw new Error(`Serviço ${item.id} possui agendamento fora das clínicas do proprietário. Migração cancelada.`)
    }
    for (const [index, companyId] of targets.entries()) {
      const { id, ...data } = item
      const categoryId = item.categoryId ? categoryMap.get(`${item.categoryId}:${companyId}`) : null
      if (item.categoryId && !categoryId) throw new Error(`Categoria incompatível no serviço ${id}.`)
      const copy = index === 0
        ? await tx.catalogItem.update({ where: { id }, data: { companyId, categoryId } })
        : await tx.catalogItem.create({ data: { ...data, companyId, categoryId } })
      await tx.appointment.updateMany({ where: { serviceId: id, companyId }, data: { serviceId: copy.id } })
    }
  }
  const templates = await tx.$queryRaw<FichaTemplate[]>`SELECT id, company_id AS "companyId", name, description, category, fields, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt" FROM ficha_templates ORDER BY id`
  for (const item of templates) {
    const targets = item.companyId ? [item.companyId] : destinations(item.createdBy)
    if (await tx.ficha.count({ where: { templateId: item.id, client: { OR: [{ companyId: null }, { companyId: { notIn: targets } }] } } })) {
      throw new Error(`Modelo ${item.id} possui ficha fora das clínicas do proprietário. Migração cancelada.`)
    }
    for (const [index, companyId] of targets.entries()) {
      const { id, ...data } = item
      const copy = index === 0
        ? await tx.fichaTemplate.update({ where: { id }, data: { companyId } })
        : await tx.fichaTemplate.create({ data: { ...data, fields: data.fields as Prisma.InputJsonValue, companyId } })
      await tx.ficha.updateMany({ where: { templateId: id, client: { companyId } }, data: { templateId: copy.id } })
    }
  }

  // Snapshot today's implicit grants once. Future modules/roles get no implicit grants.
  const modules = await tx.module.findMany({ where: { isActive: true } })
  const roles = await tx.role.findMany({ include: { permissions: true } })
  for (const role of roles) {
    for (const module of modules) {
      const current = role.permissions.find(permission => permission.moduleId === module.id)
      const subPermissions = { ...ownerSubPermissions(module.code), ...(current?.subPermissions as Record<string, boolean> || {}) }
      await tx.rolePermission.upsert({
        where: { roleId_moduleId: { roleId: role.id, moduleId: module.id } },
        create: { roleId: role.id, moduleId: module.id, hasAccess: true, subPermissions },
        update: { subPermissions }, // Explicit denials survive.
      })
    }
  }
  const professionals = await tx.professional.findMany({ select: { id: true } })
  for (const professional of professionals) {
    for (const module of modules) {
      const where = { professionalId_moduleId: { professionalId: professional.id, moduleId: module.id } }
      const existing = await tx.professionalPermission.findUnique({ where })
      const subPermissions = { ...ownerSubPermissions(module.code), ...(existing?.subPermissions as Record<string, boolean> || {}) }
      await tx.professionalPermission.upsert({ where, create: { professionalId: professional.id, moduleId: module.id, hasAccess: true, subPermissions }, update: { subPermissions } })
    }
  }
  // Legacy users without a local role receive an explicit migration role.
  const users = await tx.usuario.findMany({ include: { companyAccess: { include: { role: true } }, role: true } })
  for (const user of users) {
    const companyIds = new Set([...(user.companyId ? [user.companyId] : []), ...user.companyAccess.map(access => access.companyId)])
    for (const companyId of companyIds) {
      const access = user.companyAccess.find(item => item.companyId === companyId)
      const role = access?.role || (companyId === user.companyId ? user.role : null)
      if (role && role.companyId !== companyId) throw new Error(`Cargo de outra clínica no usuário ${user.id}. Resolver antes da migração.`)
      if (role) continue
      const ownerId = companies.find(company => company.id === companyId)?.ownerId
      if (!ownerId) throw new Error(`Clínica ${companyId} sem proprietário.`)
      const legacy = await tx.role.upsert({
        where: { companyId_value: { companyId, value: 'legacy_security_migration' } },
        create: { companyId, professionalId: ownerId, value: 'legacy_security_migration', name: 'Acessos legados — revisar' }, update: {},
      })
      for (const module of modules) await tx.rolePermission.upsert({
        where: { roleId_moduleId: { roleId: legacy.id, moduleId: module.id } },
        create: { roleId: legacy.id, moduleId: module.id, hasAccess: true, subPermissions: ownerSubPermissions(module.code) }, update: {},
      })
      await tx.userCompanyAccess.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        create: { userId: user.id, companyId, roleId: legacy.id, isActive: user.isActive }, update: { roleId: legacy.id },
      })
    }
  }
  for (const table of ['categories', 'catalog_items', 'ficha_templates']) {
    await tx.$executeRawUnsafe(`ALTER TABLE ${table} ALTER COLUMN company_id SET NOT NULL`)
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${table}_company_id_idx ON ${table}(company_id)`)
  }
  for (const table of ['role_permissions', 'professional_permissions', 'user_company_permissions', 'user_permissions']) {
    await tx.$executeRawUnsafe(`ALTER TABLE ${table} ALTER COLUMN has_access SET DEFAULT false`)
  }
  await tx.$executeRaw`INSERT INTO sellclin_security_migrations(version) VALUES ('20261029-route-isolation')`
  return { alreadyApplied: false, categories: categories.length, services: services.length, templates: templates.length, roles: roles.length }
}
