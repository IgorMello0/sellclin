import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, TrendingUp, Calculator, BarChart, DollarSign, Zap,
  Star, ChevronDown, ArrowRight, Calendar, KanbanSquare, Instagram, MessageCircle
} from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';

const MetasPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [revenue, setRevenue] = useState(200000);
  const [ticket, setTicket] = useState(6000);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const totalSales = Math.round(revenue / ticket);
  const neededLeads = Math.round(totalSales / (0.60 * 0.45));

  const benefits = [
    { icon: <Calculator className="w-6 h-6" />, title: "Cálculo Reverso de Metas", desc: "Insira o faturamento desejado e o sistema calcula quantos leads e conversões você precisa." },
    { icon: <TrendingUp className="w-6 h-6" />, title: "Histórico de Conversão", desc: "Baseado no seu histórico real, não em achismo. As taxas são calculadas do seu próprio funil." },
    { icon: <Target className="w-6 h-6" />, title: "Metas por Período", desc: "Defina metas mensais, trimestrais ou anuais. O sistema mostra progresso em tempo real." },
    { icon: <BarChart className="w-6 h-6" />, title: "Gargalos Identificados", desc: "Descubra em qual etapa do funil os leads escapam e aja antes que vire prejuízo." },
    { icon: <DollarSign className="w-6 h-6" />, title: "Ticket Médio Real", desc: "Calcule automaticamente o ticket médio da clínica por serviço e por profissional." },
    { icon: <Zap className="w-6 h-6" />, title: "Relatório de Performance", desc: "Veja em um dashboard limpo se a clínica está no ritmo certo para bater a meta do mês." },
  ];

  const faqs = [
    { q: "As taxas de conversão são automáticas?", a: "Sim. O SellClin calcula suas taxas de conversão reais baseado nos históricos de movimento dos leads no seu funil. Quanto mais você usa, mais precisa fica a previsão." },
    { q: "Posso ter metas diferentes por profissional?", a: "A engenharia de metas funciona a nível de clínica. Metas individuais por profissional estão no roadmap de próximas atualizações." },
    { q: "Como isso é diferente de uma simples calculadora?", a: "Uma calculadora usa dados que você imagina. A Engenharia de Metas usa os seus dados reais de histórico de leads, conversão por etapa e ticket médio dos seus próprios serviços — tornando a previsão muito mais confiável." },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body overflow-x-hidden">
      {/* SHARED SITE NAVBAR */}
      <SiteNavbar />

      {/* HERO — DARK, IMMERSIVE, DATA-FORWARD */}
      <section className="relative min-h-screen flex items-center pt-24 pb-32 bg-[#0B1525] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#F97316]/10 rounded-full blur-[200px] pointer-events-none" />

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
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-6 block">Engenharia de Metas</span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-headline font-black text-white tracking-tighter leading-[0.95] mb-8">
              Pare de achar. <br />
              <span className="text-[#F97316]">Comece a calcular.</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-12 max-w-lg">
              Nossa Engenharia de Metas usa o cálculo reverso baseado nos seus dados reais para te dizer exatamente quanto você precisa vender, captar e converter para bater sua meta.
            </p>
            <Link to="/entrar" className="inline-flex items-center gap-3 bg-[#F97316] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-orange-900/30">
              Começar Agora <ArrowRight size={16} />
            </Link>
          </motion.div>

          {/* Live Calculator Widget */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-[0_40px_80px_-15px_rgba(249,115,22,0.2)] border border-[#F97316]/20">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />
                <span className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.4em]">Simulador de Metas</span>
              </div>

              <div className="space-y-8 mb-10">
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta de Faturamento</label>
                    <span className="text-3xl font-black text-[#0F172A] tabular-nums">R$ {revenue.toLocaleString('pt-BR')}</span>
                  </div>
                  <input type="range" min={50000} max={1000000} step={10000} value={revenue} onChange={e => setRevenue(Number(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-[#F97316]" />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio</label>
                    <span className="text-3xl font-black text-[#0F172A] tabular-nums">R$ {ticket.toLocaleString('pt-BR')}</span>
                  </div>
                  <input type="range" min={1000} max={30000} step={500} value={ticket} onChange={e => setTicket(Number(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-[#F97316]" />
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-slate-100 via-[#F97316]/40 to-slate-100 mb-8" />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-5">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vendas Necessárias</div>
                  <div className="text-4xl font-black text-[#0F172A] tabular-nums">{totalSales}</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">fechamentos/mês</div>
                </div>
                <div className="bg-[#F97316] rounded-2xl p-5">
                  <div className="text-[9px] font-black text-orange-100 uppercase tracking-widest mb-2">Leads Necessários</div>
                  <div className="text-4xl font-black text-white tabular-nums">{neededLeads}</div>
                  <div className="text-[10px] text-orange-100 font-medium mt-1">entradas no funil</div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium text-center mt-4">*Baseado em taxas médias de conversão do setor de saúde</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Funcionalidades</span>
            <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter">Previsibilidade que <span className="text-[#F97316]">transforma negócios</span></h2>
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
                <div className="w-12 h-12 rounded-2xl bg-[#F97316]/10 flex items-center justify-center text-[#F97316] mb-6 group-hover:bg-[#F97316] group-hover:text-white transition-all">{b.icon}</div>
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
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 inline-block bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full">Planejamento Estratégico</span>
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-white">A evolução do seu planejamento financeiro</h2>
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
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Definir metas de faturamento sem saber a quantidade exata de atendimentos necessários para bater o objetivo.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Nenhum controle sobre as taxas reais de conversão de agendamentos, comparecimentos e fechamentos.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Sem ferramentas para simular e guardar diferentes cenários de faturamento e ticket médio da clínica.</p>
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
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Sliders interativos para definir Faturamento Desejado, Ticket Médio e taxas por etapa do funil comercial.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Cálculo instantâneo que mostra a quantidade necessária de Leads, Agendamentos e Vendas para atingir o alvo.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Possibilidade de salvar diferentes planos e cenários diretamente no banco de dados para comparação rápida.</p>
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
            Dúvidas sobre a Engenharia de Metas
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
              <Link to="/funcionalidades/funil" className="w-full group bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-[#F97316]/30 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#F97316] mb-6 group-hover:bg-[#F97316] group-hover:text-white transition-all">
                    <KanbanSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-[#0F172A] mb-3">Funil de Vendas</h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">Controle total dos seus leads do WhatsApp à conversão de alto ticket, sem perder nenhum paciente.</p>
                </div>
                <div className="text-xs font-black text-[#F97316] uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conhecer o Funil <ArrowRight size={14} />
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
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
                Sua meta do próximo mês começa hoje.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
                Deixe o SellClin fazer o cálculo por você e foque no que realmente importa: atender bem.
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

export default MetasPage;
