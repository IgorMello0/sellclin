import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteFooter } from '@/components/SiteFooter';
import { billingApi, type BillingCycle } from '@/lib/api';
import { 
  Check, ArrowRight, ShieldCheck, Zap, Sparkles, 
  Lock, CreditCard, Award, HeartHandshake, CheckCircle2, ChevronRight,
  Instagram, MessageCircle
} from 'lucide-react';

const SelectPlan = () => {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan');
  const initialPlan: 'pro' | 'start' | 'enterprise' =
    requestedPlan === 'start' || requestedPlan === 'enterprise' ? requestedPlan : 'pro';
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'start' | 'enterprise'>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly'
  );
  const [isActivating, setIsActivating] = useState(false);
  const [activationStep, setActivationStep] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const activationTexts = [
    "Autenticando credenciais da clínica...",
    "Instanciando banco de dados comercial dedicado...",
    "Ativando infraestrutura de leads & Kanban...",
    "Conectando central de inteligência e agendas...",
    "Tudo pronto! Preparando seu painel de faturamento..."
  ];

  useEffect(() => {
    if (isActivating) {
      if (selectedPlan === 'enterprise') {
        const interval = setInterval(() => {
          setActivationStep(prev => {
            if (prev >= 2) {
              clearInterval(interval);
              setTimeout(() => {
                toast({
                  title: '📞 Solicitação de contato registrada!',
                  description: 'Seu gestor de contas VIP entrará em contato em minutos.',
                });
                navigate('/painel');
              }, 800);
              return prev;
            }
            return prev + 1;
          });
        }, 900);
        return () => clearInterval(interval);
      } else {
        const interval = setInterval(() => {
          setActivationStep(prev => {
            if (prev >= activationTexts.length - 1) {
              clearInterval(interval);
              setTimeout(() => {
                toast({
                  title: '⚡ CRM Ativado com sucesso!',
                  description: 'Seja bem-vindo à sua nova infraestrutura comercial.',
                });
                navigate('/painel');
              }, 800);
              return prev;
            }
            return prev + 1;
          });
        }, 900);
        return () => clearInterval(interval);
      }
    }
  }, [isActivating]);

  const handleActivate = async () => {
    if (!localStorage.getItem('token')) {
      navigate(`/cadastro?plan=${selectedPlan}&cycle=${billingCycle}`);
      return;
    }

      const response = await billingApi.createCheckout(selectedPlan, billingCycle);
      if (!response.success) {
        toast({
          title: 'Não foi possível selecionar o plano',
          description: response.error?.message || 'Tente novamente em instantes.',
          variant: 'destructive',
        });
        return;
      }

      if (response.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
        return;
      }

      toast({
        title: 'Checkout indisponÃ­vel',
        description: 'A AbacatePay nÃ£o retornou o link de pagamento.',
        variant: 'destructive',
      });
      return;
  };

  const plans = [
    {
      id: 'start',
      name: "Plano Start",
      badge: "Início de Escala",
      monthly: 197,
      yearly: 1970,
      desc: "Ideal para consultórios individuais e clínicas em início de escala comercial.",
      features: [
        "Até 5 usuários ativos",
        "Gestão avançada de Leads",
        "Funil de Vendas Kanban",
        "Agenda Inteligente",
        "Suporte Individual",
        "Relatórios de performance básicos"
      ],
      glow: "hover:shadow-[0_20px_50px_rgba(100,116,139,0.08)]",
      borderColor: "border-slate-200/80",
      cta: "Ativar Licença Start"
    },
    {
      id: 'pro',
      name: "Plano Pro",
      badge: "Mais Popular & Recomendado",
      monthly: 297,
      yearly: 2970,
      desc: "O plano definitivo para clínicas que buscam crescimento agressivo.",
      features: [
        "Até 10 usuários por clínica",
        "Integração oficial de WhatsApp AI",
        "Múltiplos Funis de vendas",
        "Engenharia de Metas Reversas",
        "Dashboard de Performance em tempo real",
        "Treinamento VIP de Equipe",
        "Relatórios Customizados e avançados"
      ],
      glow: "shadow-[0_30px_70px_-15px_rgba(249,115,22,0.18)] hover:shadow-[0_30px_70px_-10px_rgba(249,115,22,0.25)]",
      borderColor: "border-[#F97316] ring-2 ring-[#F97316]/10",
      cta: "Ativar Licença Pro"
    },
    {
      id: 'enterprise',
      name: "Plano Enterprise",
      badge: "Redes e Multiclínicas",
      monthly: 497,
      yearly: 4970,
      desc: "Soluções personalizadas para redes de clínicas e operações de alta escala.",
      features: [
        "Módulos Multiclínicas integrados",
        "API Dedicada de integração",
        "Gestor de Contas Exclusivo VIP",
        "SLA de Suporte prioritário",
        "Backup em tempo real blindado",
        "White-label parcial da plataforma"
      ],
      glow: "hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]",
      borderColor: "border-slate-800",
      cta: "Ativar Licença Enterprise"
    }
  ];

  const selectedPlanData = plans.find((plan) => plan.id === selectedPlan);
  const selectedPrice = selectedPlanData
    ? billingCycle === 'yearly'
      ? selectedPlanData.yearly
      : selectedPlanData.monthly
    : null;
  const cycleLabel = billingCycle === 'yearly' ? 'Anual' : 'Mensal';
  const cycleSuffix = billingCycle === 'yearly' ? '/ano' : '/mês';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] font-body selection:bg-[#F97316]/20 relative overflow-x-hidden flex flex-col justify-between">
      
      {/* Immersive Cinematic Background Gradients & Grids */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Technical Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        {/* Soft Colorful Orbs for filling visual space */}
        <div className="absolute top-[-10%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-tr from-[#F97316]/12 to-transparent rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/6 rounded-full blur-[180px]" />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-orange-400/4 rounded-full blur-[140px]" />

        {/* Vertical Editorial Layout Lines */}
        <div className="absolute left-8 lg:left-[calc(50%-640px+32px)] top-0 w-[1px] h-full bg-slate-200/40 hidden md:block" />
        <div className="absolute right-8 lg:right-[calc(50%-640px+32px)] top-0 w-[1px] h-full bg-slate-200/40 hidden md:block" />
      </div>

      {/* High-End Header */}
      <header className="relative z-10 py-8 px-8 border-b border-slate-200/40 bg-white/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/painel" aria-label="Voltar ao dashboard" className="inline-flex items-center transition-opacity hover:opacity-80">
            <img src="/logo-site.png" alt="SellClin" className="h-7 w-auto translate-y-0.5" />
          </Link>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200/50 shadow-sm">
            <Lock className="text-emerald-500 w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Checkout Criptografado SSL</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-grow py-16 px-6 sm:px-8 max-w-7xl mx-auto w-full flex flex-col justify-center space-y-16">
        
        {/* Title and Step Progress Indicator */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          {/* Subtle Stepper Badge bar */}
          <div className="flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Passo 1: Conta Criada</span>
            <ChevronRight size={10} />
            <span className="text-[#F97316] bg-orange-50 border border-orange-100/50 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles size={10} className="animate-spin" /> Passo 2: Seleção de Licença
            </span>
            <ChevronRight size={10} />
            <span>Passo 3: Acesso ao CRM</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-black tracking-tighter text-[#0F172A] leading-[1.05]">
            Ative a infraestrutura comercial <br />
            <span className="shimmer-text">da sua clínica.</span>
          </h1>
          <p className="text-slate-500 text-sm sm:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Selecione a capacidade de faturamento ideal para o momento da sua clínica. Você pode fazer o upgrade de licença a qualquer momento.
          </p>

          <div className="mx-auto grid w-full max-w-sm grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#0F172A] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-[#0F172A] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Anual
            </button>
          </div>

          {billingCycle === 'yearly' && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
              Plano anual com 2 meses de economia
            </p>
          )}
        </div>

        {/* Breathtaking 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch w-full relative z-10">
          {plans.map((p) => {
            const isSelected = selectedPlan === p.id;
            const isPro = p.id === 'pro';

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p.id as 'pro' | 'start' | 'enterprise')}
                className={`group bg-white/80 backdrop-blur-md border rounded-[2.5rem] p-8 sm:p-10 transition-all duration-500 flex flex-col justify-between cursor-pointer relative select-none ${
                  isSelected 
                    ? `${p.borderColor} ${p.glow} scale-[1.03]` 
                    : 'border-slate-200/80 hover:border-slate-300 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.04)] hover:shadow-xl hover:scale-[1.01]'
                }`}
              >
                {/* Visual Checkmark Bubble top-right */}
                <div className={`absolute top-6 right-6 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
                  isSelected 
                    ? 'bg-[#F97316] border-[#F97316] text-white scale-110 shadow-lg shadow-orange-300' 
                    : 'border-slate-200 text-transparent'
                }`}>
                  <Check size={11} strokeWidth={4} />
                </div>

                <div className="space-y-6">
                  {/* Glowing header tag */}
                  <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-colors duration-300 ${
                    isSelected 
                      ? 'bg-[#F97316]/10 text-[#F97316]' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {p.badge}
                  </span>

                  {/* Name and desc */}
                  <div>
                    <h3 className="text-2xl font-headline font-black text-[#0F172A]">{p.name}</h3>
                    <p className="text-slate-400 text-xs mt-2 font-medium leading-relaxed">{p.desc}</p>
                  </div>

                  {/* Big price display */}
                  <div className="flex items-baseline gap-1 pt-2">
                    {p.monthly !== null ? (
                      <>
                        <span className="text-sm font-bold text-slate-400">R$</span>
                        <span className="text-5xl font-black text-[#0F172A] tracking-tighter tabular-nums">
                          {(billingCycle === 'yearly' ? p.yearly : p.monthly)?.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{cycleSuffix}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-black text-[#0F172A] tracking-tight py-1">Sob Consulta</span>
                    )}
                  </div>

                  {/* Features listing */}
                  <div className="space-y-3.5 pt-6 border-t border-slate-100">
                    {p.features.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          isSelected ? 'bg-orange-50 text-[#F97316]' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <Check size={10} strokeWidth={4} />
                        </div>
                        <span className="text-xs text-slate-600 font-semibold leading-tight">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulated key license graphic at the bottom of card */}
                <div className="pt-8 mt-8 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Award size={14} className={isSelected ? 'text-[#F97316]' : 'text-slate-400'} />
                    <span>Licença Ativa</span>
                  </div>
                  {p.monthly !== null && <span className="text-emerald-600">Instalação Grátis</span>}
                </div>

              </div>
            );
          })}
        </div>

        {/* Secure Checkout Interactive Summary Box */}
        <div className="max-w-2xl mx-auto w-full">
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-[2.5rem] p-6 sm:p-10 space-y-6 shadow-xl shadow-slate-100/50 relative overflow-hidden">
            
            {/* Soft Amber Glow inside */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#F97316]/5 rounded-full blur-xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500">
              <span>Resumo da Configuração Comercial</span>
              <span className="text-[#F97316] flex items-center gap-1.5">
                <ShieldCheck size={14} /> Ativação Comercial Segura
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div className="space-y-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Licença Selecionada</span>
                <span className="text-[#0F172A] font-black">
                  {plans.find(p => p.id === selectedPlan)?.name}
                  {` ${cycleLabel}`}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Setup Clínico</span>
                <span className="text-emerald-600 font-black">Isento (R$ 0,00)</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Valor da Licença</span>
                <span className="text-[#0F172A] font-black">
                  {selectedPrice === null ? 'Sob Consulta' : `R$ ${selectedPrice.toLocaleString('pt-BR')},00${cycleSuffix}`}
                </span>
              </div>
            </div>

            {/* Solid Massive Activation Button */}
            <div className="pt-4 space-y-4">
              <button
                onClick={handleActivate}
                className="w-full py-5 bg-[#0F172A] hover:bg-[#F97316] text-white rounded-full font-black text-xs uppercase tracking-[0.25em] shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer duration-300 border-none"
              >
                {plans.find(p => p.id === selectedPlan)?.cta} <ArrowRight size={13} />
              </button>

              {/* Guarantees bar */}
              <div className="flex items-center justify-center gap-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Sem Fidelidade Obrigatória</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-500" />
                  <span>Nota Fiscal Eletrônica</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* FOOTER — COMPREHENSIVE EDITORIAL */}
      <SiteFooter />

      {/* FULLSCREEN ACTIVATION LOADER OVERLAY */}
      <AnimatePresence>
        {isActivating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0F172A] z-[9999] flex flex-col items-center justify-center p-6 text-white text-center"
          >
            {/* Ambient Background Glowing Orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-tr from-[#F97316]/20 to-blue-500/10 blur-[120px] pointer-events-none" />

            <div className="relative z-10 space-y-8 max-w-md">
              {/* Rotating Loader Widget */}
              <div className="relative flex justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#F97316] animate-spin" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white">
                  <Zap size={20} className="animate-pulse text-[#F97316]" />
                </div>
              </div>

              {/* Status Texts with AnimatePresence */}
              <div className="h-16 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activationStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2"
                  >
                    {selectedPlan === 'enterprise' ? (
                      <>
                        <p className="text-xs font-black uppercase text-[#F97316] tracking-[0.3em]">
                          Solicitação VIP
                        </p>
                        <h3 className="text-lg font-headline font-black tracking-tight leading-snug">
                          {activationStep === 0 ? "Registrando solicitação corporativa..." : activationStep === 1 ? "Notificando time comercial de grandes contas..." : "Pronto! Direcionando para o painel..."}
                        </h3>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-black uppercase text-[#F97316] tracking-[0.3em]">
                          Etapa {activationStep + 1} de {activationTexts.length}
                        </p>
                        <h3 className="text-lg font-headline font-black tracking-tight leading-snug">
                          {activationTexts[activationStep]}
                        </h3>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Safe medical disclaimer */}
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase pt-8">
                Por favor, não feche esta tela. Estamos blindando e estruturando seu painel comercial.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default SelectPlan;
