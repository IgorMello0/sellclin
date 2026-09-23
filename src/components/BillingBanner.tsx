import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CreditCard, XCircle } from 'lucide-react';
import { billingApi, type BillingStatus } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function BillingBanner() {
  const navigate = useNavigate();
  const { loadPermissions, professional } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    billingApi.getStatus().then((response) => {
      if (mounted && response.success && response.data) {
        setStatus(response.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, [professional?.companyId]);

  if (!status || status.status === 'active') return null;

  const isTrial = status.status === 'trialing';
  const isBlocked = ['expired', 'payment_pending', 'canceled'].includes(status.status);
  const message = isTrial
    ? `Período teste: faltam ${status.daysRemaining} dia${status.daysRemaining === 1 ? '' : 's'}. Depois disso, os módulos operacionais ficam bloqueados até ativar o plano.`
    : status.status === 'canceled'
      ? 'Teste cancelado. Ative um plano para liberar os módulos operacionais.'
      : 'Seu período teste terminou. Ative um plano para continuar usando os módulos operacionais.';

  const handleCheckout = async () => {
    setIsBusy(true);
    const response = await billingApi.createCheckout(status.planCode, status.billingCycle);
    setIsBusy(false);

    if (response.success && response.data?.checkoutUrl) {
      window.location.href = response.data.checkoutUrl;
      return;
    }

    toast({
      title: 'Não foi possível abrir o checkout',
      description: response.error?.message || 'Revise as configurações da Abacate Pay e tente novamente.',
      variant: 'destructive',
    });
  };

  const handleCancelTrial = async () => {
    if (!window.confirm('Cancelar o teste desta clínica?')) return;

    setIsBusy(true);
    const response = await billingApi.cancelTrial();
    const nextStatus = await billingApi.getStatus();
    await loadPermissions();
    setIsBusy(false);

    if (response.success && nextStatus.success && nextStatus.data) {
      setStatus(nextStatus.data);
      toast({ title: 'Teste cancelado' });
      return;
    }

    toast({
      title: 'Não foi possível cancelar',
      description: response.error?.message || 'Tente novamente em instantes.',
      variant: 'destructive',
    });
  };

  return (
    <div className="border-b border-orange-200/70 bg-orange-50 text-orange-950">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 font-medium">
          {isBlocked ? <AlertCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
          <span>{message}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isBlocked && (
            <button
              type="button"
              onClick={() => navigate('/escolher-plano')}
              disabled={isBusy}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              Ativar plano
            </button>
          )}

          {(isTrial || status.status === 'payment_pending' || status.status === 'expired') && (
            <button
              type="button"
              onClick={handleCancelTrial}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-orange-800 transition hover:bg-orange-100 disabled:opacity-60"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar teste
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
