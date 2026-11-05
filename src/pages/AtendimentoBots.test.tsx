// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ list: vi.fn(), getConfig: vi.fn(), usage: vi.fn(), activate: vi.fn(), update: vi.fn(), saveConfig: vi.fn(), testKey: vi.fn(), playground: vi.fn(), duplicate: vi.fn(), delete: vi.fn(), create: vi.fn(), toast: vi.fn() }))
vi.mock('@/lib/api', () => ({ aiAgentsApi: mocks }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
import AtendimentoBots from './AtendimentoBots'
const bot = { id: 1, name: 'Recepção', basePrompt: 'Ajude', isActive: false, updatedAt: new Date().toISOString() }
const ok = (data: any) => ({ success: true, data })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.list.mockResolvedValue(ok([bot]))
  mocks.getConfig.mockResolvedValue(ok({ provider: 'openai', model: 'test', hasApiKey: true, verifiedAt: null, playgroundAt: null }))
  mocks.usage.mockResolvedValue(ok({ totals: {}, runs: [] }))
  mocks.testKey.mockResolvedValue(ok({ verified: true }))
  mocks.playground.mockResolvedValue(ok({ reply: 'Olá! Como posso ajudar?', state: {} }))
  mocks.activate.mockResolvedValue(ok({ ...bot, isActive: true }))
})
afterEach(cleanup)
it('requires key validation, a playground conversation and cost approval before activation', async () => {
  render(<AtendimentoBots />)
  fireEvent.click(await screen.findByRole('button', { name: /Recepção/ }))
  const activate = await screen.findByRole('button', { name: 'Ativar para esta clínica' }) as HTMLButtonElement
  expect(activate.disabled).toBe(true)
  expect((screen.getByLabelText('Substituir chave salva (opcional)') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Testar chave e modelo' }))
  await screen.findByText('Conexão validada')
  fireEvent.click(screen.getByRole('button', { name: 'Playground' }))
  fireEvent.change(screen.getByLabelText('Mensagem de teste'), { target: { value: 'Olá' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar teste' }))
  await screen.findByText('Olá! Como posso ajudar?')
  expect(activate.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /Revisei as respostas/ }))
  await waitFor(() => expect(activate.disabled).toBe(false))
  fireEvent.click(activate)
  await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith(1))
})
it('blocks activation and playground while configuration contains unsaved changes', async () => {
  render(<AtendimentoBots />)
  fireEvent.click(await screen.findByRole('button', { name: /Recepção/ }))
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'changed' } })
  expect((screen.getByRole('button', { name: 'Testar chave e modelo' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Ativar para esta clínica' }) as HTMLButtonElement).disabled).toBe(true)
})
