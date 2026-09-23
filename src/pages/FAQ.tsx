import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  ArrowLeft,
  Search,
  MessageCircle,
  BarChart,
  Calendar,
  Users,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Instagram
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteNavbar } from '@/components/SiteNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface FAQItemProps {
  question: string;
  category: string;
  isActive: boolean;
  onClick: () => void;
}

const FAQItem = ({ question, category, isActive, onClick }: FAQItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
        isActive
          ? "bg-white border-slate-200 shadow-sm ring-1 ring-slate-100/50"
          : "bg-transparent border-transparent hover:bg-slate-100/50 hover:border-slate-200/40"
      )}
    >
      <div className="flex flex-col gap-1.5 pr-4">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[#F97316] font-bold">{category}</span>
        <span className={cn(
          "font-sans font-medium text-sm leading-snug transition-colors",
          isActive ? "text-slate-900 font-semibold" : "text-slate-600 group-hover:text-slate-950"
        )}>
          {question}
        </span>
      </div>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all",
        isActive 
          ? "bg-slate-900 text-white" 
          : "bg-slate-100 text-slate-400 group-hover:bg-slate-200/80 group-hover:text-slate-600"
      )}>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
};

const FAQ = () => {
  const [selectedFAQ, setSelectedFAQ] = useState<{ question: string; answer: string; category: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categories = [
    { id: "Geral", icon: <ShieldCheck className="w-4 h-4" />, desc: "Conceitos básicos" },
    { id: "Agenda", icon: <Calendar className="w-4 h-4" />, desc: "Gestão de horários" },
    { id: "Vendas", icon: <BarChart className="w-4 h-4" />, desc: "Funil e metas" },
    { id: "Pacientes", icon: <Users className="w-4 h-4" />, desc: "Prontuários e dados" },
    { id: "Suporte", icon: <MessageCircle className="w-4 h-4" />, desc: "Configurações" },
  ];

  const faqs = [
    {
      category: "Geral",
      question: "O que torna o SellClin diferente?",
      answer: "O SellClin CRM não é apenas uma agenda. É uma plataforma de inteligência comercial desenhada para clínicas. Unimos a organização da recepção (agenda inteligente) com a agressividade do time comercial (funil Kanban e engenharia de metas), criando uma máquina previsível de captação e retenção de pacientes."
    },
    {
      category: "Geral",
      question: "Para qual tipo de operação o CRM foi feito?",
      answer: "Desenhado para clínicas odontológicas, médicas, estéticas e consultórios de alto padrão. Se a sua clínica sofre com 'pacientes que agendam e não comparecem' ou 'leads do Instagram que somem', o SellClin é a infraestrutura que resolve esse problema de ponta a ponta."
    },
    {
      category: "Agenda",
      question: "Como funciona a Agenda de Alta Performance?",
      answer: "Nossa agenda usa status coloridos e codificados (Agendado, Confirmado, Cancelado, Concluído) que se comunicam com o Funil de Vendas. Quando um paciente é marcado como 'Concluído' na agenda, o sistema entende o avanço dele na jornada de compra, gerando relatórios automáticos sem retrabalho da equipe."
    },
    {
      category: "Agenda",
      question: "A interface da agenda é confusa para a recepção?",
      answer: "Pelo contrário. Adotamos o conceito de 'Quiet Luxury' no design. As visões de Dia, Semana e Mês são minimalistas, focando apenas na informação essencial. O filtro rápido por profissional permite que a recepção marque consultas em segundos, sem fricção."
    },
    {
      category: "Vendas",
      question: "Qual o poder do Funil de Vendas (Kanban)?",
      answer: "O quadro Kanban transforma o invisível em visível. Cada paciente é um 'Card' que você arrasta entre colunas (ex: Lead Novo > Contato Feito > Agendado > Avaliação > Fechado). Isso permite que você saiba exatamente onde está o dinheiro parado na sua clínica e atue em cima disso."
    },
    {
      category: "Vendas",
      question: "Posso adaptar as etapas do funil para minha clínica?",
      answer: "Sim. Acreditamos que cada clínica tem sua essência. Você pode criar Múltiplos Funis (ex: um Funil de Captação e um Funil de Recuperação de Pacientes Antigos) e nomear as etapas de cada um como quiser, criando um processo 100% customizado."
    },
    {
      category: "Vendas",
      question: "O que é a famosa 'Engenharia de Metas'?",
      answer: "É o nosso recurso premium de previsibilidade. Esqueça o 'achismo'. Você insere quanto quer faturar e qual o seu ticket médio. O algoritmo reverso do SellClin calcula, baseado nas suas taxas de conversão históricas, exatamente quantos contatos o seu marketing precisa gerar e quantas avaliações você precisa realizar."
    },
    {
      category: "Vendas",
      question: "Como o sistema rastreia os leads?",
      answer: "Sempre que um card é movido no funil, o sistema salva um log de tempo. Você saberá quantos dias em média um lead demora para comprar de você, e em qual etapa a maioria das pessoas desiste. Inteligência pura de negócios."
    },
    {
      category: "Pacientes",
      question: "Onde ficam guardados os dados clínicos?",
      answer: "O Perfil do Paciente é o hub central. Lá, você tem acesso ao Prontuário, histórico de anotações clínicas, linha do tempo de interações (quando ele veio, com quem falou) e uma aba inteira dedicada ao financeiro dele com a clínica. Tudo seguro e rastreável."
    },
    {
      category: "Pacientes",
      question: "O sistema aprisiona meus dados?",
      answer: "De forma alguma. O SellClin garante a soberania dos seus dados. Você possui acesso a ferramentas de exportação robustas em formato CSV/Excel a qualquer momento, seja para clientes, leads ou faturamento."
    },
    {
      category: "Suporte",
      question: "A configuração inicial é complexa?",
      answer: "Reduzimos a complexidade ao máximo. Em 'Configurações', você insere os serviços da clínica, o tempo médio de cada um e o valor. Isso já deixa a agenda e a criação de propostas prontas para uso. O setup leva menos de 10 minutos."
    },
    {
      category: "Suporte",
      question: "Como funciona o controle de acesso (Equipe)?",
      answer: "A gestão de permissões é estrita. Administradores têm visão do fluxo de caixa e relatórios totais. Profissionais e Recepcionistas podem ter visões limitadas apenas às suas agendas e clientes. Segurança e privacidade total no trato dos dados da clínica."
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // If no selectedFAQ yet, automatically select the first item on desktop
  useEffect(() => {
    if (!isMobile && filteredFaqs.length > 0 && !selectedFAQ) {
      setSelectedFAQ(filteredFaqs[0]);
    }
  }, [isMobile, activeCategory, searchQuery]);

  const handleFAQClick = (faq: typeof faqs[0]) => {
    setSelectedFAQ(faq);
    if (isMobile) {
      setDrawerOpen(true);
    }
  };

  const getCategoryCount = (catId: string) => {
    if (catId === "Todos") return faqs.length;
    return faqs.filter(faq => faq.category === catId).length;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] font-body selection:bg-[#F97316]/20 flex flex-col relative">
      
      {/* SHARED SITE NAVBAR */}
      <SiteNavbar />

      {/* Docs Header */}
      <header className="border-b border-slate-200/80 bg-white pt-28 pb-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-2">
            <div className="text-[10px] font-mono font-bold tracking-widest text-[#F97316] uppercase">
              Central de Ajuda / Docs
            </div>
            <h1 className="text-3xl sm:text-4xl font-headline font-black tracking-tight text-slate-900">
              Como podemos ajudar?
            </h1>
          </div>

          {/* Minimalist Search Bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input 
              ref={inputRef}
              type="text"
              className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 bg-[#FAFAFA] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all font-medium"
              placeholder="Pesquisar dúvidas e artigos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-400 font-mono shadow-sm">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3-Column docs layout */}
      <main className="flex-1 max-w-7xl mx-auto px-6 w-full py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: Category Sidebar */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 space-y-1">
            <div className="px-3 mb-2 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Tópicos
            </div>
            
            {/* Reset / All */}
            <button
              onClick={() => setActiveCategory("Todos")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                activeCategory === "Todos"
                  ? "bg-slate-105 bg-slate-200/50 text-slate-950 font-bold"
                  : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explorar Todos</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                {getCategoryCount("Todos")}
              </span>
            </button>

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                  activeCategory === cat.id
                    ? "bg-slate-200/50 text-slate-950 font-bold"
                    : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-2">
                  {cat.icon}
                  <span>{cat.id}</span>
                </div>
                <span className="font-mono text-[10px] bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                  {getCategoryCount(cat.id)}
                </span>
              </button>
            ))}
          </aside>

          {/* Column 2: Question List */}
          <section className="lg:col-span-4 space-y-4">
            <div className="px-1 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Perguntas
            </div>
            
            <div className="space-y-2">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => (
                  <FAQItem
                    key={index}
                    category={faq.category}
                    question={faq.question}
                    isActive={selectedFAQ?.question === faq.question}
                    onClick={() => handleFAQClick(faq)}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/60 p-6">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Nenhum resultado</h3>
                  <p className="text-xs text-slate-500">Tente buscar por outro termo.</p>
                </div>
              )}
            </div>
          </section>

          {/* Column 3: Desktop Reading Pane */}
          <section className="hidden lg:block lg:col-span-5">
            <div className="px-1 mb-4 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Artigo
            </div>

            {selectedFAQ ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm sticky top-24">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#F97316] bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                    {selectedFAQ.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Última atualização: 2026</span>
                </div>
                
                <h2 className="text-xl sm:text-2xl font-headline font-black text-slate-900 leading-snug">
                  {selectedFAQ.question}
                </h2>
                
                <div className="h-px bg-slate-100" />
                
                <div className="prose prose-slate max-w-none text-slate-600 font-normal leading-relaxed text-sm whitespace-pre-line">
                  {selectedFAQ.answer}
                </div>
                
                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 font-semibold">Esse artigo foi útil?</div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                      Sim
                    </button>
                    <button className="px-3 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                      Não
                    </button>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <p className="text-xs text-slate-500 font-medium leading-normal">
                    Ficou com alguma dúvida residual sobre este tópico? Fale com a gente.
                  </p>
                  <div className="flex gap-2">
                    <a 
                      href="https://wa.me/5551999999999" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-grow bg-slate-900 hover:bg-slate-800 text-white text-center py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Falar no WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[300px] border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Sparkles className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-xs font-medium">Selecione uma dúvida ao lado para visualizar a resposta completa.</p>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Sleek CTA section at the bottom */}
      <section className="max-w-7xl mx-auto px-6 w-full mb-16 mt-8">
        <div className="bg-[#0B132B] rounded-[2.5rem] border border-slate-800 text-white relative overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-8 md:p-12 lg:p-16 flex flex-col justify-center space-y-6 text-left relative z-20">
            <div className="flex">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F97316]/10 text-[#F97316] text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse" />
                Suporte Premium
              </span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-headline font-extrabold text-white tracking-tight leading-tight">
              Ainda com dúvidas?
            </h2>
            
            <p className="text-slate-400 text-sm md:text-base font-normal leading-relaxed max-w-lg">
              Se você não encontrou o que procurava nos artigos acima, converse com nosso time de especialistas para desenhar o processo ideal para a sua clínica.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a 
                href="https://wa.me/5551999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#F97316] text-white hover:bg-orange-500 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
              >
                Falar com Consultor
              </a>
              <Link 
                to="/entrar"
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
              >
                Falar com o Suporte
              </Link>
            </div>
          </div>
          
          <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-full overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.1),transparent_70%)] z-10 pointer-events-none" />
            <img 
              src="/atendente.jpg" 
              alt="Atendente SellClin" 
              className="absolute inset-0 w-full h-full object-cover" 
            />
          </div>
        </div>
      </section>

      {/* FOOTER — COMPREHENSIVE EDITORIAL */}
      <SiteFooter />

      {/* Mobile Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md w-full bg-white border-l border-slate-200 flex flex-col h-full justify-between p-8">
          {selectedFAQ && (
            <>
              <div className="space-y-6 overflow-y-auto pr-2 flex-1 pt-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F97316]/10 text-[#F97316] text-[10px] font-mono font-bold uppercase tracking-wider">
                    {selectedFAQ.category}
                  </span>
                </div>
                <h3 className="font-headline font-black text-2xl text-slate-900 leading-tight">
                  {selectedFAQ.question}
                </h3>
                <div className="h-px bg-slate-100" />
                <div className="prose prose-slate max-w-none text-slate-600 font-normal leading-relaxed text-sm whitespace-pre-line">
                  {selectedFAQ.answer}
                </div>
              </div>
              
              <div className="pt-6 mt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-3 py-4 px-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center text-[#F97316] flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Ficou com alguma dúvida residual sobre este tópico? Fale com a gente.
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://wa.me/5551999999999"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
};

export default FAQ;
