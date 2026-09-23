import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({professional:{id:1,role:'profissional'},hasPermission:()=>true})}));
vi.mock('@/pages/Profile',()=>({default:function ProfileMock(){const navigate=useNavigate();return <button onClick={()=>navigate('/configuracoes?tab=seguranca')}>Atalho de senha</button>}}));
import Settings from './Settings';
afterEach(cleanup);
it('switches from the profile shortcut to security without reloading the page',async()=>{
 render(<MemoryRouter initialEntries={['/configuracoes?tab=perfil']}><Settings/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Atalho de senha'}));
 expect(await screen.findByLabelText('Senha Atual')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Atalho de senha'})).toBeNull();
});
