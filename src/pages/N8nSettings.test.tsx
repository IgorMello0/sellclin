// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ list: vi.fn(), getConfig: vi.fn(), create: vi.fn(), saveConfig: vi.fn(), testKey: vi.fn(), playground: vi.fn(), activate: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/api', () => ({ aiAgentsApi: api }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import N8nSettings from './N8nSettings'
const ok = (data: any) => ({ success: true, data })
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue(ok([])); api.create.mockResolvedValue(ok({ id: 5, name: 'Atendimento n8n', isActive: false })); api.saveConfig.mockResolvedValue(ok({ saved: true })); api.getConfig.mockResolvedValue(ok({ executionMode: 'n8n', n8nWebhookUrl: 'https://example.com/webhook/clinic', hasN8nSecret: true })); api.testKey.mockResolvedValue(ok({ verified: true })) })
afterEach(cleanup)
it('shows only n8n configuration without AI keys or the flow editor', async () => {
  render(<N8nSettings />)
  expect(await screen.findByLabelText('URL de produção do webhook')).toBeTruthy()
  expect(screen.queryByLabelText('Modelo')).toBeNull()
  expect(screen.queryByRole('group', { name: 'Mecanismo de execução' })).toBeNull()
  expect(screen.queryByLabelText('Editor visual do fluxo')).toBeNull()
})
it('creates and saves an n8n connection without an AI credential', async () => {
  render(<N8nSettings />)
  fireEvent.change(await screen.findByLabelText('URL de produção do webhook'), { target: { value: 'https://example.com/webhook/clinic' } })
  fireEvent.change(screen.getByLabelText('Token do workflow'), { target: { value: 'private-token' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar conexão' }))
  await waitFor(() => expect(api.saveConfig).toHaveBeenCalledWith(5, expect.objectContaining({ executionMode: 'n8n', n8nSecret: 'private-token' })))
  expect(await screen.findByLabelText('Substituir token (opcional)')).toHaveProperty('value', '')
  expect((screen.getByRole('button', { name: 'Ativar atendimento n8n' }) as HTMLButtonElement).disabled).toBe(true)
})
it('reuses an existing connection and blocks tests after an unsaved edit', async () => {
  api.list.mockResolvedValue(ok([{ id: 5, name: 'Existing', isActive: false }]))
  render(<N8nSettings />)
  const input = await screen.findByLabelText('URL de produção do webhook')
  expect((input as HTMLInputElement).value).toBe('https://example.com/webhook/clinic')
  fireEvent.change(input, { target: { value: 'https://other.example/webhook/clinic' } })
  expect((screen.getByRole('button', { name: 'Testar workflow' }) as HTMLButtonElement).disabled).toBe(true)
  expect(api.create).not.toHaveBeenCalled()
})
