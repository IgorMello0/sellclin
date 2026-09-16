import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Loader2, Star } from 'lucide-react';
import { leadsApi, tasksApi } from '@/lib/api';

interface Lead {
  sdrId?: number;
  closerId?: number;
  especialistaId?: number;
  id: string;
  cardId?: string;
  isProposal?: boolean;
  proposalId?: number;
  name: string;
  avatar?: string;
  phone?: string;
  value: number;
  convertedToClientId?: number | null;
  lastUpdate?: string;
  subStatus?: string | null;
  isScheduled?: boolean;
  isPaid?: boolean;
  contactCount?: number;
  appointments?: any[];
  tasks?: any[];
  tags?: string[];
  subtitle?: string;
}

interface FunnelCardProps {
  lead: Lead;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onSelect: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragged: boolean;
  activeFunnel: string;
  stageId: string;
  onOpenWhatsApp: (phone: string) => void;
  onSubStatusChange: (id: string, subStatus: string | null) => void;
  onScheduleAppointment: (lead: Lead) => void;
  onOpenProposal: (leadId: string, leadValue: number, tags: string[]) => void;
  onOpenPayment: (lead: Lead) => void;
  onMoveLead: (cardId: string, status: string) => void;
  onScheduleClosed: (lead: Lead) => void;
  onSetActiveFunnel: (funnelId: string) => void;
  isProcessingSchedule: boolean;
  currentSchedulingLeadId: string | null;
  professionalName?: string;
  quickStatuses: any[];
  contactCadence?: number;
}

export function FunnelCard({
  lead,
  isMultiSelectMode,
  isSelected,
  onToggleSelection,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragged,
  activeFunnel,
  stageId,
  onOpenWhatsApp,
  onSubStatusChange,
  onScheduleAppointment,
  onOpenProposal,
  onOpenPayment,
  onMoveLead,
  onScheduleClosed,
  onSetActiveFunnel,
  isProcessingSchedule,
  currentSchedulingLeadId,
  professionalName,
  quickStatuses,
  contactCadence
}: FunnelCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);


  const pendingCadenceTask = lead.tasks?.[0];
  const isCadenceOverdue = pendingCadenceTask && new Date(pendingCadenceTask.dueDate) < new Date();
  
  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, lead.cardId || `lead-${lead.id}`)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(lead)}
      className={cn(
        "premium-card p-3 cursor-grab active:cursor-grabbing group animate-in fade-in slide-in-from-top-2 relative",
        isDragged && "opacity-40 grayscale-[0.5]",
        isDropdownOpen && "z-30"
      )}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isMultiSelectMode && (
            <div onClick={(e) => e.stopPropagation()} className="animate-in zoom-in-95 duration-200 shrink-0">
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={() => onToggleSelection(lead.id)}
                className="border-slate-300 data-[state=checked]:bg-secondary data-[state=checked]:border-secondary"
              />
            </div>
          )}
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary border border-primary/5 shrink-0">
            {lead.avatar || lead.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-bold text-primary group-hover:text-secondary transition-colors flex items-center gap-1.5 overflow-hidden">
              <span className="truncate">{lead.name}</span>
              {lead.convertedToClientId && (
                <div 
                  className="flex items-center justify-center bg-gradient-to-b from-amber-100 to-yellow-200 border border-yellow-400/40 rounded-full w-[16px] h-[16px] shadow-sm shadow-yellow-500/20 shrink-0 cursor-help transition-transform hover:scale-110" 
                  title="Este lead já é um cliente"
                >
                  <Star className="w-[10px] h-[10px] text-amber-600 fill-amber-500" />
                </div>
              )}
            </h4>
            {lead.subtitle && lead.subtitle !== 'Sem propostas' && (
              <div className="mt-1">
                <span className="inline-block max-w-full truncate text-[9px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md">
                  {lead.subtitle}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="material-symbols-outlined text-[12px] text-emerald-500 shrink-0">chat</span>
              <p className="text-[10px] text-slate-500 font-bold tracking-tight truncate">{lead.phone}</p>
            </div>
            {(!lead.sdrId || !lead.closerId || !lead.especialistaId) && (
              <div className="flex items-center gap-1.5 mt-2 mb-1 flex-wrap">
                {!lead.sdrId && (
                  <div title="Sem SDR atribuído" className="flex items-center justify-center bg-amber-50 border border-amber-200 px-1 py-[1px] rounded-md shrink-0 shadow-sm cursor-help">
                    <span className="text-[8px] font-extrabold text-amber-600 uppercase tracking-wider">SDR</span>
                  </div>
                )}
                {!lead.closerId && (
                  <div title="Sem Closer atribuído" className="flex items-center justify-center bg-rose-50 border border-rose-200 px-1 py-[1px] rounded-md shrink-0 shadow-sm cursor-help">
                    <span className="text-[8px] font-extrabold text-rose-600 uppercase tracking-wider">Closer</span>
                  </div>
                )}
                {!lead.especialistaId && (
                  <div title="Sem Especialista atribuído" className="flex items-center justify-center bg-indigo-50 border border-indigo-200 px-1 py-[1px] rounded-md shrink-0 shadow-sm cursor-help">
                    <span className="text-[8px] font-extrabold text-indigo-600 uppercase tracking-wider">ESPECIALISTA</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onOpenWhatsApp(lead.phone || '');
            }}
            className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"
            title="Abrir no WhatsApp"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </button>
          <button className="text-slate-300 group-hover:text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-base">more_vert</span>
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between mt-2 pt-1.5 border-t border-slate-100">
        <div className="flex flex-col gap-1">
          {lead.value > 0 && (
            <div className="text-xs font-bold text-primary">
              {lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          )}
          {activeFunnel === 'prospecting' && (
            <div 
              onClick={(e) => e.stopPropagation()} 
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative"
            >
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors border text-left",
                      lead.subStatus 
                        ? (quickStatuses.find(s => s.id === lead.subStatus)?.color || "bg-slate-100 text-slate-600 border-slate-200") 
                        : "bg-slate-50 text-slate-400 border-slate-200/60"
                    )}
                  >
                    {lead.subStatus ? quickStatuses.find(s => s.id === lead.subStatus)?.label : 'Status (Nenhum)'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 rounded-xl p-2 bg-white shadow-xl border-slate-100">
                  {quickStatuses.map(status => (
                    <DropdownMenuItem 
                      key={status.id}
                      onClick={() => onSubStatusChange(lead.id, status.id)}
                      className={cn("text-xs font-bold cursor-pointer rounded-lg mb-1 last:mb-0", status.color)}
                    >
                      {status.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem 
                    onClick={() => onSubStatusChange(lead.id, null)}
                    className="text-xs font-bold text-slate-400 cursor-pointer rounded-lg"
                  >
                    Limpar Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
          <span className="material-symbols-outlined text-[10px]">schedule</span>
          {lead.lastUpdate}
        </div>
      </div>

      {pendingCadenceTask && (
        <div className={cn(
          "flex items-center justify-between px-2 py-1.5 mt-2 rounded-md text-[10px] font-bold uppercase tracking-wide border",
          isCadenceOverdue 
            ? "bg-red-50 text-red-600 border-red-100" 
            : "bg-blue-50 text-blue-600 border-blue-100"
        )}>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">
              {isCadenceOverdue ? 'warning' : 'schedule'}
            </span>
            <span className="truncate max-w-[120px]" title={pendingCadenceTask.title}>
              {isCadenceOverdue ? 'Cadência Atrasada' : 'Próximo Passo'}
            </span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              tasksApi.update(pendingCadenceTask.id, { status: 'completed' })
                .then(() => window.location.reload());
            }}
            className="flex items-center justify-center p-1 hover:bg-black/5 rounded-full transition-colors"
            title="Concluir passo da cadência"
          >
            <span className="material-symbols-outlined text-xs">check</span>
          </button>
        </div>
      )}

      {/* Stage specific actions */}
      <div className="flex flex-col gap-1 mt-2 pt-1.5 border-t border-slate-100">
        {stageId === 'prospect_scheduled' && (
          lead.isScheduled ? (() => {
            const lastAppt = lead.appointments && lead.appointments[0];
            const apptStatus = lastAppt?.status || 'agendado';
            
            switch(apptStatus) {
              case 'concluido':
                return (
                  <div className="w-full py-1.5 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-sky-100">
                    Compareceu
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                  </div>
                );
              case 'cancelado':
                return (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onScheduleAppointment(lead); }}
                    className="w-full py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-100"
                  >
                    Faltou / Reagendar
                    <span className="material-symbols-outlined text-xs">event_busy</span>
                  </button>
                );
              case 'confirmado':
                return (
                  <div className="w-full py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-emerald-100">
                    Confirmado
                    <span className="material-symbols-outlined text-xs">verified</span>
                  </div>
                );
              default:
                return (
                  <div className="w-full py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-amber-100">
                    Agendado
                    <span className="material-symbols-outlined text-xs">schedule</span>
                  </div>
                );
            }
          })() : (
            <button 
              onClick={(e) => { e.stopPropagation(); onScheduleAppointment(lead); }}
              disabled={isProcessingSchedule}
              className="w-full py-1.5 bg-violet-100 hover:bg-violet-600 text-violet-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-violet-200"
            >
              {isProcessingSchedule && currentSchedulingLeadId === lead.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  Agendar agora
                  <span className="material-symbols-outlined text-xs">calendar_today</span>
                </>
              )}
            </button>
          )
        )}

        {stageId === 'prospect_attended' && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onOpenProposal(lead.id, lead.value, lead.tags || []);
            }}
            className="w-full py-2 bg-orange-100 hover:bg-orange-500 text-orange-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-orange-200"
          >
            Gerar Proposta
            <span className="material-symbols-outlined text-xs">description</span>
          </button>
        )}

        {stageId === 'comercial_closed' && (
          <div className="flex flex-col gap-1.5">
            <div className="w-full py-2 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-green-200">
              <span className="material-symbols-outlined text-xs">how_to_reg</span>
              Cliente Ativo
            </div>
            {!lead.isPaid ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPayment(lead);
                }}
                className="w-full py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-primary/20"
              >
                <span className="material-symbols-outlined text-xs">payments</span>
                Baixar Pagamento
              </button>
            ) : (
              <div className="w-full py-2 bg-green-500/10 text-green-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-green-200">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Pagamento Realizado
              </div>
            )}

          </div>
        )}

        {stageId === 'sales_payment' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPayment(lead);
            }}
            className="w-full py-2 bg-cyan-100 hover:bg-cyan-600 text-cyan-700 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-cyan-200 animate-pulse-subtle"
          >
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Baixar Pagamento
          </button>
        )}
      </div>
    </div>
  );
}
