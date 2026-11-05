// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { migrateSecurityIsolation } from './security-migration.js'

function fixture() {
  const categories = [{ id: 10, professionalId: 7, companyId: null, name: 'Categoria' }]
  const services = [{ id: 20, professionalId: 7, companyId: null, categoryId: 10, name: 'Serviço' }]
  const templates = [{ id: 30, createdBy: 7, companyId: null, fields: [], name: 'Modelo' }]
  const appointments = [{ id: 1, companyId: 1, serviceId: 20 }, { id: 2, companyId: 2, serviceId: 20 }]
  const fichas = [{ id: 1, templateId: 30, client: { companyId: 1 } }, { id: 2, templateId: 30, client: { companyId: 2 } }]
  let id = 100
  const store = (rows: any[]) => ({
    findMany: async () => structuredClone(rows),
    update: async ({ where, data }: any) => Object.assign(rows.find(row => row.id === where.id), data),
    create: async ({ data }: any) => { const row = { ...data, id: id++ }; rows.push(row); return row },
  })
  const roleUpdates: any[] = []
  const tx: any = {
    $executeRawUnsafe: vi.fn(), $executeRaw: vi.fn(), $queryRaw: vi.fn(async (parts: TemplateStringsArray) => {
      const sql = parts.join('')
      if (sql.includes('FROM categories')) return structuredClone(categories)
      if (sql.includes('FROM catalog_items')) return structuredClone(services)
      if (sql.includes('FROM ficha_templates')) return structuredClone(templates)
      return []
    }),
    empresa: { findMany: async () => [{ id: 1, ownerId: 7 }, { id: 2, ownerId: 7 }] },
    category: store(categories), catalogItem: store(services), fichaTemplate: store(templates),
    appointment: {
      count: async ({ where }: any) => appointments.filter(row => row.serviceId === where.serviceId && !where.OR[1].companyId.notIn.includes(row.companyId)).length,
      updateMany: async ({ where, data }: any) => { for (const row of appointments) if (row.serviceId === where.serviceId && row.companyId === where.companyId) Object.assign(row, data) },
    },
    ficha: {
      count: async ({ where }: any) => fichas.filter(row => row.templateId === where.templateId && !where.client.OR[1].companyId.notIn.includes(row.client.companyId)).length,
      updateMany: async ({ where, data }: any) => { for (const row of fichas) if (row.templateId === where.templateId && row.client.companyId === where.client.companyId) Object.assign(row, data) },
    },
    module: { findMany: async () => [{ id: 1, code: 'clientes' }] },
    role: { findMany: async () => [{ id: 1, permissions: [{ moduleId: 1, hasAccess: false, subPermissions: { verClientes: false } }] }] },
    rolePermission: { upsert: async (args: any) => roleUpdates.push(args) },
    professional: { findMany: async () => [] }, usuario: { findMany: async () => [] },
  }
  return { tx, categories, services, templates, appointments, fichas, roleUpdates }
}
it('splits shared catalogs and relinks each clinic without moving patient records', async () => {
  const f = fixture()
  await migrateSecurityIsolation(f.tx)
  expect(f.categories.map(row => row.companyId)).toEqual([1, 2])
  expect(f.services.map(row => row.companyId)).toEqual([1, 2])
  expect(f.templates.map(row => row.companyId)).toEqual([1, 2])
  for (const appointment of f.appointments) {
    const service = f.services.find(row => row.id === appointment.serviceId)!
    expect(service.companyId).toBe(appointment.companyId)
    expect(f.categories.find(row => row.id === service.categoryId)!.companyId).toBe(appointment.companyId)
  }
  for (const ficha of f.fichas) expect(f.templates.find(row => row.id === ficha.templateId)!.companyId).toBe(ficha.client.companyId)
  expect(f.roleUpdates[0].update).not.toHaveProperty('hasAccess')
  expect(f.roleUpdates[0].update.subPermissions).toMatchObject({ verClientes: false, editarContatos: true })
})
it('aborts on an inconsistent cross-owner historical relationship', async () => {
  const f = fixture(); f.appointments[1].companyId = 99
  await expect(migrateSecurityIsolation(f.tx)).rejects.toThrow('fora das clínicas')
  expect(f.tx.$executeRaw).not.toHaveBeenCalled()
})
it('does not duplicate a successfully applied migration', async () => {
  const f = fixture(); f.tx.$queryRaw.mockResolvedValue([{ version: '20261029-route-isolation' }])
  expect(await migrateSecurityIsolation(f.tx)).toEqual({ alreadyApplied: true })
  expect(f.categories).toHaveLength(1)
  expect(f.tx.$executeRaw).not.toHaveBeenCalled()
})
