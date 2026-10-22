import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { authApi, billingApi } from '@/lib/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [loginFeedback, setLoginFeedback] = useState<{ title: string; message: string } | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const { login, loginWithGoogle, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (searchParams.get('signup') !== 'success') return;
    const checkoutId = sessionStorage.getItem('sellclin.pendingSignupCheckoutId');
    if (!checkoutId) return;
    let cancelled = false;
    const reconcile = async () => {
      const result = await billingApi.reconcileSignupCheckout(checkoutId);
      if (cancelled) return;
      if (result.success) {
        sessionStorage.removeItem('sellclin.pendingSignupCheckoutId');
        toast({ title: 'Conta ativada', description: 'Pagamento confirmado. Agora entre com o e-mail e a senha cadastrados.' });
        return;
      }
      if (result.error?.code === 409) {
        toast({ title: 'Confirmando pagamento', description: 'O Asaas ainda esta confirmando a cobranca. Aguarde alguns segundos e atualize esta pagina.' });
        return;
      }
      toast({ title: 'Nao foi possivel confirmar o pagamento', description: result.error?.message || 'Tente atualizar a pagina em instantes.', variant: 'destructive' });
    };
    void reconcile();
    return () => { cancelled = true; };
  }, [searchParams, toast]);

  const formatWaitTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (retryAfterSeconds > 0) return;

    setLoginFeedback(null);
    setUnverifiedEmail('');

    if (!email || !password) {
      toast({
        title: 'Campos vazios',
        description: 'Por favor, preencha seu e-mail e senha.',
        variant: 'destructive',
      });
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      toast({
        title: 'Que bom ter você aqui!',
        description: 'Login realizado com sucesso no seu painel.',
      });
      navigate('/painel');
      return;
    }

    const message = result.error || 'E-mail ou senha incorretos.';
    let title = 'Não foi possível entrar';
    let feedbackMessage = message;

    switch (result.reason) {
      case 'invalid_credentials':
        title = 'E-mail ou senha incorretos';
        feedbackMessage = 'Confira os dados informados e tente novamente.';
        break;
      case 'account_disabled':
        title = 'Conta desativada';
        feedbackMessage = 'Seu acesso foi desativado. Fale com o administrador da clínica.';
        break;
      case 'email_unverified':
        title = 'Confirme seu e-mail';
        setUnverifiedEmail(email.trim());
        break;
      case 'rate_limited': {
        title = 'Muitas tentativas';
        const waitSeconds = Math.max(1, result.retryAfterSeconds || 15 * 60);
        setRetryAfterSeconds(waitSeconds);
        feedbackMessage = `Por segurança, o acesso foi bloqueado temporariamente. Tente novamente em ${formatWaitTime(waitSeconds)}.`;
        break;
      }
      case 'connection_error':
        title = 'Falha de conexão';
        feedbackMessage = 'Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.';
        break;
    }

    setLoginFeedback({ title, message: feedbackMessage });
    toast({
      title,
      description: feedbackMessage,
      variant: 'destructive',
    });
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast({
        title: 'Erro no login com Google',
        description: 'Não foi possível obter a credencial.',
        variant: 'destructive',
      });
      return;
    }

    const result = await loginWithGoogle(credentialResponse.credential);
    if (result.success) {
      toast({
        title: 'Login com Google realizado!',
        description: 'Que bom ter você de volta!',
      });
      navigate('/painel');
      return;
    }

    toast({
      title: 'Erro no login com Google',
      description: result.error || 'Tente novamente.',
      variant: 'destructive',
    });
  };

  const handleResendVerification = async () => {
    const response = await authApi.resendVerification(unverifiedEmail);
    toast({
      title: response.success ? 'E-mail enviado' : 'Não foi possível reenviar',
      description: response.success
        ? 'Confira sua caixa de entrada e a pasta de spam.'
        : response.error?.message || 'Tente novamente em instantes.',
      variant: response.success ? 'default' : 'destructive',
    });
  };

  return (
    <div className="min-h-screen bg-white font-body text-[#0F172A] lg:grid lg:grid-cols-[minmax(430px,42%)_minmax(0,58%)]">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 sm:px-10 lg:px-14">
        <div
          className="absolute inset-x-0 bottom-0 h-56 opacity-35 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '14px 14px' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[430px]"
        >
          <div className="mb-10 text-center">
            <Link to="/" aria-label="Voltar para a página inicial" className="mb-8 inline-flex transition-opacity hover:opacity-75">
              <img src="/logo-site.png" alt="SellClin" className="h-9 w-auto" />
            </Link>
            <h1 className="font-headline text-3xl font-black tracking-tight text-[#0F172A] sm:text-[34px]">
              Boas-vindas ao SellClin
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              Acesse sua operação comercial e continue de onde sua equipe parou.
            </p>
          </div>

          <div className="flex w-full justify-center overflow-hidden rounded-full bg-[#0F172A] px-1 py-2 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.75)] transition-transform hover:-translate-y-0.5">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                toast({
                  title: 'Erro no Google',
                  description: 'Não foi possível conectar com o Google.',
                  variant: 'destructive',
                });
              }}
              theme="filled_black"
              size="large"
              width="400"
              text="continue_with"
              shape="pill"
              logo_alignment="left"
            />
          </div>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs font-medium text-slate-400">Ou entre com e-mail</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                E-mail de acesso
              </label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#F97316]" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (retryAfterSeconds === 0) setLoginFeedback(null);
                  }}
                  required
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                  Senha de acesso
                </label>
                <Link to="/esqueci-senha" className="text-xs font-bold text-slate-400 transition-colors hover:text-[#F97316]">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#F97316]" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (retryAfterSeconds === 0) setLoginFeedback(null);
                  }}
                  required
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#F97316]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {loginFeedback && (
              <div
                role="alert"
                aria-live="polite"
                className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left"
              >
                {retryAfterSeconds > 0
                  ? <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <div>
                  <p className="text-sm font-bold text-red-900">{loginFeedback.title}</p>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-red-700">
                    {retryAfterSeconds > 0
                      ? `Por segurança, o acesso foi bloqueado temporariamente. Tente novamente em ${formatWaitTime(retryAfterSeconds)}.`
                      : loginFeedback.message}
                  </p>
                </div>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={isLoading || retryAfterSeconds > 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] text-sm font-black text-white shadow-[0_12px_28px_-14px_rgba(249,115,22,0.75)] transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : retryAfterSeconds > 0
                  ? <Clock3 className="h-4 w-4" />
                  : <ArrowRight className="h-4 w-4" />}
              {isLoading
                ? 'Acessando...'
                : retryAfterSeconds > 0
                  ? `Tente novamente em ${formatWaitTime(retryAfterSeconds)}`
                  : 'Acessar painel'}
            </motion.button>

            {unverifiedEmail && (
              <button
                type="button"
                onClick={handleResendVerification}
                className="w-full text-center text-xs font-bold text-[#F97316] hover:underline"
              >
                Reenviar e-mail de verificação
              </button>
            )}
          </form>

          <div className="mt-7 space-y-4 text-center">
            <p className="text-sm font-medium text-slate-500">
              Ainda não possui uma conta?{' '}
              <Link to="/cadastro" className="font-black text-[#0F172A] transition-colors hover:text-[#F97316]">
                Começar agora
              </Link>
            </p>
            <p className="text-[11px] font-medium leading-relaxed text-slate-400">
              Ao acessar, você concorda com nossos{' '}
              <Link to="/termos-de-uso" className="underline underline-offset-2 hover:text-[#F97316]">
                termos de uso
              </Link>{' '}
              e com a{' '}
              <Link to="/politica-de-privacidade" className="underline underline-offset-2 hover:text-[#F97316]">
                política de privacidade
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-[#F3F6FA] p-5 lg:block">
        <div className="relative h-full min-h-[calc(100vh-2.5rem)] overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-[#F7F9FC] shadow-[0_30px_90px_-45px_rgba(15,23,42,0.3)]">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Operação em tempo real</span>
            </div>
            <div className="rounded-full border border-white/80 bg-white/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm backdrop-blur">
              SellClin CRM
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[250px] left-8 right-0 top-24 overflow-hidden rounded-l-[2rem] border border-slate-200 bg-white p-3 shadow-[0_35px_90px_-40px_rgba(15,23,42,0.4)]"
          >
            <img
              src="/dashboard-tela-sellclin-correto.webp"
              alt="Dashboard do SellClin"
              className="block h-full w-full rounded-l-[1.5rem] object-cover object-left-top"
            />
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[250px] z-20 h-24 bg-gradient-to-t from-white via-white/75 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="absolute inset-x-0 bottom-0 z-30 min-h-[250px] border-t border-white bg-white px-8 py-7 shadow-[0_-24px_50px_-38px_rgba(15,23,42,0.45)] xl:px-10"
          >
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              API Oficial da Meta com coexistência
            </div>
            <h2 className="mt-3 max-w-xl font-headline text-3xl font-black leading-[1.08] tracking-tight text-[#0F172A] xl:text-4xl">
              Toda a operação comercial, em uma única visão.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
              Conversas, funil, agenda, propostas e resultados conectados ao trabalho da equipe.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {[
                { icon: MessageCircle, label: 'WhatsApp Oficial' },
                { icon: BarChart3, label: 'Funil e metas' },
                { icon: ShieldCheck, label: 'Equipe e permissões' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600">
                    <Icon className="h-3.5 w-3.5 text-[#F97316]" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Login;
