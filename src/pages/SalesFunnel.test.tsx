import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SalesFunnel from './SalesFunnel';
import { leadsApi } from '@/lib/api';

const fixture = vi.hoisted(() => ({
  professional: { id: '5', name: 'Teste', companyId: 2 },
  toast: vi.fn(),
  lead: { id: 1, name: 'Paciente teste', phone: '11999990000', status: 'prospect_lead', value: 900, createdAt: '2026-09-14', proposals: [] as any[] },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ professional: fixture.professional }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fixture.toast }) }));
vi.mock('@/hooks/useSectionTour', () => ({ useSectionTour: () => ({}) }));
vi.mock('@/components/onboarding/TourPopover', () => ({ TourPopover: () => null }));
vi.mock('@/components/LeadDetailsModal', () => ({ LeadDetailsModal: () => null }));
vi.mock('@/components/ProposalViewer', () => ({ ProposalViewer: () => null }));
vi.mock('@/components/ImportModal', () => ({ ImportModal: () => null }));
vi.mock('@/components/ExportModal', () => ({ ExportModal: () => null }));
vi.mock('@/components/funnel/FunnelSettingsDialog', () => ({ FunnelSettingsDialog: () => null }));
vi.mock('@/components/funnel/ProposalDialog', () => ({ ProposalDialog: (p: any) => p.open ? <div data-testid="proposal-form">{p.lead?.id}</div> : null }));
vi.mock('@/components/NewAppointmentModal', () => ({ NewAppointmentModal: (p: any) => p.open ? <div data-testid="schedule-form">{p.initialLeadId}</div> : null }));
vi.mock('@/components/ConfirmPaymentModal', () => ({ ConfirmPaymentModal: (p: any) => p.open ? <div data-testid="payment-form">{JSON.stringify({ proposalId: p.proposalId, value: p.leadValue })}</div> : null }));
vi.mock('@/components/funnel/FunnelBoard', () => ({ FunnelBoard: (p: any) => <div>
  <span data-testid="card-stage">{p.leads[0]?.status}</span>
  <span data-testid="card-substatus">{p.leads[0]?.subStatus || ''}</span>
  {['prospect_qualified', 'prospect_scheduled', 'prospect_attended', 'comercial_closed'].map(stage => <button key={stage} onClick={() => p.onMoveLead('lead-1', stage)}>{stage}</button>)}
  <button onClick={() => p.onSubStatusChange('1', 'won')}>quick-status</button>
</div> }));
vi.mock('@/lib/api', () => {
  const empty = { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) };
  return { leadsApi: { getAll: vi.fn(), update: vi.fn() }, clientsApi: empty, tasksApi: empty, usuariosApi: empty, catalogsApi: empty, funnelConfigApi: empty, leadStatusesApi: empty, leadOriginsApi: empty };
});
beforeEach(() => {
  vi.clearAllMocks(); fixture.lead.status = 'prospect_lead'; fixture.lead.proposals = [];
  vi.mocked(leadsApi.getAll).mockImplementation(async () => ({ success: true, data: [structuredClone(fixture.lead)] }));
  vi.mocked(leadsApi.update).mockImplementation(async (_id, data) => { Object.assign(fixture.lead, data); return { success: true, data: { ...fixture.lead, value: data.proposalId ? 350 : 900 } }; });
});
afterEach(cleanup);
async function mount() { render(<SalesFunnel />); await waitFor(() => expect(screen.getByTestId('card-stage').textContent).toBe('prospect_lead')); }

it('keeps the saved card stage when the API rejects a move', async () => {
  await mount(); vi.mocked(leadsApi.update).mockResolvedValue({ success: false, error: { message: 'Recusado' } });
  fireEvent.click(screen.getByRole('button', { name: 'prospect_qualified' }));
  await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
  expect(screen.getByTestId('card-stage').textContent).toBe('prospect_lead');
});
it.each([['prospect_scheduled', 'schedule-form'], ['prospect_attended', 'proposal-form']])('opens the correct form after moving to %s', async (stage, modal) => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: stage }));
  expect((await screen.findByTestId(modal)).textContent).toBe('1');
  expect(fixture.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
});
it('preserves the chosen proposal and its value in payment', async () => {
  fixture.lead.proposals = [{ id: 101, title: 'Escolhida', value: 350, status: 'pending' }, { id: 102, title: 'Alternativa', value: 900, status: 'pending' }];
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'comercial_closed' }));
  fireEvent.click(await screen.findByRole('button', { name: /Escolhida/ }));
  expect(JSON.parse((await screen.findByTestId('payment-form')).textContent!)).toEqual({ proposalId: 101, value: 350 });
  expect(leadsApi.update).toHaveBeenCalledWith(1, { status: 'comercial_closed', proposalId: 101 });
});
it('keeps proposal selection open and shows no success when closing fails', async () => {
  fixture.lead.proposals = [{ id: 101, title: 'Escolhida', value: 350, status: 'pending' }];
  await mount(); vi.mocked(leadsApi.update).mockResolvedValue({ success: false });
  fireEvent.click(screen.getByRole('button', { name: 'comercial_closed' }));
  fireEvent.click(await screen.findByRole('button', { name: /Escolhida/ }));
  await waitFor(() => expect(fixture.toast).toHaveBeenCalled());
  expect(screen.queryByTestId('payment-form')).toBeNull(); expect(screen.getByRole('button', { name: /Escolhida/ })).toBeTruthy();
  expect(fixture.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Proposta Fechada!' }));
});
it('does not apply a quick status rejected by the API', async () => {
  await mount(); vi.mocked(leadsApi.update).mockResolvedValue({ success: false });
  fireEvent.click(screen.getByRole('button', { name: 'quick-status' }));
  await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
  expect(screen.getByTestId('card-substatus').textContent).toBe('');
});
