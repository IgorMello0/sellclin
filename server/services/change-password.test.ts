// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
const db = vi.hoisted(() => ({ professional: {findUnique: vi.fn(),updateMany:vi.fn()}, usuario:{findUnique:vi.fn(),updateMany:vi.fn()} }));
vi.mock('../prisma.js', () => ({prisma:db}));
import { changePassword } from './change-password';
beforeEach(async()=>{
 vi.clearAllMocks();
 for(const table of [db.professional,db.usuario]) {
   table.findUnique.mockResolvedValue({passwordHash:await bcrypt.hash('Old-test1!',4)});
   table.updateMany.mockResolvedValue({count:1});
 }
});
async function call(type:string, currentPassword='Old-test1!',newPassword='New-test2!') {
 const res:any={code:200,status(n:number){this.code=n;return this},json(data:any){this.data=data;return this}};
 await changePassword({user:{id:7,type},body:{currentPassword,newPassword,id:999}} as any,res);return res;
}
it.each(['profissional','usuario'])('updates only the authenticated %s account and stores a working hash',async(type)=>{
 const res=await call(type);expect(res.code).toBe(200);
 const selected=type==='profissional'?db.professional:db.usuario;
 const other=type==='profissional'?db.usuario:db.professional;
 expect(other.updateMany).not.toHaveBeenCalled();
 const args=selected.updateMany.mock.calls[0][0];expect(args.where.id).toBe(7);
 expect(await bcrypt.compare('New-test2!',args.data.passwordHash)).toBe(true);
 expect(await bcrypt.compare('Old-test1!',args.data.passwordHash)).toBe(false);
 expect(res.data).toEqual({success:true,data:{updated:true},pagination:undefined});
});
it('rejects incorrect current passwords without changing either account',async()=>{
 expect((await call('usuario','wrong')).code).toBe(400);
 expect(db.usuario.updateMany).not.toHaveBeenCalled();expect(db.professional.updateMany).not.toHaveBeenCalled();
});
it('rejects short and oversized passwords',async()=>{
 expect((await call('usuario','Old-test1!','123')).code).toBe(400);
 expect((await call('usuario','Old-test1!','á'.repeat(40))).code).toBe(400);
 expect(db.usuario.updateMany).not.toHaveBeenCalled();
});
it('rejects unsupported account types',async()=>expect((await call('cliente')).code).toBe(403));
it('does not overwrite a concurrent password change',async()=>{
 db.usuario.updateMany.mockResolvedValue({count:0});expect((await call('usuario')).code).toBe(409);
});
