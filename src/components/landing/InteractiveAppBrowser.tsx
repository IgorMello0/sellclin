import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  KanbanSquare, 
  Calendar, 
  Target, 
  MessageCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock,
  User,
  Send,
  X,
  Plus,
  Sliders,
  TrendingUp,
  Award,
  Bookmark,
  CalendarCheck,
  Activity,
  LayoutDashboard,
  DollarSign,
  Layers,
  Share2,
  Receipt,
  Tag,
  Percent,
  Rocket,
  Handshake
} from 'lucide-react';

interface MockAppointment {
  id: number;
  dayIndex: number; // 0: Seg, 1: Ter, 2: Qua, 3: Qui, 4: Sex
  time: string; // "HH:MM"
  duration: number; // min
  clientName: string;
  service: string;
  status: 'confirmado' | 'agendado' | 'concluido';
  professional: string;
}

export const InteractiveAppBrowser = () => {
  const [activeTab, setActiveTab] = useState(0); // Dashboard active by default

  // --- KANBAN STATE (Tab 1) ---
  const [kanbanLeads, setKanbanLeads] = useState([
    { id: 1, name: "Clara M.", treatment: "Facetas", val: "R$ 15.000", stage: 0 },
    { id: 2, name: "João P.", treatment: "Implante", val: "R$ 8.000", stage: 1 },
    { id: 3, name: "Beatriz S.", treatment: "Ortodontia", val: "R$ 6.500", stage: 0 },
    { id: 4, name: "Carlos F.", treatment: "Lente Resina", val: "R$ 4.000", stage: 2 },
  ]);
  const [lastMovedId, setLastMovedId] = useState<number | null>(null);

  const moveLead = (id: number, direction: 1 | -1) => {
    setKanbanLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        const nextStage = lead.stage + direction;
        if (nextStage >= 0 && nextStage <= 2) {
          setLastMovedId(id);
          return { ...lead, stage: nextStage };
        }
      }
      return lead;
    }));
  };

  // --- AGENDA STATE & SIMULATOR (Tab 2) ---
  const [appointments, setAppointments] = useState<MockAppointment[]>([
    { id: 101, dayIndex: 0, time: "09:00", duration: 90, clientName: "Mariana Leme", service: "Lentes de Contato", status: "confirmado", professional: "Dra. Carolina M." },
    { id: 102, dayIndex: 1, time: "10:00", duration: 90, clientName: "Lucas Silva", service: "Facetas Porcelana", status: "agendado", professional: "Dra. Carolina M." },
    { id: 103, dayIndex: 2, time: "14:00", duration: 90, clientName: "Pedro Costa", service: "Implante Dentário", status: "concluido", professional: "Dr. Arthur Reis" },
    { id: 104, dayIndex: 3, time: "11:00", duration: 60, clientName: "Julia Santos", service: "Aplicação Botox", status: "confirmado", professional: "Dra. Carolina M." },
    { id: 105, dayIndex: 4, time: "15:00", duration: 90, clientName: "Roberto Abreu", service: "Avaliação Geral", status: "agendado", professional: "Dr. Arthur Reis" },
  ]);

  const [selectedApt, setSelectedApt] = useState<MockAppointment | null>(null);
  const [whatsappStep, setWhatsappStep] = useState<'idle' | 'sending' | 'replied' | 'done'>('idle');

  const startWhatsAppConfirmation = (apt: MockAppointment) => {
    setSelectedApt(apt);
    setWhatsappStep('idle');
  };

  const handleSendWhatsApp = () => {
    setWhatsappStep('sending');
    setTimeout(() => {
      setWhatsappStep('replied');
      setTimeout(() => {
        setWhatsappStep('done');
        setAppointments(prev => prev.map(a => a.id === selectedApt?.id ? { ...a, status: 'confirmado' } : a));
      }, 1500);
    }, 1500);
  };

  const closeAptDetails = () => {
    setSelectedApt(null);
    setWhatsappStep('idle');
  };

  const getCardPosition = (time: string, duration: number) => {
    const [h, m] = time.split(':').map(Number);
    const startHour = 8;
    const rowHeight = 60;
    const topOffset = ((h - startHour) * rowHeight) + ((m / 60) * rowHeight);
    const height = (duration / 60) * rowHeight;
    return { top: `${topOffset}px`, height: `${height - 3}px` };
  };

  const getStatusStyle = (status: 'confirmado' | 'agendado' | 'concluido') => {
    switch (status) {
      case 'confirmado':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20',
          dot: 'bg-emerald-500',
          label: 'Confirmado'
        };
      case 'agendado':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20 animate-pulse-subtle',
          dot: 'bg-amber-500',
          label: 'Agendado'
        };
      case 'concluido':
        return {
          bg: 'bg-sky-500/10 border-sky-500/30 text-sky-700 hover:bg-sky-500/20',
          dot: 'bg-sky-500',
          label: 'Concluído'
        };
    }
  };

  // --- GOALS STATE & CALCULATOR (Tab 3) ---
  const [revenueTarget, setRevenueTarget] = useState(150000);
  const [avgTicket, setAvgTicket] = useState(5000);
  const [schedulingRate, setSchedulingRate] = useState(60);
  const [showupRate, setShowupRate] = useState(60);
  const [closingRate, setClosingRate] = useState(45);

  const [savedPlans, setSavedPlans] = useState<any[]>([
    { id: 1, name: "Plano Default Tráfego", revenueTarget: 100000, avgTicket: 4000, schedulingRate: 50, showupRate: 55, closingRate: 40 },
    { id: 2, name: "Meta Alta Estética", revenueTarget: 250000, avgTicket: 7000, schedulingRate: 65, showupRate: 70, closingRate: 50 },
  ]);

  const salesNeeded = avgTicket > 0 ? Math.ceil(revenueTarget / avgTicket) : 0;
  const showupsNeeded = closingRate > 0 ? Math.ceil(salesNeeded / (closingRate / 100)) : 0;
  const appointmentsNeeded = showupRate > 0 ? Math.ceil(showupsNeeded / (showupRate / 100)) : 0;
  const leadsNeeded = schedulingRate > 0 ? Math.ceil(appointmentsNeeded / (schedulingRate / 100)) : 0;
  const cplMax = leadsNeeded > 0 ? ((salesNeeded * avgTicket) / leadsNeeded / 8).toFixed(2) : '0.00';

  const [showSaveToast, setShowSaveToast] = useState(false);

  const handleSaveSimulatorPlan = () => {
    const newPlan = {
      id: Date.now(),
      name: `Plano Simulação ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      revenueTarget,
      avgTicket,
      schedulingRate,
      showupRate,
      closingRate
    };
    setSavedPlans([newPlan, ...savedPlans]);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleLoadPlan = (plan: any) => {
    setRevenueTarget(plan.revenueTarget);
    setAvgTicket(plan.avgTicket);
    setSchedulingRate(plan.schedulingRate);
    setShowupRate(plan.showupRate);
    setClosingRate(plan.closingRate);
  };

  const handleDeletePlan = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPlans(savedPlans.filter(p => p.id !== id));
  };

  const tabs = [
    { id: 0, label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: 1, label: "Funil de Vendas", icon: <KanbanSquare size={18} /> },
    { id: 2, label: "Agenda Inteligente", icon: <Calendar size={18} /> },
    { id: 3, label: "Engenharia de Metas", icon: <Target size={18} /> },
  ];

  const weekDays = [
    { name: "Seg", date: "18" },
    { name: "Ter", date: "19" },
    { name: "Qua", date: "20" },
    { name: "Qui", date: "21" },
    { name: "Sex", date: "22" },
  ];

  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[#F97316] font-black text-xs uppercase tracking-[0.3em] mb-4 block">A Plataforma</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Tudo que sua clínica precisa. <br/>Sem a complexidade.</h2>
          <p className="text-lg text-slate-500 font-medium">Navegue pelas funcionalidades e veja como simplificamos o controle comercial e operacional da sua clínica.</p>
        </div>

        {/* App Browser Wrapper */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl sm:rounded-3xl shadow-[0_30px_100px_-20px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col md:flex-row md:h-[780px] md:max-h-[92vh]">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col shrink-0">
            {/* macOS window controls */}
            <div className="p-4 flex gap-2 border-b border-slate-100 hidden md:flex">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>

            <div className="p-3 md:p-6 overflow-x-auto md:overflow-x-visible">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 hidden md:block">Funcionalidades</h3>
              <nav className="flex md:flex-col gap-1.5 md:gap-2 min-w-max md:min-w-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap md:whitespace-normal w-auto md:w-full ${
                      activeTab === tab.id 
                        ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-auto p-6 hidden md:block">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-1">Como no CRM real</div>
                <div className="text-[10px] text-slate-500 mb-3">Esta interface simula exatamente as telas operacionais do SellClin.</div>
                
                {/* Navigation links for marketing pages */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60 mb-3">
                  <Link to="/funcionalidades/funil" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
                    Ver detalhes do Funil <ArrowRight size={10} />
                  </Link>
                  <Link to="/funcionalidades/agenda" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
                    Ver detalhes da Agenda <ArrowRight size={10} />
                  </Link>
                  <Link to="/funcionalidades/metas" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
                    Ver detalhes de Metas <ArrowRight size={10} />
                  </Link>
                </div>

                <div className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">Acesso Comercial Ativo</div>
              </div>
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 bg-[#FAFAFA] relative overflow-hidden flex flex-col min-h-[500px] md:min-h-0">
            
            {/* Tab 0: Dashboard (EXACT CRM REPLICA) */}
            {activeTab === 0 && (
              <div className="absolute inset-0 p-6 flex flex-col animate-fade-in overflow-y-auto select-none scrollbar-hide">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Dashboard Comercial</h3>
                    <p className="text-xs text-slate-400 font-medium">Centro de controle e métricas de conversão da clínica.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/cadastro" className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline">
                      Criar Conta Grátis <ArrowRight size={12} />
                    </Link>
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado ao Vivo
                    </span>
                  </div>
                </div>

                <div className="space-y-6 pb-6">
                  {/* Primary Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Total de Leads", val: 187, icon: <User size={16} />, bg: "bg-blue-50 text-blue-600 border-blue-100" },
                      { label: "Avaliação Agendada", val: 112, icon: <Calendar size={16} />, bg: "bg-orange-50 text-[#F97316] border-orange-100" },
                      { label: "Avaliação Comparecida", val: 67, icon: <CheckCircle2 size={16} />, bg: "bg-blue-50 text-blue-600 border-blue-100" },
                      { label: "Propostas Geradas", val: 30, icon: <Rocket size={16} />, bg: "bg-blue-50 text-blue-600 border-blue-100" },
                    ].map((card, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{card.label}</span>
                          <div className={`p-1.5 rounded-lg border ${card.bg}`}>{card.icon}</div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{card.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Secondary Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Faturamento Real.", val: "R$ 150k", icon: <Handshake size={14} />, bg: "bg-emerald-50 text-emerald-600 border-emerald-100" },
                      { label: "Ticket (Orçado)", val: "R$ 5k", icon: <Sliders size={14} />, bg: "bg-slate-50 text-slate-600 border-slate-200/60" },
                      { label: "Ticket (Fechado)", val: "R$ 4.5k", icon: <Check size={14} />, bg: "bg-slate-50 text-slate-600 border-slate-200/60" },
                      { label: "Parc. Médio Boleto", val: "4.5x", icon: <Receipt size={14} />, bg: "bg-blue-50 text-blue-600 border-blue-100" },
                      { label: "Desc. Concedido", val: "R$ 2.5k", icon: <Tag size={14} />, bg: "bg-red-50 text-red-500 border-red-100" },
                      { label: "Conversão (Qtd.)", val: "16%", icon: <Percent size={14} />, bg: "bg-blue-50 text-blue-600 border-blue-100" },
                    ].map((card, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider truncate mr-1">{card.label}</span>
                          <div className={`p-1 rounded-lg border ${card.bg}`}>{card.icon}</div>
                        </div>
                        <div className="text-lg font-black text-slate-800">{card.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Revenue Details Row */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Detalhamento de Receita</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Pix / Débito", val: "R$ 68.000" },
                        { label: "Cartão", val: "R$ 52.000" },
                        { label: "Boleto (Pagos)", val: "R$ 22.000" },
                        { label: "Dinheiro", val: "R$ 8.000" },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">{item.label}</span>
                          <div className="text-sm font-black text-slate-700">{item.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Two Columns: Funnel and Origins */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Funnel of Leads */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Layers size={12} className="text-blue-500" /> Funil de Leads SellClin
                      </h4>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Novos', val: 187, pct: 100, color: 'bg-blue-600' },
                          { label: 'Contatados', val: 135, pct: 72, color: 'bg-[#F97316]' },
                          { label: 'Agendados', val: 112, pct: 60, color: 'bg-blue-500' },
                          { label: 'Fechados', val: 30, pct: 16, color: 'bg-[#F97316]' },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 w-20 shrink-0 truncate">{row.label}</span>
                            <div className="flex-1 h-3.5 bg-slate-100 rounded-xl overflow-hidden relative">
                              <div
                                className={`h-full ${row.color} rounded-xl transition-all duration-500 flex items-center justify-end pr-2 text-[8px] font-bold text-white`}
                                style={{ width: `${row.pct}%` }}
                              >
                                {row.pct > 15 && <span>{row.val}</span>}
                              </div>
                              {row.pct <= 15 && (
                                <div className="absolute inset-y-0 left-2 flex items-center text-[8px] font-bold text-slate-600">
                                  {row.val}
                                </div>
                              )}
                            </div>
                            <span className="text-slate-800 text-[10px] font-black w-8 text-right shrink-0">{row.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Leads by Origin */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Share2 size={12} className="text-[#F97316]" /> Leads por Origem
                      </h4>
                      <div className="space-y-2.5">
                        {[
                          { name: 'Meta/Facebook Ads', count: 94, pct: 50.3, logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg', bg: 'bg-blue-50' },
                          { name: 'Google Ads/Search', count: 62, pct: 33.2, logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', bg: 'bg-red-50' },
                          { name: 'Instagram Orgânico', count: 31, pct: 16.6, logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png', bg: 'bg-pink-50' },
                        ].map((row, i) => {
                          const isInsta = row.name.toLowerCase().includes('instagram');
                          return (
                          <div key={i} className="flex items-center gap-3">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-current/5 overflow-hidden",
                              isInsta ? "bg-transparent p-0 border-none shadow-none" : `${row.bg} p-1`
                            )}>
                              <img src={row.logo} alt={row.name} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-0.5">
                                <span className="truncate">{row.name}</span>
                                <span className="shrink-0">{row.count} Leads</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${row.pct}%` }} />
                              </div>
                            </div>
                            <span className="text-slate-800 text-[10px] font-black w-8 text-right shrink-0">{row.pct}%</span>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Tab 1: Kanban */}
            {activeTab === 1 && (
              <div className="absolute inset-0 p-8 flex flex-col animate-fade-in">
                <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Funil de Vendas</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Acompanhe e avance seus pacientes pelas etapas comerciais.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link to="/funcionalidades/funil" className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline">
                      Saber Mais sobre o Funil <ArrowRight size={12} />
                    </Link>
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-800 transition-colors">
                      + Novo Lead
                    </button>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6 overflow-hidden">
                  {["Novos", "Em Atendimento", "Fechados"].map((colName, idx) => {
                    const colLeads = kanbanLeads.filter(l => l.stage === idx);
                    const colTotal = colLeads.reduce((acc, curr) => acc + parseInt(curr.val.replace(/\D/g, '')), 0);

                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col shadow-sm">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{colName}</span>
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{colLeads.length}</span>
                        </div>
                        
                        <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-hide">
                          {colLeads.map(lead => (
                            <div 
                              key={lead.id} 
                              className={`bg-white border p-3 rounded-xl shadow-sm transition-all duration-300 group ${lastMovedId === lead.id ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-800">{lead.name}</span>
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{lead.val}</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 mb-4">{lead.treatment}</div>
                              
                              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                {idx > 0 ? (
                                  <button onClick={() => moveLead(lead.id, -1)} className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                    <ChevronLeft size={12} />
                                  </button>
                                ) : <div className="w-5" />}
                                
                                {idx < 2 ? (
                                  <button onClick={() => moveLead(lead.id, 1)} className="px-2 py-1 flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors text-[9px] font-black uppercase">
                                    Avançar <ChevronRight size={10} />
                                  </button>
                                ) : <div className="text-[10px] font-bold text-slate-300 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500"/> Finalizado</div>}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">Total Potencial:</span>
                          <span className="font-black text-slate-700">R$ {colTotal.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Agenda */}
            {activeTab === 2 && (
              <div className="absolute inset-0 p-6 flex flex-col animate-fade-in overflow-hidden">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Agenda Médica</h3>
                    <p className="text-xs text-slate-400 font-medium">Cronograma de consultas e procedimentos da semana.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link to="/funcionalidades/agenda" className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline">
                      Saber Mais sobre a Agenda <ArrowRight size={12} />
                    </Link>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50">
                      Maio, 18 - 22
                    </span>
                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg">
                      Visão Semana
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm relative">
                  <div className="grid grid-cols-[50px_repeat(5,minmax(0,1fr))] bg-slate-50 border-b border-slate-200 shrink-0 text-center text-xs font-bold text-slate-500">
                    <div className="py-2.5 border-r border-slate-200" />
                    {weekDays.map((day, idx) => (
                      <div key={idx} className="py-2 border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 leading-none mb-1">{day.name}</span>
                        <span className="text-xs font-black text-slate-700">{day.date}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto relative min-h-0 select-none pb-4 scrollbar-hide">
                    <div className="relative">
                      {hours.map((hour) => (
                        <div key={hour} className="grid grid-cols-[50px_repeat(5,minmax(0,1fr))]" style={{ height: '60px' }}>
                          <div className="border-r border-b border-slate-100 text-[10px] text-slate-400 font-mono flex items-start justify-end pr-2 pt-1">
                            {hour}
                          </div>
                          {weekDays.map((_, i) => (
                            <div key={i} className="border-r border-b border-slate-100/60 last:border-r-0" />
                          ))}
                        </div>
                      ))}

                      <div className="absolute top-0 left-[50px] right-0 bottom-0 pointer-events-none">
                        <div className="relative w-full h-full flex">
                          {weekDays.map((_, colIdx) => {
                            const colApts = appointments.filter(a => a.dayIndex === colIdx);
                            return (
                              <div key={colIdx} className="flex-1 h-full relative">
                                {colApts.map((apt) => {
                                  const pos = getCardPosition(apt.time, apt.duration);
                                  const st = getStatusStyle(apt.status);
                                  
                                  return (
                                    <div
                                      key={apt.id}
                                      onClick={() => startWhatsAppConfirmation(apt)}
                                      className={`absolute left-1.5 right-1.5 rounded-xl border p-2 cursor-pointer shadow-sm pointer-events-auto transition-all duration-200 flex flex-col justify-between ${st.bg}`}
                                      style={{ top: pos.top, height: pos.height }}
                                    >
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                                          <span className="font-extrabold text-[11px] leading-tight truncate">{apt.clientName}</span>
                                        </div>
                                        <div className="text-[9px] font-bold opacity-80 leading-none truncate pl-3">{apt.service}</div>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-[8px] font-bold opacity-75 mt-1 border-t border-current/10 pt-1">
                                        <span>{apt.time}</span>
                                        <span>{apt.status === 'agendado' ? 'Pendente 💬' : st.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedApt && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
                        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            <span className="text-sm font-black text-slate-700">Visualizar Agendamento</span>
                          </div>
                          <button onClick={closeAptDetails} className="p-1 rounded-lg hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600">
                            <X size={16} />
                          </button>
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <User size={20} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-base">{selectedApt.clientName}</h4>
                              <p className="text-xs text-slate-400 font-bold">{selectedApt.professional}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">Procedimento</span>
                              <span className="font-extrabold text-slate-700">{selectedApt.service}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">Horário</span>
                              <span className="font-extrabold text-slate-700">{selectedApt.time} (90 min)</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-4 space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Integração WhatsApp CRM</label>
                            
                            {whatsappStep === 'idle' && (
                              <div className="space-y-3">
                                {selectedApt.status === 'agendado' ? (
                                  <>
                                    <div className="text-xs text-slate-500 leading-relaxed">
                                      Este paciente agendou online e ainda não confirmou. Envie a confirmação em 1 clique:
                                    </div>
                                    <button
                                      onClick={handleSendWhatsApp}
                                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10"
                                    >
                                      <MessageCircle size={16} /> Confirmar via WhatsApp
                                    </button>
                                  </>
                                ) : (
                                  <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    Consulta confirmada com sucesso!
                                  </div>
                                )}
                              </div>
                            )}

                            {whatsappStep === 'sending' && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                  <Send size={12} className="text-emerald-500 animate-bounce" />
                                  SellClin disparando template...
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-lg text-[11px] text-slate-700 border border-emerald-100 leading-relaxed max-w-[85%]">
                                  "Olá {selectedApt.clientName}, tudo bem? Confirmamos seu horário com {selectedApt.professional} amanhã às {selectedApt.time}?"
                                </div>
                                <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 animate-loading-bar" />
                                </div>
                              </div>
                            )}

                            {whatsappStep === 'replied' && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 animate-fade-in">
                                <div className="bg-emerald-50 p-3 rounded-lg text-[11px] text-slate-700 border border-emerald-100 leading-relaxed max-w-[85%]">
                                  "Olá {selectedApt.clientName}, tudo bem? Confirmamos seu horário..."
                                </div>
                                <div className="bg-white p-3 rounded-lg text-[11px] text-slate-800 border border-slate-100 leading-relaxed max-w-[80%] ml-auto text-right font-bold shadow-xs">
                                  "Sim! Confirmado, estarei aí."
                                </div>
                                <div className="text-[10px] text-emerald-600 font-black flex items-center gap-1 justify-end animate-pulse">
                                  <Check size={12} strokeWidth={3} /> Atualizando status para Confirmado...
                                </div>
                              </div>
                            )}

                            {whatsappStep === 'done' && (
                              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center space-y-2 animate-scale-up">
                                <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                                <div className="text-xs font-black text-emerald-800">Status Atualizado com Sucesso!</div>
                                <div className="text-[10px] text-emerald-600 font-medium">O card na agenda ficou verde e o no-show foi evitado.</div>
                                <button
                                  onClick={closeAptDetails}
                                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                >
                                  Fechar Detalhes
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Metas */}
            {activeTab === 3 && (
              <div className="absolute inset-0 p-6 flex flex-col animate-fade-in overflow-hidden select-none">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Engenharia de Metas</h3>
                    <p className="text-xs text-slate-400 font-medium">Configure suas taxas e simule o funil necessário para sua meta comercial.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/funcionalidades/metas" className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline mr-2">
                      Saber Mais sobre Metas <ArrowRight size={12} />
                    </Link>
                    <button
                      onClick={() => {
                        setRevenueTarget(150000); setAvgTicket(5000); setSchedulingRate(60); setShowupRate(60); setClosingRate(45);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1"
                    >
                      <Activity size={12} className="text-blue-500" /> Config. Tráfego
                    </button>
                    <button
                      onClick={() => {
                        setRevenueTarget(45000); setAvgTicket(1200); setSchedulingRate(30); setShowupRate(60); setClosingRate(60);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1"
                    >
                      <Activity size={12} className="text-[#F97316]" /> Config. Indicações
                    </button>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto min-h-0 pr-1 pb-4 scrollbar-hide">
                  
                  {/* Left: Parameters Panel */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Sliders size={16} className="text-blue-600" />
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Parâmetros do Plano</h4>
                    </div>

                    {/* Faturamento Meta Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="text-slate-400 font-bold uppercase tracking-wide text-[10px]">Faturamento Meta</label>
                        <span className="font-extrabold text-blue-600 text-sm">R$ {revenueTarget.toLocaleString('pt-BR')}</span>
                      </div>
                      <input 
                        type="range" min="10000" max="500000" step="5000"
                        value={revenueTarget} 
                        onChange={(e) => setRevenueTarget(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    {/* Ticket Médio Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="text-slate-400 font-bold uppercase tracking-wide text-[10px]">Ticket Médio</label>
                        <span className="font-extrabold text-slate-700 text-sm">R$ {avgTicket.toLocaleString('pt-BR')}</span>
                      </div>
                      <input 
                        type="range" min="500" max="20000" step="500"
                        value={avgTicket} 
                        onChange={(e) => setAvgTicket(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-slate-600"
                      />
                    </div>

                    {/* Conversion Rate Sliders */}
                    <div className="border-t border-slate-100 pt-3 space-y-4">
                      {/* Lead -> Agenda */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Lead → Agendamento</span>
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">{schedulingRate}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" step="1"
                          value={schedulingRate} 
                          onChange={(e) => setSchedulingRate(Number(e.target.value))}
                          className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      {/* Agenda -> Presença */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Agendamento → Presença</span>
                          <span className="text-[#F97316] bg-orange-50 px-1.5 py-0.5 rounded text-[10px]">{showupRate}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" step="1"
                          value={showupRate} 
                          onChange={(e) => setShowupRate(Number(e.target.value))}
                          className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-[#F97316]"
                        />
                      </div>

                      {/* Presença -> Venda */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Presença → Venda</span>
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">{closingRate}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" step="1"
                          value={closingRate} 
                          onChange={(e) => setClosingRate(Number(e.target.value))}
                          className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Results Panel */}
                  <div className="lg:col-span-7 space-y-4 flex flex-col justify-start">
                    
                    {/* 4 Result Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      
                      {/* Leads Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider mb-1">Leads</span>
                        <div className="text-lg font-black text-blue-600 leading-tight">{leadsNeeded.toLocaleString()}</div>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">Necessários</span>
                      </div>

                      {/* Agendamentos Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider mb-1">Agendados</span>
                        <div className="text-lg font-black text-[#F97316] leading-tight">{appointmentsNeeded.toLocaleString()}</div>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">{schedulingRate}% de taxa</span>
                      </div>

                      {/* Presenças Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider mb-1">Presenças</span>
                        <div className="text-lg font-black text-blue-600 leading-tight">{showupsNeeded.toLocaleString()}</div>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">{showupRate}% de taxa</span>
                      </div>

                      {/* Vendas Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider mb-1">Vendas</span>
                        <div className="text-lg font-black text-[#F97316] leading-tight">{salesNeeded.toLocaleString()}</div>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">{closingRate}% de conv.</span>
                      </div>

                    </div>

                    {/* Funnel Flow Bars */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-blue-500" /> Fluxo de Funil Projetado
                      </h5>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Leads de Entrada', value: leadsNeeded, color: 'bg-blue-600', pct: 100 },
                          { label: 'Agendamentos', value: appointmentsNeeded, color: 'bg-[#F97316]', pct: schedulingRate },
                          { label: 'Visitas/Presenças', value: showupsNeeded, color: 'bg-blue-500', pct: showupRate },
                          { label: 'Vendas Fechadas', value: salesNeeded, color: 'bg-[#F97316]', pct: closingRate },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 w-24 shrink-0 truncate">{row.label}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${row.color} rounded-full transition-all duration-500`}
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                            <span className="text-slate-800 text-[10px] font-black w-8 text-right shrink-0">{row.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Projected Revenue & Save */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex items-center justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[30px] -mr-10 -mt-10 pointer-events-none" />
                      
                      <div className="space-y-0.5 relative z-10">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Faturamento Estimado</span>
                        <div className="text-2xl font-black text-white">R$ {(salesNeeded * avgTicket).toLocaleString('pt-BR')}</div>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-extrabold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded">
                            CPL Máx: R$ {cplMax}
                          </span>
                          <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Plano Viável
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleSaveSimulatorPlan}
                        className="px-4 py-2.5 bg-[#F97316] hover:bg-[#ea580c] text-white rounded-xl text-xs font-black shadow-md transition-colors flex items-center gap-1.5 relative z-10"
                      >
                        <Bookmark size={14} /> Salvar Plano
                      </button>
                    </div>

                    {/* Saved Plans Simulator List */}
                    <div className="space-y-2 border-t border-slate-200/60 pt-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <Bookmark size={12} className="text-slate-400" />
                        <span>Planos Salvos ({savedPlans.length})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-[100px] overflow-y-auto pr-1 scrollbar-hide">
                        {savedPlans.map(plan => (
                          <div 
                            key={plan.id}
                            onClick={() => handleLoadPlan(plan)}
                            className="bg-white border border-slate-200/80 rounded-xl p-2 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex justify-between items-center group"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-black text-slate-700 truncate">{plan.name}</div>
                              <div className="text-[8px] text-slate-400 font-bold mt-0.5">
                                R$ {plan.revenueTarget.toLocaleString('pt-BR')} · Ticket R$ {plan.avgTicket.toLocaleString('pt-BR')}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => handleDeletePlan(plan.id, e)}
                              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>

                {/* Toast Notification Simulation */}
                {showSaveToast && (
                  <div className="absolute bottom-6 right-6 bg-slate-950 text-white border border-slate-800 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 z-50 animate-scale-up">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <div className="text-xs">
                      <span className="font-black block">Plano Salvo!</span>
                      <span className="text-[10px] text-slate-400">Gravado com sucesso nos seus parâmetros.</span>
                    </div>
                  </div>
                )}

              </div>
            )}
            
          </div>
        </div>
      </div>
    </section>
  );
};
