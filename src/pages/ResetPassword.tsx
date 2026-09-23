import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast({ title: 'Link invalido', description: 'Solicite uma nova recuperacao de senha.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Senhas diferentes', description: 'Confirme a mesma senha nos dois campos.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const response = await authApi.resetPassword(token, password);
    setLoading(false);

    if (!response.success) {
      toast({
        title: 'Nao foi possivel redefinir',
        description: response.error?.message || 'Solicite um novo link e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Senha redefinida', description: 'Agora voce ja pode entrar com e-mail e senha.' });
    navigate('/entrar');
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
          <h1 className="text-3xl font-black text-slate-900">Criar nova senha</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            Defina uma senha para acessar sua conta tambem pelo login com e-mail.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nova senha</span>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 6 caracteres"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium text-slate-800 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#F97316]"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirmar senha</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/10"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F97316] text-sm font-black uppercase tracking-wider text-white transition hover:bg-orange-600 disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar nova senha
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
