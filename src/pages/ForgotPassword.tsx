import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
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
      toast({
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail utilizado para acessar o SellClin.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const response = await authApi.forgotPassword(email.trim());
    setLoading(false);

    if (!response.success) {
      toast({
        title: 'Não foi possível enviar',
        description: response.error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[56%_44%]">
      <section className="relative flex min-h-[220px] flex-col overflow-hidden bg-[#0b1528] px-6 py-7 text-white sm:min-h-[280px] sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <Link to="/" aria-label="Ir para a página inicial" className="relative z-10 flex w-fit items-center gap-2.5">
          <span className="flex items-center gap-2">
            <img src="/SELLCLIN LOGOTIPO.png" alt="" className="h-8 w-auto" />
            <span className="text-xl font-bold tracking-tight text-white">Sell<span className="text-orange-400">Clin</span></span>
          </span>
          <span className="h-5 w-px bg-white/20" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Clinic OS</span>
        </Link>

        <div className="relative z-10 mt-10 max-w-xl lg:mt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">Centro de comando SellClin</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            Sua clínica de volta ao controle.
          </h1>
          <p className="mt-5 hidden max-w-lg text-sm leading-7 text-slate-300 sm:block">
            Recupere seu acesso e continue acompanhando cada oportunidade, atendimento e resultado em um só lugar.
          </p>
        </div>

        <div className="relative z-10 mt-12 hidden flex-1 items-end lg:flex">
          <div className="w-[118%] overflow-hidden rounded-xl border border-white/10 bg-white p-1.5 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.8)]">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <img src="/dashboard-tela-sellclin-correto.png" alt="Painel SellClin" className="block w-full" />
            </div>
          </div>
        </div>

        <span aria-hidden="true" className="absolute bottom-0 right-0 h-1 w-32 bg-orange-500" />
      </section>

      <section className="flex min-h-[calc(100vh-220px)] flex-col bg-white px-6 py-7 sm:px-12 lg:min-h-screen lg:px-14 lg:py-12 xl:px-20">
        <div className="flex justify-end">
          <Link to="/entrar" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-orange-600">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          {sent ? (
            <div className="w-full max-w-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Solicitação recebida</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">Confira seu e-mail</h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Se <strong className="font-semibold text-slate-800">{email.trim()}</strong> estiver cadastrado, enviaremos um link para criar uma nova senha.
              </p>

              <div className="mt-7 border-l-2 border-orange-500 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                O envio pode levar alguns minutos. Confira também sua caixa de spam.
              </div>

              <Link to="/entrar" className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                Voltar para o login
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-medium text-slate-500 transition-colors hover:text-orange-600">
                Corrigir o endereço de e-mail
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Segurança da conta</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-[42px]">Recuperar senha</h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Informe o e-mail usado no SellClin. Enviaremos um link seguro para você definir uma nova senha.
              </p>

              <form onSubmit={handleSubmit} className="mt-9 space-y-6">
                <label htmlFor="recovery-email" className="block space-y-2.5">
                  <span className="text-sm font-semibold text-slate-800">E-mail de acesso</span>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="recovery-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      required
                      className="h-14 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </label>

                <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>

              <p className="mt-7 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-400">
                Por segurança, a confirmação é a mesma mesmo quando o e-mail não está cadastrado.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">© 2026 SellClin. Todos os direitos reservados.</p>
      </section>
    </main>
  );
};

export default ForgotPassword;
