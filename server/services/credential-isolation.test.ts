// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ db: {} as any }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
import { companyProfileSelect, getCompanyProfile } from './company-profile'
import { encryptCredential, readCredentialData, credentialFields } from './integration-encryption'
import { syncAppointmentToGoogle, deleteAppointmentFromGoogle } from './google-calendar'

beforeEach(() => {
  Object.assign(state.db, {
    empresa: { findUnique: vi.fn(async ({ select }: any) => {
      const row: any = { id: 4, name: 'Teste', metaToken: encryptCredential('secret', 'metaToken', Buffer.alloc(32, 2)) }
      return readCredentialData(Object.fromEntries(Object.keys(select).map(field => [field, row[field]])), Buffer.alloc(32, 3))
    }) },
    $queryRaw: vi.fn().mockResolvedValue([{ hasMetaToken: true, hasApiKey: false }]),
    appointment: {
      findUnique: vi.fn().mockResolvedValue({ id: 20, companyId: 4, googleEventId: 'event' }),
      update: vi.fn().mockResolvedValue({}),
    },
    googleCalendarConnection: {
      findUnique: vi.fn().mockRejectedValue(new Error('Não foi possível ler uma credencial criptografada')),
      update: vi.fn().mockResolvedValue({}),
    },
  })
})
it('clinic profile remains readable with an unreadable token and preserves configured indicators', async () => {
  for (const field of [...credentialFields.Empresa, 'apiKeyHash']) expect(companyProfileSelect).not.toHaveProperty(field)
  const profile = await getCompanyProfile(4)
  expect(profile?.name).toBe('Teste')
  expect(profile?.hasMetaToken).toBe(true)
  expect(profile).not.toHaveProperty('metaToken')
})
it('Google decryption failure is recorded instead of failing the local appointment save', async () => {
  await expect(syncAppointmentToGoogle(20)).resolves.toBeNull()
  expect(state.db.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ googleSyncStatus: 'error' }) }))
  expect(state.db.googleCalendarConnection.update).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }))
})
it('Google decryption failure does not block local appointment deletion', async () => {
  await expect(deleteAppointmentFromGoogle(20)).resolves.toBe(false)
  expect(state.db.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ googleSyncStatus: 'error' }) }))
})
