import { cn } from '@/lib/utils';
import { FunnelCard } from './FunnelCard';

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface FunnelColumnProps {
  stage: Stage;
  leads: any[];
  onAddLead: (stageId: string) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: () => void;
  isOver: boolean;
  
  // Card Props
  isMultiSelectMode: boolean;
  selectedLeadIds: string[];
  onToggleLeadSelection: (id: string) => void;
  onSelectLead: (lead: any) => void;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggedCardId: string | null;
  activeFunnel: string;
  onOpenWhatsApp: (phone: string) => void;
  onSubStatusChange: (id: string, subStatus: string | null) => void;
  onScheduleAppointment: (lead: any) => void;
  onOpenProposal: (leadId: string, leadValue: number, tags: string[]) => void;
  onOpenPayment: (lead: any) => void;
  onMoveLead: (cardId: string, status: string) => void;
  onScheduleClosed: (lead: any) => void;
  onSetActiveFunnel: (funnelId: string) => void;
  isProcessingSchedule: boolean;
  currentSchedulingLeadId: string | null;
  professionalName?: string;
  quickStatuses: any[];
  contactCadence?: number;
}

export function FunnelColumn({
  stage,
  leads,
  onAddLead,
  onDragOver,
  onDrop,
  onDragLeave,
  isOver,
  isMultiSelectMode,
  selectedLeadIds,
  onToggleLeadSelection,
  onSelectLead,
  onDragStart,
  onDragEnd,
  draggedCardId,
  activeFunnel,
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
}: FunnelColumnProps) {
  
  const stageLeads = leads.filter(l => l.status === stage.id);

  return (
    <div 
      className="flex-shrink-0 w-[280px] sm:w-72 flex flex-col gap-3 snap-center h-full max-h-full"
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      <div className="flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", stage.color)}></div>
          <h3 className="font-bold text-primary text-sm uppercase tracking-wider">{stage.label}</h3>
          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {stageLeads.length}
          </span>
        </div>
        <button 
          onClick={() => onAddLead(stage.id)}
          className="text-slate-300 hover:text-primary transition-colors btn-hover"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
        </button>
      </div>

      <div className={cn(
        "flex-1 min-h-[100px] overflow-y-auto scrollbar-hide rounded-2xl p-2.5 space-y-2 transition-all duration-200",
        "bg-slate-50/50 border border-slate-100/50",
        isOver && "bg-slate-100/80 border-secondary/30"
      )}>
        {stageLeads.map((lead) => (
          <FunnelCard 
            key={lead.cardId || lead.id}
            lead={lead}
            isMultiSelectMode={isMultiSelectMode}
            isSelected={selectedLeadIds.includes(lead.id)}
            onToggleSelection={onToggleLeadSelection}
            onSelect={onSelectLead}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragged={draggedCardId === (lead.cardId || `lead-${lead.id}`)}
            activeFunnel={activeFunnel}
            stageId={stage.id}
            onOpenWhatsApp={onOpenWhatsApp}
            onSubStatusChange={onSubStatusChange}
            onScheduleAppointment={onScheduleAppointment}
            onOpenProposal={onOpenProposal}
            onOpenPayment={onOpenPayment}
            onMoveLead={onMoveLead}
            onScheduleClosed={onScheduleClosed}
            onSetActiveFunnel={onSetActiveFunnel}
            isProcessingSchedule={isProcessingSchedule}
            currentSchedulingLeadId={currentSchedulingLeadId}
            professionalName={professionalName}
            quickStatuses={quickStatuses}
            contactCadence={contactCadence}
          />
        ))}
      </div>
    </div>
  );
}
