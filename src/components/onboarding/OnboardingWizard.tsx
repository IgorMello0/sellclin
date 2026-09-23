import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Users,
  TrendingUp,
  MapPin,
  Megaphone,
  Target,
  Sparkles,
} from 'lucide-react';

/* â”€â”€â”€ Step indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const StepDot = ({ active, done }: { active: boolean; done: boolean }) => (
  <div
    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
      done ? 'bg-secondary scale-100' : active ? 'bg-white scale-125 shadow-[0_0_0_3px_rgba(255,255,255,0.3)]' : 'bg-white/30'
    }`}
  />
);

/* â”€â”€â”€ Shared label style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

/* â”€â”€â”€ Field wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className={labelCls}>{label}</label>
    {children}
  </div>
);

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export const OnboardingWizard = () => {
  const { professional, completeOnboarding } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState(professional?.company?.name || '');
  const [faturamento, setFaturamento] = useState('');
  const [funcionarios, setFuncionarios] = useState('');
  const [clinicas, setClinicas] = useState('');
  const [canalAquisicao, setCanalAquisicao] = useState('');
  const [objetivoCrm, setObjetivoCrm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = professional?.role === 'profissional' || professional?.role === 'admin';
  const totalSteps = isOwner ? 3 : 1;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      await completeOnboarding({
        ...(isOwner
          ? {
              companyName,
              faturamentoMensal: faturamento,
              quantidadeFuncionarios: funcionarios,
              quantidadeClinicas: clinicas,
              canalAquisicao,
              objetivoCrm,
            }
          : {}),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* â”€â”€â”€ Left-panel meta per step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const sideMeta: Record<number, { icon: React.ReactNode; title: string; desc: string }> = {
    1: {
      icon: <Building2 className="w-10 h-10" />,
      title: 'Sua ClÃ­nica',
      desc: 'Configure a identidade do seu negÃ³cio para personalizar toda a sua experiÃªncia.',
    },
    2: {
      icon: <TrendingUp className="w-10 h-10" />,
      title: 'Sobre o NegÃ³cio',
      desc: 'Entender o seu contexto nos ajuda a sugerir as melhores configuraÃ§Ãµes do CRM.',
    },
    3: {
      icon: <Sparkles className="w-10 h-10" />,
      title: 'Tudo Pronto!',
      desc: 'Seu ambiente estÃ¡ configurado e pronto para uso.',
    },
  };

  const effectiveStep = isOwner ? step : 3;
  const sideKey = effectiveStep;
  const meta = sideMeta[sideKey] ?? sideMeta[1];

  /* â”€â”€â”€ Step content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const renderStep = () => {
    /* STEP 1 â€” Nome da ClÃ­nica (owners only) */
    if (effectiveStep === 1) {
      return (
        <motion.div
          key="s1"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm space-y-6"
        >
          <div>
            <h2 className="text-2xl font-bold text-foreground font-headline mb-1">
              Bem-vindo(a) ao SellClin!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vamos comeÃ§ar pelo essencial â€” qual Ã© o nome da sua clÃ­nica ou empresa?
            </p>
          </div>

          <div>
            <label htmlFor="company-name" className={labelCls}>
              Nome da ClÃ­nica / Empresa
            </label>
            <input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: ClÃ­nica Sorriso"
              className={
                'w-full h-12 rounded-xl border border-border bg-background px-4 text-sm text-foreground ' +
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/60 ' +
                'focus:border-accent transition-colors'
              }
            />
          </div>
        </motion.div>
      );
    }

    /* STEP 2 â€” Dados do NegÃ³cio (owners only) */
    if (effectiveStep === 2 && isOwner) {
      return (
        <motion.div
          key="s2"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-lg space-y-6"
        >
          <div>
            <h2 className="text-2xl font-bold text-foreground font-headline mb-1">
              Sobre o seu NegÃ³cio
            </h2>
            <p className="text-sm text-muted-foreground">
              Essas informaÃ§Ãµes nos ajudam a personalizar sua experiÃªncia no CRM.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MÃ©dia de Faturamento">
              <CustomSelect
                value={faturamento}
                onChange={setFaturamento}
                icon={<TrendingUp className="w-4 h-4" />}
                options={[
                  { value: 'AtÃ© 10k', label: 'AtÃ© R$ 10.000' },
                  { value: '10k a 50k', label: 'R$ 10k a R$ 50k' },
                  { value: '50k a 100k', label: 'R$ 50k a R$ 100k' },
                  { value: '100k a 500k', label: 'R$ 100k a R$ 500k' },
                  { value: 'Acima de 500k', label: 'Acima de R$ 500k' },
                ]}
              />
            </Field>

            <Field label="Quantidade de FuncionÃ¡rios">
              <CustomSelect
                value={funcionarios}
                onChange={setFuncionarios}
                icon={<Users className="w-4 h-4" />}
                options={[
                  { value: '1-5', label: '1 a 5' },
                  { value: '6-15', label: '6 a 15' },
                  { value: '16-50', label: '16 a 50' },
                  { value: 'Mais de 50', label: 'Mais de 50' },
                ]}
              />
            </Field>

            <Field label="ClÃ­nicas / Unidades">
              <CustomSelect
                value={clinicas}
                onChange={setClinicas}
                icon={<MapPin className="w-4 h-4" />}
                options={[
                  { value: '1', label: '1 unidade' },
                  { value: '2-3', label: '2 a 3' },
                  { value: '4+', label: '4 ou mais' },
                ]}
              />
            </Field>

            <Field label="Principal Objetivo">
              <CustomSelect
                value={objetivoCrm}
                onChange={setObjetivoCrm}
                icon={<Target className="w-4 h-4" />}
                options={[
                  { value: 'Aumentar Vendas', label: 'Aumentar Vendas' },
                  { value: 'Organizar Processos', label: 'Organizar Processos' },
                  { value: 'Analisar MÃ©tricas', label: 'Analisar MÃ©tricas' },
                  { value: 'Centralizar Atendimento', label: 'Centralizar Atendimento' },
                ]}
              />
            </Field>

            <Field label="Por onde nos conheceu?">
              <div className="sm:col-span-2">
                <CustomSelect
                  value={canalAquisicao}
                  onChange={setCanalAquisicao}
                  icon={<Megaphone className="w-4 h-4" />}
                  options={[
                    { value: 'Instagram', label: 'Instagram' },
                    { value: 'Google', label: 'Google' },
                    { value: 'Youtube', label: 'YouTube' },
                    { value: 'IndicaÃ§Ã£o', label: 'IndicaÃ§Ã£o de um amigo' },
                    { value: 'Outro', label: 'Outro' },
                  ]}
                />
              </div>
            </Field>
          </div>
        </motion.div>
      );
    }

    /* STEP 3 - Conclusao */
    /* STEP 4 â€” ConclusÃ£o */
    if (effectiveStep === 3) {
      return (
        <motion.div
          key="s4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm space-y-6 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-secondary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground font-headline mb-1">Tudo pronto! ðŸŽ‰</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu ambiente estÃ¡ configurado com sucesso e pronto para uso.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-2 w-full">
              {[
                'Dashboard de vendas e mÃ©tricas',
                'Funil de leads e pipeline',
                'Agenda e agendamentos',
                'RelatÃ³rios e metas',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }
  };

  /* â”€â”€â”€ Progress calc â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* â”€â”€ Left side panel (navy) â”€â”€ */}
      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="hidden lg:flex w-80 xl:w-96 flex-col justify-between bg-primary text-primary-foreground p-10 relative overflow-hidden"
      >
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Glow blobs */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-16 -left-16 w-72 h-72 bg-secondary rounded-full blur-3xl"
        />
        <div className="absolute -bottom-10 right-0 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <img src="/logo-oficial-v3.png" alt="SellClin" className="h-8 object-contain brightness-0 invert" />
        </div>

        {/* Icon + title + desc (animated) */}
        <div className="relative z-10 flex-1 flex flex-col justify-center gap-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`meta-${step}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 bg-white/10 ring-1 ring-white/20 rounded-2xl flex items-center justify-center shadow-lg shadow-black/20">
                {meta.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold font-headline">{meta.title}</h3>
                <p className="text-sm text-primary-foreground/70 mt-1 leading-relaxed">{meta.desc}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Step dots */}
          <div className="flex items-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <StepDot key={i} active={step === i + 1} done={step > i + 1} />
            ))}
            <span className="ml-2 text-xs text-primary-foreground/50">
              {step}/{totalSteps}
            </span>
          </div>

          {/* Social proof card */}
          <div className="mt-6 p-4 bg-white/8 ring-1 ring-white/10 rounded-2xl space-y-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['bg-orange-400','bg-blue-400','bg-green-400'].map((c,i) => (
                  <div key={i} className={`w-6 h-6 rounded-full ${c} ring-2 ring-primary`} />
                ))}
              </div>
              <span className="text-xs font-semibold text-primary-foreground/80">+240 clÃ­nicas ativas</span>
            </div>
            <p className="text-xs text-primary-foreground/60 leading-relaxed italic">
              "O SellClin transformou nossa gestÃ£o de pacientes e duplicou nossas conversÃµes."
            </p>
            <p className="text-xs text-secondary font-semibold">â€” ClÃ­nica Dr. Alves, SP</p>
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-primary-foreground/40">
          Â© 2026 SellClin. Todos os direitos reservados.
        </p>
      </motion.aside>

      {/* â”€â”€ Right side (form) â”€â”€ */}
      <div
        className="flex-1 flex flex-col bg-background overflow-y-auto relative"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(214 32% 91%) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        {/* Top bar: progress + step badge */}
        <div className="relative z-10">
          <div className="w-full h-1 bg-muted">
            <motion.div
              className="h-full bg-gradient-to-r from-secondary to-orange-400"
              initial={{ width: `${((step - 1) / totalSteps) * 100}%` }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
          <div className="flex items-center justify-between px-8 pt-4 pb-1">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2">
              <img src="/logo-oficial-v3.png" alt="SellClin" className="h-7 object-contain" />
            </div>
            <div className="hidden lg:block" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-bold ring-1 ring-primary/15">
              <span className="w-4 h-4 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center">{step}</span>
              Passo {step} de {totalSteps}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center items-center px-8 py-10 relative z-10">
          <div className="w-full max-w-lg mx-auto">
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="pb-8 flex items-center gap-3 justify-center relative z-10">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 h-11 px-5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting || (isOwner && step === 1 && !companyName.trim())}
            className={
              'inline-flex items-center gap-2 h-11 px-8 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-primary/25 ' +
              'bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98] ' +
              'disabled:opacity-50 disabled:pointer-events-none'
            }
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                {step === totalSteps ? 'Iniciar Tour ðŸš€' : 'PrÃ³ximo'}
                {step !== totalSteps && <ChevronRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
