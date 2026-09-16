import { loadAllPages } from '@/lib/funnel';
import { useState, useEffect, useRef } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { appointmentsApi, professionalsApi, usuariosApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { AppointmentQuickView } from '@/components/AppointmentQuickView';
import { useAuth } from '@/contexts/AuthContext';
import { useSectionTour } from '@/hooks/useSectionTour';
import { TourPopover } from '@/components/onboarding/TourPopover';

const Appointments = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [searchQuery, setSearchQuery] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [quickViewAptId, setQuickViewAptId] = useState<number | null>(null);
  const { toast } = useToast();
  const { professional } = useAuth();

  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>("");

  // Tour de primeira visita
  const { tourActive, tourStep, tourSteps, tourHandleNext, tourHandlePrev, tourHandleClose } =
    useSectionTour('appointments', [
      { id: null, title: '📅 Agenda', description: 'Aqui você visualiza e gerencia todos os agendamentos da sua clínica em visões de Dia, Semana ou Mês.', position: 'center' },
      { id: '#apt-new-btn', title: '➕ Novo Agendamento', description: 'Crie um novo agendamento associando paciente, serviço e horário em poucos cliques.', position: 'bottom' },
      { id: '#apt-calendar', title: '🗓 Calendário', description: 'Use o mini-calendário para navegar entre datas ou alterne entre as visões Dia, Semana e Mês.', position: 'right' },
      { id: '#apt-main-view', title: '🔭 Visão Principal', description: 'Aqui ficam todos os agendamentos do período. Clique em qualquer card para ver os detalhes completos.', position: 'center' },
    ]);


  const listRequest = useRef(0);
  const loadAppointments = async () => {
    if (!selectedProfFilter) return;
    const request = ++listRequest.current;
    setIsLoading(true);
    try {
      const data = await loadAllPages(params => appointmentsApi.getAll({ ...params, professionalId: Number(selectedProfFilter) }));
      if (request !== listRequest.current) return;
      if (data) {
        const mapped = data.map((apt: any) => ({
          id: apt.id,
          date: parseISO(apt.startTime),
          time: format(parseISO(apt.startTime), "HH:mm"),
          clientName: apt.client?.name || apt.lead?.name || "Paciente s/ Nome",
          service: apt.service?.name || "Serviço s/ Nome",
          status: apt.status || "agendado",
          duration: Math.round((new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime()) / 60000),
          leadStatus: apt.lead?.status || null,
          googleSyncStatus: apt.googleSyncStatus,
          googleSyncError: apt.googleSyncError,
        }));
        setAppointments(mapped);
      }
    } catch (error) {
      if (request !== listRequest.current) return;
      setAppointments([]);
      toast({ title: "Erro", description: "Não foi possível carregar os agendamentos.", variant: "destructive" });
    } finally {
      if (request === listRequest.current) setIsLoading(false);
    }
  };

  const loadProfessionals = async () => {
    try {
      const [profRes, usrRes] = await Promise.all([
        professionalsApi.getAll({ pageSize: 50 }),
        usuariosApi.getAll({ pageSize: 100 })
      ]);
      
      let allProfs: any[] = [];
      if (profRes.success && profRes.data) {
        allProfs = [...profRes.data];
      }
      
      if (usrRes.success && usrRes.data) {
        const medics = usrRes.data.filter((u: any) => {
          if (u.role?.isSpecialist) return true;
          const role = (u.role?.name || u.role || '').toLowerCase();
          return role.includes('medico') || role.includes('médico') || role.includes('doutor') || role.includes('especialista');
        });
        
        const existingIds = new Set(allProfs.map(p => p.id.toString()));
        medics.forEach((m: any) => {
          if (!existingIds.has(m.id.toString())) {
            allProfs.push(m);
            existingIds.add(m.id.toString());
          }
        });
      }
      setProfessionalsList(allProfs);
      
      if (allProfs.length === 0) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Erro ao carregar profissionais", error);
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    loadProfessionals();
  }, []);

  useEffect(() => {
    if (professionalsList.length > 0 && !selectedProfFilter) {
      const defaultProf = professional && professionalsList.find(p => p.id.toString() === professional.id?.toString()) 
        ? professional.id.toString() 
        : professionalsList[0].id.toString();
      setSelectedProfFilter(defaultProf);
    }
  }, [professionalsList, professional, selectedProfFilter]);

  useEffect(() => {
    if (selectedProfFilter) loadAppointments();
  }, [selectedProfFilter]);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 0 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 0 }),
  });

  const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const getStatusConfig = (apt: any) => {
    // Lead que compareceu (prospect_attended) ou consulta feita → verde mesmo
    const effectiveStatus =
      (apt.leadStatus === 'prospect_attended' || apt.leadStatus === 'comercial_consult')
        ? 'confirmado'
        : apt.status;
    switch (effectiveStatus) {
      case 'confirmado': return { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600', dot: 'bg-emerald-500', label: 'Confirmado' };
      case 'agendado':   return { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600',   dot: 'bg-amber-500',   label: 'Agendado' };
      case 'cancelado':  return { bg: 'bg-red-500/10 border-red-500/20 text-red-500',         dot: 'bg-red-500',     label: 'Cancelado' };
      case 'concluido':  return { bg: 'bg-sky-500/10 border-sky-500/20 text-sky-600',         dot: 'bg-sky-500',     label: 'Concluído' };
      default:           return { bg: 'bg-slate-100 border-slate-200 text-slate-600',          dot: 'bg-slate-400',   label: effectiveStatus };
    }
  };

  const getGoogleSyncBadge = (apt: any) => {
    if (!apt?.googleSyncStatus || ['synced', 'not_synced', 'deleted'].includes(apt.googleSyncStatus)) return null;
    const isError = apt.googleSyncStatus === 'error';
    return (
      <span
        title={isError ? (apt.googleSyncError || 'Falha ao sincronizar com Google Calendar') : 'Sincronizacao pendente com Google Calendar'}
        className={`material-symbols-outlined text-[13px] ${isError ? 'text-red-500' : 'text-amber-500'}`}
      >
        {isError ? 'sync_problem' : 'sync'}
      </span>
    );
  };

  const handleCheckApt = async (aptId: number) => {
    try {
      await appointmentsApi.update(aptId, { status: 'confirmado' });
      loadAppointments();
      toast({ title: 'Confirmado!', description: 'Agendamento marcado como confirmado.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status.', variant: 'destructive' });
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'dia') {
      setSelectedDate(direction === 'prev' ? addDays(selectedDate, -1) : addDays(selectedDate, 1));
    } else if (viewMode === 'semana') {
      setCurrentWeek(direction === 'prev' ? subWeeks(currentWeek, 1) : addWeeks(currentWeek, 1));
    } else {
      setCurrentWeek(direction === 'prev'
        ? new Date(currentWeek.getFullYear(), currentWeek.getMonth() - 1, 1)
        : new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 1));
    }
  };

  const getDisplayDates = () => {
    if (viewMode === 'dia') return [selectedDate];
    if (viewMode === 'semana') return weekDays;
    
    // Para alinhar corretamente o grid de Mês (iniciando no domingo)
    const start = startOfWeek(startOfMonth(currentWeek), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentWeek), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const filteredAppointments = appointments.filter(apt =>
    apt.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    apt.service.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayAppointments = appointments.filter(apt => isSameDay(apt.date, new Date()));
  const todayConfirmed = todayAppointments.filter(a => a.status === 'confirmado').length;
  const todayPending = todayAppointments.filter(a => a.status === 'agendado').length;

  const stats = [
    { label: 'Hoje', value: todayAppointments.length, icon: 'today' },
    { label: 'Confirmados', value: todayConfirmed, icon: 'check_circle' },
    { label: 'Pendentes', value: todayPending, icon: 'schedule' },
    { label: 'Total Geral', value: appointments.length, icon: 'calendar_month' },
  ];

  return (
    <div className="relative space-y-10 pb-10 overflow-hidden">
      <TourPopover active={tourActive} step={tourStep} steps={tourSteps} onNext={tourHandleNext} onPrev={tourHandlePrev} onClose={tourHandleClose} />

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
        <div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">Agendamentos</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">Gerencie seus compromissos e horários</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {professionalsList.length > 1 && (
            <Select value={selectedProfFilter} onValueChange={setSelectedProfFilter}>
              <SelectTrigger className="w-[160px] sm:w-[200px] border-slate-200 bg-white text-xs sm:text-sm">
                <SelectValue placeholder="Filtrar por especialista">
                  {professionalsList.find(p => p.id.toString() === selectedProfFilter)?.name || "Todos os especialistas"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {professionalsList.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id.toString()}>
                    {prof.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            <span className="hidden sm:inline">Filtros</span>
          </Button>
          <Button id="apt-new-btn" variant="secondary" size="xl" onClick={() => setOpenModal(true)} className="shadow-lg shadow-secondary/20 h-9 sm:h-auto text-xs sm:text-sm">
            <span className="material-symbols-outlined text-base sm:text-lg">add</span>
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
        {stats.map((s) => (
          <div key={s.label} className="premium-card p-4 sm:p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</div>
              <div className="p-2 bg-blue-50 text-accent rounded-xl">
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
              </div>
            </div>
            <div className="pt-2">
              <div className="stats-value">{s.value}</div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                {s.label === 'Hoje' ? 'agendados para hoje' : 
                 s.label === 'Confirmados' ? 'já confirmados' : 
                 s.label === 'Pendentes' ? 'aguardando' : 'no sistema'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">

        {/* ── Mini Calendar Sidebar ── */}
        <div id="apt-calendar" className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-lg">calendar_view_month</span>
              <h3 className="text-sm font-bold text-primary">Calendário</h3>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border-0 p-0 w-full"
              classNames={{
                months: "flex flex-col space-y-2 w-full",
                month: "space-y-2 w-full flex flex-col items-center",
                caption: "flex justify-center pt-1 relative items-center w-full",
                caption_label: "text-sm font-bold text-primary truncate",
                nav: "space-x-1 flex items-center",
                nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse mx-auto text-[12px]",
                head_row: "flex justify-between w-full",
                head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[10px] flex items-center justify-center",
                row: "flex justify-between w-full mt-1",
                cell: "aspect-square flex-1 text-center text-xs p-0 relative flex items-center justify-center",
                day: "w-full h-full flex items-center justify-center rounded-xl hover:bg-primary/10 aria-selected:bg-primary aria-selected:text-white transition-all",
                day_selected: "bg-primary text-white hover:bg-primary font-bold",
                day_today: "bg-secondary/10 text-secondary font-bold",
                day_outside: "text-muted-foreground opacity-40",
              }}
            />
          </Card>

          {/* Today's Quick Stats */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-secondary text-lg">bar_chart</span>
              <h3 className="text-sm font-bold text-primary">Hoje</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Agendados', value: todayAppointments.length, color: 'text-primary', dot: 'bg-primary' },
                { label: 'Confirmados', value: todayConfirmed, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                { label: 'Pendentes', value: todayPending, color: 'text-amber-600', dot: 'bg-amber-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Main Calendar View ── */}
        <div id="apt-main-view" className="lg:col-span-3">
          <Card className="overflow-hidden">

            {/* Controls Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                    <span className="material-symbols-outlined text-slate-600 text-base">chevron_left</span>
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                    <span className="material-symbols-outlined text-slate-600 text-base">chevron_right</span>
                  </Button>
                  <h2 className="text-xs sm:text-base font-black text-primary font-headline ml-1 truncate">
                    {viewMode === 'dia'
                      ? format(selectedDate, "dd 'de' MMM, yyyy", { locale: ptBR })
                      : viewMode === 'semana'
                      ? `${format(weekDays[0], "dd MMM", { locale: ptBR })} - ${format(weekDays[6], "dd MMM", { locale: ptBR })}`
                      : format(currentWeek, "MMMM yyyy", { locale: ptBR })}
                  </h2>
                </div>

                <Select value={viewMode} onValueChange={(v: 'dia' | 'semana' | 'mes') => setViewMode(v)}>
                  <SelectTrigger className="w-28 rounded-xl border-slate-200 text-sm font-semibold">
                    <SelectValue>
                      {viewMode === 'dia' ? 'Dia' : viewMode === 'semana' ? 'Semana' : 'Mês'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Dia</SelectItem>
                    <SelectItem value="semana">Semana</SelectItem>
                    <SelectItem value="mes">Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">search</span>
                <Input
                  placeholder="Buscar agendamentos..."
                  className="pl-9 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Calendar Body */}
            <div>
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && viewMode === 'dia' && (
                <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px] border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[64px_1fr] bg-primary/5 border-b border-slate-100 shrink-0">
                    <div className="p-3 text-xs text-muted-foreground border-r border-slate-100" />
                    <div className="p-3">
                      <div className="text-sm font-black text-primary">{format(selectedDate, 'EEEE', { locale: ptBR })}</div>
                      <div className="text-xs text-muted-foreground">{filteredAppointments.filter(apt => isSameDay(apt.date, selectedDate)).length} agendamentos</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pb-6 relative">
                    <div className="relative">
                    {/* Grid de Fundo */}
                    <div>
                      {timeSlots.slice(7, 20).map((time) => (
                        <div key={time} className="grid grid-cols-[64px_1fr] border-b border-slate-100/80 transition-colors" style={{ height: '64px' }}>
                          <div className="p-2 text-xs text-muted-foreground border-r border-slate-100 flex items-start justify-end pt-2 font-mono bg-white/50">{time}</div>
                          <div className="p-2" />
                        </div>
                      ))}
                    </div>

                    {/* Overlay de Agendamentos */}
                    <div className="absolute top-0 left-[64px] right-0 bottom-0 pointer-events-none">
                      {filteredAppointments.filter(apt => isSameDay(apt.date, selectedDate)).map((apt) => {
                        const [h, m] = apt.time.split(':').map(Number);
                        if (h < 7 || h >= 20) return null; // Fora do horário comercial visível

                        const topOffset = ((h - 7) * 64) + ((m / 60) * 64);
                        const height = (apt.duration / 60) * 64;
                        const st = getStatusConfig(apt);

                        // Calcula o horário de término para exibição
                        const endTime = new Date(apt.date.getTime() + apt.duration * 60000);

                        return (
                          <div
                            key={apt.id}
                            className={`absolute left-2 right-4 rounded-xl border px-3 py-2 cursor-pointer hover:shadow-md transition-all overflow-hidden shadow-sm pointer-events-auto flex flex-col justify-center ${st.bg}`}
                            style={{ top: `${topOffset}px`, height: `${Math.max(height - 4, 36)}px`, zIndex: 10 }}
                            onClick={() => setQuickViewAptId(apt.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                                  <span className="font-bold text-sm leading-none">{apt.clientName}</span>
                                  {getGoogleSyncBadge(apt)}
                                </div>
                                {height > 40 && (
                                  <span className="text-xs opacity-80 ml-3.5 leading-tight">{apt.service}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {height > 50 && (
                                  <div className="text-xs font-mono font-medium opacity-70 bg-white/40 px-1.5 py-0.5 rounded-md">
                                    {apt.time} - {format(endTime, 'HH:mm')}
                                  </div>
                                )}
                                {apt.status !== 'confirmado' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCheckApt(apt.id); }}
                                    title="Marcar como compareceu"
                                    className="w-6 h-6 rounded-full bg-white/70 hover:bg-emerald-500 hover:text-white text-emerald-600 flex items-center justify-center transition-all border border-current/20 shrink-0"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {!isLoading && viewMode === 'semana' && (
                <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px] border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-primary/5 border-b border-slate-100 shrink-0">
                    <div className="p-2 border-r border-slate-100" />
                    {weekDays.map((day, idx) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toISOString()} className={`p-2 text-center border-r border-slate-100 ${idx === 6 ? 'border-r-0' : ''}`}>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{format(day, 'EEE', { locale: ptBR })}</div>
                          <div className={`text-sm font-black mx-auto w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-secondary text-white shadow-md shadow-orange-500/30' : 'text-primary'}`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 overflow-y-auto pb-6 relative">
                    <div className="relative">
                    {/* Grid de Fundo da Semana */}
                    <div>
                      {timeSlots.slice(7, 20).map((time) => (
                        <div key={time} className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100/80 transition-colors" style={{ height: '64px' }}>
                          <div className="p-1.5 text-[10px] text-muted-foreground border-r border-slate-100 flex items-start justify-end pt-2 font-mono bg-white/50">{time}</div>
                          {weekDays.map((_, idx) => (
                            <div key={idx} className={`border-r border-slate-100/40 ${idx === 6 ? 'border-r-0' : ''}`} />
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Overlay de Agendamentos da Semana */}
                    <div className="absolute top-0 left-[56px] right-0 bottom-0 pointer-events-none flex">
                      {weekDays.map((day, idx) => {
                        const dayApts = filteredAppointments.filter(apt => isSameDay(apt.date, day));
                        return (
                          <div key={idx} className="flex-1 relative">
                            {dayApts.map((apt) => {
                              const [h, m] = apt.time.split(':').map(Number);
                              if (h < 7 || h >= 20) return null;

                              const topOffset = ((h - 7) * 64) + ((m / 60) * 64);
                              const height = (apt.duration / 60) * 64;
                              const st = getStatusConfig(apt);

                              return (
                                <div 
                                  key={apt.id} 
                                  className={`absolute left-0.5 right-1 rounded-lg border px-1.5 py-1 cursor-pointer hover:shadow-md transition-all text-[10px] overflow-hidden shadow-sm pointer-events-auto flex flex-col ${st.bg}`}
                                  style={{ top: `${topOffset}px`, height: `${Math.max(height - 2, 24)}px`, zIndex: 10 }}
                                  onClick={() => setQuickViewAptId(apt.id)}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                                    <span className="font-bold truncate leading-none">{apt.clientName}</span>
                                    {getGoogleSyncBadge(apt)}
                                  </div>
                                  {height > 35 && (
                                    <div className="opacity-70 truncate mt-1 pl-2.5 leading-none">{apt.service}</div>
                                  )}
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
              )}

              {!isLoading && viewMode === 'mes' && (
                <div>
                  <div className="grid grid-cols-7 border-b border-slate-100">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                      <div key={d} className="py-2 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-r border-slate-100 last:border-r-0">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-slate-100">
                    {getDisplayDates().map((date) => {
                      const dateApts = filteredAppointments.filter(apt => isSameDay(apt.date, date));
                      const isToday = isSameDay(date, new Date());
                      const isCurrentMonth = date.getMonth() === currentWeek.getMonth();
                      return (
                        <div
                          key={date.toISOString()}
                          className={`min-h-[90px] p-1.5 bg-white cursor-pointer hover:bg-primary/3 transition-colors ${isToday ? 'ring-2 ring-inset ring-secondary/60' : ''} ${!isCurrentMonth ? 'opacity-40 bg-slate-50' : ''}`}
                          onClick={() => { setSelectedDate(date); setViewMode('dia'); }}
                        >
                          <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-secondary text-white' : 'text-slate-600'}`}>
                            {format(date, 'd')}
                          </div>
                          <div className="space-y-0.5">
                            {dateApts.slice(0, 3).map((apt) => {
                              const st = getStatusConfig(apt);
                              return (
                                <div 
                                  key={apt.id} 
                                  className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity ${st.bg}`}
                                  onClick={(e) => { e.stopPropagation(); setQuickViewAptId(apt.id); }}
                                >
                                  <span className="font-bold">{apt.time}</span> {apt.clientName} {getGoogleSyncBadge(apt)}
                                </div>
                              );
                            })}
                            {dateApts.length > 3 && (
                              <div className="text-[10px] text-muted-foreground pl-1">+{dateApts.length - 3} mais</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>
          </Card>
        </div>
      </div>

      <NewAppointmentModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={loadAppointments}
        initialDate={selectedDate}
      />

      <AppointmentQuickView
        isOpen={!!quickViewAptId}
        appointmentId={quickViewAptId}
        onClose={() => setQuickViewAptId(null)}
        onUpdate={loadAppointments}
      />
    </div>
  );
};

export default Appointments;
