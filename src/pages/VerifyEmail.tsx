import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { authApi } from '@/lib/api';

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token') || '';
    if (!token) {
      setStatus('error');
      setMessage('Link inválido ou incompleto.');
      return;
    }

    authApi.verifyEmail(token).then((response) => {
      if (response.success) {
        setStatus('success');
        setMessage('Seu e-mail foi verificado. Você já pode acessar o SellClin.');
      } else {
        setStatus('error');
        setMessage(response.error?.message || 'Não foi possível verificar seu e-mail.');
      }
    });
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
          {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-6 w-6" />}
          {status === 'error' && <MailWarning className="h-6 w-6" />}
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {status === 'loading' ? 'Verificando e-mail...' : status === 'success' ? 'E-mail verificado' : 'Link inválido'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{message}</p>
        <Link
          to="/entrar"
          className="mt-6 inline-flex rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white hover:bg-orange-600"
        >
          Ir para login
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmail;
