// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ db: {} as any }));
vi.mock('../prisma.js', () => ({ prisma: state.db }));
vi.mock('../middleware/auth.js', () => ({ auth: () => () => {}, requireModule: () => () => {} }));
vi.mock('../utils/audit.js', () => ({ logAudit: vi.fn() }));
vi.mock('../services/cadence.js', () => ({ triggerCadenceForLead: vi.fn().mockResolvedValue(undefined) }));
import { router } from './leads';
import { leadVisibility } from '../services/funnel-access';

const user = { id: 5, type: 'usuario', companyId: 2 };
let lead: any;
let proposals: any[];
let clients: any[];
let payments: any[];
let activities: any[];
let failure: string | null;
const snapshot = () => structuredClone({ lead, proposals, clients, payments, activities });
function restore(s: ReturnType<typeof snapshot>) { ({ lead, proposals, clients, payments, activities } = s); }
async function call(method: string, path: string, body: any, proposalId = '101') {
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])!.route;
  const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(result: any) { this.result = result; return this; } };
  await route.stack.at(-1).handle({ params: { id: '1', proposalId }, body, user }, res);
  return res;
}

beforeEach(() => {
  failure = null;
  lead = { id: 1, professionalId: 7, companyId: 2, name: 'Teste', phone: '11999990000', status: 'comercial_proposal', value: 900, sdrId: 5, closerId: null, convertedToClientId: null, closedAt: null };
  proposals = [{ id: 101, leadId: 1, title: 'Escolhida', value: 350, status: 'pending' }, { id: 999, leadId: 99, value: 900, status: 'pending' }];
  clients = []; payments = []; activities = [];
  Object.assign(state.db, {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (fn: any) => { const before = snapshot(); try { return await fn(state.db); } catch (error) { restore(before); throw error; } }),
    usuario: { findUnique: vi.fn().mockResolvedValue({ id: 5, name: 'SDR', isActive: true, companyId: 2, role: { isAdmin: true } }), findFirst: vi.fn().mockResolvedValue({ id: 5 }) },
    userCompanyAccess: { findUnique: vi.fn().mockResolvedValue({ isActive: true, role: { isSDR: true } }) },
    lead: {
      findFirst: vi.fn(async () => ({ ...lead })), findUnique: vi.fn(async () => ({ ...lead })), findUniqueOrThrow: vi.fn(async () => ({ ...lead })),
      update: vi.fn(async ({ data }) => { if (failure === 'lead') throw new Error('write failed'); Object.assign(lead, data); return { ...lead }; }),
    },
    proposal: {
      findMany: vi.fn(async () => proposals.filter(p => p.leadId === 1)),
      findFirst: vi.fn(async ({ where }) => proposals.find(p => p.id === where.id && p.leadId === where.leadId)),
      update: vi.fn(async ({ where, data }) => {
        const found = proposals.find(p => p.id === where.id && (where.leadId === undefined || p.leadId === where.leadId));
        if (!found) throw Object.assign(new Error('Not found'), { code: 'P2025' });
        Object.assign(found, data); return { ...found };
      }),
      create: vi.fn(async ({ data }) => { if (data.title === 'Fail') throw new Error('write failed'); const p = { id: 102 + proposals.length, ...data }; proposals.push(p); return p; }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    client: { create: vi.fn(async ({ data }) => { const c = { id: 20 + clients.length, ...data }; clients.push(c); return c; }) },
    payment: { create: vi.fn(async ({ data }) => { if (payments.length === 1 && failure === 'payment') throw new Error('write failed'); payments.push(data); return data; }) },
    leadActivity: { create: vi.fn(async ({ data }) => { activities.push(data); return data; }) },
    appointment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  });
});

describe('funnel transactions and access', () => {
  it('uses the active clinic role over a global admin role', async () => {
    const where = await leadVisibility(state.db, user, 2);
    expect(where).toMatchObject({ companyId: 2, OR: expect.arrayContaining([{ proposals: { some: { sdrId: 5 } } }]) });
  });
  it('denies inactive clinic membership', async () => {
    state.db.userCompanyAccess.findUnique.mockResolvedValue({ isActive: false });
    expect(await leadVisibility(state.db, user, 2)).toEqual({ companyId: 2, id: -1 });
  });
  it('permits the active clinic manager to see the clinic', async () => {
    state.db.userCompanyAccess.findUnique.mockResolvedValue({ isActive: true, role: { isManager: true } });
    expect(await leadVisibility(state.db, user, 2)).toEqual({ companyId: 2 });
  });
  it('applies the same proposal participation filter to detail access', async () => {
    await call('get', '/:id/proposals', {});
    expect(state.db.lead.findFirst).toHaveBeenCalledWith({ where: { AND: [{ id: 1 }, expect.objectContaining({ OR: expect.arrayContaining([{ proposals: { some: { salespersonId: 5 } } }]) })] } });
  });
  it('cannot edit a proposal from another lead', async () => {
    const before = snapshot();
    const res = await call('put', '/:id/proposals/:proposalId', { title: 'Alterada' }, '999');
    expect(res.result.success).toBe(false); expect(snapshot()).toEqual(before);
    expect(state.db.proposal.update.mock.calls[0][0].where).toEqual({ id: 999, leadId: 1 });
  });
  it('cannot pay another lead proposal or leave financial records behind', async () => {
    const before = snapshot();
    const res = await call('post', '/:id/confirm-payment', { proposalId: 999, payments: [{ amount: 350, date: '2026-09-14', method: 'pix' }] });
    expect(res.result.success).toBe(false); expect(snapshot()).toEqual(before);
    expect(state.db.client.create).not.toHaveBeenCalled();
  });
  it('closes with the selected proposal value and converts once', async () => {
    const res = await call('put', '/:id', { status: 'comercial_closed', proposalId: 101 });
    expect(res.result.success).toBe(true); expect(lead.value).toBe(350); expect(clients).toHaveLength(1);
    expect(proposals[0].status).toBe('accepted'); expect(lead.convertedToClientId).toBe(20);
  });
  it('rolls back acceptance, client and history if moving the lead fails', async () => {
    failure = 'lead'; const before = snapshot();
    expect((await call('put', '/:id', { status: 'comercial_closed', proposalId: 101 })).result.success).toBe(false);
    expect(snapshot()).toEqual(before);
  });
  it('keeps the client on reopen and renews the closing date', async () => {
    await call('put', '/:id', { status: 'comercial_closed' });
    lead.closedAt = new Date('2020-01-01'); const clientId = lead.convertedToClientId;
    await call('put', '/:id', { status: 'comercial_negotiation' });
    expect(lead.closedAt).toBeNull(); expect(lead.convertedToClientId).toBe(clientId);
    await call('put', '/:id', { status: 'comercial_closed' });
    expect(clients).toHaveLength(1); expect(lead.closedAt.getFullYear()).toBeGreaterThan(2020);
  });
  it('rolls back all payments when the second installment fails', async () => {
    failure = 'payment'; const before = snapshot();
    const res = await call('post', '/:id/confirm-payment', { proposalId: 101, payments: [1, 2].map(() => ({ amount: 175, date: '2026-09-14', method: 'pix' })) });
    expect(res.result.success).toBe(false); expect(snapshot()).toEqual(before);
  });
  it('rolls back a partially failed proposal batch and can retry without duplication', async () => {
    const before = snapshot();
    const payload = ['First', 'Fail'].map(title => ({ title, value: 200, validUntil: '2026-10-01' }));
    expect((await call('post', '/:id/proposals/batch', { proposals: payload })).result.success).toBe(false);
    expect(snapshot()).toEqual(before);
    payload[1].title = 'Second';
    expect((await call('post', '/:id/proposals/batch', { proposals: payload })).result.success).toBe(true);
    expect(proposals.filter(p => p.title === 'First')).toHaveLength(1);
  });
  it('rejects an invalid batch before writes', async () => {
    expect((await call('post', '/:id/proposals/batch', { proposals: [{ title: 'Invalid', value: -1, validUntil: 'no' }] })).result.success).toBe(false);
    expect(state.db.$transaction).not.toHaveBeenCalled();
  });
});
