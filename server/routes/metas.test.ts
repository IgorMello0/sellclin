// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ db: { goal: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } } }));
vi.mock('../prisma.js', () => ({ prisma: state.db }));
vi.mock('../middleware/auth.js', () => ({ auth: () => () => {}, requireModule: () => () => {} }));
vi.mock('../services/tenant.js', () => ({ getCompanyOwnerProfessionalId: async () => 7 }));
import { router } from './metas';
let rows: any[];
beforeEach(() => {
 rows = [{ id: 1, professionalId: 7, companyId: 10, revenueTarget: 100, avgTicket: 10 }, { id: 2, professionalId: 7, companyId: 20, revenueTarget: 200, avgTicket: 20 }, { id: 3, professionalId: 7, companyId: null }];
 state.db.goal.findMany.mockImplementation(async ({where}) => rows.filter(r => r.companyId === where.companyId));
 state.db.goal.create.mockImplementation(async ({data}) => data);
 state.db.goal.deleteMany.mockImplementation(async ({where}) => ({count: rows.filter(r => r.id === where.id && r.companyId === where.companyId).length}));
});
async function call(method: string, path: string, companyId: number, body = {}, id = '2') {
 const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method])!.route;
 const res: any = { code: 200, status(n: number) {this.code=n;return this}, json(data: any) {this.data=data;return this} };
 await route.stack.at(-1).handle({user:{companyId},params:{id},body},res);return res;
}
it('isolates lists for two clinics with the same owner and hides unassigned legacy plans', async () => {
 expect((await call('get','/',10)).data.data.map((x:any)=>x.id)).toEqual([1]);
 expect((await call('get','/',20)).data.data.map((x:any)=>x.id)).toEqual([2]);
});
it('uses the active clinic instead of a supplied clinic or owner', async () => {
 const res=await call('post','/',10,{name:'Plan',companyId:20,professionalId:999,revenueTarget:100,avgTicket:10,schedulingRate:50,showupRate:50,closingRate:50});
 expect(res.data.data).toMatchObject({companyId:10,professionalId:7});
});
it('rejects deletion of another clinic plan even for the same owner', async () => {
 expect((await call('delete','/:id',10)).code).toBe(404);
 expect((await call('delete','/:id',20)).code).toBe(200);
});
