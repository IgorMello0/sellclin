import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProposalDialog } from './ProposalDialog';
import { leadsApi } from '@/lib/api';
const notices = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: notices }) }));
vi.mock('@/lib/api', () => ({
  leadsApi: { addProposals: vi.fn(), updateProposal: vi.fn(), addProposal: vi.fn() }, clientsApi: {},
  professionalsApi: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
  usuariosApi: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
}));
const lead = { id: 1, name: 'Paciente teste', value: 900, status: 'comercial_proposal' };
const professional = { id: 5, companyId: 2, role: 'admin' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(leadsApi.updateProposal).mockResolvedValue({ success: true, data: { id: 101 } }); vi.mocked(leadsApi.addProposals).mockResolvedValue({ success: true, data: [] }); });
afterEach(cleanup);

it('loads and updates the chosen proposal, preserving cents and its id', async () => {
  const onSuccess = vi.fn();
  render(<ProposalDialog open onOpenChange={vi.fn()} lead={lead} professional={professional} services={[]} onSuccess={onSuccess} editingProposal={{ id: 101, leadId: 1, title: 'Original', value: 350.29, validUntil: '2026-09-30', tags: ['Clínico'] }} />);
  const title = await screen.findByDisplayValue('Original');
  expect(screen.queryByText('Adicionar Outra Proposta')).toBeNull();
  fireEvent.change(title, { target: { value: 'Editada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(leadsApi.updateProposal).toHaveBeenCalledWith(1, 101, expect.objectContaining({ title: 'Editada', value: 350.29, tags: ['Clínico'] }));
  expect(leadsApi.addProposal).not.toHaveBeenCalled(); expect(leadsApi.addProposals).not.toHaveBeenCalled();
});

it('sends multiple proposals in a single batch and does not close after rejection', async () => {
  const close = vi.fn(), onSuccess = vi.fn();
  vi.mocked(leadsApi.addProposals).mockResolvedValue({ success: false, error: { message: 'Falha' } });
  render(<ProposalDialog open onOpenChange={close} lead={lead} professional={professional} services={[]} onSuccess={onSuccess} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Outra Proposta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gerar e Salvar Propostas' }));
  await waitFor(() => expect(notices).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
  expect(leadsApi.addProposals).toHaveBeenCalledTimes(1);
  expect(vi.mocked(leadsApi.addProposals).mock.calls[0][1]).toHaveLength(2);
  expect(close).not.toHaveBeenCalled(); expect(onSuccess).not.toHaveBeenCalled();
});
