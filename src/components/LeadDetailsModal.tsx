import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Edit2, Check, X, History, FileText, CheckSquare, Trash2, Calendar, Eye, Loader2, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { leadsApi, tasksApi, clientsApi, usuariosApi, empresasApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ORIGIN_OPTIONS } from '@/config/funnelConfig';
import { ProposalDialog } from '@/components/funnel/ProposalDialog';
import { ExportModal } from "@/components/ExportModal";
import { ProposalViewer } from "@/components/ProposalViewer";

export function LeadDetailsModal({ lead, isOpen, onClose, onUpdate, funnels, allStages }) {
  const { toast } = useToast();
  const { professional } = useAuth();
  const [selectedLead, setSelectedLead] = useState(lead);
  
  // States from SalesFunnel
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [tempOrigin, setTempOrigin] = useState("");
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [contactCadence, setContactCadence] = useState<number>(0);
  const [localContactCount, setLocalContactCount] = useState(lead?.contactCount || 0);

  useEffect(() => {
    if (isOpen) {
      setLocalContactCount(selectedLead?.contactCount || 0);
      const fetchCompany = async () => {
        try {
          const res = await empresasApi.getMyCompany();
          if (res.success && res.data) {
            setContactCadence(res.data.contactCadence ?? 5);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchCompany();
    }
  }, [isOpen, selectedLead?.id, selectedLead?.contactCount]);

  const handleContactChange = async (newCount: number) => {
    if (newCount < 0 || (contactCadence && newCount > contactCadence)) return;
    
    setLocalContactCount(newCount);
    setSelectedLead((prev: any) => ({ ...prev, contactCount: newCount }));
    
    try {
      const response = await leadsApi.update(selectedLead.id, { contactCount: newCount });
      if (response.success && response.data) {
        if (onUpdate) onUpdate(response.data);
      }
    } catch (error) {
      console.error("Error updating contact count:", error);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a cadência.', variant: 'destructive' });
      setLocalContactCount(selectedLead.contactCount || 0);
      setSelectedLead((prev: any) => ({ ...prev, contactCount: selectedLead.contactCount || 0 }));
    }
  };

  const loadTeam = async () => {
    try {
      const res = await usuariosApi.getAll({ pageSize: 50 });
      if (res.success && res.data) {
        setTeam(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead?.id) return;
    try {
      const response = await leadsApi.delete(selectedLead.id);
      if (response.success) {
        toast({ title: "Lead removido", description: "O lead foi removido com sucesso." });
        setIsDeleteDialogOpen(false);
        onClose();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover lead", variant: "destructive" });
    }
  };

  const [activeDetailsTab, setActiveDetailsTab] = useState('activities');
  const [noteText, setNoteText] = useState("");
  
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [tempActivityContent, setTempActivityContent] = useState("");
  const [activityToDeleteId, setActivityToDeleteId] = useState(null);
  
  const [selectedFunnelForEdit, setSelectedFunnelForEdit] = useState("");
  const [stageValue, setStageValue] = useState("");

  const [leadProposals, setLeadProposals] = useState([]);
  const [leadTasks, setLeadTasks] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("media");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("media");
  const [editTaskDate, setEditTaskDate] = useState("");
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);

  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<any>(null);
  const [editingProposal, setEditingProposal] = useState<any>(null);
  const [proposalToDelete, setProposalToDelete] = useState<any>(null);
  const [deletingProposalId, setDeletingProposalId] = useState<number | null>(null);

  const isAdminOrGestor = professional?.role === 'profissional' || ['admin', 'manager', 'gestor', 'administrador'].some(r => 
    professional?.role?.toLowerCase().includes(r) || professional?.specialization?.toLowerCase().includes(r)
  );

  const handleDeleteProposal = async () => {
    const proposal = proposalToDelete;
    if (!selectedLead?.id || !proposal) return;
    setDeletingProposalId(Number(proposal.id));
    try {
      const result = await leadsApi.deleteProposal(Number(selectedLead.id), Number(proposal.id));
      if (!result.success) throw new Error(result.error?.message || 'Não foi possível apagar a proposta.');
      const remaining = leadProposals.filter((item: any) => item.id !== proposal.id);
      setLeadProposals(remaining);
      setSelectedLead((current: any) => current ? { ...current, proposals: remaining } : current);
      onUpdate?.({ ...selectedLead, proposals: remaining });
      setProposalToDelete(null);
      toast({ title: 'Proposta apagada', description: 'A proposta foi removida com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao apagar proposta', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingProposalId(null);
    }
  };

  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    if (!professional?.id) return;
    const loadServices = async () => {
      try {
        const { catalogsApi } = await import('@/lib/api');
        const res = await catalogsApi.getAll({ professionalId: Number(professional.id) });
        if (res.success) setServices(res.data || []);
      } catch (e) {
        console.error("Error loading services:", e);
      }
    };
    loadServices();
  }, [professional]);

  const [origins, setOrigins] = useState<any[]>([]);

  useEffect(() => {
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
    loadOrigins();
    loadTeam();
  }, []);

  
  useEffect(() => {
    if (lead) {
      setSelectedLead(lead);
      setTempName(lead.name || "");
      setTempPhone(lead.phone || "");
      setTempEmail(lead.email || "");
      setTempOrigin(lead.origin || "");
      setTempValue(lead.value || 0);
      setStageValue(String(lead.status || ""));
      
      // Auto-detect funnel based on the lead's status
      const funnel = funnels.find(f => f.stages?.some(s => String(s.code || s.id) === String(lead.status)));
      if (funnel) {
        setSelectedFunnelForEdit(String(funnel.code || funnel.id));
      }
      
      setLeadProposals(lead.proposals || []);
      
      const loadTasks = async () => {
        try {
          // Add team: 'true' to ensure we get tasks assigned to other team members (like the cadence tasks assigned to SDRs)
          // Add includeCadence: 'true' to fetch cadence tasks which are otherwise filtered out of the generic tasks view
          const res = await tasksApi.getAll({ leadId: Number(lead.id), team: 'true', includeCadence: 'true' });
          if (res.success) {
            setLeadTasks(res.data || []);
          }
        } catch (error) {
          console.error("Erro ao carregar tarefas do lead:", error);
        }
      };
      loadTasks();
    }
  }, [lead, funnels]);

  const editStages = funnels?.find(f => String(f.code || f.id) === selectedFunnelForEdit)?.stages || [];

  const pendingCadenceTask = leadTasks?.find((t: any) => t.status === 'pending' && t.cadenceStageCode);
  const manualTasks = leadTasks?.filter((t: any) => !t.cadenceStageCode) || [];

  const handleUpdate = (field, value) => {
    setSelectedLead(prev => ({ ...prev, [field]: value }));
    onUpdate({ ...selectedLead, [field]: value });
  };

  const handleUpdateName = async () => {
    if (!tempName.trim()) return;
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { name: tempName });
      if (res.success) {
        toast({ title: "Nome atualizado!" });
        handleUpdate('name', tempName);
        setIsEditingName(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar nome", variant: "destructive" });
    }
  };

  const handleUpdateAssignment = async (type: 'sdrId' | 'closerId' | 'especialistaId', value: string | null) => {
    if (!selectedLead) return;
    const numericValue = value ? Number(value) : null;
    
    try {
      const res = await leadsApi.updateAssignment(Number(selectedLead.id), {
        sdrId: type === 'sdrId' ? numericValue : selectedLead.sdrId,
        closerId: type === 'closerId' ? numericValue : selectedLead.closerId,
        especialistaId: type === 'especialistaId' ? numericValue : selectedLead.especialistaId,
      });
      if (res.success) {
        toast({ title: "Atribuição atualizada!" });
        handleUpdate(type, numericValue);
      } else {
        toast({ title: "Erro", description: res.error?.message, variant: "destructive" });
      }
    } catch (e: any) {
      console.error("[LeadDetailsModal] Erro ao atualizar atribuição:", e);
      toast({ title: "Erro ao atualizar atribuição", description: e?.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  const handleUpdatePhone = async () => {
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { phone: tempPhone });
      if (res.success) {
        toast({ title: "Telefone atualizado!" });
        handleUpdate('phone', tempPhone);
        setIsEditingPhone(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleUpdateEmail = async () => {
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { email: tempEmail });
      if (res.success) {
        toast({ title: "Email atualizado!" });
        handleUpdate('email', tempEmail);
        setIsEditingEmail(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleUpdateValue = async () => {
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { value: tempValue });
      if (res.success) {
        toast({ title: "Valor atualizado!" });
        handleUpdate('value', tempValue);
        setIsEditingValue(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleUpdateOrigin = async () => {
    try {
      const res = await leadsApi.update(Number(selectedLead.id), { origin: tempOrigin });
      if (res.success) {
        toast({ title: "Origem atualizada!" });
        handleUpdate('origin', tempOrigin);
        setIsEditingOrigin(false);
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  
  const loadLeads = () => {
    onUpdate(); // Simply invoke the parent's update
  };

  const safeFormatDate = (dateStr) => {
    try {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      // check if valid
      if (isNaN(date.getTime())) return dateStr;
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getPriorityLabel = (val) => {
    switch(val) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      default: return val;
    }
  };

  const handleUpdateActivity = async (activityId) => {
    if (!lead || !tempActivityContent.trim()) return;
    try {
      const res = await leadsApi.updateActivity(Number(lead.id), Number(activityId), { content: tempActivityContent });
      if (res.success) {
        toast({ title: "Atividade atualizada!" });
        setEditingActivityId(null);
        onUpdate();
      } else {
        toast({ title: "Erro ao atualizar atividade", description: res.error?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar atividade", variant: "destructive" });
    }
  };

  const handleViewProposal = (proposal) => {
    setViewingProposal(proposal);
  };

  const handleSaveTask = async () => {
    if (!newTaskTitle) return;
    setIsSavingTask(true);
    try {
      const res = await tasksApi.create({
        title: newTaskTitle,
        description: newTaskDescription,
        priority: newTaskPriority,
        dueDate: newTaskDate ? new Date(newTaskDate).toISOString() : undefined,
        leadId: Number(selectedLead.id),
        assignedToId: Number(professional?.id),
        assigneeType: localStorage.getItem('userType') === 'user' ? 'user' : 'profissional'
      });
      if (res.success) {
        toast({ title: "Tarefa adicionada!" });
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskDate("");
        
        // Add the task locally so it appears immediately without needing a full modal reload
        setLeadTasks(prev => [...prev, res.data]);
        
        onUpdate();
      }
    } catch(e) {
      toast({ title: "Erro ao salvar tarefa", variant: "destructive" });
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: any) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const res = await tasksApi.update(Number(task.id), { status: newStatus });
      if (res.success) {
        setLeadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        toast({ title: newStatus === 'completed' ? "Tarefa concluída!" : "Tarefa reaberta!" });
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar tarefa", variant: "destructive" });
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDeleteId) return;
    try {
      const res = await tasksApi.delete(taskToDeleteId);
      if (res.success) {
        setLeadTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
        toast({ title: "Tarefa excluída!" });
      }
    } catch (e) {
      toast({ title: "Erro ao excluir tarefa", variant: "destructive" });
    } finally {
      setTaskToDeleteId(null);
    }
  };

  const handleStartEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title || "");
    setEditTaskDescription(task.description || "");
    setEditTaskPriority(task.priority || "media");
    setEditTaskDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  };

  const handleSaveEditTask = async () => {
    if (!editingTaskId || !editTaskTitle) return;
    try {
      const payload = {
        title: editTaskTitle,
        description: editTaskDescription,
        priority: editTaskPriority,
        dueDate: editTaskDate ? new Date(editTaskDate).toISOString() : undefined,
      };
      const res = await tasksApi.update(Number(editingTaskId), payload);
      if (res.success) {
        setLeadTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...payload } : t));
        setEditingTaskId(null);
        toast({ title: "Tarefa atualizada!" });
      }
    } catch (e) {
      toast({ title: "Erro ao atualizar tarefa", variant: "destructive" });
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    try {
      const res = await leadsApi.addActivity(Number(selectedLead.id), {
        type: 'nota',
        content: noteText,
        professionalId: Number(professional?.id)
      });
      if (res.success) {
        toast({ title: "Nota adicionada!" });
        setNoteText("");
        onUpdate(); // Trigger a full reload of the lead to get the new activity
      }
    } catch (e) {
      toast({ title: "Erro ao salvar nota", variant: "destructive" });
    }
  };

  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  if (!selectedLead) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-6xl max-h-[95vh] sm:h-[90vh] overflow-hidden rounded-none sm:rounded-[2rem] border-0 sm:border sm:border-slate-100 bg-slate-50 p-0 flex flex-col lg:flex-row w-full shadow-2xl">
          {selectedLead && (
            <>
              {/* Left Sidebar */}
              <div className="w-full lg:w-[400px] shrink-0 h-auto lg:h-full overflow-y-auto custom-scrollbar bg-white lg:border-r border-b lg:border-b-0 border-slate-100 flex flex-col p-6 sm:p-8 z-20 relative">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="absolute top-4 left-4 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors h-10 w-10 rounded-full"
                  title="Apagar Lead"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                
                <div className="flex flex-col gap-6 items-center w-full mt-4">
                  <div className="w-24 h-24 rounded-[1.75rem] bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-4xl font-extrabold text-white shadow-xl shadow-primary/20 ring-4 ring-slate-50 shrink-0">
                    {selectedLead.avatar}
                  </div>
                  <div className="flex-1 space-y-4 w-full flex flex-col items-center">
                    <div className="flex flex-col items-center justify-center w-full gap-3">
                      <div className="w-full flex items-center justify-center">
                        {isEditingName ? (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full">
                            <Input 
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="text-2xl text-center font-extrabold text-primary font-headline tracking-tighter h-12 rounded-xl border-secondary focus-visible:ring-secondary/20 bg-white w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateName();
                                if (e.key === 'Escape') setIsEditingName(false);
                              }}
                            />
                            <div className="flex items-center gap-1">
                              <Button 
                                onClick={handleUpdateName}
                                variant="secondary" 
                                size="sm" 
                                className="h-9 w-9 rounded-xl p-0"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                              </Button>
                              <Button 
                                onClick={() => setIsEditingName(false)}
                                variant="ghost" 
                                size="sm" 
                                className="h-9 w-9 rounded-xl p-0 text-slate-400"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 group/name relative justify-center w-full">
                            <h3 
                              className="text-2xl font-extrabold text-primary font-headline tracking-tighter cursor-pointer hover:text-primary/80 transition-colors text-center"
                              onClick={() => setIsEditingName(true)}
                            >
                              {selectedLead.name}
                            </h3>
                            <button 
                              onClick={() => setIsEditingName(true)}
                              className="opacity-0 group-hover/name:opacity-100 text-slate-300 hover:text-secondary transition-all"
                            >
                              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-2 w-full items-center justify-center">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse-subtle"></span>
                            <span className="text-on-surface-variant font-medium text-xs sm:text-sm">Estágio:</span>
                          </div>
                          
                          <div className="flex gap-2 items-center justify-center flex-wrap w-full">
                            <Select
                              value={selectedFunnelForEdit}
                              onValueChange={(newFunnel) => {
                                setSelectedFunnelForEdit(newFunnel);
                              }}
                            >
                              <SelectTrigger className="h-7 py-0 px-2 text-xs font-semibold border-slate-200 focus:ring-secondary/20 bg-white w-[130px] rounded-lg">
                                <SelectValue placeholder="Selecione o Funil">
                                  {funnels.find(f => String(f.code || f.id) === selectedFunnelForEdit)?.label}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="z-[300]">
                                {funnels.map((f: any) => (
                                  <SelectItem key={String(f.code || f.id)} value={String(f.code || f.id)} className="text-xs rounded-lg pl-8">
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={stageValue}
                              onValueChange={async (newStatus) => {
                                const statusStr = String(newStatus);
                                try {
                                  const res = await leadsApi.update(Number(selectedLead.id), { status: statusStr });
                                  if (res.success) {
                                    toast({ title: "Estágio atualizado!" });
                                    setStageValue(statusStr);
                                    const updatedLead = { ...selectedLead, status: statusStr };
                                    setSelectedLead(updatedLead);
                                    try { onUpdate(updatedLead); } catch(err) { console.error("[LeadDetailsModal] Erro no onUpdate:", err); }
                                  } else {
                                    toast({ title: "Erro ao atualizar estágio", variant: "destructive" });
                                  }
                                } catch (e) {
                                  console.error("[LeadDetailsModal] Erro na API ao atualizar estágio:", e);
                                  toast({ title: "Erro ao atualizar estágio", variant: "destructive" });
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 py-0 px-2 text-xs font-bold border-secondary focus:ring-secondary/20 bg-white min-w-[130px] max-w-[200px] rounded-lg">
                                <SelectValue placeholder="Selecione a Etapa">
                                  {editStages.find(s => String(s.code || s.id) === stageValue)?.label || "Selecione a Etapa"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="z-[300]">
                                {editStages.map((s: any) => (
                                  <SelectItem key={String(s.code || s.id)} value={String(s.code || s.id)} className="text-xs rounded-lg pl-8">
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      <div className="flex gap-3 w-full mt-2">
                        <Button 
                          onClick={() => openWhatsApp(selectedLead.phone)}
                          variant="outline" 
                          className="rounded-full flex-1 h-12 p-0 border-slate-200 text-emerald-500 hover:bg-emerald-50 shadow-sm"
                          title="Abrir WhatsApp"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </Button>
                        <Button 
                          onClick={() => window.open(`tel:${selectedLead.phone}`)}
                          variant="outline" 
                          className="rounded-full flex-1 h-12 p-0 border-slate-200 text-blue-500 hover:bg-blue-50 shadow-sm"
                          title="Ligar"
                        >
                          <span className="material-symbols-outlined text-xl">call</span>
                        </Button>
                      </div>
                    </div>
                    
                    <hr className="border-slate-100 my-4 w-full" />
                    <div className="flex flex-col gap-4 w-full">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
                        {isEditingPhone ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-200 h-8">
                            <Input 
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              className="h-8 py-0 px-2 text-xs font-bold border-secondary focus-visible:ring-secondary/20 w-32 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdatePhone();
                                if (e.key === 'Escape') setIsEditingPhone(false);
                              }}
                            />
                            <button onClick={handleUpdatePhone} className="text-emerald-500 hover:text-emerald-600 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsEditingPhone(false)} className="text-slate-400 hover:text-slate-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/phone h-8">
                            <p 
                              className="text-sm font-bold text-primary cursor-pointer hover:text-secondary transition-colors"
                              onClick={() => setIsEditingPhone(true)}
                            >
                              {selectedLead.phone || "Sem telefone"}
                            </p>
                            <button 
                              onClick={() => setIsEditingPhone(true)}
                              className="opacity-0 group-hover/phone:opacity-100 text-slate-300 hover:text-secondary transition-all animate-in fade-in"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                        {isEditingEmail ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-200 h-8">
                            <Input 
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              className="h-8 py-0 px-2 text-xs font-bold border-secondary focus-visible:ring-secondary/20 w-44 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateEmail();
                                if (e.key === 'Escape') setIsEditingEmail(false);
                              }}
                            />
                            <button onClick={handleUpdateEmail} className="text-emerald-500 hover:text-emerald-600 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsEditingEmail(false)} className="text-slate-400 hover:text-slate-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/email">
                            <p 
                              className="text-sm font-bold text-primary break-all cursor-pointer hover:text-secondary transition-colors"
                              onClick={() => setIsEditingEmail(true)}
                              title={selectedLead.email}
                            >
                              {selectedLead.email || "Sem e-mail"}
                            </p>
                            <button 
                              onClick={() => setIsEditingEmail(true)}
                              className="opacity-0 group-hover/email:opacity-100 text-slate-300 hover:text-secondary transition-all animate-in fade-in"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Canal / Origem</p>
                        {isEditingOrigin ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-200 h-8">
                            <Select
                              value={tempOrigin}
                              onValueChange={setTempOrigin}
                            >
                              <SelectTrigger className="h-8 py-0 px-2 text-xs font-bold border-secondary focus:ring-secondary/20 w-44 bg-white">
                                <SelectValue placeholder="Selecione o canal" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999]">
                                <div className="max-h-[300px] overflow-y-auto">
                                  {origins.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </div>
                              </SelectContent>
                            </Select>
                            <button onClick={handleUpdateOrigin} className="text-emerald-500 hover:text-emerald-600 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsEditingOrigin(false)} className="text-slate-400 hover:text-slate-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/origin">
                            <p 
                              className="text-sm font-bold text-primary break-all cursor-pointer hover:text-secondary transition-colors"
                              onClick={() => {
                                setTempOrigin(selectedLead.origin || "");
                                setIsEditingOrigin(true);
                              }}
                              title={selectedLead.origin}
                            >
                              {origins.find(o => o.value === selectedLead.origin)?.label || selectedLead.origin || "Não informada"}
                            </p>
                            <button 
                              onClick={() => {
                                setTempOrigin(selectedLead.origin || "");
                                setIsEditingOrigin(true);
                              }}
                              className="opacity-0 group-hover/origin:opacity-100 text-slate-300 hover:text-secondary transition-all animate-in fade-in"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor do Lead</p>
                        <p className="text-sm font-bold text-secondary">{selectedLead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>



                      <hr className="border-slate-100 my-2 w-full" />
                      <div className="space-y-3 w-full">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SDR Responsável</p>
                          <Select 
                            value={selectedLead.sdrId ? String(selectedLead.sdrId) : "unassigned"}
                            onValueChange={(val) => handleUpdateAssignment('sdrId', val === "unassigned" ? null : val)}
                          >
                            <SelectTrigger className="h-8 py-0 px-2 text-xs border-slate-200 focus-visible:ring-secondary/20 bg-white">
                              <SelectValue placeholder="Sem SDR">
                                {selectedLead.sdrId ? team.find(u => u.id === selectedLead.sdrId)?.name || 'Desconhecido' : 'Sem SDR'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              <SelectItem value="unassigned">Sem SDR</SelectItem>
                              {team.filter(u => u.role?.isSDR || u.role?.isManager || u.role?.isAdmin).map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Closer Responsável</p>
                          <Select 
                            value={selectedLead.closerId ? String(selectedLead.closerId) : "unassigned"}
                            onValueChange={(val) => handleUpdateAssignment('closerId', val === "unassigned" ? null : val)}
                          >
                            <SelectTrigger className="h-8 py-0 px-2 text-xs border-slate-200 focus-visible:ring-secondary/20 bg-white">
                              <SelectValue placeholder="Sem Closer">
                                {selectedLead.closerId ? team.find(u => u.id === selectedLead.closerId)?.name || 'Desconhecido' : 'Sem Closer'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              <SelectItem value="unassigned">Sem Closer</SelectItem>
                              {team.filter(u => u.role?.isCloser || u.role?.isManager || u.role?.isAdmin).map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Especialista Padrão</p>
                          <Select 
                            value={selectedLead.especialistaId ? String(selectedLead.especialistaId) : "unassigned"}
                            onValueChange={(val) => handleUpdateAssignment('especialistaId', val === "unassigned" ? null : val)}
                          >
                            <SelectTrigger className="h-8 py-0 px-2 text-xs border-slate-200 focus-visible:ring-secondary/20 bg-white">
                              <SelectValue placeholder="Sem Especialista">
                                {selectedLead.especialistaId ? team.find(u => u.id === selectedLead.especialistaId)?.name || 'Desconhecido' : 'Sem Especialista'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              <SelectItem value="unassigned">Sem Especialista</SelectItem>
                              {team.filter(u => u.role?.isSpecialist || u.role?.isManager || u.role?.isAdmin).map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* AlertDialog for deleting lead */}
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogContent className="rounded-3xl border-0 shadow-2xl max-w-[400px]">
                    <AlertDialogHeader>
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                        <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
                      </div>
                      <AlertDialogTitle className="text-center font-headline text-xl">Remover Lead</AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-slate-500">
                        Tem certeza que deseja remover este lead permanentemente? Esta ação não poderá ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center flex-row gap-3 mt-4">
                      <AlertDialogCancel className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold border-slate-200 hover:bg-slate-50 mt-0">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteLead}
                        className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white"
                      >
                        Sim, Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

                {/* Right Side: Main Area (Tabs + Timeline) */}
                <div className="flex-1 bg-slate-50/50 flex flex-col min-w-0 h-full relative overflow-hidden">
                  <div className="flex flex-col h-full">
                    {/* Activity Top Action */}
                    <div className="p-4 sm:p-8 border-b border-slate-100 bg-white/50 space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Linha do Tempo de Atividades</h4>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Em Tempo Real
                        </div>
                      </div>
                      
                      {pendingCadenceTask && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-blue-600">schedule</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                                Próximo Passo: {pendingCadenceTask.title}
                              </h5>
                              {pendingCadenceTask.description && (
                                <p className="text-xs text-blue-800/80 mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                  {pendingCadenceTask.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={async () => {
                              try {
                                await tasksApi.update(pendingCadenceTask.id, { status: 'completed' });
                                toast({ title: "Passo concluído!" });
                                
                                // Refresh local tasks
                                const res = await tasksApi.getAll({ leadId: Number(selectedLead.id), team: 'true', includeCadence: 'true' });
                                if (res.success) setLeadTasks(res.data || []);

                                // Refresh lead to get new activities from backend
                                const resLead = await leadsApi.getById(Number(selectedLead.id));
                                if (resLead.success) {
                                  setSelectedLead(resLead.data);
                                  if (onUpdate) onUpdate(resLead.data);
                                }
                              } catch (e) {
                                toast({ title: "Erro ao concluir", variant: "destructive" });
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0 font-bold"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Marcar como Feito
                          </Button>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <Textarea 
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Digite uma nota sobre esse lead..." 
                          className="rounded-xl border-slate-200 focus:ring-secondary/20 min-h-[80px] text-sm"
                        />
                        <div className="flex justify-end">
                          <Button 
                            onClick={handleSaveNote}
                            disabled={!noteText.trim()}
                            variant="secondary"
                            className="rounded-xl px-6 font-bold h-10 gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">save</span>
                            Salvar Nota
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Timeline / Proposals */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                      <Tabs value={activeDetailsTab} onValueChange={setActiveDetailsTab} className="w-full flex-1 flex flex-col">
                        <div className="px-6 sm:px-8 border-b border-slate-200 bg-white shrink-0 z-20 sticky top-0 flex items-center h-16 shadow-sm">
                          <TabsList className="bg-transparent border-0 h-full p-0 gap-8 w-full justify-start">
                            <TabsTrigger 
                              value="activities" 
                              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-xs font-bold uppercase tracking-widest text-slate-400 gap-2"
                            >
                              <History className="w-4 h-4" />
                              Atividades
                            </TabsTrigger>
                            <TabsTrigger 
                              value="proposals" 
                              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-xs font-bold uppercase tracking-widest text-slate-400 gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              Propostas
                              {leadProposals.length > 0 && (
                                <span className="bg-secondary text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                  {leadProposals.length}
                                </span>
                              )}
                            </TabsTrigger>
                            <TabsTrigger 
                              value="tasks" 
                              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-xs font-bold uppercase tracking-widest text-slate-400 gap-2"
                            >
                              <CheckSquare className="w-4 h-4" />
                              Tarefas
                              {manualTasks.filter(t => t.status !== 'completed').length > 0 && (
                                <span className="bg-secondary text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                  {manualTasks.filter(t => t.status !== 'completed').length}
                                </span>
                              )}
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="activities" className="flex-1 p-4 sm:p-8 m-0 outline-none">
                          <div className="relative pl-8 space-y-12">
                            {/* The Vertical Line */}
                            <div className="absolute left-[15px] top-2 bottom-4 w-[2px] bg-slate-200"></div>

                            {[...selectedLead.activities].reverse().map((act, idx) => {
                              const isNote = act.type === 'nota' || act.type === 'task';
                              const isProposal = act.type === 'proposta' || act.type === 'proposal';
                              
                              const icon = act.icon || (isNote ? 'sticky_note_2' : isProposal ? 'description' : 'info');
                              const color = act.color || (isNote ? 'bg-amber-500' : isProposal ? 'bg-emerald-500' : 'bg-blue-500');
                              const user = act.user || act.createdBy || 'Sistema';
                              const action = act.action || (isNote ? 'fez uma anotação' : isProposal ? 'gerou uma proposta comercial' : 'ação no sistema');
                              const dateStr = act.date || safeFormatDate(act.createdAt || act.updatedAt, "dd/MM/yy 'às' HH:mm");

                              return (
                                <div key={act.id} className="relative animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                                  {/* Node Dot/Icon */}
                                  <div className={cn(
                                    "absolute -left-[32px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white z-10",
                                    color
                                  )}>
                                    <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
                                  </div>

                                  {/* Content Card */}
                                  <div className="space-y-2">
                                    <header className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <span className="text-sm font-extrabold text-primary font-headline">{user}</span>
                                      <span className="text-xs text-slate-400 font-medium">{action}</span>
                                    </header>

                                  {act.result && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase">Resultado</p>
                                      <p className="text-xs font-bold text-slate-700">{act.result}</p>
                                    </div>
                                  )}

                                  {act.content && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detalhamento</p>
                                      {editingActivityId === act.id ? (
                                        <div className="space-y-2 animate-in fade-in duration-200">
                                          <Textarea
                                            value={tempActivityContent}
                                            onChange={(e) => setTempActivityContent(e.target.value)}
                                            className="text-xs text-slate-600 leading-relaxed font-medium border-secondary focus:ring-secondary/20 min-h-[60px] bg-white rounded-xl"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Escape') setEditingActivityId(null);
                                            }}
                                          />
                                          <div className="flex justify-end gap-2">
                                            <Button 
                                              onClick={() => handleUpdateActivity(act.id)} 
                                              variant="secondary" 
                                              size="sm" 
                                              className="h-8 px-3 text-[10px] font-bold gap-1 rounded-lg"
                                            >
                                              <Check className="w-3.5 h-3.5" /> Salvar
                                            </Button>
                                            <Button 
                                              onClick={() => setEditingActivityId(null)} 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-8 px-3 text-[10px] font-bold gap-1 text-slate-400 rounded-lg"
                                            >
                                              <X className="w-3.5 h-3.5" /> Cancelar
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-secondary/20 group/note relative">
                                          <p className="text-xs text-slate-600 leading-relaxed font-medium pr-14">{act.content}</p>
                                          {act.type === 'task' && (
                                            <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-all duration-200 animate-in fade-in">
                                              <button 
                                                onClick={() => {
                                                  setEditingActivityId(act.id);
                                                  setTempActivityContent(act.content || "");
                                                }} 
                                                className="text-slate-400 hover:text-secondary transition-colors p-1 rounded hover:bg-slate-50"
                                                title="Editar Anotação"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button 
                                                onClick={() => setActivityToDeleteId(act.id)} 
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                                title="Excluir Anotação"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <footer className="text-[10px] font-bold text-slate-300 pt-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                    {dateStr}
                                  </footer>
                                </div>
                              </div>
                              );
                            })}
                            {selectedLead.activities.length === 0 && (
                              <div className="text-center py-10">
                                <p className="text-sm text-slate-400 italic">Nenhuma atividade registrada.</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="proposals" className="flex-1 p-4 sm:p-8 m-0 outline-none">

                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Propostas Geradas</h4>
                            <Button 
                              onClick={() => setIsCreatingProposal(true)}
                              size="sm" 
                              className="h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg gap-1.5 shadow-sm shadow-orange-500/20"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              Criar Proposta
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {leadProposals.map((proposal) => (
                              <div 
                                key={proposal.id} 
                                className="group bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all cursor-pointer relative overflow-hidden"
                                onClick={() => handleViewProposal(proposal)}
                              >
                                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-slate-100 bg-white/95 p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isAdminOrGestor && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProposal(proposal);
                                        setIsCreatingProposal(true);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors"
                                      title="Editar Proposta"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {isAdminOrGestor && proposal.status !== 'accepted' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProposalToDelete(proposal);
                                      }}
                                      disabled={deletingProposalId === proposal.id}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                      title="Apagar proposta"
                                    >
                                      {deletingProposalId === proposal.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />}
                                    </button>
                                  )}
                                  <Eye className="w-5 h-5 text-secondary" />
                                </div>
                                
                                <div className="flex items-start gap-4 pr-24">
                                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-bold text-primary text-sm line-clamp-1">{proposal.title}</h5>
                                      {proposal.status === 'accepted' && (
                                        <span className="flex items-center gap-1 bg-green-50 text-green-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap">
                                          <Check className="w-3 h-3" />
                                          Paga
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium">#{proposal.id}</p>
                                  </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-end">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</p>
                                    <p className="text-sm font-bold text-secondary">
                                      {Number(proposal.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</p>
                                    <p className="text-[10px] font-bold text-primary">
                                      {safeFormatDate(proposal.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {leadProposals.length === 0 && !isLoadingProposals && (
                              <div className="col-span-2 text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                  <FileText className="w-8 h-8 text-slate-200" />
                                </div>
                                <h5 className="font-bold text-slate-400">Nenhuma proposta encontrada</h5>
                                <p className="text-xs text-slate-400 mt-1">Gere sua primeira proposta para este lead.</p>
                              </div>
                            )}

                            {isLoadingProposals && (
                              <div className="col-span-2 flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-secondary animate-spin" />
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="tasks" className="m-0 p-6 sm:p-8 outline-none min-h-full bg-slate-50/50 flex flex-col gap-6">
                          {/* Add Task Form */}
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Adicionar Nova Tarefa</h4>
                            
                            <div className="space-y-3">
                              <Input 
                                placeholder="Título da tarefa..." 
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                className="h-10 text-xs rounded-xl bg-slate-50 border border-slate-100 focus-visible:ring-secondary/20"
                              />
                              <Textarea 
                                placeholder="Descrição (opcional)..." 
                                value={newTaskDescription}
                                onChange={(e) => setNewTaskDescription(e.target.value)}
                                className="text-xs rounded-xl bg-slate-50 border border-slate-100 focus-visible:ring-secondary/20 min-h-[60px]"
                              />
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Prioridade</label>
                                  <Select value={newTaskPriority} onValueChange={(val: any) => setNewTaskPriority(val)}>
                                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border border-slate-100 focus:ring-secondary/20">
                                      <SelectValue>{getPriorityLabel(newTaskPriority)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="low">Baixa</SelectItem>
                                      <SelectItem value="medium">Média</SelectItem>
                                      <SelectItem value="high">Alta</SelectItem>
                                      <SelectItem value="urgent">Urgente</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Data e Hora</label>
                                  <Input 
                                    type="datetime-local" 
                                    value={newTaskDate}
                                    onChange={(e) => setNewTaskDate(e.target.value)}
                                    className="h-10 text-xs rounded-xl bg-slate-50 border border-slate-100 focus-visible:ring-secondary/20 font-headline"
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-end pt-2">
                                <Button 
                                  onClick={handleSaveTask}
                                  disabled={!newTaskTitle.trim() || isSavingTask}
                                  variant="secondary"
                                  className="rounded-xl px-6 font-bold h-10 gap-2"
                                >
                                  {isSavingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                                  Adicionar Tarefa
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* List of Tasks */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Tarefas do Lead</h4>
                            
                            {manualTasks.length === 0 ? (
                              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                                <p className="text-sm text-slate-400 italic">Nenhuma tarefa registrada.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-3">
                                {manualTasks.map(task => (
                                  <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 shadow-sm hover:border-secondary/20 transition-colors group">
                                    {editingTaskId === task.id ? (
                                      <div className="space-y-3 w-full">
                                        <Input 
                                          value={editTaskTitle}
                                          onChange={(e) => setEditTaskTitle(e.target.value)}
                                          className="h-9 text-xs rounded-lg"
                                          placeholder="Título"
                                        />
                                        <Textarea 
                                          value={editTaskDescription}
                                          onChange={(e) => setEditTaskDescription(e.target.value)}
                                          className="text-xs rounded-lg min-h-[50px]"
                                          placeholder="Descrição"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                          <Select value={editTaskPriority} onValueChange={(val: any) => setEditTaskPriority(val)}>
                                            <SelectTrigger className="h-9 text-xs rounded-lg">
                                              <SelectValue>{getPriorityLabel(editTaskPriority)}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="low">Baixa</SelectItem>
                                              <SelectItem value="medium">Média</SelectItem>
                                              <SelectItem value="high">Alta</SelectItem>
                                              <SelectItem value="urgent">Urgente</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Input 
                                            type="datetime-local" 
                                            value={editTaskDate}
                                            onChange={(e) => setEditTaskDate(e.target.value)}
                                            className="h-9 text-xs rounded-lg font-headline"
                                          />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingTaskId(null)}>Cancelar</Button>
                                          <Button size="sm" className="h-8 text-xs bg-secondary hover:bg-secondary/90" onClick={handleSaveEditTask}>Salvar</Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-start gap-3 w-full">
                                        <div 
                                          onClick={() => handleToggleTaskStatus(task)}
                                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${task.status === 'completed' ? 'bg-secondary border-secondary text-white' : 'border-slate-300 hover:border-secondary/50'}`}
                                        >
                                          {task.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.title}</p>
                                          {task.description && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                                          )}
                                          <div className="flex flex-wrap items-center gap-3 mt-3">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">
                                              <span className={`w-1.5 h-1.5 rounded-full ${
                                                task.priority === 'urgent' ? 'bg-red-500' :
                                                task.priority === 'high' ? 'bg-orange-500' :
                                                task.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-400'
                                              }`}></span>
                                              {getPriorityLabel(task.priority)}
                                            </div>
                                            {(task.dueDate || task.status === 'completed') && (
                                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">
                                                <Calendar className="w-3 h-3" />
                                                {task.status === 'completed' 
                                                  ? `Concluída: ${safeFormatDate(task.updatedAt)}` 
                                                  : safeFormatDate(task.dueDate)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-secondary hover:bg-secondary/10" onClick={() => handleStartEditTask(task)}>
                                            <Edit2 className="w-4 h-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setTaskToDeleteId(task.id)}>
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDeleteId} onOpenChange={() => setTaskToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será permanentemente removida do lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-500 hover:bg-red-600">
              Sim, excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!proposalToDelete} onOpenChange={(open) => !open && !deletingProposalId && setProposalToDelete(null)}>
        <AlertDialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="h-1.5 bg-red-500" />
          <div className="p-6 sm:p-7">
            <AlertDialogHeader className="text-left">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-primary">Apagar proposta?</AlertDialogTitle>
              <AlertDialogDescription className="pt-1 text-sm leading-6 text-slate-500">
                A proposta <span className="font-semibold text-slate-700">“{proposalToDelete?.title}”</span> será excluída permanentemente. Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2 sm:gap-2">
              <AlertDialogCancel disabled={!!deletingProposalId} className="h-11 rounded-xl border-slate-200 px-5 font-semibold">
                Manter proposta
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleDeleteProposal();
                }}
                disabled={!!deletingProposalId}
                className="h-11 rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700"
              >
                {deletingProposalId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deletingProposalId ? 'Apagando...' : 'Sim, apagar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualizador de Propostas */}
      {viewingProposal && (
        <ProposalViewer
          open={!!viewingProposal}
          onOpenChange={(open) => !open && setViewingProposal(null)}
          proposal={viewingProposal}
          lead={selectedLead}
        />
      )}

      {/* Proposal Dialog */}
      <ProposalDialog 
        open={isCreatingProposal}
        onOpenChange={(open) => {
          setIsCreatingProposal(open);
          if (!open) setEditingProposal(null);
        }}
        lead={selectedLead}
        professional={professional}
        services={services}
        editingProposal={editingProposal}
        onSuccess={() => {
          leadsApi.getProposals(Number(selectedLead?.id)).then(res => {
            if (res.success) {
              setLeadProposals(res.data || []);
              const updated = { ...selectedLead, proposals: res.data || [] };
              setSelectedLead(updated);
              onUpdate(updated);
            }
          });
          setEditingProposal(null);
        }}
      />
    </>
  );
}
