import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Informe seu e-mail', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const response = await authApi.forgotPassword(email.trim());
    setLoading(false);

    if (!response.success) {
      toast({
        title: 'Nao foi possivel enviar',
        description: response.error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none opacity-[0.25]" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="relative w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.35)]">
        <Link to="/entrar" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#F97316]">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>

        <div className="mt-8 space-y-2">
          <img src="/logo-site.png" alt="SellClin" className="h-7 w-auto translate-y-0.5" />
          <h1 className="text-3xl font-black text-slate-900">Recuperar senha</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            Informe seu e-mail para receber um link seguro e criar uma nova senha.
          </p>
        </div>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900">
            Se esse e-mail existir no SellClin, enviamos um link de recuperacao. Confira sua caixa de entrada e spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">E-mail</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F97316] text-sm font-black uppercase tracking-wider text-white transition hover:bg-orange-600 disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar link
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
