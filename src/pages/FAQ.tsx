import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  MessageCircle,
  BarChart,
  Calendar,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Inbox
} from 'lucide-react';
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
    { id: "Geral", icon: <ShieldCheck className="w-4 h-4" />, desc: "Visão do produto" },
    { id: "WhatsApp", icon: <MessageCircle className="w-4 h-4" />, desc: "API Oficial e campanhas" },
    { id: "Conversas", icon: <Inbox className="w-4 h-4" />, desc: "Atendimento da equipe" },
    { id: "Comercial", icon: <BarChart className="w-4 h-4" />, desc: "Funil, propostas e metas" },
    { id: "Agenda", icon: <Calendar className="w-4 h-4" />, desc: "Consultas e profissionais" },
    { id: "Equipe", icon: <Users className="w-4 h-4" />, desc: "Perfis e permissões" },
  ];

  const faqs = [
    {
      category: "Geral",
      question: "O que é o SellClin?",
      answer: "O SellClin é um CRM para a operação comercial de clínicas. Ele reúne leads, funil de vendas, conversas do WhatsApp Oficial, agenda, tarefas, propostas, metas e gestão da equipe em um único sistema."
    },
    {
      category: "Geral",
      question: "Para quais tipos de clínica o sistema foi criado?",
      answer: "O sistema atende clínicas médicas, odontológicas, estéticas e outras operações que captam leads, agendam avaliações e acompanham oportunidades até o fechamento. Ele pode ser usado por equipes pequenas ou por operações com recepção, SDR, closer, especialistas e gestores."
    },
    {
      category: "Geral",
      question: "Preciso usar todos os módulos desde o início?",
      answer: "Não. A clínica pode começar pelos módulos disponíveis no plano contratado e organizar o processo aos poucos. O acesso a cada módulo também pode ser controlado por usuário e por função."
    },
    {
      category: "Geral",
      question: "O SellClin substitui o sistema clínico ou prontuário médico?",
      answer: "O foco do SellClin é a gestão comercial e o atendimento: leads, conversas, agenda, propostas, tarefas e acompanhamento de vendas. Ele não deve ser tratado como substituto de um prontuário médico especializado."
    },
    {
      category: "WhatsApp",
      question: "A integração usa a API Oficial do WhatsApp?",
      answer: "Sim. O SellClin trabalha com a WhatsApp Business Platform, a API Oficial da Meta. Isso permite centralizar atendimentos, templates e campanhas dentro do CRM sem depender de conexões não oficiais."
    },
    {
      category: "WhatsApp",
      question: "O que significa coexistência no mesmo número?",
      answer: "A coexistência permite continuar usando o WhatsApp Business no celular e conectar esse mesmo número à plataforma oficial integrada ao SellClin. Assim, a clínica mantém a rotina no aplicativo e também organiza os atendimentos no CRM."
    },
    {
      category: "WhatsApp",
      question: "Preciso deixar um celular conectado ou escanear QR Code?",
      answer: "Não. A conexão oficial não depende de uma sessão do WhatsApp Web nem de um celular permanentemente conectado. A configuração é feita pelo fluxo oficial da Meta."
    },
    {
      category: "WhatsApp",
      question: "Como funciona a janela de atendimento de 24 horas?",
      answer: "Quando o contato envia uma mensagem, abre-se uma janela de 24 horas para respostas livres pela API Oficial. O SellClin mostra se a janela está aberta e quanto tempo resta. Quando ela termina, a retomada precisa seguir as regras de templates da Meta."
    },
    {
      category: "WhatsApp",
      question: "Como inicio ou retomo uma conversa fora da janela de 24 horas?",
      answer: "É necessário enviar um template previamente aprovado pela Meta. No SellClin, a equipe escolhe o template disponível e preenche as variáveis exigidas antes do envio."
    },
    {
      category: "WhatsApp",
      question: "O que são templates aprovados pela Meta?",
      answer: "São modelos de mensagem cadastrados e revisados pela Meta. Eles podem conter texto, variáveis e, conforme o modelo, cabeçalho, mídia ou botões. A aprovação e as regras de uso são definidas pela própria Meta."
    },
    {
      category: "WhatsApp",
      question: "Como funcionam as campanhas?",
      answer: "A clínica escolhe uma base autorizada, segmenta os contatos, seleciona um template aprovado e revisa as variáveis antes de criar a campanha. O envio ocorre pelo canal oficial escolhido e o SellClin acompanha o processamento e os destinatários."
    },
    {
      category: "WhatsApp",
      question: "Quais informações de campanha consigo acompanhar?",
      answer: "O painel mostra o andamento do processamento e os eventos disponibilizados pela integração oficial, como mensagens enviadas, entregues, lidas quando essa informação estiver disponível e respostas recebidas."
    },
    {
      category: "Conversas",
      question: "Todas as conversas ficam reunidas no sistema?",
      answer: "As conversas recebidas pelos números oficiais conectados aparecem na caixa de entrada da clínica. A equipe pode pesquisar por nome ou telefone e filtrar por situação, mensagens não lidas e etiquetas."
    },
    {
      category: "Conversas",
      question: "Como vejo somente mensagens que ainda não foram abertas?",
      answer: "Use o filtro Não lidas na lista de conversas. O sistema também exibe um contador nas conversas com mensagens pendentes e zera esse indicador quando elas são abertas."
    },
    {
      category: "Conversas",
      question: "Posso definir responsável e etiquetas para uma conversa?",
      answer: "Sim. A conversa pode receber um responsável e etiquetas criadas pela própria clínica. Isso ajuda a separar assuntos, organizar filas e localizar atendimentos com rapidez."
    },
    {
      category: "Conversas",
      question: "Posso enviar áudio e arquivos pelo atendimento?",
      answer: "Durante uma janela de atendimento aberta, a equipe pode enviar mensagens e usar os formatos de mídia suportados pelo canal, incluindo gravação de áudio e anexos disponíveis no composer do SellClin."
    },
    {
      category: "Comercial",
      question: "Como funciona o Funil de Vendas?",
      answer: "Cada oportunidade aparece como um card com responsável, origem, valor e histórico. A equipe move o lead entre as etapas do processo e mantém o próximo passo visível para todos que têm acesso."
    },
    {
      category: "Comercial",
      question: "Posso adaptar as etapas do funil à minha clínica?",
      answer: "Sim. A clínica pode configurar os funis e as etapas de acordo com o próprio processo comercial, por exemplo: lead novo, contato realizado, avaliação agendada, proposta enviada e venda concluída."
    },
    {
      category: "Comercial",
      question: "Como funcionam os responsáveis SDR, closer e especialista?",
      answer: "Os leads podem ser atribuídos aos profissionais envolvidos em cada fase. Isso permite separar prospecção, negociação e atendimento especializado, além de filtrar a operação por responsável."
    },
    {
      category: "Comercial",
      question: "É possível criar propostas para os leads?",
      answer: "Sim. A equipe pode registrar propostas vinculadas ao lead, acompanhar sua situação e relacionar o fechamento ao valor negociado. O histórico permanece disponível no dossiê do cliente."
    },
    {
      category: "Comercial",
      question: "Para que servem as tarefas e cadências?",
      answer: "Tarefas registram retornos e ações com prazo e responsável. As cadências ajudam a organizar sequências de acompanhamento para que uma oportunidade não fique sem próximo contato."
    },
    {
      category: "Comercial",
      question: "Como funciona a Engenharia de Metas?",
      answer: "A clínica informa a meta de faturamento e parâmetros como ticket médio e taxas de conversão. O sistema calcula o volume necessário em cada etapa para transformar a meta financeira em objetivos operacionais."
    },
    {
      category: "Agenda",
      question: "Quais visualizações a agenda oferece?",
      answer: "A agenda possui visualizações por dia, semana e mês, além de filtros por profissional. Isso permite que a recepção veja a rotina geral ou concentre o atendimento em uma agenda específica."
    },
    {
      category: "Agenda",
      question: "Quais status posso acompanhar nas consultas?",
      answer: "Os agendamentos usam status visuais para indicar situações como agendado, confirmado, concluído ou cancelado. A equipe consegue atualizar o andamento e localizar rapidamente o que exige atenção."
    },
    {
      category: "Agenda",
      question: "A agenda se conecta aos clientes e ao processo comercial?",
      answer: "Sim. O agendamento fica associado ao cliente e ao profissional, preservando o contexto necessário para a recepção e para a equipe comercial acompanharem a jornada."
    },
    {
      category: "Equipe",
      question: "Como funciona o controle de acesso da equipe?",
      answer: "A clínica pode criar funções e definir quais módulos e ações cada usuário pode acessar. Gestores podem ter visão ampla, enquanto SDRs, closers, especialistas e recepcionistas trabalham apenas com as áreas necessárias para sua função."
    },
    {
      category: "Equipe",
      question: "Cada profissional pode visualizar apenas seus atendimentos?",
      answer: "As regras de acesso podem limitar dados conforme a função e as atribuições do usuário. Por exemplo, SDRs, closers e especialistas podem trabalhar com conversas e leads vinculados às suas responsabilidades."
    },
    {
      category: "Equipe",
      question: "Consigo trabalhar com mais de uma clínica ou unidade?",
      answer: "Quando o usuário possui acesso a mais de uma empresa, ele pode alternar entre as clínicas disponíveis no seletor do sistema. Os dados e as permissões são respeitados em cada ambiente."
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // If no selectedFAQ yet, automatically select the first item on desktop
  useEffect(() => {
    const selectedIsVisible = filteredFaqs.some((faq) => faq.question === selectedFAQ?.question);
    if (!isMobile && filteredFaqs.length > 0 && !selectedIsVisible) {
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
            <p className="text-sm text-slate-500 font-medium max-w-xl">
              Encontre respostas sobre WhatsApp Oficial, conversas, campanhas, funil, agenda e gestão da equipe.
            </p>
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
                  <span className="text-[10px] text-slate-400 font-mono">Atualizado em outubro de 2026</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-headline font-black text-slate-900 leading-snug">
                  {selectedFAQ.question}
                </h2>

                <div className="h-px bg-slate-100" />

                <div className="prose prose-slate max-w-none text-slate-600 font-normal leading-relaxed text-sm whitespace-pre-line">
                  {selectedFAQ.answer}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <p className="text-xs text-slate-500 font-medium leading-normal">
                    Já utiliza o SellClin e precisa de ajuda com a sua conta?
                  </p>
                  <div className="flex gap-2">
                    <Link
                      to="/entrar"
                      className="flex-grow bg-slate-900 hover:bg-slate-800 text-white text-center py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      Acessar o sistema
                    </Link>
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
                Central de ajuda
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-headline font-extrabold text-white tracking-tight leading-tight">
              Ainda com dúvidas?
            </h2>

            <p className="text-slate-400 text-sm md:text-base font-normal leading-relaxed max-w-lg">
              Explore as respostas acima ou entre no sistema para acessar os canais de atendimento disponíveis para a sua conta.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/cadastro"
                className="bg-[#F97316] text-white hover:bg-orange-500 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
              >
                Conhecer o SellClin
              </Link>
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
              src="/atendente.webp"
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
                    Já utiliza o SellClin e precisa de ajuda com a sua conta?
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    to="/entrar"
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
                  >
                    Acessar o sistema
                  </Link>
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
