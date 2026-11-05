import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ preview: vi.fn(), transfer: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/api', () => ({ usuariosApi: { leadTransferPreview: state.preview, transferLeads: state.transfer } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }))
import { LeadTransfer } from './LeadTransfer'
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  state.preview.mockResolvedValue({ success: true, data: { companyId: 4, total: 2, counts: { sdrId: 2, closerId: 0, especialistaId: 0 }, targets: [{ id: 20, name: 'Novo SDR' }] } })
  state.transfer.mockResolvedValue({ success: true, data: { transferred: 2 } })
})
it('requires a destination and explicit confirmation, displays names and refreshes after success', async () => {
  render(<LeadTransfer memberId={10} companyId={4} companyName="Clínica teste" />)
  await screen.findByRole('combobox')
  expect((screen.getByRole('button', { name: 'Transferir leads' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByText('Novo SDR'))
  expect(screen.getByRole('combobox').textContent).toContain('Novo SDR')
  fireEvent.click(screen.getByRole('button', { name: 'Transferir leads' }))
  expect(state.transfer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }))
  await waitFor(() => expect(state.transfer).toHaveBeenCalledWith(10, 20, 2, 4))
  await waitFor(() => expect(state.preview).toHaveBeenCalledTimes(2))
  expect(state.toast).toHaveBeenCalledOnce()
})
it('shows an API error without claiming success', async () => {
  state.preview.mockRejectedValue(new Error('Membro não pertence à clínica atual.'))
  render(<LeadTransfer memberId={10} companyId={4} companyName="Clínica teste" />)
  expect((await screen.findByRole('alert')).textContent).toContain('Membro não pertence')
  expect(state.toast).not.toHaveBeenCalled()
})
