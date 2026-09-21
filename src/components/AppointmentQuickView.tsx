import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { appointmentsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AppointmentQuickViewProps {
  appointmentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AppointmentQuickView({ appointmentId, isOpen, onClose, onUpdate }: AppointmentQuickViewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [tempStatus, setTempStatus] = useState<string>('');
  const [tempNotes, setTempNotes] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { professional } = useAuth();
  const allowAction = useActionPermission();

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchDetails(appointmentId);
    }
  }, [isOpen, appointmentId]);

  const fetchDetails = async (id: number) => {
    setLoading(true);
    try {
      const response = await appointmentsApi.getById(id);
      if (response.success) {
        setData(response.data);
        setTempStatus(response.data.status);
        setTempNotes(response.data.notes || '');
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível carregar os detalhes.', variant: 'destructive' });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!allowAction('agendamentos', 'cancelarAgendamentos')) return;
    if (!appointmentId) return;
    setSaving(true);
    try {
      const response = await appointmentsApi.delete(appointmentId);
      if (response.success) {
        toast({ title: 'Agendamento apagado com sucesso.' });
        setIsDeleteDialogOpen(false);
        onUpdate();
        onClose();
      } else {
        toast({ title: 'Erro ao apagar', description: response.error?.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao apagar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!allowAction('agendamentos', 'editarAgendamentos')) return;
    if (tempStatus === 'cancelado' && !allowAction('agendamentos', 'cancelarAgendamentos')) return;
    if (!data) return;
    setSaving(true);
    try {
      const response = await appointmentsApi.update(data.id, {
        status: tempStatus,
        notes: tempNotes,
        // Mantemos os outros dados
        professionalId: data.professionalId,
        clientId: data.clientId,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime: data.endTime
      });
      
      if (!response.success) throw new Error(response.error?.message || 'Falha ao salvar as alterações.');
      onUpdate();
      toast({ title: 'Sucesso!', description: 'Agendamento atualizado com sucesso.' });
      onClose();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar as alterações.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const clientName = data?.client?.name || data?.lead?.name || 'Paciente s/ Nome';
  const clientPhone = data?.client?.phone || data?.lead?.phone || '';
  const serviceName = data?.service?.name || 'Avaliação / Consulta';
  const profName = data?.professional?.name || 'Profissional';
  const isLead = !!data?.lead;
  const appointmentDate = data ? format(parseISO(data.startTime), "dd/MM/yyyy") : '';
  const appointmentTime = data ? format(parseISO(data.startTime), "HH:mm") : '';

  const companyName = professional?.companyName || 'SellClin';
  const whatsappReminderMsg = `Oi ${clientName.split(' ')[0]}, aqui é a ${profName} da ${companyName}. Passando aqui para confirmar a sua consulta no dia ${appointmentDate} às ${appointmentTime}.`;
  
  const whatsappReminderLink = clientPhone 
    ? `https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappReminderMsg)}`
    : '#';

  const whatsappLink = clientPhone 
    ? `https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=Olá ${clientName.split(' ')[0]}, tudo bem? Aqui é da ${companyName}.`
    : '#';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'agendado': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'cancelado': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'concluido': return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Container principal do modal. Mistura o padrão branco com toques glassmorphism */}
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] p-0 overflow-hidden border-slate-100 rounded-3xl bg-white shadow-2xl flex flex-col">
        
        {/* Cabeçalho "Glass" (escuro para contraste premium) */}
        <div className="relative p-6 bg-[#0B1525] border-b border-[#0B1525] overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          {loading ? (
            <div className="h-20 flex items-center gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/10" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5 mt-2 relative z-10">
              <div className="w-16 h-16 rounded-full border border-white/20 bg-white/5 flex flex-col items-center justify-center text-white font-headline text-xl font-bold shrink-0">
                {clientName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-white font-headline leading-tight">
                  {clientName}
                </DialogTitle>
                <p className="text-sm text-white/70 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">smartphone</span>
                  {clientPhone || 'Sem telefone'}
                </p>
                {isLead && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/90 rounded border border-white/20">
                    Lead no Funil
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo scrollável com estilo claro do sistema */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!loading && data && (
            <>
              {/* Linha de Status e WhatsApp */}
              <div className="flex gap-2">
                <div className="flex-[1.5]">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                  <Select value={tempStatus} onValueChange={setTempStatus}>
                    <SelectTrigger 
                      className={cn(
                        "w-full h-9 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all",
                        getStatusBadge(tempStatus)
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="concluido">Compareceu / Concluído</SelectItem>
                      <SelectItem value="cancelado">Faltou / Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border transition-all text-slate-600 bg-white",
                      clientPhone 
                        ? "hover:bg-slate-50 border-slate-200" 
                        : "opacity-50 cursor-not-allowed border-slate-100"
                    )}
                    onClick={(e) => { if (!clientPhone) e.preventDefault(); }}
                  >
                    <span className={cn("material-symbols-outlined text-[16px]", clientPhone ? "text-[#25D366]" : "text-slate-400")}>chat</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Whats</span>
                  </a>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                  <a
                    href={whatsappReminderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border transition-all text-slate-600 bg-white",
                      clientPhone 
                        ? "hover:bg-slate-50 border-slate-200" 
                        : "opacity-50 cursor-not-allowed border-slate-100"
                    )}
                    onClick={(e) => { if (!clientPhone) e.preventDefault(); }}
                  >
                    <span className={cn("material-symbols-outlined text-[16px]", clientPhone ? "text-indigo-500" : "text-slate-400")}>notifications_active</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Avisar</span>
                  </a>
                </div>
              </div>

              {/* Detalhes do Agendamento */}
              <div className="space-y-3 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Procedimento</p>
                  <p className="text-slate-700 text-sm font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">medical_services</span>
                    {serviceName}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data e Hora</p>
                    <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-[14px]">calendar_today</span>
                      {format(parseISO(data.startTime), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duração</p>
                    <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-[14px]">schedule</span>
                      {Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 60000)} min
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Especialista</p>
                  <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[14px]">badge</span>
                    Dr(a). {profName}
                  </p>
                </div>

                {data.sdr && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">SDR</p>
                    <p className="text-slate-700 text-xs font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-[14px]">support_agent</span>
                      {data.sdr.name}
                    </p>
                  </div>
                )}

                {data.googleSyncStatus && !['synced', 'not_synced', 'deleted'].includes(data.googleSyncStatus) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex gap-2">
                    <span className="material-symbols-outlined text-[15px]">sync_problem</span>
                    <span>{data.googleSyncError || 'Sincronizacao com Google Calendar pendente.'}</span>
                  </div>
                )}

                {data.payments && data.payments.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consulta de Avaliação</p>
                    <p className="text-emerald-600 text-xs font-bold flex items-center gap-1.5 bg-emerald-50 w-fit px-2 py-1 rounded-md border border-emerald-100">
                      <span className="material-symbols-outlined text-emerald-500 text-[14px]">payments</span>
                      R$ {Number(data.payments[0].amount).toFixed(2).replace('.', ',')} 
                      <span className="text-emerald-600/70 text-[10px] uppercase font-semibold ml-1">({data.payments[0].method})</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Observações</p>
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Escreva alguma observação aqui..."
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 min-h-[80px] outline-none focus:border-slate-300 transition-all resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="h-9 px-3 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              Fechar
            </Button>
            
            <Button
              onClick={() => setIsDeleteDialogOpen(true)}
              variant="ghost"
              disabled={saving}
              className="h-9 px-3 text-[11px] font-bold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
            >
              Apagar
            </Button>

            <Button 
              onClick={() => {
                setTempStatus('cancelado');
                handleSave();
                toast({ title: 'Agendamento cancelado', description: 'Por favor, crie um novo agendamento para reagendar.' });
              }}
              variant="outline"
              className="flex-1 h-9 rounded-lg font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-2 text-[11px] shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px] mr-1">edit_calendar</span>
              Reagendar
            </Button>

            {isLead ? (
              <Button 
                onClick={() => { onClose(); navigate('/sales-funnel'); }}
                variant="outline"
                className="flex-1 h-9 rounded-lg font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-2 text-[11px] shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px] mr-1">filter_alt</span>
                No Funil
              </Button>
            ) : (
              <Button 
                onClick={() => { onClose(); navigate('/patients'); }}
                variant="outline"
                className="flex-1 h-9 rounded-lg font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 px-2 text-[11px] shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px] mr-1">person</span>
                No Paciente
              </Button>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full h-10 rounded-lg font-bold shadow-md shadow-primary/20 gap-2 bg-[#111827] hover:bg-[#1f2937]"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px] rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-red-500 text-[24px]">delete</span>
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-slate-800">
              Apagar Agendamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 mt-2">
              Você está prestes a excluir este agendamento permanentemente. Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-4 sm:justify-center w-full">
            <AlertDialogCancel className="flex-1 mt-0 bg-white border-slate-200 hover:bg-slate-50 text-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0"
            >
              {saving ? <span className="material-symbols-outlined animate-spin text-[18px] mr-2">refresh</span> : null}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
import { useActionPermission } from '@/hooks/use-action-permission';
