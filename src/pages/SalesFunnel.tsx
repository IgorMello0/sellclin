import React, { useState, useMemo, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewAppointmentModal } from '@/components/NewAppointmentModal';
import { ConfirmPaymentModal } from '@/components/ConfirmPaymentModal';
import { clientsApi, leadsApi, tasksApi, usuariosApi } from '@/lib/api';
import { loadAllPages, requireApiSuccess } from '@/lib/funnel';
import { loadDashboardTeam } from '@/lib/dashboard';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from "lucide-react";
import { useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { ExportModal } from "@/components/ExportModal";
import { ImportModal } from "@/components/ImportModal";
import { ProposalViewer } from "@/components/ProposalViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, History, FileDown, Edit2, Check, X, Eye, Plus, Trash2, CheckSquare, Calendar } from "lucide-react";
import { FunnelBoard } from '@/components/funnel/FunnelBoard';
import { ProposalDialog } from '@/components/funnel/ProposalDialog';
import { FunnelSettingsDialog } from '@/components/funnel/FunnelSettingsDialog';
import { LeadDetailsModal } from "@/components/LeadDetailsModal";
import { FUNNELS, STAGES, QUICK_STATUSES, ORIGIN_OPTIONS } from '@/config/funnelConfig';
import { useSectionTour } from '@/hooks/useSectionTour';
import { TourPopover } from '@/components/onboarding/TourPopover';

const safeFormatDate = (dateStr: any, formatStr: string = "dd/MM/yyyy") => {
  try {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Data Inválida";
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return "Erro na data";
  }
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Activity {
  id: string;
  type: 'call' | 'whatsapp' | 'task' | 'system' | 'proposal';
  user: string;
  action: string;
  content?: string;
  result?: string;
  date: string;
  icon: string;
  color: string;
}

interface Lead {
  id: string;
  name: string;
  value: number;
  origin: string;
  avatar: string;
  status: string;
  lastUpdate: string;
  phone: string;
  email: string;
  activities: Activity[];
  isScheduled?: boolean;
  notes?: string;
  responsible?: string;
  tags?: string[];
  justification?: string;
  discountApplied?: boolean;
  remarketingProposals?: any[];
  isPaid?: boolean;
  subStatus?: string | null;
  appointments?: any[];
  proposals?: any[];
  rawDate?: string;
  closedAt?: string;
  createdAt?: string;
}

const initialLeads: Lead[] = [];

const SalesFunnel = () => {
  const { professional } = useAuth();
  const allowAction = useActionPermission();
  const [activeFunnel, setActiveFunnel] = useState('prospecting');
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLeadStage, setNewLeadStage] = useState<string | null>(null);
  const [newLeadData, setNewLeadData] = useState({ name: '', value: '', origin: '', phone: '', email: '', sdrId: 'random' });
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sdrs, setSdrs] = useState<any[]>([]);

  const loadSdrs = async () => {
    try {
      if (!professional?.companyId) return;
      const team = await loadDashboardTeam(professional.companyId, usuariosApi.getAll);
      setSdrs(team.sdrs);
    } catch (e) {
      console.error("Error loading SDRs:", e);
    }
  };
  const [isConfiguringFunnels, setIsConfiguringFunnels] = useState(false);
  const [dynamicFunnels, setDynamicFunnels] = useState<any[]>([]);
  const [isLoadingFunnels, setIsLoadingFunnels] = useState(true);
  const [dynamicStatuses, setDynamicStatuses] = useState<any[]>(QUICK_STATUSES);

  // Proposal Selection State
  const [proposalSelectionOpen, setProposalSelectionOpen] = useState(false);
  const [leadForProposalSelection, setLeadForProposalSelection] = useState<any>(null);
  const [targetStageForSelection, setTargetStageForSelection] = useState<string>("");
  const [draggedCardIdForSelection, setDraggedCardIdForSelection] = useState<string>("");


  // Multi-select & Export State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Two-Level Edit & Bulk Edit States
  const [selectedFunnelForEdit, setSelectedFunnelForEdit] = useState<string>("");
  const [isBulkStageDialogOpen, setIsBulkStageDialogOpen] = useState(false);
  const [bulkSelectedFunnel, setBulkSelectedFunnel] = useState("");
  const [bulkSelectedStage, setBulkSelectedStage] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
      isDown = false;
      el.style.cursor = 'grab';
    };

    const handleMouseUp = () => {
      isDown = false;
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mousemove', handleMouseMove);

    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'cadence_asc' | 'cadence_desc'>('newest');
  const [filterOrigin, setFilterOrigin] = useState<string>('todos');
  const [filterCadence, setFilterCadence] = useState<string>('todos');
  const [filterMenuMode, setFilterMenuMode] = useState<'main' | 'origin' | 'cadence'>('main');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Appointment scheduling state
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingClientId, setSchedulingClientId] = useState<string | undefined>(undefined);
  const [schedulingClientName, setSchedulingClientName] = useState<string | undefined>(undefined);
  const [schedulingClientPhone, setSchedulingClientPhone] = useState<string | undefined>(undefined);
  const [currentSchedulingLeadId, setCurrentSchedulingLeadId] = useState<string | null>(null);
  const [isProcessingSchedule, setIsProcessingSchedule] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const { toast } = useToast();

  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [proposalLeadId, setProposalLeadId] = useState<string | null>(null);

  // Payment Confirmation State
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [paymentLead, setPaymentLead] = useState<{id: string, value: number, proposalId?: number} | null>(null);
  // Schedule from closed lead
  const [isSchedulingClosed, setIsSchedulingClosed] = useState(false);
  const [closedLeadToSchedule, setClosedLeadToSchedule] = useState<Lead | null>(null);

  // Proposals Viewing
  const [leadProposals, setLeadProposals] = useState<any[]>([]);
  const [isViewingProposal, setIsViewingProposal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState("activities");
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [tempOrigin, setTempOrigin] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [tempActivityContent, setTempActivityContent] = useState("");
  const [noteText, setNoteText] = useState("");
  const [activityToDeleteId, setActivityToDeleteId] = useState<string | null>(null);

  // Tasks State
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Mapeamento de Leads e Orçamentos para os cartões do Funil Kanban
  const boardCards = useMemo(() => {
    return leads.map((lead: any) => {
      // Filtrar propostas ativas (ignorando aceitas e rejeitadas)
      const activeProposals = lead.proposals ? lead.proposals.filter((p: any) => p.status !== 'accepted' && p.status !== 'rejected') : [];

      // Calcular o valor total das propostas ativas
      const totalProposalValue = activeProposals.reduce(
        (sum: number, p: any) => sum + (Number(p.value) || 0), 0
      );

      return {
        ...lead,
        cardId: `lead-${lead.id}`, // Identificador único do cartão
        isProposal: false,
        value: totalProposalValue > 0 ? totalProposalValue : (Number(lead.value) || 0),
        displayName: lead.name,
        subtitle: activeProposals.length > 0
          ? `${activeProposals.length} proposta${activeProposals.length > 1 ? 's' : ''}`
          : 'Sem propostas',
        displayValue: totalProposalValue > 0 ? totalProposalValue : (Number(lead.value) || 0),
        activeProposalCount: activeProposals.length,
      };
    });
  }, [leads]);

  const getOriginLabel = (origin: string) => {
    if (!origin) return origin;
    return origins.find(o => o.value === origin.toLowerCase())?.label || origin;
  };

  const getStageLabel = (status: string) => {
    if (dynamicFunnels.length > 0) {
      for (const f of dynamicFunnels) {
        const stage = (f.stages || []).find((s: any) => s.code === status);
        if (stage) return `${f.label}: ${stage.label}`;
      }
    }
    for (const [funnelKey, stagesList] of Object.entries(STAGES)) {
      const stage = stagesList.find(s => s.id === status);
      if (stage) {
        const funnelLabel = FUNNELS.find(f => f.id === funnelKey)?.label || funnelKey;
        return `${funnelLabel}: ${stage.label}`;
      }
    }
    return status;
  };

  const getFunnelOfStage = (status: string) => {
    if (dynamicFunnels.length > 0) {
      for (const f of dynamicFunnels) {
        const stage = (f.stages || []).find((s: any) => s.code === status);
        if (stage) return f.code || f.id;
      }
    }
    for (const [funnelKey, stagesList] of Object.entries(STAGES)) {
      const stage = stagesList.find(s => s.id === status);
      if (stage) return funnelKey;
    }
    return "";
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    window.location.href = `whatsapp://send?phone=${finalPhone}`;
  };

  const funnelList = useMemo(() => {
    if (dynamicFunnels.length > 0) return dynamicFunnels;
    return FUNNELS.map(f => ({ ...f, code: f.id })); // Garantir consistência entre id e code
  }, [dynamicFunnels]);

  const activeStages = useMemo(() => {
    if (dynamicFunnels.length > 0) {
      const funnel = dynamicFunnels.find(f => f.code === activeFunnel || f.id === activeFunnel);
      // Normalize stages: use 'code' as 'id' so lead.status matching works
      return (funnel?.stages || []).map((s: any) => ({
        ...s,
        id: s.code, // lead.status is the code string, not the numeric DB id
      }));
    }
    return STAGES[activeFunnel as keyof typeof STAGES] || [];
  }, [activeFunnel, dynamicFunnels]);

  const editStages = useMemo(() => {
    if (!selectedFunnelForEdit) return [];
    if (dynamicFunnels.length > 0) {
      const funnel = dynamicFunnels.find(f => f.code === selectedFunnelForEdit || f.id === selectedFunnelForEdit);
      return (funnel?.stages || []).map((s: any) => ({
        ...s,
        id: s.code,
      }));
    }
    return STAGES[selectedFunnelForEdit as keyof typeof STAGES] || [];
  }, [selectedFunnelForEdit, dynamicFunnels]);

  const isCurrentStageInSelectedFunnel = useMemo(() => {
    if (!selectedLead?.status || !selectedFunnelForEdit) return false;
    if (dynamicFunnels.length > 0) {
      const funnel = dynamicFunnels.find(f => f.code === selectedFunnelForEdit || f.id === selectedFunnelForEdit);
      return !!(funnel?.stages || []).find((s: any) => s.code === selectedLead.status);
    }
    const stagesList = STAGES[selectedFunnelForEdit] || [];
    return !!stagesList.find(s => s.id === selectedLead.status);
  }, [selectedFunnelForEdit, selectedLead?.status, dynamicFunnels]);

  const stageValue = isCurrentStageInSelectedFunnel && selectedLead ? selectedLead.status : "";

  const bulkStages = useMemo(() => {
    if (!bulkSelectedFunnel) return [];
    if (dynamicFunnels.length > 0) {
      const funnel = dynamicFunnels.find(f => f.code === bulkSelectedFunnel || f.id === bulkSelectedFunnel);
      return (funnel?.stages || []).map((s: any) => ({
        ...s,
        id: s.code,
      }));
    }
    return STAGES[bulkSelectedFunnel as keyof typeof STAGES] || [];
  }, [bulkSelectedFunnel, dynamicFunnels]);

    const filteredAndSortedLeads = useMemo(() => {
    let result = [...boardCards];

    // AUTO-ARQUIVAMENTO: esconder leads fechados há mais de 15 dias
    const ARCHIVE_DAYS = 15;
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_DAYS);
    
    result = result.filter(card => {
      if (card.status === 'comercial_closed') {
        const closedDate = card.closedAt ? new Date(card.closedAt) : new Date(card.rawDate || card.updatedAt || card.createdAt || 0);
        return closedDate > archiveCutoff; // só mostra se fechou nos últimos 15 dias
      }
      return true;
    });

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      result = result.filter(card => 
        card.displayName.toLowerCase().includes(query) || 
        (card.subtitle && card.subtitle.toLowerCase().includes(query)) ||
        (card.phone && card.phone.toLowerCase().includes(query)) ||
        (card.email && card.email.toLowerCase().includes(query))
      );
    }

    // Filter by origin
    if (filterOrigin !== 'todos') {
      result = result.filter(card => card.origin && card.origin.toLowerCase() === filterOrigin.toLowerCase());
    }

    // Filter by cadence
    if (filterCadence !== 'todos') {
      if (filterCadence === '10+') {
        result = result.filter(card => (card.contactCount || 0) >= 10);
      } else {
        const targetCount = parseInt(filterCadence, 10);
        result = result.filter(card => (card.contactCount || 0) === targetCount);
      }
    }

    // Sort cards
    result.sort((a: any, b: any) => {
      if (sortOrder === 'cadence_asc' || sortOrder === 'cadence_desc') {
        const countA = a.contactCount || 0;
        const countB = b.contactCount || 0;
        if (countA !== countB) {
          return sortOrder === 'cadence_asc' ? countA - countB : countB - countA;
        }
      }
      const dateA = new Date(a.rawDate || a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.rawDate || b.updatedAt || b.createdAt || 0).getTime();
      return sortOrder === 'newest' || sortOrder === 'cadence_desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [boardCards, searchTerm, filterOrigin, filterCadence, sortOrder]);

  useEffect(() => {
    if (selectedLead) {
      setTempOrigin(selectedLead.origin || "");
      setIsEditingOrigin(false);
      setTempName(selectedLead.name || "");
      setIsEditingName(false);
      setTempPhone(selectedLead.phone || "");
      setIsEditingPhone(false);
      setTempEmail(selectedLead.email || "");
      setIsEditingEmail(false);
      setEditingActivityId(null);
      setActivityToDeleteId(null);

      const leadFunnel = getFunnelOfStage(selectedLead.status);
      setSelectedFunnelForEdit(leadFunnel);
    }
  }, [selectedLead?.id]);

  const handleUpdateName = async () => {
    if (!selectedLead || !tempName.trim()) return;
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { name: tempName });
      if (res.success) {
        toast({ title: "Nome atualizado!" });
        setSelectedLead({ ...selectedLead, name: tempName });
        setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, name: tempName } : l));
        setIsEditingName(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar nome", variant: "destructive" });
    }
  };

  const leadsRequest = useRef(0);
  const loadLeads = async () => {
    const request = ++leadsRequest.current;
    if (!professional?.id) return;
    setIsLoading(true);
    try {
      const data = await loadAllPages(leadsApi.getAll);
      if (request === leadsRequest.current) {
        const mappedLeads = data.map((l: any) => ({
          ...l,
          id: l.id.toString(),
          isScheduled: l.isScheduled || l.is_scheduled, // Handle both just in case
          rawDate: l.updatedAt || l.createdAt,
          lastUpdate: safeFormatDate(l.updatedAt || l.createdAt, "dd/MM/yy 'às' HH:mm"),
          activities: (l.activities || []).map((a: any) => {
            const isNote = a.type === 'nota' || a.type === 'task';
            const isProposal = a.type === 'proposta' || a.type === 'proposal';
            
            return {
              id: a.id.toString(),
              type: isNote ? 'task' : isProposal ? 'proposal' : 'system',
              user: a.createdBy || 'Sistema',
              action: isNote ? 'fez uma anotação' : isProposal ? 'gerou uma proposta comercial' : 'ação no sistema',
              content: a.content,
              date: safeFormatDate(a.createdAt, "dd/MM/yy 'às' HH:mm"),
              icon: isNote ? 'edit_note' : isProposal ? 'description' : 'info',
              color: isNote ? 'bg-[#FF7A00]' : isProposal ? 'bg-orange-500' : 'bg-blue-400'
            };
          })
        }));
        setLeads(mappedLeads);
      }
    } catch (error) {
      if (request === leadsRequest.current) toast({ title: "Erro ao carregar leads", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      if (request === leadsRequest.current) setIsLoading(false);
    }
  };

  const loadFunnelConfigs = async () => {
    setIsLoadingFunnels(true);
    try {
      const { funnelConfigApi } = await import('@/lib/api');
      const res = await funnelConfigApi.getAll();
      if (res.success && res.data && res.data.length > 0) {
        setDynamicFunnels(res.data);
        // Se o funil ativo atual não existe mais nos novos dados, reseta para o primeiro
        if (!res.data.find((f: any) => f.code === activeFunnel)) {
          setActiveFunnel(res.data[0].code);
        }
      }
    } catch (e) {
      console.error("Error loading funnel configs:", e);
    } finally {
      setIsLoadingFunnels(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const { leadStatusesApi } = await import('@/lib/api');
      const res = await leadStatusesApi.getAll();
      if (res.success && res.data && res.data.length > 0) {
        setDynamicStatuses(res.data.map((s: any) => ({
          id: s.code,
          label: s.label,
          color: s.color
        })));
      }
    } catch (e) {
      console.error("Error loading statuses:", e);
    }
  };

  const loadServices = async () => {
    if (!professional?.id) return;
    try {
      const { catalogsApi } = await import('@/lib/api');
      const res = await catalogsApi.getAll({ professionalId: Number(professional.id) });
      if (res.success) setServices(res.data || []);
    } catch (e) {
      console.error("Error loading services for tags:", e);
    }
  };

  const [origins, setOrigins] = useState<any[]>([]);

  const loadOrigins = async () => {
    try {
      const { leadOriginsApi } = await import('@/lib/api');
      const res = await leadOriginsApi.getAll();
      if (res.success && res.data) {
        setOrigins(res.data);
      }
    } catch (e) {
      console.error("Error loading origins:", e);
    }
  };

  useEffect(() => {
    if (professional?.id) {
      loadLeads();
      loadServices();
      loadFunnelConfigs();
      loadStatuses();
      loadOrigins();
      loadSdrs();
    }
  }, [professional, activeFunnel]);

  const handleScheduleAppointment = async (lead: Lead) => {
    const lastAppt = lead.appointments && lead.appointments[0];
    const isActuallyCanceled = lastAppt?.status === 'cancelado';

    if (lead.isScheduled && !isActuallyCanceled) {
      toast({
        title: "Já Agendado",
        description: "Este lead já possui um agendamento ativo.",
      });
      return;
    }

    setIsProcessingSchedule(true);
    setCurrentSchedulingLeadId(lead.id);
    
    try {
      // Scheduling is linked by leadId; keep this lead's identity in the form.
      setSchedulingClientId(undefined);
      setSchedulingClientName(lead.name);
      setSchedulingClientPhone(lead.phone);

      setIsScheduling(true);
    } catch (error) {
      toast({
        title: "Erro ao buscar cliente",
        description: "Não foi possível verificar se o cliente já existe.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingSchedule(false);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      loadProposals(Number(selectedLead.id));
      loadTasks(Number(selectedLead.id));
      setActiveDetailsTab("activities");
    }
  }, [selectedLead]);

  const loadTasks = async (leadId: number) => {
    try {
      const res = await tasksApi.getAll({ leadId });
      if (res.success) {
        setLeadTasks(res.data || []);
      }
    } catch (e) {
      console.error("Error loading tasks:", e);
    }
  };

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim() || !selectedLead) return;
    setIsSavingTask(true);
    try {
      const payload = {
        title: newTaskTitle,
        description: newTaskDescription,
        status: 'pending',
        priority: newTaskPriority,
        dueDate: newTaskDate || new Date().toISOString(),
        leadId: selectedLead.id,
        assignedToId: professional?.id
      };
      const res = await tasksApi.create(payload);
      if (res.success) {
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskPriority("medium");
        setNewTaskDate("");
        loadTasks(Number(selectedLead.id));
        toast({ title: "Tarefa adicionada com sucesso" });
      }
    } catch (e) {
      toast({ title: "Erro ao adicionar tarefa", variant: "destructive" });
    } finally {
      setIsSavingTask(false);
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'urgent': return 'Urgente';
      default: return 'Média';
    }
  };

  const loadProposals = async (leadId: number) => {
    setIsLoadingProposals(true);
    try {
      const res = await leadsApi.getProposals(leadId);
      if (res.success) {
        setLeadProposals(res.data || []);
      }
    } catch (e) {
      console.error("Error loading proposals:", e);
    } finally {
      setIsLoadingProposals(false);
    }
  };

  const handleViewProposal = (proposal: any) => {
    setSelectedProposal(proposal);
    setIsViewingProposal(true);
  };

  const movingLeads = useRef(new Set<string>());
  const moveLead = async (leadId: string, newStatus: string, proposalId?: number) => {
    if (!allowAction('funnel', 'moverFases')) return;
    if ((proposalId != null || ['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(newStatus)) && !allowAction('funnel', 'aprovarPropostas')) return;
    const id = String(leadId);
    if (movingLeads.current.has(id)) return false;
    movingLeads.current.add(id);
    try {
      const updated = requireApiSuccess(await leadsApi.update(Number(id), { status: newStatus, ...(proposalId ? { proposalId } : {}) }));
      setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, ...updated, id, lastUpdate: 'Agora mesmo' } : lead));
      if (newStatus === 'prospect_scheduled') {
        await handleScheduleAppointment({ ...updated, id });
      } else if (newStatus === 'prospect_attended') {
        setProposalLeadId(id);
        setIsCreatingProposal(true);
      } else if (newStatus === 'comercial_closed' || newStatus.startsWith('sales_')) {
        setPaymentLead({ id, value: Number(updated.value) || 0, proposalId });
        setIsConfirmingPayment(true);
      }
      void loadLeads();
      return true;
    } catch (error) {
      toast({ title: "Erro ao mover lead", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      return false;
    } finally {
      movingLeads.current.delete(id);
    }
  };

    const moveCard = async (cardId: string, stageId: string) => {
    const leadId = Number(cardId.replace('lead-', '').replace('proposal-', ''));
    const targetLead = leads.find(l => l.id == leadId.toString());
    if (!targetLead) return;

    const isClosingStage = stageId === 'comercial_closed' || stageId.startsWith('sales_');

    // Filtrar propostas ativas (não fechadas nem rejeitadas)
    const activeProposals = targetLead.proposals ? targetLead.proposals.filter((p: any) => 
      p.status !== 'accepted' && 
      p.status !== 'rejected' && 
      p.status !== 'comercial_closed' &&
      p.status !== 'sales_payment'
    ) : [];

    // Se está movendo para uma fase de fechamento e ele tem propostas ativas
    if (isClosingStage && activeProposals.length > 0) {
      setLeadForProposalSelection({ ...targetLead, proposals: activeProposals });
      setTargetStageForSelection(stageId);
      setDraggedCardIdForSelection(cardId);
      setProposalSelectionOpen(true);
      return;
    }

    // Se for um lead sendo movido, movemos ele normalmente
    await moveLead(leadId.toString(), stageId);
  };

  const handleConfirmProposalSelection = async (proposalId: number) => {
    if (!allowAction('funnel', 'aprovarPropostas')) return;
    if (!leadForProposalSelection) return;
    const saved = await moveLead(String(leadForProposalSelection.id), targetStageForSelection, proposalId);
    if (saved) {
      setProposalSelectionOpen(false);
      toast({ title: "Proposta selecionada", description: "Registre a forma de pagamento para confirmar esta venda." });
    }
  };

    const handleDragStart = (e: React.DragEvent, cardId: string) => {
      e.dataTransfer.setData('cardId', cardId);
      e.dataTransfer.effectAllowed = 'move';
      
      // Delay state update to allow browser to capture opaque drag ghost
      setTimeout(() => {
        setDraggedCardId(cardId);
      }, 0);
    };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDropTargetStage(stageId);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDropTargetStage(null);
  };

    const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId') || draggedCardId;
    if (cardId) {
      moveCard(cardId, stageId);
    }
    setDraggedCardId(null);
    setDropTargetStage(null);
  };

  const handleAddLead = async () => {
    console.log("[Funnel] Tentando criar lead...", { name: newLeadData.name, professional: professional?.id });
    
    if (!newLeadData.name) {
      toast({ title: "Campo obrigatório", description: "O nome do lead é obrigatório.", variant: "destructive" });
      return;
    }

    if (!professional) {
      console.error("[Funnel] Profissional não identificado.");
      toast({ title: "Erro de Autenticação", description: "Não foi possível identificar o profissional logado.", variant: "destructive" });
      return;
    }

    const finalStatus = newLeadStage || 'prospect_lead';
    
    try {
      const res = await leadsApi.create({
        professional_id: Number(professional.id),
        name: newLeadData.name,
        phone: newLeadData.phone,
        email: newLeadData.email,
        value: Number(newLeadData.value.toString().replace(/\./g, "")) || 0,
        origin: newLeadData.origin,
        status: finalStatus,
        sdrId: newLeadData.sdrId,
        avatar: newLeadData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
      });

      console.log("[Funnel] Resposta criação lead:", res);

      if (res.success) {
        toast({ title: "Lead Criado!", description: "O lead foi salvo no banco de dados." });
        loadLeads();
        setIsAddingLead(false);
        setNewLeadData({ name: '', value: '', origin: '', phone: '', email: '', sdrId: 'random' });
      } else {
        toast({ 
          title: "Erro ao criar lead", 
          description: res.error?.message || "O servidor retornou um erro.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("[Funnel] Erro catch criação lead:", error);
      toast({ title: "Erro de Conexão", description: "Não foi possível conectar ao servidor.", variant: "destructive" });
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedLead) return;

    try {
      const res = await leadsApi.addActivity(Number(selectedLead.id), {
        type: 'nota',
        content: noteText,
        createdBy: professional?.name || 'Consultor'
      });

      if (res.success) {
        toast({ title: 'Nota salva com sucesso!' });
        
        // Formatar e adicionar localmente a nova nota para atualizar na hora
        const newAct = res.data;
        const mappedAct: Activity = {
          id: newAct.id.toString(),
          type: 'task',
          user: newAct.createdBy || professional?.name || 'Consultor',
          action: 'fez uma anotação',
          content: newAct.content,
          date: safeFormatDate(newAct.createdAt, "dd/MM/yy 'às' HH:mm"),
          icon: 'edit_note',
          color: 'bg-[#FF7A00]'
        };
        
        setSelectedLead(prev => prev ? {
          ...prev,
          activities: [mappedAct, ...(prev.activities || [])]
        } : null);

        setNoteText('');
        loadLeads(); // Sincroniza em background
      } else {
        toast({ title: 'Erro ao salvar nota', description: res.error?.message, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    }
  };

  const handleUpdatePhone = async () => {
    if (!selectedLead || !tempPhone.trim()) return;
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { phone: tempPhone });
      if (res.success) {
        toast({ title: "Telefone atualizado!" });
        setSelectedLead({ ...selectedLead, phone: tempPhone });
        setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, phone: tempPhone } : l));
        setIsEditingPhone(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar telefone", variant: "destructive" });
    }
  };

  const handleUpdateEmail = async () => {
    if (!selectedLead) return;
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { email: tempEmail });
      if (res.success) {
        toast({ title: "E-mail atualizado!" });
        setSelectedLead({ ...selectedLead, email: tempEmail });
        setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, email: tempEmail } : l));
        setIsEditingEmail(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar e-mail", variant: "destructive" });
    }
  };

  const handleUpdateActivity = async (activityId: string) => {
    if (!selectedLead || !tempActivityContent.trim()) return;
    try {
      const res = await leadsApi.updateActivity(Number(selectedLead.id), Number(activityId), {
        content: tempActivityContent
      });
      if (res.success) {
        toast({ title: "Anotação atualizada!" });
        setSelectedLead(prev => prev ? {
          ...prev,
          activities: (prev.activities || []).map(act => 
            act.id === activityId ? { ...act, content: tempActivityContent } : act
          )
        } : null);
        setEditingActivityId(null);
        loadLeads();
      } else {
        toast({ title: "Erro ao atualizar", description: res.error?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!selectedLead) return;
    try {
      const res = await leadsApi.deleteActivity(Number(selectedLead.id), Number(activityId));
      if (res.success) {
        toast({ title: "Anotação excluída!" });
        setSelectedLead(prev => prev ? {
          ...prev,
          activities: (prev.activities || []).filter(act => act.id !== activityId)
        } : null);
        loadLeads();
      } else {
        toast({ title: "Erro ao excluir", description: res.error?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const confirmDeleteActivity = () => {
    if (activityToDeleteId) {
      handleDeleteActivity(activityToDeleteId);
      setActivityToDeleteId(null);
    }
  };



  const handleUpdateOrigin = async () => {
    if (!selectedLead) return;
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { origin: tempOrigin });
      if (res.success) {
        toast({ title: "Origem atualizada com sucesso!" });
        setSelectedLead({ ...selectedLead, origin: tempOrigin });
        setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, origin: tempOrigin } : l));
        setIsEditingOrigin(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar origem", variant: "destructive" });
    }
  };

  const handleConfirmPayment = (lead: Lead) => {
    setPaymentLead({ id: lead.id, value: lead.value });
    setIsConfirmingPayment(true);
  };

  const handleSubStatusChange = async (leadId: string, subStatus: string | null) => {
    try {
      requireApiSuccess(await leadsApi.update(Number(leadId), { subStatus }));
      setLeads(prev => prev.map(l => l.id === String(leadId) ? { ...l, subStatus } : l));
      toast({ title: "Status rápido atualizado!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const openAddLead = (stageId: string | null = null) => {
    setNewLeadStage(stageId);
    setIsAddingLead(true);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleExport = (formatType: string, scope: string) => {
    if (!allowAction('clientes', 'exportarContatos')) return;
    const leadsToExport = scope === 'selected' 
      ? leads.filter(l => selectedLeadIds.includes(l.id))
      : leads; // or filteredLeads if they only want currently filtered

    if (leadsToExport.length === 0) {
      toast({ title: "Nenhum lead para exportar", variant: "destructive" });
      return;
    }

    const dataToExport = leadsToExport.map(lead => ({
      Nome: lead.name,
      Telefone: lead.phone,
      Email: lead.email || '',
      Valor: lead.value,
      Origem: lead.origin || '',
      Status: lead.status || '',
      DataCriacao: safeFormatDate(lead.lastUpdate), // using lastUpdate or created_at if available
    }));

    if (formatType === 'csv' || formatType === 'excel' || formatType === 'sheets') {
      const csv = Papa.unparse(dataToExport, {
        delimiter: formatType === 'excel' ? ';' : ',',
      });
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); // BOM for UTF-8 Excel support
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Exportação Concluída", description: `Foram exportados ${leadsToExport.length} leads.` });
      
      if (scope === 'selected') {
        setSelectedLeadIds([]);
      }
    }
  };

  const handleDeleteSelectedLeads = async () => {
    if (!allowAction('funnel', 'excluirOportunidades')) return;
    if (selectedLeadIds.length === 0) return;
    
    try {
      let successCount = 0;
      for (const leadId of selectedLeadIds) {
        const res = await leadsApi.delete(Number(leadId));
        if (res.success) successCount++;
      }
      toast({ title: `${successCount} lead${successCount > 1 ? 's' : ''} excluído${successCount > 1 ? 's' : ''}!` });
      setSelectedLeadIds([]);
      setIsMultiSelectMode(false);
      setIsConfirmingBulkDelete(false);
      loadLeads();
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast({ title: 'Erro ao excluir leads', variant: 'destructive' });
      setIsConfirmingBulkDelete(false);
    }
  };

  const handleBulkStageChange = async () => {
    if (!bulkSelectedStage || selectedLeadIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      let successCount = 0;
      for (const leadId of selectedLeadIds) {
        const res = await leadsApi.update(Number(leadId), { status: bulkSelectedStage });
        if (res.success) successCount++;
      }
      toast({ title: `${successCount} lead${successCount > 1 ? 's' : ''} atualizado${successCount > 1 ? 's' : ''} com sucesso!` });
      setSelectedLeadIds([]);
      setIsMultiSelectMode(false);
      setIsBulkStageDialogOpen(false);
      loadLeads();
    } catch (error) {
      console.error('Error bulk updating leads:', error);
      toast({ title: 'Erro ao atualizar estágio dos leads', variant: 'destructive' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Tour de primeira visita
  const { tourActive, tourStep, tourSteps, tourHandleNext, tourHandlePrev, tourHandleClose } =
    useSectionTour('comercial', [
      { id: null, title: '💼 Comercial', description: 'Gerencie todos os seus leads e acompanhe cada etapa do funil até a venda. Arraste os cards entre as colunas para avançar o lead!', position: 'center' },
      { id: '#comercial-novo-lead', title: '➕ Novo Lead', description: 'Cadastre um novo lead rapidamente. Preencha os dados básicos e ele entra automaticamente no início do funil.', position: 'bottom' },
      { id: '#comercial-funis', title: '🔄 Funis de Venda', description: 'Alterne entre diferentes funis: Marketing, Comercial ou personalizados. Cada funil tem suas próprias etapas.', position: 'bottom' },
      { id: '#comercial-board', title: '📦 Quadro Kanban', description: 'Cada coluna é uma etapa do funil. Arraste os cards de lead entre as colunas para avançar na jornada de venda.', position: 'center' },
    ]);

  return (
    <div className="space-y-4 sm:space-y-8 pb-10 min-h-screen">
      <TourPopover active={tourActive} step={tourStep} steps={tourSteps} onNext={tourHandleNext} onPrev={tourHandlePrev} onClose={tourHandleClose} />
      {/* Header & Funnel Switcher */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="min-h-[64px] flex flex-col justify-center">
          <h2 className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">Comercial</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">Gerencie seus leads e funis de vendas.</p>
        </div>

        {/* Row container for Tabs and Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100/50 pb-4">
          {/* Funnel Tabs — scrollable on mobile and drag-to-scroll on desktop */}
          <div 
            id="comercial-funis" 
            ref={scrollRef}
            className="flex overflow-x-auto scrollbar-hide w-full lg:max-w-[65%] xl:max-w-[75%] min-w-0 -mx-3 px-3 sm:mx-0 sm:px-0 select-none scroll-smooth"
          >
            <div className="flex p-1 sm:p-1.5 bg-slate-100/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-slate-200/50 w-fit shrink-0">
              {funnelList.map((f) => (
                <button
                  key={f.id || f.code}
                  onClick={() => setActiveFunnel(f.code || f.id)}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                    activeFunnel === (f.code || f.id)
                      ? "bg-white text-primary shadow-sm" 
                      : "text-slate-400 hover:text-primary hover:bg-white/50"
                  )}
                >
                  <span className={cn("material-symbols-outlined text-base sm:text-lg", activeFunnel === (f.code || f.id) ? "text-secondary" : "")}>
                    {f.icon}
                  </span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 h-12">
            {/* 1. Buscar (Search) */}
            {isSearchExpanded ? (
              <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200/50 w-36 sm:w-56 transition-all duration-300 animate-in fade-in slide-in-from-right-3">
                <span className="material-symbols-outlined text-slate-400 text-lg mr-1.5">search</span>
                <input 
                  type="text"
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Buscar lead..." 
                  className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none w-full placeholder-slate-400"
                />
                <button 
                  onClick={() => { 
                    setIsSearchExpanded(false); 
                    setSearchTerm(''); 
                  }} 
                  className="text-slate-400 hover:text-slate-600 flex items-center"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                </button>
              </div>
            ) : (
              <Button 
                variant="ghost"
                onClick={() => setIsSearchExpanded(true)}
                className="h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Buscar leads"
              >
                <span className="material-symbols-outlined text-xl sm:text-[22px]">search</span>
              </Button>
            )}

            {/* 2. Filtrar (Filter) */}
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost"
                    className={cn(
                      "h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-full flex items-center justify-center transition-colors",
                      filterOrigin !== 'todos' || filterCadence !== 'todos' ? "text-secondary bg-orange-50 hover:bg-orange-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    )}
                    onClick={() => {
                      setFilterMenuMode('main');
                      setFilterSearchQuery('');
                    }}
                    title="Filtrar por origem"
                  >
                    <span className="material-symbols-outlined text-xl sm:text-[22px]">filter_list</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="absolute left-0 top-full mt-1.5 w-64 p-1.5 rounded-2xl shadow-xl border border-slate-200/50 bg-white/95 backdrop-blur-md z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  {filterMenuMode === 'main' ? (
                    <div className="space-y-1">
                      {/* Search box */}
                      <div className="p-2">
                        <input
                          type="text"
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQuery(e.target.value)}
                          placeholder="Procurar uma propriedade..."
                          className="w-full bg-slate-50 text-slate-800 border border-slate-200/60 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-secondary focus:border-secondary transition-all placeholder-slate-400 font-bold"
                          autoFocus
                        />
                      </div>

                      {/* Properties list */}
                      <div className="px-1 space-y-0.5">
                        {[
                          { id: 'name', label: 'Nome', icon: 'title', display: 'Aa' },
                          { id: 'phone', label: 'Telefone', icon: 'call' },
                          { id: 'email', label: 'E-mail', icon: 'mail' },
                          { id: 'origin', label: 'Origem', icon: 'sell' },
                          { id: 'cadence', label: 'Cadência', icon: '123' },
                        ]
                          .filter(p => p.label.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                          .map((prop) => (
                            <button
                              key={prop.id}
                              type="button"
                              onClick={() => {
                                if (prop.id === 'origin') {
                                  setFilterMenuMode('origin');
                                  setFilterSearchQuery('');
                                } else if (prop.id === 'cadence') {
                                  setFilterMenuMode('cadence');
                                  setFilterSearchQuery('');
                                } else {
                                  setIsSearchExpanded(true);
                                  setFilterSearchQuery('');
                                }
                              }}
                              className="w-full text-left rounded-xl py-2 px-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-xs text-slate-700 hover:text-secondary font-bold group"
                            >
                              <div className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-secondary transition-colors">
                                {prop.display ? (
                                  <span className="text-[11px] font-black tracking-tighter leading-none">{prop.display}</span>
                                ) : (
                                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{prop.icon}</span>
                                )}
                              </div>
                              <span className="flex-1 truncate">{prop.label}</span>
                              {prop.id === 'origin' && (
                                <span className="material-symbols-outlined text-slate-400 group-hover:text-secondary transition-colors" style={{ fontSize: '16px' }}>chevron_right</span>
                              )}
                            </button>
                          ))}
                      </div>

                      <div className="h-px bg-slate-100 my-1.5" />

                      <div className="px-1">
                        <button 
                          type="button"
                          className="w-full text-left rounded-xl py-2 px-3 flex items-center gap-3 hover:bg-red-50/50 transition-colors text-xs text-slate-500 hover:text-red-500 font-bold group"
                          onClick={() => {
                            setFilterOrigin('todos');
                            setFilterCadence('todos');
                            setSearchTerm('');
                          }}
                        >
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 transition-colors" style={{ fontSize: '18px' }}>delete</span>
                          Limpar Filtros
                        </button>
                      </div>
                    </div>
                  ) : filterMenuMode === 'origin' ? (
                    <div className="space-y-1">
                      {/* Back button */}
                      <div className="px-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMenuMode('main');
                            setFilterSearchQuery('');
                          }}
                          className="w-full text-left rounded-xl py-1.5 px-2 flex items-center gap-2 hover:bg-slate-50 transition-colors text-[10px] uppercase font-black tracking-wider text-slate-400 hover:text-secondary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_left</span>
                          Voltar
                        </button>
                      </div>

                      {/* Search box for origin */}
                      <div className="p-2">
                        <input
                          type="text"
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQuery(e.target.value)}
                          placeholder="Procurar origem..."
                          className="w-full bg-slate-50 text-slate-800 border border-slate-200/60 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-secondary focus:border-secondary transition-all placeholder-slate-400 font-bold"
                          autoFocus
                        />
                      </div>

                      {/* Origin sub-items list */}
                      <div className="px-1 space-y-0.5 max-h-48 overflow-y-auto scrollbar-hide">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterOrigin('todos');
                            setFilterMenuMode('main');
                          }}
                          className={cn(
                            "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                            filterOrigin === 'todos' ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                          )}
                        >
                          <span className="truncate font-bold">Todos</span>
                          {filterOrigin === 'todos' && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                        </button>
                        {origins
                          .filter(opt => opt.label.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                          .map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFilterOrigin(opt.value);
                                setFilterMenuMode('main');
                              }}
                              className={cn(
                                "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                                filterOrigin === opt.value ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                              )}
                            >
                              <span className="truncate font-bold">{opt.label}</span>
                              {filterOrigin === opt.value && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : filterMenuMode === 'cadence' ? (
                    <div className="space-y-1">
                      {/* Back button */}
                      <div className="px-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMenuMode('main');
                          }}
                          className="w-full text-left rounded-xl py-1.5 px-2 flex items-center gap-2 hover:bg-slate-50 transition-colors text-[10px] uppercase font-black tracking-wider text-slate-400 hover:text-secondary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_left</span>
                          Voltar
                        </button>
                      </div>

                      <div className="p-2 pb-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                          Tentativas de Contato
                        </p>
                      </div>

                      {/* Cadence sub-items list */}
                      <div className="px-1 space-y-0.5 max-h-48 overflow-y-auto scrollbar-hide pt-1">
                        {[
                          { value: 'todos', label: 'Todos' },
                          { value: '0', label: 'Sem contato (0)' },
                          { value: '1', label: '1 contato' },
                          { value: '2', label: '2 contatos' },
                          { value: '3', label: '3 contatos' },
                          { value: '4', label: '4 contatos' },
                          { value: '5', label: '5 contatos' },
                          { value: '6', label: '6 contatos' },
                          { value: '7', label: '7 contatos' },
                          { value: '8', label: '8 contatos' },
                          { value: '9', label: '9 contatos' },
                          { value: '10+', label: '10 ou mais' }
                        ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFilterCadence(opt.value);
                                setFilterMenuMode('main');
                              }}
                              className={cn(
                                "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                                filterCadence === opt.value ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                              )}
                            >
                              <span className="truncate font-bold">{opt.label}</span>
                              {filterCadence === opt.value && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 3. Ordenar (Sort) */}
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost"
                    className={cn(
                      "h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-full flex items-center justify-center transition-colors",
                      sortOrder !== 'newest' ? "text-secondary bg-orange-50 hover:bg-orange-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    )}
                    title="Ordenar leads"
                  >
                    <span className="material-symbols-outlined text-xl sm:text-[22px]">swap_vert</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="absolute left-0 top-full mt-1.5 w-44 p-1.5 rounded-2xl shadow-xl border border-slate-200/50 bg-white/95 backdrop-blur-md z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ordenar por data</div>
                  <button 
                    type="button"
                    onClick={() => setSortOrder('newest')} 
                    className={cn(
                      "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                      sortOrder === 'newest' ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                    )}
                  >
                    <span className="font-bold">Mais Novos</span>
                    {sortOrder === 'newest' && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSortOrder('oldest')} 
                    className={cn(
                      "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                      sortOrder === 'oldest' ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                    )}
                  >
                    <span className="font-bold">Mais Antigos</span>
                    {sortOrder === 'oldest' && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                  </button>

                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1 border-t border-slate-100">Ordenar por Cadência</div>
                  <button 
                    type="button"
                    onClick={() => setSortOrder('cadence_desc')} 
                    className={cn(
                      "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                      sortOrder === 'cadence_desc' ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                    )}
                  >
                    <span className="font-bold">Maior Cadência</span>
                    {sortOrder === 'cadence_desc' && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSortOrder('cadence_asc')} 
                    className={cn(
                      "w-full text-left rounded-xl py-2 px-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs font-bold",
                      sortOrder === 'cadence_asc' ? "text-secondary bg-orange-50/50" : "text-slate-700 hover:text-secondary"
                    )}
                  >
                    <span className="font-bold">Menor Cadência</span>
                    {sortOrder === 'cadence_asc' && <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>check</span>}
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 4. Seleção Múltipla */}
            <Button 
              variant="ghost"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) setSelectedLeadIds([]);
              }}
              className={cn(
                "h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-full flex items-center justify-center transition-colors",
                isMultiSelectMode ? "text-secondary bg-orange-50 hover:bg-orange-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
              title={isMultiSelectMode ? "Desativar seleção múltipla" : "Ativar seleção múltipla"}
            >
              <span className="material-symbols-outlined text-xl sm:text-[22px]">{isMultiSelectMode ? 'close' : 'checklist'}</span>
            </Button>

            {/* 5. Configurações (Sheet) */}
            <div className="flex-shrink-0">
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost"
                    className="h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Configurações do funil"
                  >
                    <span className="material-symbols-outlined text-xl sm:text-[22px]">tune</span>
                  </Button>
                </SheetTrigger>
                <SheetContent 
                  side="right"
                  className="w-full sm:max-w-md p-6 bg-white border-l border-slate-100 flex flex-col justify-between"
                >
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-3xl text-secondary">tune</span>
                        <h3 className="text-xl font-extrabold font-headline tracking-tight">Opções do Funil</h3>
                      </div>
                      <p className="text-slate-500 text-xs sm:text-sm font-medium">
                        Gerencie visualização, exportação de dados e etapas do pipeline comercial.
                      </p>
                    </div>

                    <div className="h-px bg-slate-100 w-full" />

                    {/* Actions List */}
                    <div className="space-y-3">
                      {/* Action 0: Importar Dados */}
                      <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-orange-50/30 hover:border-orange-100 transition-all duration-300 flex items-start gap-4 group active:scale-[0.99]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-secondary flex items-center justify-center shrink-0 transition-colors">
                          <span className="material-symbols-outlined text-xl">upload</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-primary group-hover:text-secondary transition-colors">Importar Leads</h4>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-secondary transition-colors font-bold">chevron_right</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Traga sua planilha de clientes de outro CRM ou Excel.
                          </p>
                        </div>
                      </button>

                      {/* Action 1: Exportar Dados */}
                      <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-orange-50/30 hover:border-orange-100 transition-all duration-300 flex items-start gap-4 group active:scale-[0.99]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-secondary flex items-center justify-center shrink-0 transition-colors">
                          <span className="material-symbols-outlined text-xl">download</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-primary group-hover:text-secondary transition-colors">Exportar Leads</h4>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-secondary transition-colors font-bold">chevron_right</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Exporte a lista completa de leads em formato CSV ou planilha Excel.
                          </p>
                        </div>
                      </button>

                      {/* Action 3: Configurar Funis e Etapas */}
                      <button
                        onClick={() => setIsConfiguringFunnels(true)}
                        className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200/80 transition-all duration-300 flex items-start gap-4 group active:scale-[0.99]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 flex items-center justify-center shrink-0 transition-colors">
                          <span className="material-symbols-outlined text-xl">dashboard_customize</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-primary group-hover:text-secondary transition-colors">Personalizar Pipelines</h4>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-secondary transition-colors font-bold">chevron_right</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Adicione, ordene ou alterne entre diferentes funis de vendas.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <Button 
              id="comercial-novo-lead"
              onClick={() => openAddLead()} 
              size="xl"
              variant="secondary"
              className="h-10 sm:h-12 px-3 sm:px-6 font-bold gap-1 sm:gap-2 shadow-lg shadow-secondary/20 text-sm flex-shrink-0"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Novo Lead</span>
              <span className="sm:hidden">Novo</span>
            </Button>

            {/* Lixeira vermelha — aparece quando seleção múltipla está ativa */}
            {isMultiSelectMode && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setBulkSelectedFunnel(activeFunnel);
                    setBulkSelectedStage("");
                    setIsBulkStageDialogOpen(true);
                  }}
                  disabled={selectedLeadIds.length === 0}
                  variant="ghost"
                  className={cn(
                    "h-10 sm:h-12 px-3 sm:px-4 rounded-xl font-bold gap-1.5 text-sm flex-shrink-0 transition-all duration-200",
                    selectedLeadIds.length > 0
                      ? "bg-secondary hover:bg-secondary/90 text-white shadow-lg shadow-secondary/20"
                      : "bg-orange-50 text-orange-300 cursor-not-allowed"
                  )}
                  title={selectedLeadIds.length > 0 ? `Alterar estágio de ${selectedLeadIds.length} lead(s)` : "Selecione leads para alterar estágio"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>swap_horiz</span>
                  <span className="hidden sm:inline">Mudar Estágio</span>
                </Button>

                <Button
                  onClick={() => setIsConfirmingBulkDelete(true)}
                  disabled={selectedLeadIds.length === 0}
                  variant="ghost"
                  className={cn(
                    "h-10 sm:h-12 px-3 sm:px-4 rounded-xl font-bold gap-1.5 text-sm flex-shrink-0 transition-all duration-200",
                    selectedLeadIds.length > 0
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                      : "bg-red-50 text-red-300 cursor-not-allowed"
                  )}
                  title={selectedLeadIds.length > 0 ? `Excluir ${selectedLeadIds.length} lead(s)` : "Selecione leads para excluir"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                  {selectedLeadIds.length > 0 && (
                    <span className="hidden sm:inline">{selectedLeadIds.length}</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      <FunnelBoard 
        stages={activeStages}
        leads={filteredAndSortedLeads}
        quickStatuses={dynamicStatuses}
        onAddLead={openAddLead}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onDragLeave={() => setDropTargetStage(null)}
        dropTargetStage={dropTargetStage}
        isMultiSelectMode={isMultiSelectMode}
        selectedLeadIds={selectedLeadIds}
        onToggleLeadSelection={toggleLeadSelection}
        onSelectLead={setSelectedLead}
        onDragStart={handleDragStart}
        draggedCardId={draggedCardId}
        activeFunnel={activeFunnel}
        onOpenWhatsApp={openWhatsApp}
        onSubStatusChange={handleSubStatusChange}
        onScheduleAppointment={handleScheduleAppointment}
        onOpenProposal={(id) => {
          setProposalLeadId(String(id));
          setIsCreatingProposal(true);
        }}
        onOpenPayment={(card) => {
          setPaymentLead({ id: card.id, value: card.value, proposalId: card.proposalId || null } as any);
          setIsConfirmingPayment(true);
        }}
        onMoveLead={moveCard}
        onScheduleClosed={(lead) => {
          setClosedLeadToSchedule(lead);
          setIsSchedulingClosed(true);
        }}
        onSetActiveFunnel={setActiveFunnel}
        isProcessingSchedule={isProcessingSchedule}
        currentSchedulingLeadId={currentSchedulingLeadId}
        professionalName={professional?.name}
      />

      {/* Add Lead Dialog */}
      <Dialog open={isAddingLead} onOpenChange={setIsAddingLead}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-slate-100 bg-white overflow-visible">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary font-headline">Cadastrar Novo Lead</DialogTitle>
            <p className="text-slate-500 text-sm">Adicione as informações básicas do novo lead para o pipeline.</p>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-slate-400">Nome do Lead</Label>
              <Input 
                id="name" 
                placeholder="Ex: João Silva" 
                className="rounded-xl border-slate-200 h-12 focus:ring-secondary/20"
                value={newLeadData.name}
                onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-slate-400">WhatsApp / Celular</Label>
                <Input 
                  id="phone" 
                  placeholder="(00) 00000-0000" 
                  className="rounded-xl border-slate-200 h-12"
                  value={newLeadData.phone}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 11) val = val.substring(0, 11);
                    
                    if (val.length > 2) {
                      val = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                    }
                    if (val.length > 10) {
                      val = `${val.substring(0, 10)}-${val.substring(10)}`;
                    }
                    setNewLeadData({...newLeadData, phone: val})
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-xs font-bold uppercase tracking-widest text-slate-400">Origem</Label>
                <Select value={newLeadData.origin} onValueChange={(val) => setNewLeadData({...newLeadData, origin: val})}>
                  <SelectTrigger id="origin" className="rounded-xl border-slate-200 h-12 bg-white">
                    <SelectValue placeholder="Selecione...">
                      {origins.find(opt => opt.value === newLeadData.origin)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-white border-slate-100 shadow-xl z-[200]">
                    {origins.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">E-mail</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="email@exemplo.com" 
                  className="rounded-xl border-slate-200 h-12"
                  value={newLeadData.email}
                  onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})}
                />
              </div>
              {!(professional?.role?.toLowerCase() === 'sdr') && (
                <div className="space-y-2">
                  <Label htmlFor="sdr" className="text-xs font-bold uppercase tracking-widest text-slate-400">Atribuir a (SDR)</Label>
                  <Select value={newLeadData.sdrId} onValueChange={(val) => setNewLeadData({...newLeadData, sdrId: val})}>
                    <SelectTrigger id="sdr" className="rounded-xl border-slate-200 h-12 bg-white">
                      <SelectValue placeholder="Selecione...">
                        {newLeadData.sdrId === 'random' ? 'Aleatório (Roleta)' : sdrs.find(opt => opt.id.toString() === newLeadData.sdrId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-white border-slate-100 shadow-xl z-[200]">
                      <SelectItem value="random" className="font-bold text-primary">Aleatório (Roleta)</SelectItem>
                      {sdrs.map(opt => (
                        <SelectItem key={opt.id} value={opt.id.toString()}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsAddingLead(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddLead} variant="secondary" className="rounded-xl px-8 font-bold">Criar Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Stage Change Dialog */}
      <Dialog open={isBulkStageDialogOpen} onOpenChange={setIsBulkStageDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-100 p-6 rounded-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-3xl text-secondary">swap_horiz</span>
              <DialogTitle className="text-xl font-extrabold font-headline tracking-tight">Alterar Estágio em Lote</DialogTitle>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              Selecione o novo funil e estágio para mover os {selectedLeadIds.length} leads selecionados de uma vez só.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Funil de Vendas</Label>
              <Select
                value={bulkSelectedFunnel}
                onValueChange={(val) => {
                  setBulkSelectedFunnel(val);
                  setBulkSelectedStage(""); // Reset stage selection when funnel changes
                }}
              >
                <SelectTrigger className="w-full border-slate-200 focus:ring-secondary/20 rounded-xl h-11">
                  <SelectValue placeholder="Selecione o Funil">
                    {funnelList.find(f => (f.code || f.id) === bulkSelectedFunnel)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[350]">
                  {funnelList.map((f: any) => (
                    <SelectItem key={f.code || f.id} value={f.code || f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Novo Estágio</Label>
              <Select
                value={bulkSelectedStage}
                onValueChange={setBulkSelectedStage}
                disabled={!bulkSelectedFunnel}
              >
                <SelectTrigger className="w-full border-slate-200 focus:ring-secondary/20 rounded-xl h-11">
                  <SelectValue placeholder="Selecione o Estágio">
                    {bulkStages.find(s => (s.code || s.id) === bulkSelectedStage)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[350]">
                  {bulkStages.map((s: any) => (
                    <SelectItem key={s.code || s.id} value={s.code || s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsBulkStageDialogOpen(false)} 
              className="rounded-xl"
              disabled={isBulkUpdating}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkStageChange} 
              variant="secondary" 
              className="rounded-xl px-6 font-bold"
              disabled={!bulkSelectedStage || isBulkUpdating}
            >
              {isBulkUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                "Atualizar Leads"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Details Modal */}
      <LeadDetailsModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={(updatedLead) => {
          if (updatedLead) {
             setSelectedLead(updatedLead);
             // Atualizar localmente para refletir imediatamente no kanban
             setLeads(prev => prev.map(l => 
               l.id === String(updatedLead.id) || l.id === updatedLead.id 
                 ? { ...l, ...updatedLead, id: String(updatedLead.id) } 
                 : l
             ));
          }
          loadLeads(); // Reload leads to sync with server
        }}
        funnels={funnelList}
        allStages={editStages}
      />

      {/* Proposal Dialog */}
      <ProposalDialog 
        open={isCreatingProposal}
        onOpenChange={setIsCreatingProposal}
        lead={leads.find(l => l.id === proposalLeadId)}
        professional={professional}
        services={services}
        onSuccess={loadLeads}
      />
      {/* Appointment Modal */}
      <NewAppointmentModal
        open={isScheduling}
        onOpenChange={setIsScheduling}
        initialLeadId={currentSchedulingLeadId?.toString()}
        initialLeadName={schedulingClientName}
        initialLeadPhone={schedulingClientPhone}
        onSuccess={async () => {
          if (currentSchedulingLeadId) {
            try {
              requireApiSuccess(await leadsApi.update(Number(currentSchedulingLeadId), { is_scheduled: true }));
              await loadLeads();
            } catch (error) {
              toast({ title: "Agendamento criado, mas o funil não foi atualizado", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
              return;
            }
          }
          toast({
            title: "Sucesso!",
            description: "Agendamento realizado e vinculado ao lead.",
          });
        }}
      />
      
      {/* Agendar Agora — from closed lead */}
      {closedLeadToSchedule && (
        <NewAppointmentModal
          open={isSchedulingClosed}
          onOpenChange={(v) => { 
            setIsSchedulingClosed(v); 
            if (!v) setClosedLeadToSchedule(null); 
          }}
          onSuccess={() => { 
            setIsSchedulingClosed(false); 
            setClosedLeadToSchedule(null); 
            loadLeads(); 
          }}
          initialLeadId={closedLeadToSchedule.id}
          initialLeadName={closedLeadToSchedule.name}
          initialLeadPhone={closedLeadToSchedule.phone || ''}
          initialServiceTags={closedLeadToSchedule.tags || []}
        />
      )}

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        selectedCount={selectedLeadIds.length}
      />

      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        team={sdrs}
        funnelList={dynamicFunnels}
        onSuccess={() => {
          loadLeads();
        }}
      />

      <Dialog open={isConfirmingBulkDelete} onOpenChange={setIsConfirmingBulkDelete}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-3xl border-slate-100 shadow-2xl">
          <div className="p-6 border-b border-slate-100 bg-red-50/50">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-2">
              Tem certeza que deseja excluir {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? 's' : ''}? 
              Esta ação não pode ser desfeita. Todos os dados, arquivos e históricos serão apagados.
            </DialogDescription>
          </div>
          <div className="p-4 bg-slate-50 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsConfirmingBulkDelete(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelectedLeads} className="rounded-xl bg-red-500 hover:bg-red-600">
              Sim, Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmPaymentModal
        open={isConfirmingPayment}
        onOpenChange={setIsConfirmingPayment}
        leadId={paymentLead?.id || null}
        leadValue={paymentLead?.value || 0}
        proposalId={paymentLead?.proposalId || null}
        onSuccess={() => {
          loadLeads();
        }}
      />

      {/* Modal de Seleção de Proposta para Avançar de Fase */}
      <Dialog open={proposalSelectionOpen} onOpenChange={setProposalSelectionOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-primary">
              Selecionar Proposta
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-slate-500 text-sm">
              O lead <strong>{leadForProposalSelection?.name}</strong> possui múltiplas propostas. Escolha qual delas será avançada para a fase de <strong>{getStageLabel(targetStageForSelection)}</strong>:
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {leadForProposalSelection?.proposals?.map((prop: any) => (
                <button
                  key={prop.id}
                  onClick={() => handleConfirmProposalSelection(prop.id)}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-primary hover:bg-orange-50/50 transition-all duration-200 group flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm">
                      {prop.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-bold">
                      {Number(prop.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
                    arrow_forward_ios
                  </span>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setProposalSelectionOpen(false)} className="rounded-xl w-full sm:w-auto">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <ProposalViewer
        open={isViewingProposal}
        onOpenChange={setIsViewingProposal}
        proposal={selectedProposal}
        lead={selectedLead}
        companyInfo={{
          name: "SellClin CRM",
          address: "Av. Paulista, 1000 - São Paulo, SP",
          phone: "(11) 99999-9999"
        }}
      />

      {/* Exclusão de Anotação Confirm Dialog */}
      <Dialog open={!!activityToDeleteId} onOpenChange={(open) => { if (!open) setActivityToDeleteId(null); }}>
        <DialogContent className="w-[90vw] max-w-[400px] border-0 shadow-2xl rounded-3xl bg-card p-6 text-foreground z-[310]">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-base font-bold font-headline text-primary">Confirmar Exclusão</DialogTitle>
              <p className="text-xs text-muted-foreground">Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex w-full gap-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => setActivityToDeleteId(null)}
                className="flex-1 rounded-xl h-10 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteActivity}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl h-10 text-xs font-bold shadow-none cursor-pointer"
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FunnelSettingsDialog 
        open={isConfiguringFunnels}
        onOpenChange={setIsConfiguringFunnels}
        onSaved={() => {
          loadFunnelConfigs();
          loadLeads();
        }}
      />
    </div>
  );
};

export default SalesFunnel;
import { useActionPermission } from '@/hooks/use-action-permission';
