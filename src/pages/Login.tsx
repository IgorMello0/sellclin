import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { authApi } from '@/lib/api';
import { 
  Loader2, Mail, Lock, ArrowRight, Check, Eye, EyeOff, 
  Calendar, Filter, TrendingUp, DollarSign, MessageSquare, 
  Sparkles, Bot, Shield, Cloud, HeartHandshake 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';

const leftBadges = [
  { id: 1, text: 'Agenda Inteligente', icon: Calendar, top: '15%', left: '8%', path: 'M 420 360 C 330 360, 320 120, 230 120' },
  { id: 2, text: 'Funil de Vendas', icon: Filter, top: '30%', left: '5%', path: 'M 420 380 C 310 380, 290 240, 180 240' },
  { id: 3, text: 'Gestão Comercial', icon: TrendingUp, top: '45%', left: '8%', path: 'M 420 400 C 330 400, 320 360, 230 360' },
  { id: 4, text: 'Faturamento do Dia', icon: DollarSign, top: '60%', left: '4%', path: 'M 420 420 C 310 420, 310 480, 200 480' },
  { id: 5, text: 'Avisos WhatsApp', icon: MessageSquare, top: '75%', left: '9%', path: 'M 420 440 C 330 440, 320 600, 230 600' }
];

const rightBadges = [
  { id: 1, text: 'WhatsApp Cloud', icon: MessageSquare, top: '10%', right: '9%', path: 'M 860 320 C 950 320, 940 80, 1030 80' },
  { id: 2, text: 'Agentes de IA', icon: Bot, top: '22%', right: '5%', path: 'M 860 350 C 970 350, 970 176, 1080 176' },
  { id: 3, text: 'Relatórios de Métricas', icon: Sparkles, top: '34%', right: '10%', path: 'M 860 380 C 930 380, 940 272, 1010 272' },
  { id: 4, text: 'Segurança LGPD', icon: Shield, top: '46%', right: '4%', path: 'M 860 400 C 980 400, 980 368, 1100 368' },
  { id: 5, text: 'Suporte Dedicado', icon: HeartHandshake, top: '58%', right: '11%', path: 'M 860 420 C 930 420, 930 464, 1000 464' },
  { id: 6, text: 'Backup em Nuvem', icon: Cloud, top: '70%', right: '6%', path: 'M 860 450 C 960 450, 970 560, 1070 560' },
  { id: 7, text: 'Google Calendar', icon: Calendar, top: '82%', right: '10%', path: 'M 860 480 C 930 480, 940 656, 1010 656' }
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithGoogle, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeBadge, setActiveBadge] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ 
        title: 'Campos vazios', 
        description: 'Por favor, preencha seu e-mail e senha.', 
        variant: 'destructive' 
      });
      return;
    }
    const result = await login(email, password);
    if (result.success) {
      toast({ 
        title: 'Que bom ter você aqui!', 
        description: `Login realizado com sucesso no seu painel.` 
      });
      navigate('/painel');
    } else {
      const message = result.error || 'E-mail ou senha incorretos.';
      setUnverifiedEmail(message.toLowerCase().includes('verifique seu e-mail') ? email : '');
      toast({ 
        title: 'Verifique seus dados', 
        description: message,
        variant: 'destructive' 
      });
    }
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
    <div className="min-h-screen relative overflow-hidden bg-[#FAF9F6] font-body flex items-center justify-center">
      
      {/* 1. Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.25]" 
        style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
      />
      
      {/* 2. Vibrant Orange Gradient Area at the bottom of the screen */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-[#F97316]/75 via-[#F97316]/30 to-transparent pointer-events-none" />

      {/* 3. Central responsive container containing both layout sides and the login card */}
      <div className="w-full max-w-7xl min-h-screen mx-auto relative flex items-center justify-center px-4 sm:px-6 lg:px-8">
        
        {/* SVG CONNECTIONS (Mindmap paths with high-res viewBox to avoid scaling distortion) */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block" 
          viewBox="0 0 1280 800" 
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="leftLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="rightLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <style>{`
            @keyframes dashflow {
              to {
                stroke-dashoffset: -40;
              }
            }
            .animated-path {
              stroke-dasharray: 6, 6;
              animation: dashflow 6s linear infinite;
            }
          `}</style>
          
          {/* Left lines */}
          {leftBadges.map((badge) => {
            const isHighlighted = activeBadge === `left-${badge.id}`;
            return (
              <path 
                key={`line-left-${badge.id}`} 
                d={badge.path} 
                fill="none" 
                stroke={isHighlighted ? '#F97316' : 'url(#leftLineGradient)'} 
                strokeWidth={isHighlighted ? '2.5' : '1.2'}
                opacity={isHighlighted ? '0.95' : '1'}
                className="animated-path transition-all duration-300"
              />
            );
          })}

          {/* Right lines */}
          {rightBadges.map((badge) => {
            const isHighlighted = activeBadge === `right-${badge.id}`;
            return (
              <path 
                key={`line-right-${badge.id}`} 
                d={badge.path} 
                fill="none" 
                stroke={isHighlighted ? '#F97316' : 'url(#rightLineGradient)'} 
                strokeWidth={isHighlighted ? '2.5' : '1.2'}
                opacity={isHighlighted ? '0.95' : '1'}
                className="animated-path transition-all duration-300"
              />
            );
          })}
        </svg>

        {/* LEFT FLOATING BADGES */}
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none hidden lg:block">
          {leftBadges.map((badge) => {
            const IconComponent = badge.icon;
            const isHovered = activeBadge === `left-${badge.id}`;
            return (
              <motion.div
                key={`badge-left-${badge.id}`}
                style={{ top: badge.top, left: badge.left }}
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 4 + badge.id,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                onMouseEnter={() => setActiveBadge(`left-${badge.id}`)}
                onMouseLeave={() => setActiveBadge(null)}
                className="absolute px-4 py-2.5 bg-white rounded-full border border-slate-100/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)] flex items-center gap-2.5 hover:shadow-[0_10px_25px_-5px_rgba(249,115,22,0.15)] hover:border-orange-200 hover:scale-[1.06] transition-all duration-300 pointer-events-auto cursor-pointer group"
              >
                <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
                  isHovered ? 'bg-[#F97316] text-white' : 'bg-orange-50 text-[#F97316]'
                } transition-colors duration-300`}>
                  <IconComponent size={11} className="stroke-[2.5]" />
                </div>
                <span className={`text-[11px] font-bold ${
                  isHovered ? 'text-[#F97316]' : 'text-slate-700'
                } tracking-tight transition-colors duration-300`}>{badge.text}</span>
              </motion.div>
            );
          })}
        </div>

        {/* RIGHT FLOATING BADGES */}
        <div className="absolute inset-y-0 right-0 w-full pointer-events-none hidden lg:block">
          {rightBadges.map((badge) => {
            const IconComponent = badge.icon;
            const isHovered = activeBadge === `right-${badge.id}`;
            return (
              <motion.div
                key={`badge-right-${badge.id}`}
                style={{ top: badge.top, right: badge.right }}
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 4 + badge.id,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                onMouseEnter={() => setActiveBadge(`right-${badge.id}`)}
                onMouseLeave={() => setActiveBadge(null)}
                className="absolute px-4 py-2.5 bg-white rounded-full border border-slate-100/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)] flex items-center gap-2.5 hover:shadow-[0_10px_25px_-5px_rgba(249,115,22,0.15)] hover:border-orange-200 hover:scale-[1.06] transition-all duration-300 pointer-events-auto cursor-pointer group"
              >
                <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
                  isHovered ? 'bg-[#F97316] text-white' : 'bg-orange-50 text-[#F97316]'
                } transition-colors duration-300`}>
                  <IconComponent size={11} className="stroke-[2.5]" />
                </div>
                <span className={`text-[11px] font-bold ${
                  isHovered ? 'text-[#F97316]' : 'text-slate-700'
                } tracking-tight transition-colors duration-300`}>{badge.text}</span>
              </motion.div>
            );
          })}
        </div>

        {/* CENTRAL LOGIN CARD */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-[0_30px_70px_-20px_rgba(120,40,0,0.08),0_0_0_1px_rgba(15,23,42,0.03)] border border-slate-100/60 p-8 sm:p-10 flex flex-col justify-center gap-6"
        >
          {/* Logo */}
          <div className="flex justify-center mb-1">
            <Link to="/" aria-label="Voltar para a página inicial" className="inline-flex opacity-95 hover:opacity-100 transition-opacity">
              <img
                src="/logo-site.png"
                alt="SellClin Logo"
                className="h-7 w-auto translate-y-0.5"
              />
            </Link>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-headline font-black text-slate-800 tracking-tight">
              Boas vindas ao <span className="text-[#F97316]">SellClin.</span>
            </h1>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed px-4">
              Preparamos seu espaço para que o dia de hoje seja produtivo, leve e cheio de resultados.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Google Sign-In Button */}
            <div className="flex justify-center w-full">
              <div className="relative w-full shadow-sm hover:shadow transition-shadow duration-300 rounded-full overflow-hidden border border-slate-200/80 bg-white">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (!credentialResponse.credential) {
                      toast({ 
                        title: 'Erro no login com Google', 
                        description: 'Não foi possível obter credencial.', 
                        variant: 'destructive' 
                      });
                      return;
                    }
                    const result = await loginWithGoogle(credentialResponse.credential);
                    if (result.success) {
                      toast({ 
                        title: 'Login com Google realizado!', 
                        description: 'Que bom ter você de volta!' 
                      });
                      navigate('/painel');
                    } else {
                      toast({ 
                        title: 'Erro no login com Google', 
                        description: result.error || 'Tente novamente.', 
                        variant: 'destructive' 
                      });
                    }
                  }}
                  onError={() => {
                    toast({ 
                      title: 'Erro no Google', 
                      description: 'Não foi possível conectar com o Google.', 
                      variant: 'destructive' 
                    });
                  }}
                  theme="outline"
                  size="large"
                  width="360"
                  text="continue_with"
                  shape="pill"
                  logo_alignment="left"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
              <div className="relative flex justify-center">
                <span className="px-4 text-[10px] font-black text-slate-400 bg-white uppercase tracking-[0.15em]">
                  ou acesse com e-mail
                </span>
              </div>
            </div>

            {/* Inputs Group */}
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[12px] font-bold text-slate-600 ml-1">E-mail de acesso</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F97316] transition-colors duration-300">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    id="email"
                    type="email" 
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-[50px] pl-11 pr-5 border border-slate-200 rounded-2xl text-[13px] font-medium text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#F97316]/5 focus:border-[#F97316] transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.01)]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label htmlFor="password" className="block text-[12px] font-bold text-slate-600">Senha de acesso</label>
                  <Link to="/esqueci-senha" className="text-[11px] text-slate-400 hover:text-[#F97316] font-bold transition-colors duration-300">Esqueceu a senha?</Link>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F97316] transition-colors duration-300">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input 
                    id="password"
                    type={showPassword ? "text" : "password"} 
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-[50px] pl-11 pr-12 border border-slate-200 rounded-2xl text-[13px] font-medium text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#F97316]/5 focus:border-[#F97316] transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.01)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#F97316] transition-colors duration-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full h-[50px] bg-[#F97316] hover:bg-orange-600 text-white rounded-2xl text-[14px] font-headline font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-85 disabled:cursor-not-allowed shadow-[0_8px_20px_-6px_rgba(249,115,22,0.3)] hover:shadow-[0_12px_24px_-6px_rgba(249,115,22,0.5)] transition-all duration-300 mt-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isLoading ? 'Acessando...' : 'Acessar painel'}
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

            {/* Terms Consent and Back Link */}
            <div className="space-y-4 pt-2">
              <p className="text-[11px] text-slate-400 text-center leading-relaxed font-medium px-2">
                Ao fazer login, você concorda com nossos{' '}
                <Link to="/termos-de-uso" className="underline text-slate-500 hover:text-[#F97316] transition-colors">
                  termos e condições
                </Link>
                .
              </p>
              
              <div className="text-center">
                <Link 
                  to="/" 
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#F97316] hover:-translate-x-1 transition-all duration-300"
                >
                  <span>← Voltar para a página inicial</span>
                </Link>
              </div>
            </div>

          </form>
        </motion.div>

      </div>
    </div>
  );
};

export default Login;
