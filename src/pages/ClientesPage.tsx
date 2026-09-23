import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Quote, ArrowRight, Check } from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { Link } from 'react-router-dom';

const ClientesPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const cases = [
    {
      name: "Dra. Juliana Silva",
      clinic: "OdontoPremium",
      img: "https://i.pravatar.cc/150?u=dra_juliana",
      quote: "O SellClin mudou nossa percepção de leads. Antes achávamos que o marketing era ruim, agora vemos que o problema era nossa gestão comercial.",
      stats: { metric: "+120%", label: "faturamento" },
      featured: true
    },
    {
      name: "Dr. Marcos Oliveira",
      clinic: "Vision Center",
      img: "https://i.pravatar.cc/150?u=dr_marcos",
      quote: "A agenda inteligente reduziu nosso no-show drasticamente. O time hoje trabalha com metas e clareza total.",
      stats: { metric: "-35%", label: "no-show" },
      featured: false
    },
    {
      name: "Dra. Fernanda Rocha",
      clinic: "Aesthetic Life",
      img: "https://i.pravatar.cc/150?u=dra_fernanda",
      quote: "A engenharia de metas nos deu a previsibilidade que faltava. Hoje sei exatamente o retorno esperado.",
      stats: { metric: "3x", label: "ROI MKT" },
      featured: false
    }
  ];

  const logos = ["OdontoPrime", "LifeClin", "VisionGroup", "SellClin", "OrthoStyle", "HealthHub"];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body selection:bg-[#F97316]/20 flex flex-col relative overflow-x-hidden">
      <SiteNavbar />

      {/* HERO EDITORIAL */}
      <section className="relative pt-48 pb-20 bg-white overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-8 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-100 bg-slate-50 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F97316] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F97316]"></span>
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Cases Reais · 2026</span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-headline font-black text-[#0F172A] mb-8 tracking-tighter leading-[0.9]">
              Histórias de escala <br className="hidden md:block" /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-[#F97316]">escritas com dados.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
              Conheça as clínicas de alto padrão que transformaram sua gestão comercial e dominaram a previsibilidade de caixa com a infraestrutura SellClin.
            </p>
          </motion.div>
        </div>
      </section>

      {/* INFINITE MARQUEE LOGOS */}
      <section className="py-12 bg-white relative border-b border-slate-50">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        
        <div className="flex overflow-hidden">
          <div className="flex animate-marquee-left whitespace-nowrap opacity-30 grayscale items-center gap-24 px-12">
            {[...logos, ...logos, ...logos].map((l, i) => (
              <span key={i} className="text-2xl font-headline font-black tracking-tighter text-[#0F172A]">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS - WALL OF LOVE (INFINITE MARQUEE) */}
      <section className="py-32 bg-slate-50 relative z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 text-center mb-20 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100/50 border border-orange-200 text-[#F97316] text-xs font-bold uppercase tracking-widest mb-6 shadow-sm">
            <Star size={14} className="fill-[#F97316]" /> Wall of Love
          </div>
          <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter text-[#0F172A] mb-6">
            Estatísticas que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-orange-400">falam por si.</span>
          </h2>
          <p className="text-slate-500 font-medium max-w-xl mx-auto text-lg">
            Não vendemos software. Nós entregamos resultados financeiros palpáveis para as clínicas mais exigentes do país.
          </p>
        </div>

        {/* Marquee Fade Masks */}
        <div className="absolute left-0 top-0 w-32 md:w-64 h-full bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 w-32 md:w-64 h-full bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />

        <div className="flex flex-col gap-8 relative">
          
          {/* Row 1 - Left Scrolling */}
          <div className="flex w-max animate-marquee-left hover:[animation-play-state:paused]">
            {/* Half 1 */}
            <div className="flex gap-8 px-4">
              {[...cases, ...cases].map((c, i) => (
                <div key={`r1-h1-${i}`} className="w-[350px] md:w-[450px] shrink-0 bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.03)] hover:shadow-2xl hover:border-slate-200 hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#F97316]/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 border-2 border-[#F97316] rounded-full scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                        <img src={c.img} alt={c.name} className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 relative z-10" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#0F172A] text-sm">{c.name}</h4>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F97316] font-black mt-0.5">{c.clinic}</p>
                      </div>
                    </div>
                    <Quote className="text-slate-100 w-8 h-8 group-hover:text-[#F97316]/20 transition-colors duration-500" />
                  </div>
                  
                  <p className="text-base text-slate-600 font-medium leading-relaxed mb-10 relative z-10 line-clamp-4">
                    "{c.quote}"
                  </p>
                  
                  <div className="mt-auto border-t border-slate-50 pt-6 flex items-center justify-between relative z-10">
                    <div className="text-3xl font-black text-[#0F172A] tracking-tighter tabular-nums">{c.stats.metric}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <div className="w-4 h-px bg-[#F97316]" />
                      {c.stats.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Half 2 */}
            <div className="flex gap-8 px-4">
              {[...cases, ...cases].map((c, i) => (
                <div key={`r1-h2-${i}`} className="w-[350px] md:w-[450px] shrink-0 bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.03)] hover:shadow-2xl hover:border-slate-200 hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#F97316]/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 border-2 border-[#F97316] rounded-full scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                        <img src={c.img} alt={c.name} className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 relative z-10" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#0F172A] text-sm">{c.name}</h4>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F97316] font-black mt-0.5">{c.clinic}</p>
                      </div>
                    </div>
                    <Quote className="text-slate-100 w-8 h-8 group-hover:text-[#F97316]/20 transition-colors duration-500" />
                  </div>
                  
                  <p className="text-base text-slate-600 font-medium leading-relaxed mb-10 relative z-10 line-clamp-4">
                    "{c.quote}"
                  </p>
                  
                  <div className="mt-auto border-t border-slate-50 pt-6 flex items-center justify-between relative z-10">
                    <div className="text-3xl font-black text-[#0F172A] tracking-tighter tabular-nums">{c.stats.metric}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <div className="w-4 h-px bg-[#F97316]" />
                      {c.stats.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 - Right Scrolling */}
          <div className="flex w-max animate-marquee-left hover:[animation-play-state:paused]" style={{ animationDirection: 'reverse', animationDuration: '70s' }}>
            {/* Half 1 */}
            <div className="flex gap-8 px-4">
              {[...cases, ...cases].reverse().map((c, i) => (
                <div key={`r2-h1-${i}`} className="w-[350px] md:w-[450px] shrink-0 bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.03)] hover:shadow-2xl hover:border-slate-200 hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#F97316]/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 border-2 border-[#F97316] rounded-full scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                        <img src={c.img} alt={c.name} className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 relative z-10" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#0F172A] text-sm">{c.name}</h4>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F97316] font-black mt-0.5">{c.clinic}</p>
                      </div>
                    </div>
                    <Quote className="text-slate-100 w-8 h-8 group-hover:text-[#F97316]/20 transition-colors duration-500" />
                  </div>
                  
                  <p className="text-base text-slate-600 font-medium leading-relaxed mb-10 relative z-10 line-clamp-4">
                    "{c.quote}"
                  </p>
                  
                  <div className="mt-auto border-t border-slate-50 pt-6 flex items-center justify-between relative z-10">
                    <div className="text-3xl font-black text-[#0F172A] tracking-tighter tabular-nums">{c.stats.metric}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <div className="w-4 h-px bg-[#F97316]" />
                      {c.stats.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Half 2 */}
            <div className="flex gap-8 px-4">
              {[...cases, ...cases].reverse().map((c, i) => (
                <div key={`r2-h2-${i}`} className="w-[350px] md:w-[450px] shrink-0 bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.03)] hover:shadow-2xl hover:border-slate-200 hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#F97316]/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 border-2 border-[#F97316] rounded-full scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                        <img src={c.img} alt={c.name} className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 relative z-10" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#0F172A] text-sm">{c.name}</h4>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F97316] font-black mt-0.5">{c.clinic}</p>
                      </div>
                    </div>
                    <Quote className="text-slate-100 w-8 h-8 group-hover:text-[#F97316]/20 transition-colors duration-500" />
                  </div>
                  
                  <p className="text-base text-slate-600 font-medium leading-relaxed mb-10 relative z-10 line-clamp-4">
                    "{c.quote}"
                  </p>
                  
                  <div className="mt-auto border-t border-slate-50 pt-6 flex items-center justify-between relative z-10">
                    <div className="text-3xl font-black text-[#0F172A] tracking-tighter tabular-nums">{c.stats.metric}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <div className="w-4 h-px bg-[#F97316]" />
                      {c.stats.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </section>

      {/* METRICS - WHITE MODE ARCHITECTURE */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-8">
          <div className="bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.03),0_30px_60px_-20px_rgba(15,23,42,0.05)] rounded-[3rem] p-12 md:p-20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#F97316]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 relative z-10">
              <div className="space-y-4 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-100 pb-12 md:pb-0 md:pr-12">
                <div className="text-6xl lg:text-7xl font-headline font-black text-[#F97316] tracking-tighter">42%</div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A]">Taxa de Comparecimento</h4>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Aumento médio nas consultas realizadas após o primeiro mês de uso da Agenda Inteligente e confirmações ativas.
                </p>
              </div>
              
              <div className="space-y-4 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-100 pb-12 md:pb-0 md:pr-12 md:pl-6">
                <div className="text-6xl lg:text-7xl font-headline font-black text-[#F97316] tracking-tighter">2.5<span className="text-4xl text-slate-300">x</span></div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A]">Aproveitamento de Leads</h4>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Melhoria direta na conversão de leads provenientes de redes sociais devido ao pipeline visual de Kanban.
                </p>
              </div>
              
              <div className="space-y-4 text-center md:text-left md:pl-6">
                <div className="text-6xl lg:text-7xl font-headline font-black text-[#F97316] tracking-tighter">15<span className="text-4xl text-slate-300">h</span></div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A]">Economia Mensal</h4>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Tempo recuperado pelas equipes de recepção que antes gerenciavam retornos manualmente em planilhas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - RICH & DYNAMIC */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 relative z-10">
          
          <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-12 md:p-24 relative overflow-hidden flex flex-col items-center justify-center text-center shadow-[0_20px_80px_-15px_rgba(15,23,42,0.05)]">
            
            {/* Dynamic Background Effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
            
            {/* Animated Glow Orbs */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
                x: [0, 50, 0],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[40rem] h-[40rem] bg-[#F97316]/10 rounded-full blur-[100px] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.5, 0.2],
                x: [0, -50, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[30rem] h-[30rem] bg-orange-400/10 rounded-full blur-[80px] pointer-events-none"
            />

            {/* Content */}
            <div className="relative z-10 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-12">
                <span className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">O Futuro da sua Clínica</span>
              </div>

              <h2 className="text-5xl md:text-7xl font-headline font-black mb-8 tracking-tighter text-[#0F172A] leading-[1.1]">
                O seu próximo nível <br className="hidden md:block"/> começa <span className="relative whitespace-nowrap"><span className="relative z-10 text-[#F97316]">agora.</span><svg className="absolute -bottom-2 left-0 w-full h-4 text-[#F97316]/20 -z-10 pointer-events-none" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 10 Q 50 20 100 10" stroke="currentColor" strokeWidth="8" fill="none" /></svg></span>
              </h2>
              
              <p className="text-xl md:text-2xl text-slate-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
                Pare de perder pacientes por falta de gestão. Assuma o controle total da sua máquina de vendas hoje mesmo.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link to="/entrar" className="inline-flex items-center justify-center gap-4 bg-[#F97316] text-white px-12 py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] hover:bg-orange-600 transition-all duration-500 shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)] hover:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.6)] hover:-translate-y-1 group w-full sm:w-auto">
                  Quero Escalar Minha Clínica
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/sobre" className="inline-flex items-center justify-center gap-4 bg-white text-[#0F172A] border border-slate-200 shadow-sm px-12 py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-50 transition-all duration-500 hover:-translate-y-1 w-full sm:w-auto">
                  Falar com Consultor
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-16 pt-12 border-t border-slate-200/60 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-slate-500 font-bold text-sm uppercase tracking-widest">
                <div className="flex items-center gap-3">
                  <Check size={20} className="text-[#F97316] stroke-[3]" /> Implantação Rápida
                </div>
                <div className="flex items-center gap-3">
                  <Check size={20} className="text-[#F97316] stroke-[3]" /> Suporte Dedicado
                </div>
                <div className="flex items-center gap-3">
                  <Check size={20} className="text-[#F97316] stroke-[3]" /> Sem Fidelidade
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

export default ClientesPage;
