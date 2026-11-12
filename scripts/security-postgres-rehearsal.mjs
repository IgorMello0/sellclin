// Run with: node --import tsx scripts/security-postgres-rehearsal.mjs
// Installs no service and never accepts an external DATABASE_URL.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { migrateSecurityIsolation } from '../server/services/security-migration.ts'
import { passwordSessionStamp } from '../server/services/session-security.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const { default: EmbeddedPostgres } = await import(new URL('../.security-check/postgres-runtime/node_modules/embedded-postgres/dist/index.js', import.meta.url).href)
const temp = await mkdtemp(join(tmpdir(), 'sellclin-pg-'))
const reservation = createServer()
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const password = randomBytes(24).toString('hex')
const url = name => `postgresql://postgres:${password}@127.0.0.1:${port}/${name}`
const clients = []
const dbFor = name => {
  const db = new PrismaClient({ datasourceUrl: url(name) })
  clients.push(db)
  return db
}
// Override inherited configuration before importing application middleware.
process.env.DATABASE_URL = url('success')
process.env.DIRECT_URL = url('success')
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = randomBytes(32).toString('hex')
const pg = new EmbeddedPostgres({
  databaseDir: join(temp, 'data'), user: 'postgres', password, port,
  persistent: false, autoRehydrateSymlinks: true,
  postgresFlags: ['-h', '127.0.0.1', '-k', temp],
  onLog: () => {}, onError: () => {},
})
const txOptions = { isolationLevel: 'Serializable', timeout: 120_000, maxWait: 10_000 }
let admin
let seedConnection
let passed = 0
async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}
async function snapshot(db) {
  const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  const result = {}
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z_]+$/)
    result[tablename] = await db.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${tablename}" t ORDER BY row_to_json(t)::text`)
  }
  return result
}
async function seed(db) {
  const owner = await db.professional.create({ data: { name: 'Owner A', email: 'owner-a@example.invalid', passwordHash: 'fixture-owner-a' } })
  const outsider = await db.professional.create({ data: { name: 'Owner B', email: 'owner-b@example.invalid', passwordHash: 'fixture-owner-b' } })
  const companies = []
  for (const [index, ownerId] of [owner.id, owner.id, outsider.id].entries()) {
    companies.push(await db.empresa.create({ data: { ownerId, name: `Clinic ${index + 1}` } }))
  }
  const [a, b, c] = companies
  await db.professional.update({ where: { id: owner.id }, data: { companyId: a.id } })
  await db.professional.update({ where: { id: outsider.id }, data: { companyId: c.id } })
  const contacts = await db.module.create({ data: { code: 'clientes', name: 'Clients' } })
  const catalog = await db.module.create({ data: { code: 'catalogos', name: 'Catalog' } })
  await db.plan.create({ data: { code: 'start', name: 'Fixture', modules: { create: [{ moduleId: contacts.id }, { moduleId: catalog.id }] } } })
  for (const company of companies) await db.companySubscription.create({ data: { companyId: company.id, planCode: 'start', trialEndsAt: new Date(Date.now() + 86400000) } })
  const roleA = await db.role.create({ data: { companyId: a.id, professionalId: owner.id, value: 'sdr', name: 'Restricted' } })
  const roleB = await db.role.create({ data: { companyId: b.id, professionalId: owner.id, value: 'admin', name: 'Admin B' } })
  await db.rolePermission.create({ data: { roleId: roleA.id, moduleId: contacts.id, hasAccess: false, subPermissions: { verClientes: false } } })
  await db.rolePermission.create({ data: { roleId: roleB.id, moduleId: contacts.id, hasAccess: true, subPermissions: { excluirContatos: false } } })
  await db.professionalPermission.create({ data: { professionalId: owner.id, moduleId: contacts.id, hasAccess: false, subPermissions: { verClientes: false } } })
  const restricted = await db.usuario.create({ data: { companyId: a.id, roleId: roleA.id, name: 'Restricted', email: 'restricted@example.invalid', passwordHash: 'fixture-restricted' } })
  await db.userCompanyAccess.create({ data: { userId: restricted.id, companyId: b.id, roleId: roleB.id } })
  await db.userCompanyPermission.create({ data: { userId: restricted.id, companyId: b.id, moduleId: catalog.id, hasAccess: false } })
  await db.userPermission.create({ data: { userId: restricted.id, moduleId: catalog.id, hasAccess: false } })
  const legacy = await db.usuario.create({ data: { companyId: a.id, name: 'Legacy', email: 'legacy@example.invalid', passwordHash: 'fixture-legacy' } })
  await db.userCompanyAccess.create({ data: { userId: legacy.id, companyId: b.id, isActive: false } })
  const categories = [], services = [], templates = [], appointments = [], fichas = []
  for (const professionalId of [owner.id, outsider.id]) {
    const [category] = await db.$queryRaw`INSERT INTO categories (professional_id, name, updated_at) VALUES (${professionalId}, 'Category fixture', now()) RETURNING id`
    const [service] = await db.$queryRaw`INSERT INTO catalog_items (professional_id, category_id, name, price, duration_minutes, updated_at) VALUES (${professionalId}, ${category.id}, 'Service fixture', 123.45, 50, now()) RETURNING id`
    const [template] = await db.$queryRaw`INSERT INTO ficha_templates (created_by, name, fields, updated_at) VALUES (${professionalId}, 'Template fixture', '[{"id":"field-1","type":"text"}]'::jsonb, now()) RETURNING id`
    categories.push(category); services.push(service); templates.push(template)
  }
  for (const company of companies) {
    const index = company.id === c.id ? 1 : 0
    const client = await db.client.create({ data: { companyId: company.id, professionalId: company.ownerId, name: `Synthetic patient ${company.id}`, notes: 'Synthetic content preserved' } })
    appointments.push(await db.appointment.create({ data: { companyId: company.id, professionalId: company.ownerId, clientId: client.id, serviceId: services[index].id, startTime: new Date('2026-11-01T12:00:00Z'), endTime: new Date('2026-11-01T13:00:00Z'), notes: 'Synthetic appointment preserved' } }))
    fichas.push(await db.ficha.create({ data: { clientId: client.id, professionalId: company.ownerId, type: 'anamnese', templateId: templates[index].id, content: { synthetic: company.id } } }))
  }
  return { owner, outsider, a, b, c, contacts, catalog, roleA, roleB, restricted, legacy, categories, services, templates, appointments, fichas }
}
try {
  await pg.initialise()
  await pg.start()
  admin = pg.getPgClient()
  await admin.connect()
  console.log((await admin.query('SHOW server_version')).rows[0])
  await pg.createDatabase('baseline')
  const legacySchema = join(temp, 'legacy.prisma')
  await writeFile(legacySchema, execFileSync('git', ['show', '548b5c6:prisma/schema.prisma'], { cwd: root }))
  const ddl = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', legacySchema, '--script'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  seedConnection = pg.getPgClient('baseline')
  await seedConnection.connect()
  await seedConnection.query(ddl)
  await seedConnection.end()
  seedConnection = null
  const baseline = dbFor('baseline')
  const f = await seed(baseline)
  const original = await snapshot(baseline)
  await baseline.$disconnect()
  const clone = async name => {
    assert.match(name, /^[a-z_]+$/)
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE baseline`)
    return dbFor(name)
  }
  const db = await clone('success')
  await check('migration commits against the legacy PostgreSQL schema', async () => {
    assert.deepEqual(await db.$transaction(migrateSecurityIsolation, txOptions), { alreadyApplied: false, categories: 2, services: 2, templates: 2, roles: 2 })
  })
  await check('clinic copies preserve contents and patient relationships', async () => {
    assert.equal(await db.category.count(), 3)
    assert.equal(await db.catalogItem.count(), 3)
    assert.equal(await db.fichaTemplate.count(), 3)
    const appointments = await db.appointment.findMany({ include: { service: { include: { category: true } } }, orderBy: { id: 'asc' } })
    assert.equal(appointments.length, f.appointments.length)
    for (const appointment of appointments) {
      assert.equal(appointment.companyId, appointment.service.companyId)
      assert.equal(appointment.companyId, appointment.service.category.companyId)
      assert.equal(appointment.service.price.toString(), '123.45')
      assert.equal(appointment.service.durationMinutes, 50)
      const { service, serviceId, updatedAt, ...unchanged } = appointment
      const { serviceId: oldService, updatedAt: oldTime, ...expected } = f.appointments.find(item => item.id === appointment.id)
      assert.deepEqual(unchanged, expected)
    }
    const fichas = await db.ficha.findMany({ include: { client: true, template: true }, orderBy: { id: 'asc' } })
    assert.equal(fichas.length, f.fichas.length)
    for (const ficha of fichas) {
      assert.equal(ficha.client.companyId, ficha.template.companyId)
      assert.deepEqual(ficha.template.fields, [{ id: 'field-1', type: 'text' }])
      const { client, template, templateId, updatedAt, ...unchanged } = ficha
      const { templateId: oldTemplate, updatedAt: oldTime, ...expected } = f.fichas.find(item => item.id === ficha.id)
      assert.deepEqual(unchanged, expected)
    }
    const after = await snapshot(db)
    for (const table of ['clients', 'professionals', 'usuarios', 'user_permissions', 'user_company_permissions']) assert.deepEqual(after[table], original[table])
    assert.equal((await db.catalogItem.findUnique({ where: { id: f.services[0].id } })).companyId, f.a.id)
    assert.equal((await db.fichaTemplate.findUnique({ where: { id: f.templates[1].id } })).companyId, f.c.id)
  })
  await check('explicit denials and inactive memberships survive migration', async () => {
    const permission = await db.rolePermission.findUnique({ where: { roleId_moduleId: { roleId: f.roleA.id, moduleId: f.contacts.id } } })
    assert.equal(permission.hasAccess, false)
    assert.equal(permission.subPermissions.verClientes, false)
    assert.equal(permission.subPermissions.editarContatos, true)
    const inactive = await db.userCompanyAccess.findUnique({ where: { userId_companyId: { userId: f.legacy.id, companyId: f.b.id } }, include: { role: true } })
    assert.equal(inactive.isActive, false)
    assert.equal(inactive.role.companyId, f.b.id)
    assert.equal(inactive.role.value, 'legacy_security_migration')
    const migrated = await db.userCompanyAccess.findUnique({ where: { userId_companyId: { userId: f.legacy.id, companyId: f.a.id } }, include: { role: { include: { permissions: true } } } })
    assert.equal(migrated.role.companyId, f.a.id)
    assert.equal(migrated.role.permissions.length, 2)
    assert.equal(migrated.role.permissions.every(item => item.hasAccess), true)
    const professional = await db.professionalPermission.findUnique({ where: { professionalId_moduleId: { professionalId: f.owner.id, moduleId: f.contacts.id } } })
    assert.equal(professional.hasAccess, false)
    assert.equal(professional.subPermissions.verClientes, false)
  })
  await check('repeated application makes no changes', async () => {
    const before = await snapshot(db)
    assert.deepEqual(await db.$transaction(migrateSecurityIsolation, txOptions), { alreadyApplied: true })
    assert.deepEqual(await snapshot(db), before)
  })
  await check('PostgreSQL enforces NOT NULL, foreign keys, indexes and deny defaults', async () => {
    for (const table of ['categories', 'catalog_items', 'ficha_templates']) {
      await assert.rejects(db.$executeRawUnsafe(`UPDATE ${table} SET company_id = NULL`))
      await assert.rejects(db.$executeRawUnsafe(`UPDATE ${table} SET company_id = 2147483647`))
      const indexes = await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename = ${table}`
      assert.ok(indexes.some(row => row.indexname === `${table}_company_id_idx`))
    }
    const defaults = await db.$queryRaw`SELECT table_name, column_default FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'has_access' AND table_name IN ('role_permissions','professional_permissions','user_permissions','user_company_permissions')`
    assert.equal(defaults.length, 4)
    assert.ok(defaults.every(row => row.column_default === 'false'))
  })
  await check('migrated schema matches the Prisma deployment schema', async () => {
    const diff = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    // The explicit migration marker is intentionally not an application model.
    const changes = diff.replace(/--[^\n]*/g, '').replace(/DROP TABLE "(?:public"\.")?sellclin_security_migrations";/g, '').trim()
    assert.equal(changes, '', diff)
  })
  await check('real middleware enforces migrated grants and clinic boundaries', async () => {
    globalThis.prisma = db
    const { auth, requireModule, requirePermission } = await import('../server/middleware/auth.ts')
    const authorize = async (account, type, companyId, key, moduleCode = 'clientes') => {
      const token = jwt.sign({ id: account.id, type, companyId: f.a.id, role: 'admin', allowedCompanies: [f.a.id, f.b.id, f.c.id], passwordStamp: passwordSessionStamp(account.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '5m' })
      const req = { headers: { authorization: `Bearer ${token}`, 'x-company-id': String(companyId) } }
      let status = 200
      const res = { status(code) { status = code; return this }, json() {} }
      for (const middleware of [auth(), requireModule(moduleCode), ...(key ? [requirePermission(moduleCode, key)] : [])]) {
        let next = false
        await middleware(req, res, () => { next = true })
        if (!next) return status
      }
      return status
    }
    assert.equal(await authorize(f.owner, 'profissional', f.a.id, 'verClientes'), 200)
    assert.equal(await authorize(f.owner, 'profissional', f.b.id, 'verClientes'), 200)
    assert.equal(await authorize(f.owner, 'profissional', f.c.id, 'verClientes'), 403)
    assert.equal(await authorize(f.restricted, 'usuario', f.a.id, 'verClientes'), 403)
    assert.equal(await authorize(f.restricted, 'usuario', f.b.id, 'verClientes'), 200)
    assert.equal(await authorize(f.restricted, 'usuario', f.b.id, 'excluirContatos'), 403)
    assert.equal(await authorize(f.restricted, 'usuario', f.b.id, null, 'catalogos'), 403)
    assert.equal(await authorize(f.legacy, 'usuario', f.a.id, 'verClientes'), 200)
    assert.equal(await authorize(f.legacy, 'usuario', f.b.id, 'verClientes'), 403)
    assert.equal(await authorize(f.legacy, 'usuario', f.c.id, 'verClientes'), 403)
    assert.equal(await authorize(f.legacy, 'usuario', f.a.id, 'futurePermission'), 403)
    const newRole = await db.role.create({ data: { companyId: f.a.id, professionalId: f.owner.id, value: 'new_role', name: 'New role' } })
    const newUser = await db.usuario.create({ data: { companyId: f.a.id, roleId: newRole.id, name: 'New user', email: 'new@example.invalid', passwordHash: 'fixture-new' } })
    assert.equal(await authorize(newUser, 'usuario', f.a.id, 'verClientes'), 403)
    const grant = await db.rolePermission.create({ data: { roleId: newRole.id, moduleId: f.contacts.id } })
    assert.equal(grant.hasAccess, false)
  })
  await check('standard role bootstrap preserves migrated grants and denies new grants', async () => {
    const { ensureDefaultRoles } = await import('../server/bootstrap/default-roles.ts')
    const existing = await db.rolePermission.findMany({ where: { role: { companyId: f.a.id } }, orderBy: { id: 'asc' } })
    await ensureDefaultRoles(db, f.a.id, f.owner.id)
    for (const permission of existing) assert.deepEqual(await db.rolePermission.findUnique({ where: { id: permission.id } }), permission)
    const newPermissions = await db.rolePermission.findMany({ where: { role: { companyId: f.a.id }, id: { notIn: existing.map(item => item.id) } } })
    assert.ok(newPermissions.length > 0)
    assert.ok(newPermissions.every(item => item.hasAccess === false))
  })
  for (const [name, corrupt, message] of [
    ['bad_appointment', async broken => broken.appointment.update({ where: { id: f.appointments[1].id }, data: { companyId: f.c.id } }), /Serviço .*fora das clínicas/],
    ['bad_template', async broken => broken.client.update({ where: { id: f.fichas[1].clientId }, data: { companyId: f.c.id } }), /Modelo .*fora das clínicas/],
    ['bad_role', async broken => broken.userCompanyAccess.update({ where: { userId_companyId: { userId: f.restricted.id, companyId: f.b.id } }, data: { roleId: f.roleA.id } }), /Cargo de outra clínica/],
    ['orphan_owner', async broken => broken.empresa.update({ where: { id: f.c.id }, data: { ownerId: f.owner.id } }), /Cadastro sem clínica proprietária/],
  ]) {
    await check(`transaction rollback restores data AND DDL: ${name}`, async () => {
      const broken = await clone(name)
      await corrupt(broken)
      const before = await snapshot(broken)
      await assert.rejects(broken.$transaction(migrateSecurityIsolation, txOptions), message)
      assert.deepEqual(await snapshot(broken), before)
      const columns = await broken.$queryRaw`SELECT table_name FROM information_schema.columns WHERE column_name = 'company_id' AND table_name IN ('categories','catalog_items','ficha_templates')`
      assert.equal(columns.length, 0)
      const [{ marker }] = await broken.$queryRaw`SELECT to_regclass('public.sellclin_security_migrations')::text AS marker`
      assert.equal(marker, null)
      const defaults = await broken.$queryRaw`SELECT column_default FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'has_access'`
      assert.equal(defaults[0].column_default, 'true')
      await broken.$disconnect()
    })
  }
  console.log(`PostgreSQL rehearsal: ${passed}/${passed} checks passed. Synthetic data only; no VPS backup was restored.`)
} finally {
  await Promise.allSettled(clients.map(db => db.$disconnect()))
  if (seedConnection) await seedConnection.end()
  if (admin) await admin.end()
  await pg.stop()
  await rm(temp, { recursive: true, force: true })
}
