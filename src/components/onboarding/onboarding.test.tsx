import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { OnboardingWizard } from './OnboardingWizard';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ professional: { role: 'profissional', company: { name: 'Clínica Teste' } }, completeOnboarding: vi.fn() }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps a low dropdown outside the form stacking context and above the trigger', async () => {
  const onChange = vi.fn();
  const { container } = render(<div style={{ transform: 'translateX(0)', overflow: 'auto', zIndex: 10 }}>
    <CustomSelect value="" onChange={onChange} options={[{ value: 'Indicação', label: 'Indicação de um amigo' }]} />
  </div>);
  const trigger = screen.getByRole('button', { name: 'Selecione...' });
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ top: 650, bottom: 694, left: 20, right: 320, width: 300, height: 44, x: 20, y: 650, toJSON() {} });
  fireEvent.click(trigger);
  const option = screen.getByRole('button', { name: 'Indicação de um amigo' });
  const menu = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(container.contains(option)).toBe(false);
  expect(menu.parentElement).toBe(document.body);
  expect(menu.style.bottom).toBe(`${window.innerHeight - 650 + 8}px`);
  expect(menu.style.maxHeight).toBe('224px');
  fireEvent.click(option);
  expect(onChange).toHaveBeenCalledWith('Indicação');
  await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  expect(document.activeElement).toBe(trigger);
});

it('repositions a menu on scroll and closes on Escape or an outside click', () => {
  render(<CustomSelect value="" onChange={vi.fn()} options={[{ value: 'Google', label: 'Google' }]} />);
  const trigger = screen.getByRole('button', { name: 'Selecione...' });
  const bounds = vi.spyOn(trigger, 'getBoundingClientRect');
  bounds.mockReturnValue({ top: 20, bottom: 64, left: 20, width: 300 } as DOMRect);
  fireEvent.click(trigger);
  const menu = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(menu.style.top).toBe('72px');
  bounds.mockReturnValue({ top: 650, bottom: 694, left: 20, width: 300 } as DOMRect);
  fireEvent.scroll(window);
  expect(menu.style.top).toBe('');
  expect(menu.style.bottom).not.toBe('');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('renders readable Portuguese across all three onboarding steps', async () => {
  render(<OnboardingWizard />);
  expect(screen.getByText('Sua Clínica')).toBeTruthy();
  expect(screen.getByLabelText('Nome da Clínica / Empresa')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
  expect(await screen.findByText('Sobre o seu Negócio')).toBeTruthy();
  expect(screen.getByText('Quantidade de Funcionários')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
  expect(await screen.findByText('Tudo pronto! 🎉')).toBeTruthy();
  expect(screen.getByText('Dashboard de vendas e métricas')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Iniciar Tour 🚀' })).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/Ã.|Â©|â€|ðŸ/);
});
