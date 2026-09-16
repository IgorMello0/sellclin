import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FunnelColumn } from './FunnelColumn';
import { empresasApi } from '@/lib/api';

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface FunnelBoardProps {
  stages: Stage[];
  leads: any[];
  onAddLead: (stageId: string) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: () => void;
  dropTargetStage: string | null;
  
  // Column/Card Props
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
}

export function FunnelBoard({
  stages,
  leads,
  onAddLead,
  onDragOver,
  onDrop,
  onDragLeave,
  dropTargetStage,
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
  quickStatuses
}: FunnelBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [contactCadence, setContactCadence] = useState<number>(5);

  useEffect(() => {
    const fetchCadence = async () => {
      try {
        const res = await empresasApi.getMyCompany();
        if (res.success && res.data) {
          setContactCadence(res.data.contactCadence ?? 5);
        }
      } catch (e) {
        console.error('Error fetching contactCadence', e);
      }
    };
    fetchCadence();
  }, []);

  const checkScroll = () => {
    if (boardRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = boardRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkScroll, 150);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [leads, stages]);

  const scroll = (direction: 'left' | 'right') => {
    if (boardRef.current) {
      const { clientWidth } = boardRef.current;
      const scrollAmount = clientWidth * 0.75;
      boardRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative group/board w-full h-full flex flex-col min-h-0">
      {/* Floating Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-[240px] -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-primary p-2.5 rounded-full shadow-xl border border-slate-200/60 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 opacity-0 group-hover/board:opacity-100 focus:opacity-100"
          style={{ transition: 'opacity 0.25s, transform 0.15s' }}
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
      )}

      {/* Kanban Board Container */}
      <div 
        ref={boardRef}
        onScroll={checkScroll}
        className="flex gap-3 sm:gap-4 flex-1 min-h-0 h-full overflow-x-auto pb-6 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-hide snap-x snap-mandatory sm:snap-none"
      >
        {stages.map((stage) => (
          <FunnelColumn 
            key={stage.id}
            stage={stage}
            leads={leads}
            onAddLead={onAddLead}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={onDragLeave}
            isOver={dropTargetStage === stage.id}
            isMultiSelectMode={isMultiSelectMode}
            selectedLeadIds={selectedLeadIds}
            onToggleLeadSelection={onToggleLeadSelection}
            onSelectLead={onSelectLead}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            draggedCardId={draggedCardId}
            activeFunnel={activeFunnel}
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

      {/* Floating Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-[240px] -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-primary p-2.5 rounded-full shadow-xl border border-slate-200/60 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 opacity-0 group-hover/board:opacity-100 focus:opacity-100"
          style={{ transition: 'opacity 0.25s, transform 0.15s' }}
        >
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </button>
      )}
    </div>
  );
}
