import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Instagram, MessageCircle,
  BarChart2, Users, TrendingUp, Filter, Eye, Layers,
  CheckCircle, Star, ChevronDown, Calendar, Target
} from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';

const FunilPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    { icon: <Eye className="w-6 h-6" />, title: "Visão Total do Pipeline", desc: "Veja onde cada lead está na jornada. Nada se perde, nada fica esquecido." },
    { icon: <Layers className="w-6 h-6" />, title: "Múltiplos Funis", desc: "Crie um funil de captação e outro de recuperação. Cada fluxo, no seu lugar certo." },
    { icon: <Filter className="w-6 h-6" />, title: "Filtros por Responsável", desc: "Veja só os leads do seu time. Distribua e acompanhe sem perder o fio da meada." },
    { icon: <TrendingUp className="w-6 h-6" />, title: "Rastreio de Velocidade", desc: "Saiba quantos dias um lead fica em cada etapa antes de avançar ou desistir." },
    { icon: <Users className="w-6 h-6" />, title: "Cards com Histórico Completo", desc: "Clique em qualquer lead e veja todo o histórico, anotações e interações anteriores." },
    { icon: <BarChart2 className="w-6 h-6" />, title: "Relatórios de Conversão", desc: "Taxa de fechamento por etapa, por profissional, por período. Dados reais, decisões certas." },
  ];

  const steps = [
    { num: "01", title: "Lead Entra no Funil", desc: "Manualmente ou via formulário, cada novo contato entra no topo do funil como um Card pronto para ser trabalhado." },
    { num: "02", title: "Equipe Qualifica e Avança", desc: "Seu time arrasta o Card pelas colunas enquanto agenda consultas, registra contatos e adiciona notas em tempo real." },
    { num: "03", title: "Você Vê e Decide", desc: "Com o funil aberto, você enxerga em segundos onde está o dinheiro parado e age antes que o lead esfrie." },
  ];

  const faqs = [
    { q: "Posso ter mais de um funil ao mesmo tempo?", a: "Sim. Você pode criar quantos funis quiser — um para novos pacientes, outro para recuperação de inativos, outro para procedimentos específicos. Cada funil tem suas próprias colunas e configurações." },
    { q: "O funil se conecta com a agenda?", a: "Totalmente. Quando um lead avança para a etapa 'Agendado', ele já aparece automaticamente na sua agenda como uma consulta vinculada ao Card do funil." },
    { q: "É possível ver quem está responsável por cada lead?", a: "Sim. Cada Card pode ser atribuído a um membro da equipe, com foto e nome visíveis no próprio quadro Kanban." },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body overflow-x-hidden">
      {/* SHARED SITE NAVBAR */}
      <SiteNavbar />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-24 pb-32 bg-[#0F172A] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#F97316]/15 rounded-full blur-[180px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-10 group">
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              Voltar ao início
            </Link>
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-6 block">Funil de Vendas</span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-headline font-black text-white tracking-tighter leading-[0.95] mb-8">
              O dinheiro parado na sua clínica{' '}
              <span className="text-[#F97316]">finalmente aparece.</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-12 max-w-lg">
              Visualize cada lead, em cada etapa, in real time. Com o Funil Kanban do SellClin, você para de perder oportunidades que já estavam na sua mão.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link to="/entrar" className="bg-[#F97316] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-orange-900/40 flex items-center gap-3">
                Começar Agora <ArrowRight size={16} />
              </Link>
              <Link to="/perguntas-frequentes" className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Ver o FAQ →</Link>
            </div>
          </motion.div>

          {/* Mini Kanban Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-sm overflow-hidden">
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent md:overflow-x-hidden md:pb-0">
                {[
                  { col: "Lead Novo", color: "bg-blue-500", leads: ["Dr. Carlos M.", "Patrícia A."], count: 2 },
                  { col: "Em Contato", color: "bg-amber-500", leads: ["Fernanda R.", "João P.", "Ana C."], count: 3 },
                  { col: "Agendado", color: "bg-[#F97316]", leads: ["Marcos T."], count: 1 },
                  { col: "Fechado", color: "bg-green-500", leads: ["Cláudia S.", "Roberto M."], count: 2 },
                ].map((col, i) => (
                  <div key={i} className="flex-1 min-w-[150px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${col.color}`} />
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest truncate">{col.col}</span>
                      <span className="ml-auto text-[9px] font-black text-white/30">{col.count}</span>
                    </div>
                    <div className="space-y-2">
                      {col.leads.map((name, j) => (
                        <div key={j} className="bg-white/5 border border-white/5 rounded-xl p-2.5 hover:bg-white/10 transition-colors cursor-pointer">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-slate-700 mb-1.5" />
                          <p className="text-[9px] font-bold text-white/80 truncate">{name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[9px] text-white/30 font-bold text-center mt-2 md:hidden">← Deslize para ver todas as etapas →</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Como funciona</span>
            <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter text-[#0F172A]">Simples de entender.<br /><span className="text-[#F97316]">Poderoso na prática.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 50 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, amount: 0.3 }} 
                transition={{ duration: 1.4, delay: i * 0.2, ease: [0.16, 1, 0.3, 1] }} 
                className="relative p-10 rounded-[2.5rem] border border-slate-100 hover:border-[#F97316]/30 hover:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.1)] transition-all group"
              >
                <div className="text-[80px] font-black text-slate-50 leading-none mb-4 group-hover:text-orange-50 transition-colors">{s.num}</div>
                <h3 className="text-2xl font-headline font-black text-[#0F172A] mb-3">{s.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="py-32 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Funcionalidades</span>
            <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter">Tudo que seu time comercial precisa</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 50 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, amount: 0.3 }} 
                transition={{ duration: 1.4, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }} 
                className="bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-[#F97316]/30 hover:shadow-xl transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F97316]/10 flex items-center justify-center text-[#F97316] mb-6 group-hover:bg-[#F97316] group-hover:text-white transition-all">
                  {b.icon}
                </div>
                <h3 className="text-lg font-black text-[#0F172A] mb-2">{b.title}</h3>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ANTES VS DEPOIS (IMPACTO REAL) */}
      <section className="py-24 bg-[#0F172A] border-t border-slate-800 relative overflow-hidden">
        {/* Background grid mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_0.6px,transparent_0.6px),linear-gradient(to_bottom,#1e293b_0.6px,transparent_0.6px)] bg-[size:3rem_3rem] pointer-events-none opacity-40" />
        {/* Ambient glowing circles */}
        <div className="absolute left-1/4 top-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute right-1/4 bottom-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 inline-block bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full">Processo Comercial</span>
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-white">A evolução do seu controle de leads</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* ANTES */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-3 mb-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full shadow-sm">Como era antes</span>
              </div>
              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Leads vindos do Instagram e tráfego pago perdidos em conversas soltas ou planilhas difíceis de atualizar.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Falta de histórico sobre o que já foi conversado com o paciente, precisando reler conversas antigas inteiras.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Sem controle sobre o valor potencial de vendas de cada tratamento em negociação na clínica.</p>
                </div>
              </div>
            </motion.div>

            {/* DEPOIS */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-gradient-to-br from-[#1e293b]/50 to-[#0f172a]/30 backdrop-blur-sm border border-orange-500/20 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden shadow-[0_15px_40px_-20px_rgba(249,115,22,0.15)]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-3 mb-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#F97316] bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full shadow-sm">Com o SellClin</span>
              </div>
              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Quadro Kanban organizado por etapas do funil com identificação clara de origem (Instagram, Meta Ads, Google Ads).</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Linha do tempo de atividades contendo anotações, ligações e propostas geradas para cada paciente.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Controle do valor potencial do tratamento no próprio card para priorizar as negociações mais valiosas.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-32 bg-white">
        <div className="max-w-3xl mx-auto px-8">
          <motion.h2 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-headline font-black tracking-tighter text-center mb-16"
          >
            Dúvidas sobre o Funil
          </motion.h2>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.15 }
              }
            }}
            className="space-y-4"
          >
            {faqs.map((faq, i) => (
              <motion.div 
                key={i} 
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
                }}
                className={`rounded-2xl border transition-all ${openFaq === i ? 'border-[#F97316]/40 bg-orange-50/30' : 'border-slate-100 bg-white'}`}
              >
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                  <span className="font-black text-[#0F172A] text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180 text-[#F97316]' : ''}`} />
                </button>
                {openFaq === i && <div className="px-6 pb-6 text-slate-600 font-medium leading-relaxed">{faq.a}</div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* NAVEGAÇÃO ENTRE RECURSOS */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-8">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12"
          >
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Outras Funcionalidades</span>
            <h2 className="text-3xl font-headline font-black tracking-tighter text-[#0F172A]">Veja como os recursos se conectam</h2>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.2 }
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] } }
              }}
              className="flex"
            >
              <Link to="/funcionalidades/agenda" className="w-full group bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-[#F97316]/30 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#F97316] mb-6 group-hover:bg-[#F97316] group-hover:text-white transition-all">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-[#0F172A] mb-3">Agenda Inteligente</h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">Confirmações automáticas por WhatsApp Web e painel de status visual colorido para a recepção.</p>
                </div>
                <div className="text-xs font-black text-[#F97316] uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conhecer a Agenda <ArrowRight size={14} />
                </div>
              </Link>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] } }
              }}
              className="flex"
            >
              <Link to="/funcionalidades/metas" className="w-full group bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-[#F97316]/30 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#F97316] mb-6 group-hover:bg-[#F97316] group-hover:text-white transition-all">
                    <Target className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-[#0F172A] mb-3">Engenharia de Metas</h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">Calcule com precisão matemática o volume de leads e taxa de conversão necessários para atingir seu objetivo.</p>
                </div>
                <div className="text-xs font-black text-[#F97316] uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conhecer a Engenharia de Metas <ArrowRight size={14} />
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-slate-50 border-t border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 45 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0F172A] rounded-[2.5rem] p-8 sm:p-16 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10"
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#F97316]/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="space-y-4 max-w-xl relative z-10 text-center md:text-left">
              <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.3em] block">Comece em Minutos</span>
              <h2 className="text-3xl sm:text-4xl font-headline font-black tracking-tight leading-tight">
                Pare de perder leads.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
                Comece hoje e tenha visão completa do seu pipeline de pacientes em menos de 10 minutos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto shrink-0 relative z-10">
              <Link to="/cadastro" className="bg-[#F97316] text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest text-center shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all">
                Começar Grátis
              </Link>
              <Link to="/entrar" className="bg-white/10 hover:bg-white/15 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest text-center border border-white/10 transition-all">
                Fazer Login
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  );
};

export default FunilPage;
