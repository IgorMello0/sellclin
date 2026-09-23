import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Shield, Zap, Target, ArrowRight, Instagram, Linkedin, Quote, Star } from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { Link } from 'react-router-dom';

const SobrePage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const values = [
    { icon: <Target className="w-6 h-6" />, title: "Foco em Resultados", desc: "Não criamos software para ser bonito, criamos para vender. Cada linha de código visa aumentar o faturamento da sua clínica." },
    { icon: <Shield className="w-6 h-6" />, title: "Transparência Total", desc: "Acreditamos em dados reais. Sem métricas de vaidade, apenas o que realmente impacta o seu lucro líquido." },
    { icon: <Heart className="w-6 h-6" />, title: "Humanidade Digital", desc: "Atrás de cada lead existe um paciente, e atrás de cada tela existe um profissional. Valorizamos o tempo e a experiência de ambos." },
    { icon: <Zap className="w-6 h-6" />, title: "Agilidade Obsessiva", desc: "No mercado de alto ticket, quem responde primeiro vence. Nossa plataforma é otimizada para velocidade de resposta e ação." },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-body selection:bg-[#F97316]/20 flex flex-col relative overflow-x-hidden">
      <SiteNavbar />

      {/* 1. HERO — GLOW TECH (SUAVE) */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-24 bg-white overflow-hidden">
        {/* Soft Radial Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#F97316]/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-8 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 mb-8 shadow-sm">
              <Star size={14} className="fill-[#F97316] text-[#F97316]" />
              <span className="text-[#0F172A] font-bold text-[10px] uppercase tracking-[0.2em]">Quem Somos</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-black text-[#0F172A] mb-8 tracking-tighter leading-[1.1]">
              A inteligência que faltava para a sua <span className="text-[#F97316]">clínica escalar.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
              Nascemos no chão de clínicas de alto padrão para resolver os gargalos reais que impedem empresários da saúde de crescerem com previsibilidade.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 2. THE BENTO GRID MASTERPIECE */}
      <section className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(280px,auto)]">
            
            {/* BENTO 1: CEO BLOCK (Large Rect) */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2 rounded-[2.5rem] bg-slate-50 relative overflow-hidden shadow-sm border border-slate-100 group flex flex-col justify-end min-h-[500px]"
            >
              {/* Image & Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent z-10" />
              <img src="/Captura de tela 2026-05-15 183100.png" alt="Luiz Bucco" className="absolute inset-0 w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
              
              <div className="relative z-20 p-8 md:p-12">
                <Quote className="w-10 h-10 text-[#F97316] mb-6" />
                <p className="text-white text-2xl md:text-3xl font-headline font-black leading-[1.2] tracking-tight mb-8">
                  "O SellClin é o braço direito que toda clínica de sucesso deve ter para recuperar o controle do seu tempo e caixa."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-1 bg-[#F97316] rounded-full" />
                  <div>
                    <h3 className="text-white font-black text-lg">Luiz Bucco</h3>
                    <p className="text-white/60 font-black text-[10px] uppercase tracking-[0.2em] mt-1">Co-Founder & CEO</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* BENTO 2: METRICS 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="col-span-1 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.04)] p-8 flex flex-col justify-center items-start group hover:-translate-y-2 transition-transform duration-500"
            >
              <div className="w-14 h-14 bg-orange-50 rounded-[1.2rem] flex items-center justify-center mb-8 border border-orange-100 group-hover:bg-[#F97316] transition-colors duration-500">
                 <Target className="text-[#F97316] w-6 h-6 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-5xl font-headline font-black text-[#0F172A] tracking-tighter mb-2">500<span className="text-[#F97316]">+</span></div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="w-3 h-px bg-[#F97316]" /> Clínicas Ativas
              </div>
            </motion.div>

            {/* BENTO 3: METRICS 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="col-span-1 rounded-[2.5rem] bg-gradient-to-br from-[#F97316] to-orange-500 shadow-lg shadow-orange-500/20 p-8 flex flex-col justify-center items-start relative overflow-hidden group hover:-translate-y-2 transition-transform duration-500"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 blur-3xl rounded-full pointer-events-none" />
              <div className="w-14 h-14 bg-white/20 rounded-[1.2rem] flex items-center justify-center mb-8 relative z-10 backdrop-blur-sm border border-white/10 group-hover:bg-white transition-colors duration-500">
                 <Zap className="text-white w-6 h-6 group-hover:text-[#F97316] transition-colors duration-500" />
              </div>
              <div className="text-5xl font-headline font-black text-white tracking-tighter mb-2 relative z-10">50<span className="text-white/80">M+</span></div>
              <div className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] relative z-10 flex items-center gap-2">
                 <div className="w-3 h-px bg-white" /> Transacionados
              </div>
            </motion.div>

            {/* BENTO 4: OUR MISSION */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 rounded-[2.5rem] bg-slate-50 border border-slate-100 p-8 md:p-12 flex flex-col justify-center group hover:bg-white hover:shadow-xl transition-all duration-500 relative overflow-hidden"
            >
               <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-100/50 rounded-tl-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <h3 className="text-2xl md:text-3xl font-headline font-black text-[#0F172A] mb-4 relative z-10">Uma infraestrutura para a nova era.</h3>
               <p className="text-slate-500 font-medium leading-relaxed relative z-10 text-lg">
                 Nossa missão é democratizar a inteligência de dados que antes era exclusividade de grandes corporações, entregando na mão do dono de clínica o controle absoluto do seu destino.
               </p>
            </motion.div>

            {/* BENTO 5: VALUES (Wide Block) */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="col-span-1 md:col-span-3 lg:col-span-4 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.03)] p-8 md:p-12"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                 <h3 className="text-2xl font-headline font-black text-[#0F172A]">Nossos Pilares</h3>
                 <div className="h-px bg-slate-100 flex-1 hidden md:block mx-8" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
                 {values.map((v, i) => (
                   <div key={i} className="group">
                     <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#F97316] group-hover:bg-[#F97316] group-hover:text-white transition-colors duration-300">
                          {v.icon}
                        </div>
                        <h4 className="font-black text-[#0F172A] text-base">{v.title}</h4>
                     </div>
                     <p className="text-sm text-slate-500 font-medium leading-relaxed">{v.desc}</p>
                   </div>
                 ))}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 3. FINAL CTA — RICH DYNAMIC */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 relative z-10">
          
          <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-12 md:p-24 relative overflow-hidden flex flex-col items-center justify-center text-center shadow-[0_20px_80px_-15px_rgba(15,23,42,0.05)]">
            
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
            
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3], x: [0, 50, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[40rem] h-[40rem] bg-[#F97316]/10 rounded-full blur-[100px] pointer-events-none"
            />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2], x: [0, -50, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[30rem] h-[30rem] bg-orange-400/10 rounded-full blur-[80px] pointer-events-none"
            />

            <div className="relative z-10 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-12">
                <span className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Próximo Passo</span>
              </div>

              <h2 className="text-4xl md:text-6xl lg:text-7xl font-headline font-black mb-8 tracking-tighter text-[#0F172A] leading-[1.1]">
                O cérebro da sua operação a um <span className="relative whitespace-nowrap"><span className="relative z-10 text-[#F97316]">clique.</span><svg className="absolute -bottom-2 left-0 w-full h-4 text-[#F97316]/20 -z-10 pointer-events-none" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 10 Q 50 20 100 10" stroke="currentColor" strokeWidth="8" fill="none" /></svg></span>
              </h2>
              
              <p className="text-xl text-slate-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
                Junte-se às clínicas que pararam de perder leads e começaram a escalar com inteligência e controle.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Link to="/entrar" className="inline-flex items-center justify-center gap-4 bg-[#F97316] text-white px-10 py-5 md:px-12 md:py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] hover:bg-orange-600 transition-all duration-500 shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)] hover:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.6)] hover:-translate-y-1 group w-full sm:w-auto">
                  Solicitar Demonstração
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#contato" className="inline-flex items-center justify-center gap-4 bg-white text-[#0F172A] border border-slate-200 shadow-sm px-10 py-5 md:px-12 md:py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-50 transition-all duration-500 hover:-translate-y-1 w-full sm:w-auto">
                  Falar com Especialista
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default SobrePage;
