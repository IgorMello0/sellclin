import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';

const roles = [
  {
    icon: BarChart3,
    title: 'Proprietário e gestor',
    description: 'Enxerga funil, metas, equipe e faturamento para decidir com dados da própria operação.',
  },
  {
    icon: MessageCircle,
    title: 'Recepção',
    description: 'Centraliza conversas, confirmações e agenda sem perder o histórico de cada paciente.',
  },
  {
    icon: Users,
    title: 'SDR',
    description: 'Recebe leads, organiza contatos e prepara as oportunidades para avançarem no funil.',
  },
  {
    icon: Target,
    title: 'Closer',
    description: 'Conduz propostas, retornos e negociações com todo o contexto do atendimento.',
  },
  {
    icon: CalendarDays,
    title: 'Especialista',
    description: 'Acompanha sua agenda, pacientes e compromissos ligados à rotina clínica.',
  },
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Conecta campanhas oficiais às respostas, aos leads e ao resultado comercial.',
  },
];

const journey = [
  { number: '01', title: 'O lead entra', text: 'Cadastros e oportunidades chegam ao funil com origem e responsável.' },
  { number: '02', title: 'A conversa acontece', text: 'A equipe atende pelo WhatsApp Oficial e acompanha a janela de 24 horas.' },
  { number: '03', title: 'A oportunidade avança', text: 'Tarefas, agenda, propostas e etapas mantêm o próximo passo visível.' },
  { number: '04', title: 'A gestão acompanha', text: 'Painéis e metas mostram o andamento da operação comercial.' },
];

const clinicProfiles = [
  {
    label: 'Organização',
    title: 'Clínica saindo das planilhas',
    text: 'Para quem precisa reunir leads, contatos, agenda e tarefas em um processo simples de acompanhar.',
  },
  {
    label: 'Operação comercial',
    title: 'Equipe com SDR e closer',
    text: 'Para distribuir responsabilidades, acompanhar negociações e manter cada oportunidade com um próximo passo.',
  },
  {
    label: 'Escala',
    title: 'Gestão de equipes e unidades',
    text: 'Para gestores que precisam de visão central, permissões por perfil e uma rotina comercial padronizada.',
  },
];

const ClientesPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body selection:bg-[#F97316]/20 overflow-x-hidden">
      <SiteNavbar />

      <main>
        <section className="relative pt-36 sm:pt-44 pb-20 sm:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(249,115,22,0.10),transparent_30%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 mb-7">
                  <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[#F97316]">Para quem é o SellClin</span>
                </div>
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-headline font-black tracking-tighter leading-[0.98] mb-7">
                  Uma operação para cada papel da <span className="text-[#F97316]">clínica.</span>
                </h1>
                <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mb-9">
                  Do primeiro contato ao fechamento, o SellClin conecta as pessoas, as conversas e os próximos passos em um único fluxo comercial.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/cadastro" className="inline-flex items-center justify-center gap-3 rounded-full bg-[#0F172A] px-7 py-4 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-[#F97316] transition-colors">
                    Começar agora <ArrowRight size={16} />
                  </Link>
                  <a href="#perfis" className="inline-flex items-center justify-center rounded-full border border-slate-200 px-7 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-600 hover:border-slate-300 hover:text-[#0F172A] transition-colors">
                    Ver os perfis
                  </a>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 28 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <div className="absolute -inset-8 bg-gradient-to-tr from-orange-100/80 to-blue-100/40 blur-3xl rounded-full" />
                <div className="relative rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-7 shadow-[0_35px_90px_-45px_rgba(15,23,42,0.45)]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Fluxo comercial</div>
                      <div className="text-base font-black mt-1">Todos trabalhando no mesmo processo</div>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck size={20} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: MessageCircle, title: 'Conversa oficial', detail: 'WhatsApp + histórico' },
                      { icon: GitBranch, title: 'Funil organizado', detail: 'Etapa + responsável' },
                      { icon: ClipboardCheck, title: 'Próximo passo', detail: 'Tarefa + agenda' },
                      { icon: BarChart3, title: 'Visão da gestão', detail: 'Metas + resultados' },
                    ].map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                          <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 text-[#F97316] flex items-center justify-center shrink-0">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-black">{item.title}</div>
                            <div className="text-[11px] font-medium text-slate-400 mt-0.5">{item.detail}</div>
                          </div>
                          <span className="text-[10px] font-black text-slate-300 tabular-nums">0{index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="perfis" className="py-20 sm:py-28 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="max-w-3xl mb-12 sm:mb-16">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F97316]">Perfis da equipe</span>
              <h2 className="text-3xl sm:text-5xl font-headline font-black tracking-tighter mt-4 mb-5">O contexto certo para cada função.</h2>
              <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed">
                Cada pessoa acessa o que precisa para executar seu trabalho, enquanto a gestão mantém a visão completa da operação.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {roles.map((role, index) => {
                const Icon = role.icon;
                return (
                  <motion.article
                    key={role.title}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.65, delay: index * 0.05 }}
                    className="rounded-[1.75rem] border border-slate-200/80 bg-white p-7 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.4)]"
                  >
                    <div className="h-11 w-11 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center mb-6">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-lg font-headline font-black mb-2">{role.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{role.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28 bg-[#0F172A] text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.14),transparent_34%)]" />
          <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Da entrada ao resultado</span>
              <h2 className="text-3xl sm:text-5xl font-headline font-black tracking-tighter mt-4 mb-5">Uma jornada contínua, sem pontos soltos.</h2>
              <p className="text-slate-400 font-medium leading-relaxed">O trabalho passa de uma pessoa para outra com histórico, responsável e próximo passo visíveis.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {journey.map((step) => (
                <div key={step.number} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                  <span className="text-[10px] font-black tracking-[0.25em] text-orange-400">{step.number}</span>
                  <h3 className="text-lg font-black mt-5 mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-20 items-start">
              <div className="lg:sticky lg:top-32">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F97316]">Momentos da clínica</span>
                <h2 className="text-3xl sm:text-5xl font-headline font-black tracking-tighter mt-4 mb-5">Cresça sobre um processo que a equipe entende.</h2>
                <p className="text-slate-500 font-medium leading-relaxed">O SellClin acompanha operações em diferentes níveis de maturidade comercial.</p>
              </div>
              <div className="space-y-4">
                {clinicProfiles.map((profile, index) => (
                  <div key={profile.title} className="rounded-[1.75rem] border border-slate-200 p-6 sm:p-8 flex gap-5 sm:gap-7">
                    <div className="h-9 w-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-black shrink-0">{index + 1}</div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#F97316]">{profile.label}</span>
                      <h3 className="text-xl font-headline font-black mt-2 mb-2">{profile.title}</h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">{profile.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pb-24 sm:pb-32 bg-white">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="rounded-[2.5rem] bg-[#F97316] p-8 sm:p-14 lg:p-16 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22),transparent_58%)]" />
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-orange-100 mb-5">
                  <CheckCircle2 size={15} /> Operação comercial conectada
                </div>
                <h2 className="text-3xl sm:text-5xl font-headline font-black tracking-tighter mb-5">Veja como o SellClin se encaixa na rotina da sua equipe.</h2>
                <p className="text-orange-50 font-medium leading-relaxed mb-8 max-w-2xl">Comece com os módulos do seu plano e organize o processo comercial da clínica em um só lugar.</p>
                <Link to="/cadastro" className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#0F172A] hover:scale-[1.02] transition-transform">
                  Conhecer os planos <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ClientesPage;
