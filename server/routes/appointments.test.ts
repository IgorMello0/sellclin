// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: {} as any }))
vi.mock('../prisma.js', () => ({ prisma: state.db }))
vi.mock('../middleware/auth.js', () => ({ auth: () => (_req: any, _res: any, next: any) => next(), requireModule: () => (_req: any, _res: any, next: any) => next() }))
vi.mock('../middleware/action-permissions.js', () => ({ actionPermissions: () => (_req: any, _res: any, next: any) => next(), hasActionPermission: async () => true }))
vi.mock('../services/tenant.js', () => ({
  assertClientBelongsToCompany: vi.fn(),
  assertUserBelongsToCompany: vi.fn(),
  assertProfessionalBelongsToCompany: vi.fn(),
  getCompanyOwnerProfessionalId: vi.fn().mockResolvedValue(7),
}))
vi.mock('../services/google-calendar.js', () => ({ syncAppointmentToGoogle: vi.fn().mockResolvedValue(null), deleteAppointmentFromGoogle: vi.fn() }))
vi.mock('../utils/audit.js', () => ({ logAudit: vi.fn() }))

import { router } from './appointments'

const user = { id: 7, type: 'profissional', companyId: 2 }
const current = {
  id: 11,
  companyId: 2,
  professionalId: 7,
  especialistaId: null,
  startTime: new Date('2026-10-10T12:00:00.000Z'),
  endTime: new Date('2026-10-10T13:00:00.000Z'),
  status: 'agendado',
  leadId: null,
}

async function call(method: 'post' | 'put', path: '/' | '/:id', body: any) {
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])!.route
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json(result: any) { this.result = result; return this } }
  await route.stack.at(-1).handle({ params: { id: '11' }, body, user }, res)
  return res
}

beforeEach(() => {
  state.db.appointment = {
    findFirst: vi.fn(async ({ where }: any) => where.id === 11 ? { ...current } : null),
    update: vi.fn(async ({ data }: any) => ({ ...current, ...data })),
    create: vi.fn(),
  }
})

it('rejects invalid creation periods and statuses before writing', async () => {
  const reversed = await call('post', '/', { startTime: '2026-10-10T13:00:00.000Z', endTime: '2026-10-10T12:00:00.000Z' })
  expect(reversed.code).toBe(400)
  const badStatus = await call('post', '/', { startTime: '2026-10-10T12:00:00.000Z', endTime: '2026-10-10T13:00:00.000Z', status: 'unknown' })
  expect(badStatus.code).toBe(400)
  expect(state.db.appointment.create).not.toHaveBeenCalled()
})

it('validates a partial reschedule against the resulting complete period', async () => {
  const response = await call('put', '/:id', { startTime: '2026-10-10T14:00:00.000Z' })
  expect(response.code).toBe(400)
  expect(state.db.appointment.update).not.toHaveBeenCalled()
})

it('checks reschedule conflicts only inside the active clinic', async () => {
  state.db.appointment.findFirst = vi.fn(async ({ where }: any) => where.id === 11 ? { ...current } : { id: 99 })
  const response = await call('put', '/:id', {
    startTime: '2026-10-10T14:00:00.000Z',
    endTime: '2026-10-10T15:00:00.000Z',
  })
  expect(response.code).toBe(409)
  expect(state.db.appointment.findFirst.mock.calls[1][0].where.companyId).toBe(2)
  expect(state.db.appointment.update).not.toHaveBeenCalled()
})

it('allows cancellation without an unnecessary conflict lookup', async () => {
  const response = await call('put', '/:id', {
    status: 'cancelado',
    startTime: current.startTime.toISOString(),
    endTime: current.endTime.toISOString(),
  })
  expect(response.code).toBe(200)
  expect(state.db.appointment.findFirst).toHaveBeenCalledTimes(1)
  expect(state.db.appointment.update).toHaveBeenCalledOnce()
})
