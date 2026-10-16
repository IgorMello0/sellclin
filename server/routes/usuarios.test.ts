// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { encryptCredential, readCredentialData } from '../services/integration-encryption'

const state = vi.hoisted(() => ({ db: {} as any, sendInvite: vi.fn() }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../middleware/auth.js', () => ({ auth: () => () => {}, requireCompanyOwner: () => () => {} }))
vi.mock('../bootstrap/defaults.js', () => ({ ensureCompanyDefaults: vi.fn() }))
vi.mock('../services/billing.js', () => ({ assertCanAddUserToCompany: vi.fn(), BillingLimitError: class extends Error {} }))
vi.mock('../services/email-verification.js', () => ({ sendTeamInviteEmail: state.sendInvite }))
import { router } from './usuarios'

const company = { id: 4, name: 'Clínica de teste', isActive: true }
const wrongKey = Buffer.alloc(32, 3)
const storedCompany = { ...company, metaToken: encryptCredential('secret', 'metaToken', Buffer.alloc(32, 2)) }
// Simulate the real query boundary: selecting a secret would attempt to decrypt
// it with the current key and fail, just as the production log shows.
function selectCompany(relation: any) {
  const selected = relation === true ? storedCompany : Object.fromEntries(
    Object.keys(relation.select).map(field => [field, (storedCompany as any)[field]]),
  )
  return readCredentialData(selected, wrongKey)
}
const user = { id: 20, companyId: 4, name: 'Pessoa de teste', email: 'test@example.com', passwordHash: '', isActive: true, emailVerified: false }
function returnedUser(include: any) {
  return { ...user, company: selectCompany(include.company), companyAccess: include.companyAccess
    ? [{ companyId: 4, company: selectCompany(include.companyAccess.include.company) }] : undefined }
}
beforeEach(() => {
  state.sendInvite.mockReset().mockResolvedValue({})
  Object.assign(state.db, {
    professional: { findUnique: vi.fn(async (args: any) => args.select.ownedCompanies
      ? { id: 1, ownedCompanies: [selectCompany(args.select.ownedCompanies)] }
      : { id: 1, companyId: 4 }) },
    usuario: {
      findUnique: vi.fn(async (args: any) => args.where.email ? null : returnedUser(args.include)),
      create: vi.fn(async (args: any) => returnedUser(args.include)),
    },
    role: { findUnique: vi.fn().mockResolvedValue({ id: 8, value: 'comercial' }) },
    userCompanyAccess: { create: vi.fn().mockResolvedValue({}) },
  })
})
async function call(path: string, body = {}) {
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods.post)!.route
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json(data: any) { this.body = data; return this } }
  await route.stack.at(-1).handle({ user: { id: 1, type: 'profissional', companyId: 4 }, params: { id: '20' }, body }, res)
  return res
}
it('creates and invites a collaborator even when an unrelated company credential cannot be decrypted', async () => {
  const res = await call('/', { name: user.name, email: user.email, companyIds: [4] })
  expect(res.code).toBe(201)
  expect(state.sendInvite).toHaveBeenCalledOnce()
  expect(res.body.data.company).toEqual(company)
  expect(res.body.data.passwordHash).toBeUndefined()
})
it('resends an existing pending invite without selecting company credentials', async () => {
  state.db.usuario.findUnique.mockImplementation(async (args: any) => returnedUser(args.include))
  const res = await call('/', { name: user.name, email: user.email })
  expect(res.code).toBe(200)
  expect(res.body.data.inviteResent).toBe(true)
  expect(state.sendInvite).toHaveBeenCalledOnce()
})
it('explicit resend also avoids unrelated encrypted credentials', async () => {
  const res = await call('/:id/resend-invite')
  expect(res.code).toBe(200)
  expect(res.body.data.sent).toBe(true)
  expect(state.sendInvite).toHaveBeenCalledOnce()
})
