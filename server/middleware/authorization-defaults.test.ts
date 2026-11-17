// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ permission: null as any, individual: null as any, activeRole: null as any, globalCompanyId: 1, moduleActive: true }))
vi.mock('../services/billing.js', () => ({ canCompanyAccessModule: async () => ({ hasAccess: true }) }))
vi.mock('../prisma.js', () => ({ prisma: {
  module: { findUnique: async () => ({ id: 1, isActive: state.moduleActive }) },
  professionalPermission: { findUnique: async () => state.permission },
  userCompanyPermission: { findUnique: async () => state.individual },
  userCompanyAccess: { findUnique: async () => ({ role: state.activeRole }) },
  usuario: { findUnique: async () => ({ companyId: state.globalCompanyId, role: { permissions: state.permission ? [state.permission] : [] } }) },
} }))
import { requireModule, requirePermission } from './auth.js'
import { resolveRoleSubPermissions } from '../config/commercial-role-permissions.js'
beforeEach(() => { state.permission = null; state.individual = null; state.activeRole = null; state.globalCompanyId = 1; state.moduleActive = true })
async function call(granular = false, user: any = { id: 1, type: 'usuario', companyId: 1, role: 'admin' }) {
  const next = vi.fn()
  const res: any = { code: 200, status(code: number) { this.code = code; return this }, json() { return this } }
  await (granular ? requirePermission('clientes', 'verClientes') : requireModule('clientes'))({ user } as any, res, next)
  return { accepted: next.mock.calls.length === 1, code: res.code }
}
it('denies missing permissions even to an admin role name', async () => {
  expect(await call()).toEqual({ accepted: false, code: 403 })
  expect(await call(true)).toEqual({ accepted: false, code: 403 })
})
it('requires an explicit granular grant and preserves explicit denials', async () => {
  state.permission = { hasAccess: true, subPermissions: {} }
  expect((await call()).accepted).toBe(true)
  expect((await call(true)).accepted).toBe(false)
  state.permission.subPermissions.verClientes = true
  expect((await call(true)).accepted).toBe(true)
  state.individual = { hasAccess: false }
  expect((await call()).accepted).toBe(false)
  expect((await call(true)).accepted).toBe(false)
})
it('never borrows the primary clinic role while operating in another clinic', async () => {
  state.permission = { hasAccess: true, subPermissions: { verClientes: true } }
  state.globalCompanyId = 2
  expect((await call()).accepted).toBe(false)
  expect((await call(true)).accepted).toBe(false)
})
it('preserves verified owner access, not arbitrary professional access', async () => {
  const user = { id: 1, type: 'profissional', companyId: 1, isCompanyOwner: true }
  expect((await call(true, user)).accepted).toBe(true)
  expect((await call(true, { ...user, isCompanyOwner: false })).accepted).toBe(false)
  state.moduleActive = false
  expect((await call(false, user)).accepted).toBe(false)
})

it.each([{isSDR:true}, {isCloser:true}, {value:'comercial'}, {isSDR:true,isCloser:true}])('restores basic Comercial actions for an enabled operational role %j with legacy empty permissions', async flags => {
  for (const stored of [null, {}]) {
    state.activeRole={...flags,permissions:[{hasAccess:true,subPermissions:stored}]};
    const next=vi.fn(),res:any={status(){return this},json(){return this}};
    await requirePermission('funnel','moverFases')({user:{id:1,type:'usuario',companyId:1}} as any,res,next);
    expect(next).toHaveBeenCalledOnce();
    expect(resolveRoleSubPermissions(state.activeRole,'funnel',stored).criarPropostas).toBe(true);
  }
})
it('preserves explicit action denials, individual module blocks and clinic boundaries', async()=>{
  const check=async()=>{
    const next=vi.fn(),res:any={status(){return this},json(){return this}};
    await requirePermission('funnel','moverFases')({user:{id:1,type:'usuario',companyId:1}} as any,res,next);
    return next.mock.calls.length;
  };
  state.activeRole={isSDR:true,permissions:[{hasAccess:true,subPermissions:{moverFases:false}}]};
  expect(await check()).toBe(0);
  state.activeRole.permissions[0].subPermissions=null;state.individual={hasAccess:false};
  expect(await check()).toBe(0);
  state.individual=null;state.activeRole=null;state.globalCompanyId=2;
  state.permission={hasAccess:true,subPermissions:{moverFases:true}};
  expect(await check()).toBe(0);
})
it('does not grant SDRs closing, deletion, unknown actions or other modules',()=>{
  const sdr={isSDR:true};
  const defaults=resolveRoleSubPermissions(sdr,'funnel',null);
  expect(defaults.aprovarPropostas).toBeUndefined();
  expect(defaults.excluirOportunidades).toBeUndefined();
  expect(defaults.unknown).toBeUndefined();
  expect(resolveRoleSubPermissions(sdr,'clientes',null)).toEqual({});
  expect(resolveRoleSubPermissions({isCloser:true},'funnel',null).aprovarPropostas).toBe(true);
})
