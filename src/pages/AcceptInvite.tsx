import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = params.get('token') || '';

    if (!token) {
      toast({ title: 'Link inválido', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Senha fraca', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const response = await authApi.acceptTeamInvite(token, password);
    setIsLoading(false);

    if (response.success) {
      toast({ title: 'Convite aceito', description: 'Agora você já pode entrar no SellClin.' });
      navigate('/entrar');
      return;
    }

    toast({
      title: 'Não foi possível aceitar o convite',
      description: response.error?.message || 'Solicite um novo convite.',
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-center text-2xl font-black text-slate-900">Aceitar convite</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          Defina sua senha para ativar o acesso à clínica.
        </p>

        <div className="mt-6 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nova senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm outline-none focus:border-[#F97316]"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-70"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Ativar acesso
        </button>

        <div className="mt-5 text-center">
          <Link to="/entrar" className="text-xs font-bold text-slate-400 hover:text-[#F97316]">
            Voltar para login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default AcceptInvite;
