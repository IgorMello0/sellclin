import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Instagram, MessageCircle,
  Calendar, Clock, Bell, CheckCircle, Users, Smartphone,
  Star, ChevronDown, KanbanSquare, Target
} from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';

const AgendaPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    { icon: <Calendar className="w-6 h-6" />, title: "Visão Dia, Semana e Mês", desc: "Alterne entre as visões em um clique. A agenda se adapta ao seu ritmo de trabalho." },
    { icon: <Clock className="w-6 h-6" />, title: "Status em Tempo Real", desc: "Agendado, Confirmado, Cancelado, Concluído. Cada consulta com seu status atualizado ao vivo." },
    { icon: <Bell className="w-6 h-6" />, title: "Redução de No-Show", desc: "Alertas automáticos para a equipe lembrar de confirmar os pacientes no momento certo." },
    { icon: <Users className="w-6 h-6" />, title: "Filtro por Profissional", desc: "Veja a agenda de qualquer membro da equipe de forma individual e organizada." },
    { icon: <CheckCircle className="w-6 h-6" />, title: "Integração com o Funil", desc: "Quando um paciente é 'Concluído' na agenda, o CRM avança ele automaticamente no funil de vendas." },
    { icon: <Smartphone className="w-6 h-6" />, title: "100% Responsivo", desc: "A recepção acessa a agenda do celular. Agende, confirme e cancele de qualquer lugar." },
  ];

  const faqs = [
    { q: "A agenda se integra com Google Calendar?", a: "Sim. Conecte o Google Calendar em Integrações para sincronizar os agendamentos da clínica e acompanhar eventuais falhas de sincronização." },
    { q: "Posso filtrar a agenda por profissional?", a: "Sim! A agenda tem um filtro rápido por profissional, perfeito para clínicas com múltiplos doutores ou especialidades." },
    { q: "O sistema avisa quando um paciente não confirmou?", a: "Isso é gerenciado pelo status do Card. A recepção pode visualizar todos os pacientes com status 'Agendado' que ainda não foram atualizados para 'Confirmado', facilitando o acompanhamento." },
  ];

  const statuses = [
    { label: "Agendado", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { label: "Confirmado", color: "bg-green-100 text-green-700 border-green-200" },
    { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200" },
    { label: "Concluído", color: "bg-orange-100 text-orange-700 border-orange-200" },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body overflow-x-hidden">
      {/* SHARED SITE NAVBAR */}
      <SiteNavbar />

      {/* HERO — CLEAN WHITE EDITORIAL */}
      <section className="relative pt-40 pb-32 bg-white overflow-hidden">
        <div className="absolute left-8 lg:left-[calc(50%-640px+32px)] top-0 w-[1px] h-full bg-slate-100" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-50 rounded-full blur-[150px] opacity-60" />

        <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-[#0F172A] transition-colors mb-10 group">
              <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
              Voltar ao início
            </Link>
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-6 block">Agenda Inteligente</span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-headline font-black text-[#0F172A] tracking-tighter leading-[0.95] mb-8">
              Sua recepção no controle. <span className="text-[#F97316]">Sempre.</span>
            </h1>
            <p className="text-lg text-slate-500 font-medium leading-relaxed mb-12 max-w-lg">
              Chega de agendas no papel, planilhas soltas e WhatsApp bagunçado. O SellClin centraliza tudo em uma agenda visual, intuitiva e conectada ao seu comercial.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link to="/entrar" className="bg-[#F97316] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-orange-200 flex items-center gap-3">
                Começar Agora <ArrowRight size={16} />
              </Link>
            </div>
            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mt-10">
              {statuses.map((s, i) => (
                <span key={i} className={`px-4 py-1.5 rounded-full text-xs font-bold border ${s.color}`}>{s.label}</span>
              ))}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-3">Status visuais em tempo real para toda a equipe</p>
          </motion.div>

          {/* Agenda Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:max-w-2xl"
          >
            <div className="bg-[#FAFAFA] rounded-[2rem] border border-slate-200/80 shadow-[0_40px_80px_-15px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col h-[520px]">
              
              {/* Agenda Mock Header */}
              <div className="bg-white px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Agenda Médica</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Cronograma de consultas e procedimentos da semana</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200/50">
                    Maio, 18 - 22
                  </span>
                  <span className="text-[8px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                    Semana
                  </span>
                </div>
              </div>

              {/* Grid Wrapper */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Days header */}
                <div className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] bg-slate-50 border-b border-slate-200 shrink-0 text-center text-[10px] font-bold text-slate-500">
                  <div className="py-2 border-r border-slate-200" />
                  {[
                    { name: "Seg", date: "18" },
                    { name: "Ter", date: "19" },
                    { name: "Qua", date: "20" },
                    { name: "Qui", date: "21" },
                    { name: "Sex", date: "22" },
                  ].map((day, idx) => (
                    <div key={idx} className="py-1.5 border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center">
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 leading-none mb-0.5">{day.name}</span>
                      <span className="text-[10px] font-black text-slate-700">{day.date}</span>
                    </div>
                  ))}
                </div>

                {/* Hours scroll container */}
                <div className="flex-1 overflow-y-auto relative min-h-0 select-none pb-4 bg-white">
                  <div className="relative">
                    {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((hour) => (
                      <div key={hour} className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))]" style={{ height: '55px' }}>
                        <div className="border-r border-b border-slate-100 text-[9px] text-slate-400 font-mono flex items-start justify-end pr-1.5 pt-1">
                          {hour}
                        </div>
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="border-r border-b border-slate-100/60 last:border-r-0" />
                        ))}
                      </div>
                    ))}

                    {/* Absolute positioned appointments (like CRM/Simulator) */}
                    <div className="absolute top-0 left-[40px] right-0 bottom-0 pointer-events-none">
                      <div className="relative w-full h-full flex">
                        
                        {/* Monday Column (Seg - Day 0) */}
                        <div className="flex-1 h-full relative">
                          <div className="absolute left-1 right-1 rounded-lg border p-1.5 shadow-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-700 flex flex-col justify-between" style={{ top: '55px', height: '80px' }}>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-extrabold text-[9px] truncate">Mariana Leme</span>
                              </div>
                              <div className="text-[8px] font-bold opacity-80 leading-none truncate pl-2">Lentes Contato</div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold opacity-75 border-t border-emerald-500/10 pt-0.5">
                              <span>09:00</span>
                              <span>Confirmado</span>
                            </div>
                          </div>
                        </div>

                        {/* Tuesday Column (Ter - Day 1) */}
                        <div className="flex-1 h-full relative">
                          <div className="absolute left-1 right-1 rounded-lg border p-1.5 shadow-xs bg-amber-500/10 border-amber-500/30 text-amber-700 flex flex-col justify-between" style={{ top: '110px', height: '80px' }}>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                <span className="font-extrabold text-[9px] truncate">Lucas Silva</span>
                              </div>
                              <div className="text-[8px] font-bold opacity-80 leading-none truncate pl-2">Facetas Porcelana</div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold opacity-75 border-t border-amber-500/10 pt-0.5">
                              <span>10:00</span>
                              <span>Pendente</span>
                            </div>
                          </div>
                        </div>

                        {/* Wednesday Column (Qua - Day 2) */}
                        <div className="flex-1 h-full relative">
                          <div className="absolute left-1 right-1 rounded-lg border p-1.5 shadow-xs bg-sky-500/10 border-sky-500/30 text-sky-700 flex flex-col justify-between" style={{ top: '330px', height: '80px' }}>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1 h-1 rounded-full bg-sky-500 shrink-0" />
                                <span className="font-extrabold text-[9px] truncate">Pedro Costa</span>
                              </div>
                              <div className="text-[8px] font-bold opacity-80 leading-none truncate pl-2">Implante Dentário</div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold opacity-75 border-t border-sky-500/10 pt-0.5">
                              <span>14:00</span>
                              <span>Concluído</span>
                            </div>
                          </div>
                        </div>

                        {/* Thursday Column (Qui - Day 3) */}
                        <div className="flex-1 h-full relative">
                          <div className="absolute left-1 right-1 rounded-lg border p-1.5 shadow-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-700 flex flex-col justify-between" style={{ top: '165px', height: '52px' }}>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-extrabold text-[9px] truncate">Julia Santos</span>
                              </div>
                              <div className="text-[8px] font-bold opacity-80 leading-none truncate pl-2">Botox Facial</div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold opacity-75 border-t border-emerald-500/10 pt-0.5">
                              <span>11:00</span>
                              <span>Confirmado</span>
                            </div>
                          </div>
                        </div>

                        {/* Friday Column (Sex - Day 4) */}
                        <div className="flex-1 h-full relative">
                          <div className="absolute left-1 right-1 rounded-lg border p-1.5 shadow-xs bg-amber-500/10 border-amber-500/30 text-amber-700 flex flex-col justify-between" style={{ top: '385px', height: '80px' }}>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                <span className="font-extrabold text-[9px] truncate">Roberto Abreu</span>
                              </div>
                              <div className="text-[8px] font-bold opacity-80 leading-none truncate pl-2">Avaliação Geral</div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-bold opacity-75 border-t border-amber-500/10 pt-0.5">
                              <span>15:00</span>
                              <span>Pendente</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-32 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Funcionalidades</span>
            <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter">Uma agenda que <span className="text-[#F97316]">pensa com você</span></h2>
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
            <span className="text-[#F97316] font-black text-[10px] uppercase tracking-[0.4em] mb-4 inline-block bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full">Rotina da Clínica</span>
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tighter text-white">A evolução da sua rotina na recepção</h2>
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
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Perder tempo digitando manualmente a mensagem de confirmação para cada paciente agendado.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Dificuldade para identificar rapidamente quais consultas estão confirmadas, pendentes ou concluídas.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner transition-all hover:bg-slate-950 hover:border-slate-700 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-[13px] font-medium leading-relaxed mt-1">Navegação lenta e confusa para visualizar a agenda individual de cada profissional da clínica.</p>
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
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Botão "Avisar" que abre o WhatsApp Web com mensagem de confirmação de consulta 100% pronta.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Status visuais coloridos (Agendado, Confirmado, Concluído, Cancelado) no próprio painel da consulta.</p>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-950/80 border border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all hover:border-orange-500/40 hover:-translate-y-0.5 duration-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-100 text-[13px] font-semibold leading-relaxed mt-1">Visualização rápida da agenda em formato de Dia, Semana e Mês, com filtro instantâneo por profissional.</p>
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
            Dúvidas sobre a Agenda
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
                Sua agenda nunca mais vai te trair.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
                Diga adeus às planilhas, papéis e ao caos na recepção. Comece a gerenciar seus atendimentos de forma inteligente.
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

export default AgendaPage;
