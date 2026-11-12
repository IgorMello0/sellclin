// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: {} as any }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../middleware/auth.js', () => ({
  auth: () => (_req: any, _res: any, next: () => void) => next(),
  requireModule: () => (_req: any, _res: any, next: () => void) => next(),
}))
vi.mock('../middleware/action-permissions.js', () => ({
  ownerConfiguration: (_req: any, _res: any, next: () => void) => next(),
}))

import { router } from './funnelConfig'
import { copiedFunnelCode, copiedStageCode } from '../utils/funnel-stages'

let funnels: any[]

beforeEach(() => {
  funnels = [{
    companyId: 2, code: 'prospecting', label: 'Prospecção', icon: 'person_search', isActive: true, order: 0,
    stages: [{ code: 'prospect_scheduled', label: 'Consulta marcada', color: 'bg-violet-500', order: 2, isActive: true, isTransition: true }],
  }, {
    companyId: 3, code: 'prospecting', label: 'Outra clínica', icon: 'person_search', isActive: true, order: 0,
    stages: [{ code: 'prospect_scheduled', label: 'Outra clínica', color: 'bg-violet-500', order: 0, isActive: true }],
  }]
  Object.assign(state.db, {
    $transaction: vi.fn(async (run: any) => {
      const previous = [...funnels]
      try { return await run(state.db) } catch (error) { funnels = previous; throw error }
    }),
    funnelConfig: {
      findMany: vi.fn(async ({ where }) => funnels.filter(item => item.companyId === where.companyId)),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, isActive: true, stages: data.stages.create }
        funnels.push(row)
        return row
      }),
    },
    lead: { create: vi.fn(), updateMany: vi.fn() },
  })
})

async function duplicate(operationName: string, templates: string[]) {
  const route = router.stack.find((layer: any) => layer.route?.path === '/duplicate')!.route
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json(result: any) { this.result = result; return this } }
  await route.stack.at(-1).handle({ user: { companyId: 2 }, body: { operationName, templates } }, res)
  return res
}

it('copies a single original with the clinic’s configured stages and creates no leads', async () => {
  const response = await duplicate('Social Selling', ['prospecting'])
  expect(response.code).toBe(201)
  expect(response.result.data).toEqual([expect.objectContaining({
    companyId: 2,
    code: copiedFunnelCode('social-selling', 'prospecting'),
    label: 'Prospecção · Social Selling',
    stages: [{ code: copiedStageCode('social-selling', 'prospecting', 'prospect_scheduled'),
      label: 'Consulta marcada', color: 'bg-violet-500', order: 2, isTransition: true }],
  })])
  expect(funnels[0].stages[0].code).toBe('prospect_scheduled')
  expect(state.db.lead.create).not.toHaveBeenCalled()
  expect(state.db.lead.updateMany).not.toHaveBeenCalled()
})

it('adds only missing originals when copying a group into an existing operation', async () => {
  expect((await duplicate('Social Selling', ['prospecting'])).code).toBe(201)
  const response = await duplicate('social selling', ['prospecting', 'commercial', 'sales'])
  expect(response.code).toBe(201)
  expect(response.result.data.map((row: any) => row.code)).toEqual([
    copiedFunnelCode('social-selling', 'commercial'), copiedFunnelCode('social-selling', 'sales'),
  ])
  expect((await duplicate('Social Selling', ['prospecting', 'commercial', 'sales'])).code).toBe(409)
  expect(state.db.funnelConfig.create).toHaveBeenCalledTimes(3)
})

it('does not leave a partial group if one of the copies cannot be saved', async () => {
  const create = state.db.funnelConfig.create.getMockImplementation()
  state.db.funnelConfig.create.mockImplementationOnce(create)
    .mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 'P2002' }))
  const previous = [...funnels]
  expect((await duplicate('TikTok', ['prospecting', 'commercial'])).code).toBe(409)
  expect(state.db.funnelConfig.create).toHaveBeenCalledTimes(2)
  expect(funnels).toEqual(previous)
})

it('updates funnel positions and stage positions independently', async () => {
  state.db.funnelConfig.count = vi.fn(async ({ where }) => where.id.in.length)
  state.db.funnelConfig.update = vi.fn()
  state.db.funnelStage = { count: vi.fn(async ({ where }) => where.id.in.length), update: vi.fn() }
  state.db.$transaction = vi.fn().mockResolvedValue([])
  const route = router.stack.find((layer: any) => layer.route?.path === '/reorder/batch')!.route
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json() { return this } }
  await route.stack.at(-1).handle({
    user: { companyId: 2 }, body: { funnels: [{ id: 11, order: 1 }, { id: 12, order: 0 }] },
  }, res)
  expect(res.code).toBe(200)
  expect(state.db.funnelConfig.update).toHaveBeenCalledWith({ where: { id: 11, companyId: 2 }, data: { order: 1 } })
  expect(state.db.funnelConfig.update).toHaveBeenCalledWith({ where: { id: 12, companyId: 2 }, data: { order: 0 } })
  expect(state.db.funnelStage.update).not.toHaveBeenCalled()
  state.db.funnelConfig.update.mockClear()
  await route.stack.at(-1).handle({
    user: { companyId: 2 }, body: { funnels: [{ id: 11, stages: [{ id: 20, order: 0 }] }] },
  }, res)
  expect(res.code).toBe(200)
  expect(state.db.funnelStage.update).toHaveBeenCalledWith({ where: { id: 20 }, data: { order: 0 } })
  expect(state.db.funnelConfig.update).not.toHaveBeenCalled()
})
