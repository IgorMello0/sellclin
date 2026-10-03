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

      {/* META TRADUZIDA EM OPERAÇÃO */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-[#0F172A] py-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_0.6px,transparent_0.6px),linear-gradient(to_bottom,#1e293b_0.6px,transparent_0.6px)] bg-[size:3rem_3rem] opacity-35" />
        <div className="absolute left-1/2 top-1/2 h-[430px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.09] blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-14 text-center"
          >
            <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.4em] text-orange-400">Meta traduzida em operação</span>
            <h2 className="text-3xl font-headline font-black tracking-tighter text-white md:text-5xl">Do faturamento desejado ao número de leads.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-400 sm:text-base">O SellClin transforma o objetivo financeiro em metas comerciais que sua equipe consegue acompanhar todos os dias.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 45 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]"
          >
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="relative flex h-52 w-52 items-center justify-center rounded-full bg-[conic-gradient(#F97316_0deg,#F97316_276deg,rgba(255,255,255,0.07)_276deg)] shadow-[0_25px_90px_-35px_rgba(249,115,22,0.7)]">
                <div className="flex h-[174px] w-[174px] flex-col items-center justify-center rounded-full border border-white/[0.06] bg-[#111827]">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Progresso da meta</span>
                  <strong className="mt-2 text-5xl font-black tracking-tighter text-white">77%</strong>
                  <span className="mt-1 text-[11px] font-bold text-emerald-400">no ritmo esperado</span>
                </div>
              </div>
              <p className="mt-7 text-xs font-medium leading-relaxed text-slate-500">A projeção acompanha o desempenho real do funil e mostra quanto falta para atingir o objetivo.</p>
            </div>

            <div>
              <div className="mb-7">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Objetivo mensal</span>
                <p className="mt-2 text-4xl font-black tracking-tighter text-white">{revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Ticket médio de {ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { value: totalSales, label: 'vendas', detail: 'objetivo final', icon: DollarSign, color: 'text-emerald-400 bg-emerald-400/10' },
                  { value: Math.round(totalSales / 0.45), label: 'agendamentos', detail: '45% de fechamento', icon: Calendar, color: 'text-blue-400 bg-blue-400/10' },
                  { value: neededLeads, label: 'leads', detail: '60% de agendamento', icon: Target, color: 'text-orange-400 bg-orange-400/10' },
                ].map((metric, index) => (
                  <div key={metric.label} className="relative rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
                    {index > 0 && <ArrowRight className="absolute -left-5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-600 sm:block" />}
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${metric.color}`}><metric.icon className="h-4 w-4" /></span>
                    <p className="mt-5 text-3xl font-black tracking-tighter text-white">{metric.value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-300">{metric.label}</p>
                    <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600">{metric.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-orange-400/15 bg-orange-400/[0.06] px-5 py-4">
                <TrendingUp className="h-5 w-5 shrink-0 text-orange-400" />
                <p className="text-xs font-semibold leading-relaxed text-slate-300">Se uma taxa muda, toda a projeção é recalculada para mostrar o novo esforço necessário.</p>
              </div>
            </div>
          </motion.div>
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
                  <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">Confirmações pelo WhatsApp oficial e painel de status visual para toda a recepção.</p>
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
