import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RoleHelp, describeRole } from './RoleHelp';

afterEach(cleanup);

it('explains combined functions without promising owner access', () => {
  const description = describeRole({ name: 'Administrador + Especialista', isAdmin: true, isSpecialist: true });
  expect(description).toContain('agenda e das propostas');
  expect(description).toContain('Não substitui o proprietário');
  expect(description).toContain('permissões configuradas');
});

it('opens with hover, keyboard and touch without expanding the role editor', () => {
  const expand = vi.fn();
  render(<div onClick={expand}><RoleHelp role={{ name: 'SDR', isSDR: true }} /></div>);
  const help = screen.getByRole('button', { name: 'Sobre o cargo SDR' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.mouseEnter(help);
  expect(screen.getByRole('tooltip').textContent).toContain('qualificação');
  fireEvent.mouseLeave(help);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.focus(help);
  expect(help.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  fireEvent.keyDown(help, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(help);
  expect(screen.getByRole('tooltip')).toBeTruthy();
  expect(expand).not.toHaveBeenCalled();
  fireEvent.blur(help);
  expect(screen.queryByRole('tooltip')).toBeNull();
});
