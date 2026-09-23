import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { billingApi, type BillingCycle, type PublicPlanCode } from '@/lib/api';
import {
  ArrowRight,
  BarChart,
  Briefcase,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';

const PLAN_OPTIONS: Array<{
  code: PublicPlanCode;
  name: string;
  monthly: number;
  yearly: number;
  description: string;
}> = [
  {
    code: 'start',
    name: 'Start',
    monthly: 197,
    yearly: 1970,
    description: 'Para clínicas iniciando a operação comercial.',
  },
  {
    code: 'pro',
    name: 'Pro',
    monthly: 297,
    yearly: 2970,
    description: 'Para clínicas que querem escala e automação.',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    monthly: 497,
    yearly: 4970,
    description: 'Para redes, multiclínicas e operações avançadas.',
  },
];

const TESTIMONIALS = [
  { text: "O SellClin mudou o jogo da nossa clínica. Centralizamos todos os leads e finalmente temos controle total do que entra e do que converte.", author: "Dr. Ricardo Santos", clinic: "Clínica OrthoDesign", img: "https://i.pravatar.cc/150?u=dr1" },
  { text: "Finalmente tenho controle total dos meus leads de WhatsApp. Não perdemos mais nenhuma oportunidade de agendamento.", author: "Mariana Costa", clinic: "Aesthetic Center", img: "https://i.pravatar.cc/150?u=dr2" },
  { text: "A agenda inteligente é fantástica. Reduzimos o no-show em 30% usando as automações e integrações de calendário.", author: "Dr. Paulo Vieira", clinic: "Vision Institute", img: "https://i.pravatar.cc/150?u=dr3" },
];

const Signup = () => {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan');
  const initialPlan: PublicPlanCode = requestedPlan === 'start' || requestedPlan === 'enterprise' ? requestedPlan : 'pro';
  const initialBillingCycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PublicPlanCode>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.specialization || !formData.password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Senha fraca',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await billingApi.createSignupCheckout({
        ...formData,
        planCode: selectedPlan,
        billingCycle,
      });

      if (result.success && result.data?.checkoutUrl) {
        window.location.href = result.data.checkoutUrl;
        return;
      }

      toast({
        title: 'Erro ao abrir checkout',
        description: result.error?.message || 'Não foi possível iniciar o pagamento. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePlan = PLAN_OPTIONS.find((plan) => plan.code === selectedPlan) || PLAN_OPTIONS[1];
  const activePrice = billingCycle === 'yearly' ? activePlan.yearly : activePlan.monthly;

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body selection:bg-[#F97316]/20 overflow-x-hidden relative flex flex-col justify-between">
      <div className="absolute left-8 lg:left-[calc(50%-640px+32px)] top-0 w-[1px] h-full bg-slate-100 z-0 hidden md:block" />

      <div className="relative z-50">
        <SiteNavbar />
      </div>

      <section className="relative flex-grow flex items-center pt-24 lg:pt-28 pb-16 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
            <div className="lg:col-span-6 space-y-8 py-4">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100/50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F97316] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F97316]" />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">Onboarding ativo</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-[56px] font-headline font-black text-[#0F172A] leading-[1] tracking-tighter max-w-xl">
                  Sua clínica no próximo <br />
                  <span className="shimmer-text">nível comercial.</span>
                </h1>
                <p className="text-lg text-[#64748B] font-medium leading-relaxed max-w-md">
                  Escolha o plano, ative seu teste com cartão e receba uma operação comercial pronta para captar, vender e acompanhar pacientes.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-12 border-l-2 border-slate-100 pl-8">
                {[
                  { icon: <BarChart size={18} />, t: 'Performance', d: 'Aceleração real de vendas.' },
                  { icon: <ShieldCheck size={18} />, t: 'Dados protegidos', d: 'Segurança para operação clínica.' },
                ].map((item) => (
                  <div key={item.t} className="flex flex-col gap-2">
                    <div className="text-[#F97316]">{item.icon}</div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#0F172A]">{item.t}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5">{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 mt-8 border-t border-slate-100/60 max-w-md">
                <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 relative mb-8 min-h-[160px] overflow-hidden">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#F97316] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 z-20">
                     <span className="font-serif text-2xl leading-none pt-2">"</span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTestimonial}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="relative z-10"
                    >
                      <p className="text-sm text-slate-600 font-medium leading-italic mb-4">
                        "{TESTIMONIALS[activeTestimonial].text}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                           <img src={TESTIMONIALS[activeTestimonial].img} alt={TESTIMONIALS[activeTestimonial].author} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-[#0F172A]">{TESTIMONIALS[activeTestimonial].author}</div>
                          <div className="text-[9px] font-bold text-[#F97316] uppercase tracking-wider">{TESTIMONIALS[activeTestimonial].clinic}</div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Testimonial Indicators */}
                  <div className="absolute bottom-4 right-6 flex gap-1.5 z-20">
                    {TESTIMONIALS.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === activeTestimonial ? 'w-4 bg-[#F97316]' : 'w-1.5 bg-slate-300'}`} 
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    "Liberação imediata do sistema após pagamento",
                    "Acesso completo aos módulos do seu plano",
                    "Cancele a qualquer momento sem burocracia"
                  ].map((text, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-emerald-500" strokeWidth={4} />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-lg">
                <div className="absolute -inset-10 bg-gradient-to-tr from-[#F97316]/10 to-blue-500/5 blur-[100px] opacity-40 pointer-events-none" />

                <div className="relative bg-white p-3 rounded-[3rem] border border-slate-100 shadow-[0_50px_100px_-20px_rgba(15,23,42,0.15)] w-full">
                  <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 space-y-6">
                    <div className="space-y-1">
                      <h2 className="text-xl sm:text-2xl font-black font-headline tracking-tight text-[#0F172A]">
                        Escolha seu plano e ative seu teste
                      </h2>
                      <p className="text-xs text-slate-400 font-medium">
                        Sua conta será criada após a confirmação segura pelo AbacatePay.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Plano</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PLAN_OPTIONS.map((plan) => {
                            const isActive = selectedPlan === plan.code;
                            return (
                              <button
                                key={plan.code}
                                type="button"
                                onClick={() => setSelectedPlan(plan.code)}
                                className={`text-left rounded-2xl border p-4 transition-all ${
                                  isActive
                                    ? 'border-[#F97316] bg-orange-50 shadow-sm shadow-orange-100'
                                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                                }`}
                              >
                                <span className="block text-sm font-black text-slate-900">{plan.name}</span>
                                <span className="block mt-1 text-[11px] leading-relaxed text-slate-500">{plan.description}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-50 border border-slate-200 p-1">
                        <button
                          type="button"
                          onClick={() => setBillingCycle('monthly')}
                          className={`rounded-xl px-4 py-3 text-xs font-black transition-all ${
                            billingCycle === 'monthly'
                              ? 'bg-white text-slate-950 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Mensal
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingCycle('yearly')}
                          className={`rounded-xl px-4 py-3 text-xs font-black transition-all ${
                            billingCycle === 'yearly'
                              ? 'bg-white text-slate-950 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Anual
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">
                            {activePlan.name} {billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                          </div>
                          <div className="text-xs text-slate-500">Teste com cartão pelo AbacatePay</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-slate-950">
                            R$ {activePrice.toLocaleString('pt-BR')}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            {billingCycle === 'yearly' ? 'por ano' : 'por mês'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Nome completo</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            placeholder="Dr. João Silva"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none text-slate-800 placeholder-slate-400 focus:border-[#F97316] focus:bg-white transition-all duration-200 font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">E-mail corporativo</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            placeholder="clinica@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none text-slate-800 placeholder-slate-400 focus:border-[#F97316] focus:bg-white transition-all duration-200 font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              id="phone"
                              name="phone"
                              type="tel"
                              required
                              placeholder="(11) 99999-9999"
                              value={formData.phone}
                              onChange={handleChange}
                              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none text-slate-800 placeholder-slate-400 focus:border-[#F97316] focus:bg-white transition-all duration-200 font-medium"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Especialidade</label>
                          <div className="relative">
                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              id="specialization"
                              name="specialization"
                              type="text"
                              required
                              placeholder="Dermatologia..."
                              value={formData.specialization}
                              onChange={handleChange}
                              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none text-slate-800 placeholder-slate-400 focus:border-[#F97316] focus:bg-white transition-all duration-200 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Senha de acesso</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full h-[50px] pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none text-slate-800 placeholder-slate-400 focus:border-[#F97316] focus:bg-white transition-all duration-200 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-[#F97316] text-white px-10 py-4 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-orange-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2 cursor-pointer w-full mt-6"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isSubmitting ? 'Abrindo checkout...' : 'Ativar teste com cartão'} <ArrowRight size={14} />
                      </button>
                    </form>

                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold gap-3 text-slate-400">
                      <div>
                        Já é cliente?{' '}
                        <Link to="/entrar" className="text-[#F97316] hover:underline font-bold transition-colors">
                          Fazer login
                        </Link>
                      </div>
                      <Link to="/" className="inline-flex items-center gap-1.5 hover:text-slate-700 transition-colors group">
                        Voltar ao site principal <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Signup;
