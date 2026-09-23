import { useNavigate } from 'react-router-dom';

interface ModuleBlockedPageProps {
  moduleName?: string;
  reason?: 'permission' | 'plan';
}

export function ModuleBlockedPage({ moduleName, reason = 'permission' }: ModuleBlockedPageProps) {
  const navigate = useNavigate();
  const isPlanBlocked = reason === 'plan';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-6 max-w-lg">
        {/* Animated Lock Icon */}
        <div className="relative mx-auto w-28 h-28">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-secondary/20 to-primary/10 animate-pulse" />
          {/* Inner circle */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <span className="material-symbols-outlined text-5xl text-secondary/80" style={{ fontVariationSettings: "'FILL' 1" }}>
              lock
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">
            Módulo Bloqueado
          </h1>
          {moduleName && (
            <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
              <span className="material-symbols-outlined text-sm text-primary/60">extension</span>
              <span className="text-sm font-bold text-primary/70">{moduleName}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
          {isPlanBlocked
            ? 'Este módulo não está incluído no plano da clínica. Para liberar, revise a assinatura ou altere o plano contratado.'
            : 'Você não tem permissão para acessar este módulo do sistema. Entre em contato com o administrador da sua clínica para solicitar a liberação.'}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/painel')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Voltar ao Dashboard
          </button>
          <button
            onClick={() => navigate('/configuracoes')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            {isPlanBlocked ? 'Ver plano' : 'Configurações'}
          </button>
        </div>

        {/* Info footer */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
            <span className="material-symbols-outlined text-sm">info</span>
            {isPlanBlocked
              ? 'As permissões internas nunca liberam módulos fora do plano contratado'
              : 'Cada módulo pode ser liberado individualmente pelo administrador'}
          </div>
        </div>
      </div>
    </div>
  );
}
