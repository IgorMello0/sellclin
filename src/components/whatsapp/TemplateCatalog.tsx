import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from 'lucide-react';
import { whatsappTemplatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { WhatsAppTemplate } from '@/types/whatsapp-template';
import { useNavigate } from 'react-router-dom';

export type { WhatsAppTemplate } from '@/types/whatsapp-template';

export function TemplateCatalog({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    const response = await whatsappTemplatesApi.list(undefined, true);
    if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel carregar os templates.');
    setTemplates(response.data || []);
  };

  useEffect(() => {
    void load().catch((error: Error) => setLoadError(error.message)).finally(() => setLoading(false));
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const response = await whatsappTemplatesApi.sync();
      if (!response.success) throw new Error(response.error?.message || 'Nao foi possivel sincronizar.');
      setTemplates(response.data || []);
      setLoadError(null);
      toast({ title: 'Templates sincronizados', description: `${response.data?.length || 0} template(s) encontrado(s).` });
    } catch (error: any) {
      setLoadError(error.message);
      toast({ title: 'Erro ao sincronizar templates', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">Templates de mensagem</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Aprovados pela Meta para iniciar conversas e campanhas.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/templates')}>Gerenciar</Button>
          <Button type="button" variant="outline" size="icon" title="Sincronizar templates" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className={`mt-4 space-y-2 ${compact ? 'max-h-52' : 'max-h-72'} overflow-y-auto pr-1`}>
        {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
        {loading && <p className="py-4 text-center text-sm text-slate-500">Carregando templates...</p>}
        {!loading && templates.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-medium text-slate-500">
            Nenhum template sincronizado.
          </p>
        )}
        {templates.map((template) => {
          const approved = template.status.toUpperCase() === 'APPROVED';
          return (
            <div key={template.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{template.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{template.language} · {template.category}</p>
                {template.rejectionReason && <p className="mt-1 text-xs text-red-600">{template.rejectionReason}</p>}
              </div>
              <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ${approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {approved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {({ APPROVED: 'Aprovado', PENDING: 'Em análise', NOT_FOUND: 'Não encontrado na Meta', UNKNOWN: 'A confirmar', REJECTED: 'Rejeitado', PAUSED: 'Pausado', DISABLED: 'Desativado', PENDING_DELETION: 'Exclusão pendente' } as Record<string, string>)[template.status.toUpperCase()] || template.status}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
