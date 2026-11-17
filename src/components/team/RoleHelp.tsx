import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert } from 'lucide-react';

type Role = {
  name: string;
  isAdmin?: boolean;
  isManager?: boolean;
  isSpecialist?: boolean;
  isSDR?: boolean;
  isCloser?: boolean;
};

export function describeRole(role: Role) {
  const parts: string[] = [];
  if (role.isAdmin) parts.push('Administrador: pode visualizar os leads da clínica nos módulos liberados. Não substitui o proprietário nas ações exclusivas do dono.');
  if (role.isManager) parts.push('Gerente: pode acompanhar os leads da equipe nos módulos liberados.');
  if (role.isSpecialist) parts.push('Especialista: aparece nas seleções de especialista da agenda e das propostas.');
  if (role.isSDR) parts.push('SDR: atua na abordagem, qualificação e pré-venda, com atribuição de leads à pessoa.');
  if (role.isCloser) parts.push('Closer: atua na negociação e no fechamento, com atribuição de oportunidades à pessoa.');
  if (!parts.length) parts.push('Atua na rotina da clínica conforme os módulos e ações liberados neste cargo. Não tem função de SDR, Closer ou Especialista marcada.');
  parts.push('O acesso depende das permissões configuradas e das clínicas autorizadas.');
  return parts.join(' ');
}

export function RoleHelp({ role }: { role: Role }) {
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const open = (element: HTMLButtonElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      top: rect.top > window.innerHeight / 2 ? rect.top - 8 : rect.bottom + 8,
    });
  };
  return <>
    <button type="button" aria-label={`Sobre o cargo ${role.name}`} aria-describedby={position ? id : undefined}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onMouseEnter={event => open(event.currentTarget)} onMouseLeave={() => setPosition(null)}
      onFocus={event => open(event.currentTarget)} onBlur={() => setPosition(null)}
      onClick={event => { event.stopPropagation(); open(event.currentTarget); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); } }}>
      <CircleAlert aria-hidden="true" className="h-4 w-4" />
    </button>
    {position && createPortal(<div id={id} role="tooltip"
      className="pointer-events-none fixed z-[400] w-72 max-w-[calc(100vw-24px)] rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-white shadow-lg"
      style={{ left: position.left, top: position.top, transform: position.top > window.innerHeight / 2 ? 'translateY(-100%)' : undefined }}>
      <p className="mb-1 font-semibold">{role.name}</p>
      <p>{describeRole(role)}</p>
    </div>, document.body)}
  </>;
}
