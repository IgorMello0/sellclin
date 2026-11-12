import { expect, it, vi } from 'vitest'
vi.mock('../prisma.js', () => ({ prisma: {} }))
import { effectiveBotConfig } from './bot-clinic-settings.js'
it('uses the authenticated clinic settings without replacing flow connection or validation', async () => {
  const findUnique = vi.fn().mockResolvedValue({ apiKey: 'clinic-key', settings: { provider: 'anthropic', model: 'clinic-model', knowledge: 'Clinic A' } })
  const config = await effectiveBotConfig(12, { apiKey: 'old-key', knowledge: 'old', executionMode: 'n8n', n8nSecret: 'workflow-key', verifiedAt: 'validated', flowDefinition: { version: 1 } }, { botClinicSettings: { findUnique } })
  expect(findUnique).toHaveBeenCalledWith({ where: { companyId: 12 } })
  expect(config).toMatchObject({ apiKey: 'clinic-key', knowledge: 'Clinic A', executionMode: 'n8n', n8nSecret: 'workflow-key', verifiedAt: 'validated', sharedSettings: true })
})
it('preserves legacy settings until the owner saves shared preferences', async () => {
  const legacy = { apiKey: 'legacy', provider: 'openai' }
  expect(await effectiveBotConfig(12, legacy, { botClinicSettings: { findUnique: vi.fn().mockResolvedValue(null) } })).toBe(legacy)
})
