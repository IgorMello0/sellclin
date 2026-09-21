import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus, Clock, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { clientsApi, catalogsApi, appointmentsApi, professionalsApi, usuariosApi, empresasApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface NewAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialClientId?: string;
  initialClientName?: string;
  initialClientPhone?: string;
  initialLeadId?: string;
  initialLeadName?: string;
  initialLeadPhone?: string;
  /** Serviços/tags pré-selecionados (ex: vindo da proposta fechada) */
  initialServiceTags?: string[];
}

export function NewAppointmentModal({
  open,
  onOpenChange,
  onSuccess,
  initialDate,
  initialClientId,
  initialClientName,
  initialClientPhone,
  initialLeadId,
  initialLeadName,
  initialLeadPhone,
  initialServiceTags,
}: NewAppointmentModalProps) {
  const { professional } = useAuth();
  const allowAction = useActionPermission();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Data lists
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [companyProfessionals, setCompanyProfessionals] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Form state
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [selectedSdrId, setSelectedSdrId] = useState<string>("none");
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(
    initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [time, setTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Consultation fee
  const [chargeConsultation, setChargeConsultation] = useState(false);
  const [consultationAmount, setConsultationAmount] = useState<string>("");
  const [consultationPaymentMethod, setConsultationPaymentMethod] = useState<string>("");

  // Computed
  const isQuickCreate = !!(initialLeadId || initialClientName);
  const quickClientData = {
    name: initialLeadName || initialClientName || "",
    phone: initialLeadPhone || initialClientPhone || "",
    leadId: initialLeadId,
  };

  const selectedService = services.find(s => s.id.toString() === selectedServiceId);
  const serviceDuration = selectedService?.durationMinutes || 60;

  const calculateEndTime = (startTime: string, durationMin: number) => {
    if (!startTime) return "";
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + durationMin;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  // Load initial data when modal opens
  useEffect(() => {
    if (open && professional) {
      loadInitialData();
      if (initialClientId) setSelectedClient(initialClientId);
      else setSelectedClient("");
      setSelectedServiceId("");
      setTime("");
      setAvailableSlots([]);
    }
  }, [open, initialClientId, professional]);

  const loadInitialData = async () => {
    if (!professional?.id) return;
    setDataLoading(true);
    try {
      const [clientsRes, profsRes, usrRes, empresaRes] = await Promise.all([
        clientsApi.getAll({ pageSize: 100 }),
        professionalsApi.getAll({ pageSize: 50 }),
        usuariosApi.getAll({ pageSize: 100 }),
        empresasApi.getMyCompany()
      ]);
      if (clientsRes.success) setClients(clientsRes.data || []);
      if (empresaRes.success && empresaRes.data) {
        setChargeConsultation(empresaRes.data.chargeConsultation || false);
      }
      
      let allProfs: any[] = [];
      if (profsRes.success && profsRes.data) {
        allProfs = [...profsRes.data.map((p: any) => ({ ...p, _isUsuario: false }))];
      }
      if (usrRes.success && usrRes.data) {
        const medics = usrRes.data.filter((u: any) => {
          if (u.isActive === false) return false;
          if (u.role?.isSpecialist) return true;
          const role = (u.role?.name || u.role || '').toLowerCase();
          return role.includes('medico') || role.includes('médico') || role.includes('doutor') || role.includes('especialista');
        });
        const sdrUsers = usrRes.data.filter((u: any) => u.isActive !== false && u.role?.isSDR);
        setSdrs(sdrUsers);
        
        // Auto-select logged in user as SDR if they are in the list
        if (professional?.id) {
          const isUserSdr = sdrUsers.find((u: any) => u.id.toString() === professional.id.toString());
          if (isUserSdr) {
            setSelectedSdrId(professional.id.toString());
          }
        }

        const existingIds = new Set(allProfs.map(p => p.id.toString()));
        medics.forEach((m: any) => {
          if (!existingIds.has(m.id.toString())) {
            allProfs.push({ ...m, _isUsuario: true });
            existingIds.add(m.id.toString());
          }
        });
      }
      
      if (allProfs.length > 0) {
        setCompanyProfessionals(allProfs);
        const defaultProf =
          allProfs.find((p: any) => p.id.toString() === professional.id) || allProfs[0];
        setSelectedProfessionalId(defaultProf?.id.toString() || professional.id);
      } else {
        setSelectedProfessionalId(professional.id);
      }
    } catch (error) {
      console.error("Error loading modal initial data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  // Load services when professional changes
  useEffect(() => {
    if (open && selectedProfessionalId) loadServices(selectedProfessionalId);
  }, [open, selectedProfessionalId]);

  const loadServices = async (profId: string) => {
    try {
      const res = await catalogsApi.getAll({ pageSize: 100, professionalId: Number(profId) });
      if (res.success) {
        const svcList = res.data || [];
        setServices(svcList);
        // Pre-select first service matching initialServiceTags if provided
        if (initialServiceTags && initialServiceTags.length > 0) {
          const match = svcList.find((s: any) =>
            initialServiceTags.some(tag => s.name.toLowerCase().includes(tag.toLowerCase()))
          );
          if (match) setSelectedServiceId(match.id.toString());
        }
      }
    } catch (error) {
      console.error("Error loading services", error);
    }
  };

  // Load available slots when professional, date, or service (duration) changes
  useEffect(() => {
    if (open && selectedProfessionalId && date) {
      loadAvailableSlots();
    }
  }, [open, selectedProfessionalId, date, selectedServiceId]);

  const loadAvailableSlots = async () => {
    if (!selectedProfessionalId || !date) return;
    setSlotsLoading(true);
    setTime(""); // Reset time when inputs change
    try {
      const selectedProf = companyProfessionals.find(p => p.id.toString() === selectedProfessionalId);
      const isUsuario = selectedProf ? selectedProf._isUsuario : false;
      const res = await appointmentsApi.getAvailableSlots(
        selectedProfessionalId,
        date,
        serviceDuration,
        isUsuario
      );
      if (res.success && res.data) {
        setAvailableSlots(res.data);
      } else {
        setAvailableSlots([]);
      }
    } catch (e) {
      console.error("Error loading slots", e);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!allowAction('agendamentos', 'criarAgendamentos')) return;
    if (!initialLeadId && (!selectedClient || selectedClient === "new")) {
      toast({ title: "Erro", description: "Selecione um paciente para o agendamento.", variant: "destructive" });
      return;
    }
    if (!date || !time) {
      toast({ title: "Erro", description: "Selecione a data e o horário disponível.", variant: "destructive" });
      return;
    }
    if (!selectedProfessionalId) return;

    setLoading(true);
    try {
      const startDateTime = new Date(`${date}T${time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + serviceDuration * 60000);

      const selectedProf = companyProfessionals.find(p => p.id.toString() === selectedProfessionalId);

      const response = await appointmentsApi.create({
        professionalId: selectedProf && !selectedProf._isUsuario ? Number(selectedProfessionalId) : undefined,
        especialistaId: selectedProf && selectedProf._isUsuario ? Number(selectedProfessionalId) : undefined,
        sdrId: selectedSdrId !== "none" ? Number(selectedSdrId) : undefined,
        clientId: initialLeadId ? null : Number(selectedClient),
        leadId: initialLeadId ? Number(initialLeadId) : null,
        serviceId: selectedServiceId ? Number(selectedServiceId) : null,
        tags: selectedService ? [selectedService.name] : (initialServiceTags || []),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: "agendado",
        notes,
        ...(chargeConsultation && consultationAmount && consultationPaymentMethod ? {
          consultationAmount: Number(consultationAmount),
          consultationPaymentMethod,
        } : {}),
      });

      if (response.success) {
        toast({ title: "Sucesso!", description: "Agendamento criado com sucesso." });
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        if (response.error?.code === 409) {
          toast({ title: "Conflito de Horário", description: "Este horário já foi ocupado. Recarregue os slots disponíveis.", variant: "destructive" });
          loadAvailableSlots();
          return;
        }
        toast({ title: "Erro ao criar agendamento", description: response.error?.message || "Erro desconhecido", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro de conexão.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClient("");
    setSelectedServiceId("");
    setNotes("");
    setTime("");
    setAvailableSlots([]);
    setConsultationAmount("");
    setConsultationPaymentMethod("");
  };

  // Format time label: "09:00  →  10:30  (1h30)"
  const formatSlotLabel = (slot: string) => {
    const [h, m] = slot.split(":").map(Number);
    const endMinutes = h * 60 + m + serviceDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const durationH = Math.floor(serviceDuration / 60);
    const durationM = serviceDuration % 60;
    const durationLabel = durationH > 0
      ? `${durationH}h${durationM > 0 ? durationM : ""}`
      : `${durationM}min`;
    return `${slot}  →  ${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}  (${durationLabel})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border sm:border-slate-100 bg-white p-0 shadow-2xl">
        <div className="p-4 sm:p-8 bg-gradient-to-br from-indigo-50 to-transparent border-b border-indigo-100">
          <DialogTitle className="text-lg sm:text-2xl font-extrabold text-primary font-headline tracking-tight">Novo Agendamento</DialogTitle>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Configure os detalhes da consulta ou procedimento.</p>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                Especialista Responsável *
              </Label>
              <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                <SelectTrigger className="w-full h-11 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Selecione...">
                    {companyProfessionals.find(p => p.id.toString() === selectedProfessionalId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companyProfessionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id.toString()}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                SDR Responsável (Opcional)
              </Label>
              <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
                <SelectTrigger className="w-full h-11 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Selecione o SDR...">
                    {selectedSdrId === "none" ? "Nenhum" : sdrs.find(s => s.id.toString() === selectedSdrId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {sdrs.map((sdr) => (
                    <SelectItem key={sdr.id} value={sdr.id.toString()}>
                      {sdr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patient Selector */}
          <div className="space-y-2 flex flex-col">
            <Label className="text-sm font-medium">Paciente *</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className="w-full justify-between font-normal"
                  disabled={dataLoading || isQuickCreate}
                >
                  {isQuickCreate ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-primary">{quickClientData.name}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">Lead</span>
                    </div>
                  ) : (
                    selectedClient
                      ? clients.find((c) => c.id.toString() === selectedClient)?.name
                      : "Selecionar paciente..."
                  )}
                  {dataLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin shrink-0 opacity-50" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                </Button>
              </PopoverTrigger>
              {!isQuickCreate && (
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar paciente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={() => { setSelectedClient(client.id.toString()); setClientOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClient === client.id.toString() ? "opacity-100" : "opacity-0")} />
                            {client.name}
                            <span className="ml-2 text-xs text-muted-foreground">{client.phone}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-primary" onClick={() => window.location.href = '/clients'}>
                          <Plus className="mr-2 h-3 w-3" /> Cadastrar novo paciente
                        </Button>
                      </div>
                    </CommandList>
                  </Command>
                </PopoverContent>
              )}
            </Popover>
          </div>

          {isQuickCreate && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 -mt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="material-symbols-outlined text-sm">info</span>
                Os dados deste lead serão usados para criar o cadastro de cliente automaticamente.
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome</p>
                  <p className="text-xs font-bold text-primary">{quickClientData.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
                  <p className="text-xs font-bold text-primary">{quickClientData.phone}</p>
                </div>
              </div>
            </div>
          )}

          {/* Procedure / Service Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Procedimento *</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="rounded-xl border-slate-200 h-12">
                <SelectValue placeholder="Selecione o procedimento...">
                  {services.find(s => s.id.toString() === selectedServiceId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {services.map(svc => (
                  <SelectItem key={svc.id} value={svc.id.toString()}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span className="font-semibold">{svc.name}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {svc.durationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {svc.durationMinutes >= 60
                              ? `${Math.floor(svc.durationMinutes / 60)}h${svc.durationMinutes % 60 > 0 ? (svc.durationMinutes % 60) + 'min' : ''}`
                              : `${svc.durationMinutes}min`}
                          </span>
                        )}
                        {svc.price && (
                          <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(svc.price))}</span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedService && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Duração: {serviceDuration >= 60 ? `${Math.floor(serviceDuration / 60)}h${serviceDuration % 60 > 0 ? ` ${serviceDuration % 60}min` : ''}` : `${serviceDuration}min`}</span>
                <span className="text-indigo-400">— o período será bloqueado automaticamente</span>
              </div>
            )}
          </div>

          {/* Date and Time Slots */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data do Agendamento *</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="rounded-xl border-slate-200 h-12 pl-10 font-bold text-primary"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">calendar_month</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Horário Disponível *
                  {slotsLoading && <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />}
                </span>
                {!slotsLoading && availableSlots.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{availableSlots.length} horários livres</span>
                )}
              </Label>

              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
                {slotsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Buscando disponibilidade...</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
                    <span className="material-symbols-outlined text-3xl">event_busy</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Sem horários para este dia</p>
                      <p className="text-[10px] font-medium mt-1">Tente outra data ou profissional</p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px] pr-4">
                    <div className="space-y-6">
                      {/* Manhã */}
                      {availableSlots.some(s => parseInt(s.split(':')[0]) < 12) && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">light_mode</span> Manhã
                          </h4>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots.filter(s => parseInt(s.split(':')[0]) < 12).map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setTime(slot)}
                                className={cn(
                                  "py-2 px-1 rounded-lg text-xs font-bold transition-all border",
                                  time === slot 
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                                )}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tarde */}
                      {availableSlots.some(s => parseInt(s.split(':')[0]) >= 12) && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">sunny</span> Tarde
                          </h4>
                          <div className="grid grid-cols-4 gap-2">
                            {availableSlots.filter(s => parseInt(s.split(':')[0]) >= 12).map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setTime(slot)}
                                className={cn(
                                  "py-2 px-1 rounded-lg text-xs font-bold transition-all border",
                                  time === slot 
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                                )}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
              
              {time && (
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500 text-sm">check_circle</span>
                    <span className="text-[11px] font-bold text-indigo-700">Horário: {time}</span>
                  </div>
                  {selectedService && (
                    <div className="text-[10px] font-bold text-indigo-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
                      Término: {calculateEndTime(time, serviceDuration)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Observações</Label>
            <Input
              placeholder="Ex: Paciente com urgência, primeira vez..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Consultation Fee (only if toggle is on) */}
          {chargeConsultation && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base">payments</span>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Consulta de Avaliação</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Valor (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={consultationAmount}
                    onChange={(e) => setConsultationAmount(e.target.value)}
                    className="h-10 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Método</Label>
                  <Select value={consultationPaymentMethod} onValueChange={setConsultationPaymentMethod}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao">Cartão (Crédito/Débito)</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-amber-600/70">Opcional — deixe vazio se a consulta for gratuita.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || dataLoading || slotsLoading || !time}
            variant="secondary"
            className="rounded-xl px-10 font-bold shadow-lg shadow-secondary/20"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isQuickCreate ? "Salvar Paciente & Agendar" : "Confirmar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useActionPermission } from '@/hooks/use-action-permission';
