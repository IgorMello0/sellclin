// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({sub:{} as Record<string,boolean>,moduleAccess:true,owner:true}));
vi.mock('../services/billing.js',()=>({canCompanyAccessModule:async()=>({hasAccess:true})}));
vi.mock('../prisma.js',()=>({prisma:{
 module:{findUnique:async()=>({id:1})},
 userCompanyAccess:{findUnique:async()=>({role:{permissions:[{hasAccess:state.moduleAccess,subPermissions:state.sub}]}})},
 usuario:{findUnique:async()=>({role:{permissions:[{hasAccess:true,subPermissions:{}}]}})},
 userCompanyPermission:{findUnique:async()=>null},
 empresa:{findFirst:async()=>state.owner?{id:2}:null},
 professionalPermission:{findUnique:async()=>null},
 task:{findFirst:async()=>({assignedToId:null,assignedToUserId:9})},
 appointment:{findFirst:async()=>null},
}}));
import { actionPermissions, ownerConfiguration } from './action-permissions';
beforeEach(()=>{state.sub={};state.moduleAccess=true;state.owner=true});
function response(){return {code:200,status(n:number){this.code=n;return this},json(){return this}} as any}
const cases:[string,string,string,any,string][]=[
 ['agendamentos','POST','/',{},'criarAgendamentos'],
 ['agendamentos','PUT','/1',{status:'confirmado'},'editarAgendamentos'],
 ['agendamentos','PUT','/1',{status:'cancelado'},'cancelarAgendamentos'],
 ['agendamentos','DELETE','/1',{},'cancelarAgendamentos'],
 ['clientes','POST','/',{},'editarContatos'],
 ['clientes','DELETE','/1',{},'excluirContatos'],
 ['funnel','PUT','/1',{status:'prospect_qualified'},'moverFases'],
 ['funnel','POST','/1/proposals/batch',{},'criarPropostas'],
 ['funnel','PUT','/1',{proposalId:4},'aprovarPropostas'],
 ['funnel','PUT','/1',{status:'comercial_closed'},'aprovarPropostas'],
 ['funnel','POST','/1/confirm-payment',{},'aprovarPropostas'],
 ['funnel','DELETE','/bulk',{},'excluirOportunidades'],
 ['tarefas','POST','/',{assignedToId:9,assigneeType:'user'},'atribuirParaOutros'],
 ['tarefas','DELETE','/1',{},'excluirTarefas'],
 ['metas','POST','/',{},'gerenciarMetas'],
 ['metas','DELETE','/1',{},'gerenciarMetas'],
 ['campanhas','POST','/1/send',{},'criarCampanhas'],
 ['campanhas','DELETE','/1',{},'excluirCampanhas'],
];
it.each(cases)('%s %s %s respects %s and preserves allowed operations',async(module,method,path,body,key)=>{
 const req:any={user:{id:5,type:'usuario',companyId:2,role:'admin'},method,path,body};
 state.sub={[key]:false};const denied=response();const next=vi.fn();
 await actionPermissions(module)(req,denied,next);expect(denied.code).toBe(403);expect(next).not.toHaveBeenCalled();
 state.sub={[key]:true};const allowed=response();await actionPermissions(module)(req,allowed,next);expect(next).toHaveBeenCalledTimes(1);
});
it('does not require delegation permission to assign a task to oneself',async()=>{
 state.sub={atribuirParaOutros:false};const next=vi.fn();
 await actionPermissions('tarefas')({user:{id:5,type:'usuario'},method:'POST',path:'/',body:{assignedToId:5,assigneeType:'user'}} as any,response(),next);
 expect(next).toHaveBeenCalledOnce();
});
it('also checks edit permission when cancellation changes other fields',async()=>{
 state.sub={editarAgendamentos:false,cancelarAgendamentos:true};const res=response();
 await actionPermissions('agendamentos')({user:{id:5,type:'usuario',companyId:2},method:'PUT',path:'/1',body:{status:'cancelado',notes:'changed'}} as any,res,vi.fn());expect(res.code).toBe(403);
});
it.each(['POST','PUT','DELETE'])('restricts configuration %s to the verified owner',async(method)=>{
 const next=vi.fn(),res=response();
 await ownerConfiguration({method,user:{id:5,type:'usuario',role:'admin',companyId:2}} as any,res,next);
 expect(res.code).toBe(403);expect(next).not.toHaveBeenCalled();
 await ownerConfiguration({method,user:{id:7,type:'profissional',companyId:2}} as any,response(),next);expect(next).toHaveBeenCalledOnce();
 state.owner=false;const other=response();await ownerConfiguration({method,user:{id:8,type:'profissional',companyId:2}} as any,other,vi.fn());expect(other.code).toBe(403);
});
it('preserves reading of funnel options for team members',async()=>{
 const next=vi.fn();await ownerConfiguration({method:'GET',user:{type:'usuario'}} as any,response(),next);expect(next).toHaveBeenCalledOnce();
});
it('allows editing a task without changing its assignee when delegation is disabled',async()=>{
 state.sub={atribuirParaOutros:false};const next=vi.fn();
 const req:any={user:{id:5,type:'usuario',companyId:2},method:'PUT',path:'/1',body:{assignedToId:9,assigneeType:'user'}};
 await actionPermissions('tarefas')(req,response(),next);expect(next).toHaveBeenCalledOnce();
 req.body.assignedToId=10;const denied=response();await actionPermissions('tarefas')(req,denied,vi.fn());expect(denied.code).toBe(403);
});
it('denies access to another persons appointment when shared viewing is disabled',async()=>{
 state.sub={verAgendamentosAlheios:false};const next=vi.fn(),res=response();
 await actionPermissions('agendamentos')({user:{id:5,type:'usuario',companyId:2},method:'GET',path:'/1'} as any,res,next);
 expect(res.code).toBe(403);expect(next).not.toHaveBeenCalled();
});
