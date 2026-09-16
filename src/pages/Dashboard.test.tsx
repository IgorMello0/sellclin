import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './Dashboard';
import { dashboardApi, usuariosApi } from '@/lib/api';

const auth = vi.hoisted(() => ({ companyId: 2 }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  professional: { id: '1', companyId: auth.companyId }, hasPermission: () => true,
}) }));
vi.mock('@/lib/api', () => ({ dashboardApi: { getMetrics: vi.fn() }, usuariosApi: { getAll: vi.fn() } }));

function result(leads = 12) {
  return { success: true, data: {
    leads, agendamentos: 4, comparada: 3, oportunidades: 2, contratos: 1,
    faturamento: 1000, faturamentoFechado: 500, totalDiscount: 0,
    ticketOrcado: 500, ticketFechado: 500, conversao: '8.3', conversaoPropostas: '50.0',
    conversaoFinanceira: '50.0', parcelamentoMedioBoleto: 1,
    funil: { novos: 100, contatados: 60, agendamentos: 40, fechados: 20 },
    metodos: { boleto: { gerados: 200 }, cartao: 200, pix: 100, dinheiro: 0 },
    origem: [{ origin: 'Google', count: leads }],
  } };
}

const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
}
function deferred() {
  let resolve!: (value: ReturnType<typeof result>) => void;
  const promise = new Promise<ReturnType<typeof result>>(done => { resolve = done; });
  return { promise, resolve };
}
function leadCount() {
  return screen.getByText('Total de Leads').parentElement?.querySelector('h3')?.textContent;
}
async function applyCustom() {
  fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }));
  fireEvent.change(screen.getByLabelText('Data Início'), { target: { value: '2026-09-01' } });
  fireEvent.change(screen.getByLabelText('Data Fim'), { target: { value: '2026-09-10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar Período' }));
  await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenLastCalledWith('custom', '2026-09-01', '2026-09-10', 'all', 'all', expect.any(AbortSignal)));
}

beforeEach(() => {
  auth.companyId = 2;
  vi.mocked(dashboardApi.getMetrics).mockReset().mockResolvedValue(result());
  vi.mocked(usuariosApi.getAll).mockReset().mockResolvedValue({ success: true, data: [
    { id: 8, name: 'Ana', companyId: 2, role: { isSDR: true } },
    { id: 9, name: 'Bruno', companyId: 2, role: { isCloser: true } },
  ], pagination: { page: 1, pageSize: 100, total: 2 } });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('dashboard filter interactions', () => {
  it('keeps today data after both an older filter and the initial request resolve late', async () => {
    const initial = deferred(), week = deferred(), today = deferred();
    vi.mocked(dashboardApi.getMetrics).mockImplementation(filter => filter === 'today' ? today.promise : filter === '7days' ? week.promise : initial.promise);
    mount();
    await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    await act(async () => { today.resolve(result(7)); });
    await waitFor(() => expect(leadCount()).toBe('7'));
    await act(async () => { week.resolve(result(80)); initial.resolve(result(900)); });
    expect(leadCount()).toBe('7');
  });

  it('keeps unapplied dates out of the label and team-filter request', async () => {
    mount();
    await screen.findByText('Total de Leads');
    await applyCustom();
    fireEvent.click(screen.getByRole('button', { name: /01\/09\/2026 - 10\/09\/2026/ }));
    fireEvent.change(screen.getByLabelText('Data Fim'), { target: { value: '2026-09-14' } });
    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('button', { name: /01\/09\/2026 - 10\/09\/2026/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Ana'));
    await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenLastCalledWith('custom', '2026-09-01', '2026-09-10', '8', 'all', expect.any(AbortSignal)));
  });

  it('keeps the date editor open with an error and does not fetch an inverted range', async () => {
    mount();
    await screen.findByText('Total de Leads');
    const count = vi.mocked(dashboardApi.getMetrics).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }));
    fireEvent.change(screen.getByLabelText('Data Início'), { target: { value: '2026-09-14' } });
    fireEvent.change(screen.getByLabelText('Data Fim'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar Período' }));
    expect(screen.getByRole('alert').textContent).toContain('Informe datas válidas');
    expect(dashboardApi.getMetrics).toHaveBeenCalledTimes(count);
    expect(screen.getByLabelText('Data Início')).toBeTruthy();
  });

  it('shows an error instead of zero counters, then retries the selected filter', async () => {
    vi.mocked(dashboardApi.getMetrics).mockResolvedValueOnce({ success: false, error: { message: 'Falha' } }).mockResolvedValue(result(25));
    mount();
    await screen.findByRole('alert');
    expect(screen.queryByText('Total de Leads')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(leadCount()).toBe('25'));
  });

  it('combines and clears team filters without losing the applied period', async () => {
    mount();
    await screen.findByText('Total de Leads');
    await applyCustom();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Leads sem SDR (Vazio)'));
    fireEvent.click(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByText('Bruno'));
    await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenLastCalledWith('custom', '2026-09-01', '2026-09-10', 'none', '9', expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Filtros' }));
    await waitFor(() => expect(dashboardApi.getMetrics).toHaveBeenLastCalledWith('custom', '2026-09-01', '2026-09-10', 'all', 'all', expect.any(AbortSignal)));
  });
});
