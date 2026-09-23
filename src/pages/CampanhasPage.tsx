import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send, Users, MessageSquare, Activity, ShieldCheck, KanbanSquare,
  ChevronDown, ArrowRight, Calendar, Target, CheckCircle2
} from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';

const CampanhasPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    { icon: <Send className="w-6 h-6" />, title: "Disparos Rápidos", desc: "Envie milhares de mensagens via WhatsApp em poucos cliques, sem complicação ou configurações técnicas." },
    { icon: <Users className="w-6 h-6" />, title: "Segmentação Inteligente", desc: "Filtre sua base por tags, etapa do funil ou importe planilhas CSV para enviar a mensagem certa para a pessoa certa." },
    { icon: <MessageSquare className="w-6 h-6" />, title: "Mensagens Personalizadas", desc: "Use variáveis como nome do lead ou serviço de interesse para criar mensagens que convertem de verdade." },
    { icon: <Activity className="w-6 h-6" />, title: "Acompanhamento ao Vivo", desc: "Veja em tempo real quem recebeu, quem leu e o progresso da sua campanha direto no dashboard." },
    { icon: <ShieldCheck className="w-6 h-6" />, title: "Envio Cadenciado (Anti-ban)", desc: "Nosso sistema simula o comportamento humano com pausas estratégicas para proteger seu número contra bloqueios." },
    { icon: <KanbanSquare className="w-6 h-6" />, title: "Integração com Funil", desc: "Os leads que responderem a campanha já entram automaticamente no seu funil comercial, prontos para a venda." },
  ];

  const faqs = [
    { q: "Preciso de um celular conectado o tempo todo?", a: "Para disparos via WhatsApp Web, você precisará conectar seu aparelho através do QR Code e mantê-lo com internet, exatamente como usa o WhatsApp Web no computador." },
    { q: "Há risco de ter meu número banido?", a: "O SellClin utiliza algoritmos de envio cadenciado (pausas aleatórias) para simular o comportamento humano e reduzir o risco de bloqueios, mas é importante seguir as boas práticas e evitar spam para contatos que não solicitaram mensagens." },
    { q: "Posso enviar campanhas para listas frias compradas?", a: "Não recomendamos. Nossa ferramenta foi desenhada para nutrir e reengajar a base de contatos e leads que já interagiram com a sua clínica. O envio para listas não autorizadas aumenta exponencialmente as chances de banimento do WhatsApp." },
    { q: "As métricas de leitura são exatas?", a: "Mostramos a taxa de entrega e envio com 100% de exatidão. A leitura (blue tick) depende da configuração de privacidade de quem recebe a mensagem." },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body overflow-x-hidden">
      {/* SHARED SITE NAVBAR */}
      <SiteNavbar />

      {/* HERO — DARK, IMMERSIVE */}
      <section className="relative min-h-screen flex items-center pt-24 pb-32 bg-[#0A0E1A] overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#F97316]/8 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/6 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        </div>
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-10 group">
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              Voltar ao início
            </Link>
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-6 block">Campanhas & Disparos</span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-headline font-black text-white tracking-tighter leading-[0.95] mb-8">
              Sua clínica na<br />
              <span className="bg-gradient-to-r from-[#F97316] via-orange-400 to-amber-400 bg-clip-text text-transparent">palma da mão</span> do lead.
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-12 max-w-lg">
              Reative pacientes antigos, divulgue promoções e lote a agenda da semana em poucos cliques com nossos disparos inteligentes via WhatsApp.
            </p>
            <Link to="/entrar" className="inline-flex items-center gap-3 bg-[#F97316] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-orange-900/30">
              Começar Agora <ArrowRight size={16} />
            </Link>
          </motion.div>

          {/* Light Theme Mockup (Reused from Index) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative lg:pl-10"
          >
            {/* Glow behind the card */}
            <div className="absolute -inset-10 bg-gradient-to-tr from-[#F97316]/20 via-transparent to-blue-500/10 blur-[80px] rounded-full" />
            
            <div className="relative bg-white p-2 sm:p-3 rounded-[2rem] sm:rounded-[2.5rem] border border-[#F97316]/20 shadow-[0_0_40px_rgba(249,115,22,0.08)]">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
                
                {/* Top Bar — Campaign Info */}
                <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F97316] to-orange-600 flex items-center justify-center shadow-md shadow-orange-500/20 relative">
                      <Send size={18} className="text-white" />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#0F172A]">Promoção Botox</h4>
                      <p className="text-[10px] text-slate-500 font-medium">WhatsApp • 842 contatos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Ao Vivo</span>
                  </div>
                </div>

                <div className="px-5 sm:px-7 pb-5 sm:pb-7 pt-4 space-y-5">
                  {/* Audience Chips */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">Audiência selecionada</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Todos os Leads", active: false },
                        { label: "Clientes Antigos", active: true },
                        { label: "Por Tags", active: false },
                      ].map((chip, i) => (
                        <div key={i} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                          chip.active 
                            ? 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}>
                          {chip.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WhatsApp Chat Mockup */}
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">Preview da mensagem</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      {/* WhatsApp Header Bar */}
                      <div className="bg-[#008069] px-4 py-2.5 flex items-center gap-3">
                        <svg className="w-4 h-4 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                        <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center overflow-hidden">
                          <span className="text-[10px] font-black text-slate-600">JS</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-bold text-white">Juliana Silva</div>
                          <div className="text-[9px] text-white/80">online</div>
                        </div>
                        <div className="flex items-center gap-3 text-white/90">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
                        </div>
                      </div>
                      
                      {/* Chat Area with WhatsApp light wallpaper */}
                      <div className="bg-[#EFEAE2] px-4 py-4 min-h-[140px] relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M50 20c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm100 0c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm-50 50c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm-80 30c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm160 0c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3zm-80 50c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3z\' fill=\'%23000000\' fill-opacity=\'0.03\'/%3E%3C/svg%3E")' }}>
                        {/* Outgoing bubble */}
                        <div className="flex justify-end mb-1">
                          <div className="bg-[#D9FDD3] rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%] shadow-sm relative">
                            <p className="text-[12px] text-[#111B21] leading-[1.5]">
                              Oie <span className="bg-white/60 text-[#F97316] px-1 py-0.5 rounded text-[10px] font-bold border border-[#F97316]/20">{'{{primeiro_nome}}'}</span>, saudades de você por aqui! 💕
                            </p>
                            <p className="text-[12px] text-[#111B21] leading-[1.5] mt-1">
                              Liberamos hoje uma <strong>ação exclusiva</strong> para as pacientes que já fizeram o Botox com a gente.
                            </p>
                            <p className="text-[12px] text-[#111B21] leading-[1.5] mt-1">
                              Tem interesse em renovar? ✨
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[9px] text-[#667781]">10:15</span>
                              <svg className="w-4 h-3 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor"><path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.136.475.475 0 00-.343.153.499.499 0 00.009.697l2.746 2.594a.467.467 0 00.678-.034L11.2 1.4a.503.503 0 00-.129-.747z"/><path d="M14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.38.178l-6.19 7.636-1.167-1.102a.183.183 0 00-.254.003.162.162 0 00.003.232l1.505 1.422a.467.467 0 00.679-.034L14.886 1.4a.503.503 0 00-.129-.747z"/></svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progresso do envio</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-medium">656 / 842</span>
                        <span className="text-[11px] font-black text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full">78%</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#F97316] via-orange-400 to-amber-400 rounded-full relative" style={{ width: '78%' }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Contatos", val: "842", color: "text-blue-600", bg: "bg-blue-50", iconPath: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
                      { label: "Enviadas", val: "656", color: "text-emerald-600", bg: "bg-emerald-50", iconPath: "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" },
                      { label: "Entregues", val: "640", color: "text-cyan-600", bg: "bg-cyan-50", iconPath: "M22 12h-4l-3 9L9 3l-3 9H2" },
                      { label: "Respostas", val: "89", color: "text-[#F97316]", bg: "bg-orange-50", iconPath: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all group">
                        <div className={`w-6 h-6 rounded-lg ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                          <svg className={`w-3.5 h-3.5 ${s.color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={s.iconPath}/></svg>
                        </div>
                        <div className="text-base sm:text-lg font-black text-[#0F172A] tabular-nums">{s.val}</div>
                        <div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="absolute -right-4 sm:-right-8 top-16 bg-[#1F2937] text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-xl shadow-black/20 flex items-center gap-3 border border-slate-700"
            >
              <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/30">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="text-[11px] font-black">+89 leads no funil</div>
                <div className="text-[9px] text-slate-400">campanha convertendo</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Funcionalidades</span>
            <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter">Muito além de <span className="text-[#F97316]">apertar enviar</span></h2>
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
        <div className="absolute right-1/4 bottom-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 inline-block bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full">Reativação de Base</span>
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-white">O fim do ctrl+c ctrl+v manual</h2>
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
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Sua secretária precisando copiar e colar mensagens paciente por paciente no WhatsApp por horas.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Usar listas de transmissão que só entregam a mensagem para quem tem o número da clínica salvo na agenda.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Pacientes respondendo "quem é?" porque a mensagem foi genérica e não tinha o nome deles.</p>
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
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Dispare para centenas de pacientes em 1 clique, enquanto sua secretária foca em fechar as vendas no Funil.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Envio garantido, 1 a 1. A mensagem chega mesmo se o paciente não tiver o contato da clínica salvo.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Mensagens que parecem que foram digitadas na hora, chamando pelo nome e contextualizadas com a jornada dele.</p>
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
            Dúvidas Frequentes
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
                  <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">Descubra exatamente quantos disparos você precisa fazer para bater a meta de faturamento da clínica.</p>
                </div>
                <div className="text-xs font-black text-[#F97316] uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conhecer as Metas <ArrowRight size={14} />
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
                Sua próxima campanha a um clique de distância.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
                Pare de perder tempo com listas de transmissão que não chegam. Envie mensagens que convertem de verdade.
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

export default CampanhasPage;
