import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getAll: vi.fn(), getByStage: vi.fn(), update: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/api', () => ({ funnelConfigApi: {getAll: api.getAll}, cadenceApi: {getByStage:api.getByStage, update:api.update} }));
vi.mock('@/hooks/use-toast', () => ({useToast:()=>({toast:api.toast})}));
vi.mock('@/components/ui/select', () => ({
 Select: ({children,value,onValueChange,disabled}:any)=><select value={value} onChange={e=>onValueChange(e.target.value)} disabled={disabled}><option value="">Selecione</option>{children}</select>,
 SelectTrigger:()=>null, SelectValue:()=>null, SelectContent:({children}:any)=><>{children}</>, SelectItem:({children,value}:any)=><option value={value}>{children}</option>
}));
import Cadence from './CadenceSettingsView';
afterEach(()=>{cleanup();vi.clearAllMocks()});
async function setup() {
 api.getAll.mockResolvedValue({success:true,data:[{id:1,code:'prospecting',label:'Prospecção',stages:[{id:1,code:'a',label:'Novos Leads'},{id:2,code:'b',label:'Qualificados'}]},{id:2,code:'commercial',label:'Comercial',stages:[{id:3,code:'c',label:'Proposta'}]}]});
 render(<Cadence/>); await screen.findByRole('option',{name:'Prospecção'});
 fireEvent.change(screen.getAllByRole('combobox')[0],{target:{value:'prospecting'}});
}
const config=(title:string)=>({success:true,data:{isActive:true,steps:[{id:'1',day:1,title,method:'call',template:''}]}});
it('clears the selected stage and form when switching funnels',async()=>{
 api.getByStage.mockResolvedValue(config('A')); await setup();
 fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'a'}});await screen.findByDisplayValue('A');
 fireEvent.change(screen.getAllByRole('combobox')[0],{target:{value:'commercial'}});
 expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('');
 expect(screen.queryByDisplayValue('A')).toBeNull();expect(screen.queryByRole('button',{name:'Salvar',exact:true})).toBeNull();
});
it('ignores delayed responses from the previously selected stage',async()=>{
 let finish:any;
 api.getByStage.mockImplementation((stage:string)=>stage==='a'?new Promise(resolve=>{finish=resolve}):Promise.resolve(config('B')));
 await setup();fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'a'}});
 fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'b'}});await screen.findByDisplayValue('B');
 await act(async()=>finish(config('A')));expect(screen.queryByDisplayValue('A')).toBeNull();expect(screen.getByDisplayValue('B')).toBeTruthy();
});
it('reports rejected saves without claiming success',async()=>{
 api.getByStage.mockResolvedValue(config('A'));api.update.mockResolvedValue({success:false});await setup();
 fireEvent.change(screen.getAllByRole('combobox')[1],{target:{value:'a'}});await screen.findByDisplayValue('A');
 fireEvent.click(screen.getByRole('button',{name:'Salvar',exact:true}));
 await waitFor(()=>expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'})));
 expect(api.toast).not.toHaveBeenCalledWith({title:'Configuração salva com sucesso!'});
});
