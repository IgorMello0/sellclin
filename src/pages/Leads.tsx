import { loadAllPages } from '@/lib/funnel';
import { useState, useEffect, useRef } from 'react';
import { cn, formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Search, Filter, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { leadsApi, catalogsApi, usuariosApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { ProposalViewer } from '@/components/ProposalViewer';
import { LeadDetailsModal } from '@/components/LeadDetailsModal';
import { FileText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { STAGES, FUNNELS } from '@/config/funnelConfig';
import { useMemo } from 'react';

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

interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  value: number;
  origin: string;
  createdAt: string;
  professionalId: number;
  tags?: string[];
}

const Leads = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    value: '',
    origin: '',
    status: 'prospect_lead',
    sdrId: 'random',
    tags: [] as string[]
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { professional } = useAuth();
  const allowAction = useActionPermission();
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchDebounce, setSearchDebounce] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<number | null>(null);

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isAssignSdrDialogOpen, setIsAssignSdrDialogOpen] = useState(false);
  const [isAssignCloserDialogOpen, setIsAssignCloserDialogOpen] = useState(false);
  const [bulkAssignSdrId, setBulkAssignSdrId] = useState('');
  const [bulkAssignCloserId, setBulkAssignCloserId] = useState('');
  const [closers, setClosers] = useState<any[]>([]);

  const loadSdrs = async () => {
    try {
      const res = await usuariosApi.getAll({ pageSize: 100 });
      if (res.success && res.data) {
        setSdrs(res.data.filter((u: any) => u.isSdr || (u.role && u.role.isSDR) || (u.role && u.role.isSdr)));
        setClosers(res.data.filter((u: any) => u.isCloser || (u.role && u.role.isCloser) || (u.role && u.role.isCLoser)));
      }
    } catch (e) {
      console.error("Error loading SDRs/Closers:", e);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(prev => {
      if (prev) setSelectedIds([]);
      return !prev;
    });
  };

  const toggleSelectLead = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedLeads.map(l => l.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!allowAction('funnel', 'excluirOportunidades')) return;
    try {
      const response = await leadsApi.bulkDelete(selectedIds);
      if (response.success) {
        toast({ title: 'Leads removidos', description: `${selectedIds.length} leads foram removidos.` });
        setSelectedIds([]);
        setIsSelectMode(false);
        loadLeads();
      } else {
        toast({ title: 'Erro', description: 'Erro ao remover leads', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao remover leads', variant: 'destructive' });
    } finally {
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const handleBulkAssignSdr = async () => {
    if (!bulkAssignSdrId) return;
    try {
      const response = await leadsApi.bulkAssignment(selectedIds, { sdrId: Number(bulkAssignSdrId) });
      if (response.success) {
        toast({ title: 'SDR atribuído', description: `${selectedIds.length} leads atribuídos com sucesso.` });
        setSelectedIds([]);
        setIsSelectMode(false);
        loadLeads();
      } else {
        toast({ title: 'Erro', description: 'Erro ao atribuir SDR', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao atribuir SDR', variant: 'destructive' });
    } finally {
      setIsAssignSdrDialogOpen(false);
      setBulkAssignSdrId('');
    }
  };

  const handleBulkAssignCloser = async () => {
    if (!bulkAssignCloserId) return;
    try {
      const response = await leadsApi.bulkAssignment(selectedIds, { closerId: Number(bulkAssignCloserId) });
      if (response.success) {
        toast({ title: 'Closer atribuído', description: `${selectedIds.length} leads atribuídos com sucesso.` });
        setSelectedIds([]);
        setIsSelectMode(false);
        loadLeads();
      } else {
        toast({ title: 'Erro', description: 'Erro ao atribuir Closer', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao atribuir Closer', variant: 'destructive' });
    } finally {
      setIsAssignCloserDialogOpen(false);
      setBulkAssignCloserId('');
    }
  };

  // Proposal State
  const [leadProposals, setLeadProposals] = useState<any[]>([]);
  const [selectedLeadForProposals, setSelectedLeadForProposals] = useState<Lead | null>(null);
  const [isProposalsListOpen, setIsProposalsListOpen] = useState(false);

  const [selectedDetailsLead, setSelectedDetailsLead] = useState<Lead | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);



  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [isViewingProposal, setIsViewingProposal] = useState(false);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);

  const [dynamicFunnels, setDynamicFunnels] = useState<any[]>([]);

  const funnelList = useMemo(() => {
    if (dynamicFunnels.length > 0) return dynamicFunnels;
    return FUNNELS.map(f => ({ ...f, code: f.id }));
  }, [dynamicFunnels]);

  const editStages = useMemo(() => {
    // Return all stages for all funnels so the modal can find what it needs
    let all: any[] = [];
    if (dynamicFunnels.length > 0) {
      dynamicFunnels.forEach(f => {
        const stages = (f.stages || []).map((s: any) => ({ ...s, id: s.code, funnelId: f.code || f.id }));
        all = [...all, ...stages];
      });
    } else {
      Object.keys(STAGES).forEach(funnelId => {
        const stages = STAGES[funnelId as keyof typeof STAGES].map((s: any) => ({ ...s, funnelId }));
        all = [...all, ...stages];
      });
    }
    return all;
  }, [dynamicFunnels]);

  const loadFunnelConfigs = async () => {
    try {
      const { funnelConfigApi } = await import('@/lib/api');
      const res = await funnelConfigApi.getAll();
      if (res.success && res.data?.length > 0) {
        setDynamicFunnels(res.data);
      }
    } catch (e) {
      console.error("Error loading funnel configs:", e);
    }
  };

  const [origins, setOrigins] = useState<any[]>([]);

  useEffect(() => {
    loadLeads();
    loadServices();
    loadFunnelConfigs();
    loadOrigins();
    loadSdrs();
  }, [professional]);

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

  const allAvailableStages = useMemo(() => {
    const stagesList: {id: string, label: string}[] = [];
    Object.values(STAGES).forEach(funnelStages => {
      funnelStages.forEach(stage => {
        stagesList.push({ id: stage.id, label: stage.label });
      });
    });

    dynamicFunnels.forEach(funnel => {
      if (funnel.stages && Array.isArray(funnel.stages)) {
        funnel.stages.forEach((stage: any) => {
          const code = stage.code || stage.id;
          if (!stagesList.find(s => s.id === code)) {
            stagesList.push({ id: code, label: stage.label });
          }
        });
      }
    });

    return stagesList;
  }, [dynamicFunnels]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchDebounce);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDebounce]);

  const listRequest = useRef(0);
  const loadLeads = async () => {
    if (!professional?.id) return;
    const request = ++listRequest.current;
    setIsLoading(true);
    try {
      const data = await loadAllPages(params => leadsApi.getAll({ ...params, search: searchQuery || undefined }));
      if (request === listRequest.current) setLeads(data);
    } catch (error) {
      if (request !== listRequest.current) return;
      setLeads([]);
      toast({
        title: "Erro",
        description: "Erro ao carregar leads",
        variant: "destructive",
      });
    } finally {
      if (request === listRequest.current) setIsLoading(false);
    }
  };

  const loadServices = async () => {
    if (!professional?.id) return;
    try {
      const res = await catalogsApi.getAll({ professionalId: Number(professional.id) });
      if (res.success) setServices(res.data || []);
    } catch (e) {
      console.error("Error loading services for tags:", e);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [searchQuery]);

  const handleOpenProposals = async (lead: Lead) => {
    setSelectedLeadForProposals(lead);
    setIsProposalsListOpen(true);
    setIsLoadingProposals(true);
    try {
      const res = await leadsApi.getProposals(lead.id);
      if (res.success) {
        setLeadProposals(res.data || []);
      }
    } catch (e) {
      toast({ title: "Erro ao carregar propostas", variant: "destructive" });
    } finally {
      setIsLoadingProposals(false);
    }
  };

  const handleViewProposal = (proposal: any) => {
    setSelectedProposal(proposal);
    setIsViewingProposal(true);
  };

  const handleOpenDialog = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        value: lead.value.toString(),
        origin: lead.origin,
        status: lead.status?.toLowerCase() || 'prospect_lead',
        tags: lead.tags || []
      });
    } else {
      setEditingLead(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        value: '',
        origin: '',
        status: 'prospect_lead',
        tags: []
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!professional?.id) return;

    try {
      const leadData = {
        professional_id: Number(professional.id),
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        value: parseFloat(formData.value) || 0,
        origin: formData.origin || 'Direto',
        status: formData.status,
        sdrId: formData.sdrId,
        tags: formData.tags
      };

      let response;
      if (editingLead) {
        response = await leadsApi.update(editingLead.id, leadData);
      } else {
        response = await leadsApi.create(leadData);
      }

      if (response.success) {
        toast({
          title: editingLead ? "Lead atualizado" : "Lead cadastrado",
          description: `O lead foi ${editingLead ? 'atualizado' : 'cadastrado'} com sucesso.`,
        });
        loadLeads();
        setIsDialogOpen(false);
      } else {
        toast({
          title: "Erro",
          description: response.error?.message || "Erro ao salvar lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar lead",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = (id: number) => {
    setLeadToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!leadToDelete) return;
    try {
      const response = await leadsApi.delete(leadToDelete);
      if (response.success) {
        toast({
          title: "Lead removido",
          description: "O lead foi removido com sucesso.",
        });
        loadLeads();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover lead",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setLeadToDelete(null);
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const filteredLeads = leads.filter(lead => {
    if (selectedTags.length === 0) return true;
    const leadTags = lead.tags || [];
    return selectedTags.every(tag => leadTags.includes(tag));
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTags, itemsPerPage]);

  const getStatusLabel = (status: string) => {
    const stage = allAvailableStages.find(s => s.id === status);
    if (stage) return stage.label;
    
    // Fallback dictionary for common hardcoded ones just in case
    const statuses: Record<string, string> = {
      'lost': 'Perdido'
    };
    return statuses[status.toLowerCase()] || status;
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('closed')) return 'bg-green-100 text-green-800 border-green-200';
    if (s.includes('prospect')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('comercial')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (s.includes('sales')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (s === 'lost') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' Mi';
    }
    if (value >= 1000) {
      return (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const ticketMedio = filteredLeads.length > 0 
    ? filteredLeads.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) / filteredLeads.length 
    : 0;

  return (
    <>
    <div className="space-y-8 pb-10 min-h-screen animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">Leads</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">Gerencie seus potenciais clientes e oportunidades de venda.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button 
            onClick={() => navigate('/comercial')}
            variant="outline"
            className="h-9 sm:h-12 px-3 sm:px-6 font-bold gap-1 sm:gap-2 rounded-xl border-secondary/20 text-secondary hover:bg-secondary/5 text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-lg">filter_list</span>
            <span className="hidden sm:inline">Ver no Funil</span>
            <span className="sm:hidden">Funil</span>
          </Button>


          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => handleOpenDialog()} 
                size="xl"
                variant="secondary"
                className="h-9 sm:h-12 px-3 sm:px-6 font-bold gap-1 sm:gap-2 shadow-lg shadow-secondary/20 rounded-xl transition-all hover:-translate-y-0.5 text-xs sm:text-sm"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="hidden sm:inline">Novo Lead</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[600px] border-0 shadow-2xl rounded-3xl bg-card p-0 overflow-hidden">
              <div className="p-6 bg-[#0B1525] border-b border-[#0B1525] rounded-t-3xl">
                <DialogTitle className="text-xl font-bold text-white font-headline">
                  {editingLead ? 'Editar Lead' : 'Novo Lead'}
                </DialogTitle>
                <p className="text-sm text-white/70 mt-1">
                  {editingLead ? 'Atualize as informações do lead' : 'Preencha os dados da nova oportunidade'}
                </p>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome Completo *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: João Silva"
                        className="h-11 rounded-xl bg-muted border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Telefone *</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                        placeholder="(11) 99999-9999"
                        className="h-11 rounded-xl bg-muted border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Origem</Label>
                        <Select 
                          value={formData.origin} 
                          onValueChange={(val) => setFormData({ ...formData, origin: val })}
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-muted border-border">
                            <SelectValue placeholder="Selecione a origem">
                              {origins.find(opt => opt.value === formData.origin)?.label || formData.origin}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl bg-white border-slate-100 shadow-xl z-[200]">
                            {origins.map(opt => (
                              <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!(professional?.role?.toLowerCase() === 'sdr') && (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">SDR</Label>
                          <Select value={formData.sdrId} onValueChange={(val) => setFormData({...formData, sdrId: val})}>
                            <SelectTrigger className="h-11 rounded-xl bg-muted border-border">
                              <SelectValue placeholder="Selecione...">
                                {formData.sdrId === 'random' ? 'Aleatório (Roleta)' : sdrs.find(opt => opt.id.toString() === formData.sdrId)?.name}
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
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status Atual</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(val) => setFormData({ ...formData, status: val })}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-muted border-border">
                          <SelectValue placeholder="Selecione o status">
                            {getStatusLabel(formData.status)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                          {allAvailableStages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="lost">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tags de Serviços</Label>
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-2xl border border-border min-h-[60px]">
                    {services.map((service) => {
                      const isSelected = formData.tags.includes(service.name);
                      return (
                        <button
                          key={service.id}
                          onClick={() => {
                            const newTags = isSelected
                              ? formData.tags.filter(t => t !== service.name)
                              : [...formData.tags, service.name];
                            setFormData({ ...formData, tags: newTags });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                            isSelected
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-card text-muted-foreground border-border hover:border-primary/30"
                          )}
                        >
                          {service.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border bg-muted/50 flex justify-end gap-3 rounded-b-3xl">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold h-11 px-6">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold h-11 px-6 shadow-sm">
                  {editingLead ? 'Atualizar' : 'Salvar Lead'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="premium-card p-6 border-0 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filtrar por Tags</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => toggleTag(service.name)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                selectedTags.includes(service.name)
                  ? "bg-secondary text-white border-secondary shadow-md scale-105"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/20 hover:text-foreground shadow-sm"
              )}
            >
              {service.name}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedTags([])}
              className="text-[10px] font-bold text-red-500 hover:bg-red-50 h-8 rounded-lg"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm overflow-hidden">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Filtrado</div>
            <div className="text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined text-lg">group</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight truncate">{filteredLeads.length}</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Leads</p>
          </div>
        </div>
        
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm overflow-hidden">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novos Leads</div>
            <div className="text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-lg">star</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-amber-600 font-headline tracking-tight truncate">
              {filteredLeads.filter(l => l.status === 'prospect_lead').length}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Aguardando</p>
          </div>
        </div>

        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm overflow-hidden">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Propostas</div>
            <div className="text-purple-600 dark:text-purple-400">
              <span className="material-symbols-outlined text-lg">sync_alt</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-primary font-headline tracking-tight truncate">
              {filteredLeads.filter(l => l.status.includes('proposal')).length}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Em Negociação</p>
          </div>
        </div>

        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm overflow-hidden">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ticket Médio</div>
            <div className="text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-2xl font-extrabold text-primary font-headline tracking-tight truncate">
              R$ {formatCurrency(ticketMedio)}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Filtrado</p>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="premium-card overflow-hidden rounded-3xl border-0 shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/50 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-primary font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">list_alt</span>
                Gerenciamento de Leads
              </h3>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
                <Button
                  onClick={toggleSelectMode}
                  variant={isSelectMode ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-9 px-3 sm:px-4 font-bold gap-1 sm:gap-2 rounded-xl text-xs transition-all",
                    isSelectMode
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "border-slate-200 text-slate-600 hover:border-primary/30"
                  )}
                >
                  <span className="material-symbols-outlined text-base">{isSelectMode ? 'close' : 'checklist'}</span>
                  <span className="hidden sm:inline">{isSelectMode ? 'Cancelar Seleção' : 'Multisseleção'}</span>
                  <span className="sm:hidden">{isSelectMode ? 'Cancelar' : 'Multisseleção'}</span>
                </Button>

                {isSelectMode && selectedIds.length > 0 && (
                  <>
                    <Button
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 font-bold gap-1 rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">delete_sweep</span>
                      <span className="hidden sm:inline">Apagar ({selectedIds.length})</span>
                    </Button>
                    <Button
                      onClick={() => setIsAssignSdrDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 font-bold gap-1 rounded-xl text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">person_pin</span>
                      <span className="hidden sm:inline">SDR</span>
                    </Button>
                    <Button
                      onClick={() => setIsAssignCloserDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 font-bold gap-1 rounded-xl text-xs border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">handshake</span>
                      <span className="hidden sm:inline">Closer</span>
                    </Button>
                  </>
                )}

                <div className="relative w-full sm:flex-1 lg:w-64 xl:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                  <Input
                    placeholder="Buscar por nome, fone..."
                    className="pl-10 bg-card border-border transition-all rounded-xl h-9 shadow-sm text-sm"
                    value={searchDebounce}
                    onChange={(e) => setSearchDebounce(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {filteredLeads.length > 0 && !isLoading && (
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-500">
                  <span>Mostrar</span>
                  <select
                    className="h-8 w-14 sm:w-16 rounded-md border border-slate-200 bg-white text-center text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  >
                    {[20, 40, 60, 80, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="hidden sm:inline">por página</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-slate-500">
                  <span className="hidden sm:inline">Página <span className="font-bold text-slate-700">{currentPage}</span> de {totalPages || 1}</span>
                  <span className="sm:hidden font-bold">{currentPage}/{totalPages || 1}</span>
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-0 bg-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-secondary animate-spin mb-3" />
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sincronizando base...</span>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b-slate-100/50">
                  {isSelectMode && (
                    <TableHead className="w-10 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 w-4 h-4 cursor-pointer accent-primary"
                        checked={selectedIds.length > 0 && selectedIds.length === paginatedLeads.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 px-6">Lead</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12">Tags</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12">Valor</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className={cn(
                      "hover:bg-muted/50 border-b-border transition-colors",
                      isSelectMode && selectedIds.includes(lead.id) && "bg-primary/5"
                    )}
                  >
                    {isSelectMode && (
                      <TableCell className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 w-4 h-4 cursor-pointer accent-primary"
                          checked={selectedIds.includes(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell 
                      className="px-6 py-4 cursor-pointer group/lead" 
                      onClick={() => {
                        if (isSelectMode) { toggleSelectLead(lead.id); }
                        else { setSelectedDetailsLead(lead); setIsDetailsModalOpen(true); }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 flex-shrink-0 group-hover/lead:bg-secondary/10 group-hover/lead:border-secondary/20 transition-all">
                          <span className="text-sm font-bold text-primary font-headline group-hover/lead:text-secondary">

                            {lead.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-primary text-sm group-hover/lead:text-secondary transition-colors">{lead.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">phone</span>
                            {lead.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags || []).map((tag, idx) => (
                          <span key={idx} className="bg-muted text-muted-foreground text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            {tag}
                          </span>
                        ))}
                        {(!lead.tags || lead.tags.length === 0) && (
                          <span className="text-[10px] text-slate-300 italic">Sem tags</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider font-bold", getStatusColor(lead.status))}>
                        {getStatusLabel(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-primary text-sm">
                      R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/comercial')}
                          className="h-9 px-3 text-[11px] font-bold text-secondary hover:bg-secondary/10 rounded-lg flex items-center gap-1"
                        >
                          Detalhes
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenProposals(lead)}
                          className="h-9 w-9 p-0 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg"
                          title="Ver Propostas"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedDetailsLead(lead); setIsDetailsModalOpen(true); }}
                          className="h-9 w-9 p-0 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => confirmDelete(lead.id)}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {filteredLeads.length === 0 && !isLoading && (
            <div className="text-center py-20 px-4">
              <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">person_search</span>
              <p className="text-sm font-bold text-slate-500">Nenhum lead encontrado com estes filtros.</p>
            </div>
          )}

          {filteredLeads.length > 0 && !isLoading && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-xl">
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span>Mostrar</span>
                <select
                  className="h-8 w-16 rounded-md border border-slate-200 bg-white text-center text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  {[20, 40, 60, 80, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="hidden sm:inline">por página</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-500">
                  Página <span className="font-bold text-slate-700">{currentPage}</span> de {totalPages || 1}
                </span>
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


      
      <LeadDetailsModal
        lead={selectedDetailsLead}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onUpdate={(updatedLead) => {
          if (updatedLead) {
            setLeads(prev => prev.map(l => 
              l.id === updatedLead.id ? { ...l, ...updatedLead } : l
            ));
          }
          loadLeads();
        }}
        funnels={funnelList}
        allStages={editStages}
      />

      {/* Proposals List Dialog */}
      <Dialog open={isProposalsListOpen} onOpenChange={setIsProposalsListOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-0 shadow-2xl bg-card p-0 overflow-hidden">
          <div className="p-6 bg-[#0B1525] text-white">
            <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" />
              Propostas de {selectedLeadForProposals?.name}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {isLoadingProposals ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-secondary animate-spin" />
              </div>
            ) : leadProposals.length > 0 ? (
              leadProposals.map((p) => (
                <div 
                  key={p.id} 
                  className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border hover:border-secondary/30 hover:bg-card transition-all group cursor-pointer"
                  onClick={() => handleViewProposal(p)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">{p.title || `Proposta #${p.id}`}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {safeFormatDate(p.createdAt)} • {Number(p.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 group-hover:text-secondary">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400 italic">Nenhuma proposta encontrada.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProposalViewer
        open={isViewingProposal}
        onOpenChange={setIsViewingProposal}
        proposal={selectedProposal}
        lead={selectedLeadForProposals}
        companyInfo={{
          name: "SellClin CRM",
          address: "Av. Paulista, 1000 - São Paulo, SP",
          phone: "(11) 99999-9999"
        }}
      />

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
              onClick={executeDelete}
              className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white"
            >
              Sim, Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* BULK DELETE DIALOG */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl max-w-[400px]">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
              <span className="material-symbols-outlined text-red-500 text-2xl">delete_sweep</span>
            </div>
            <AlertDialogTitle className="text-center font-headline text-xl">Remover {selectedIds.length} Leads</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500">
              Tem certeza que deseja remover <strong>{selectedIds.length} leads</strong> permanentemente? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center flex-row gap-3 mt-4">
            <AlertDialogCancel className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold border-slate-200 hover:bg-slate-50 mt-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white"
            >
              Sim, Remover Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ASSIGN TO SDR DIALOG */}
      <Dialog open={isAssignSdrDialogOpen} onOpenChange={setIsAssignSdrDialogOpen}>
        <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-[420px] p-0 overflow-hidden">
          <div className="p-6 bg-[#0B1525] text-white rounded-t-3xl">
            <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">person_pin</span>
              Atribuir a SDR
            </DialogTitle>
            <p className="text-sm text-white/70 mt-1">{selectedIds.length} leads selecionados</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selecione o SDR</Label>
              <Select value={bulkAssignSdrId} onValueChange={setBulkAssignSdrId}>
                <SelectTrigger className="h-11 rounded-xl bg-muted border-border">
                  <SelectValue placeholder="Escolha um SDR desta clínica...">
                    {bulkAssignSdrId ? sdrs.find((s: any) => s.id.toString() === bulkAssignSdrId)?.name : ''}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white border-slate-100 shadow-xl z-[200]">
                  {sdrs.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum SDR encontrado nesta clínica</div>
                  )}
                  {sdrs.map((sdr: any) => (
                    <SelectItem key={sdr.id} value={sdr.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                          {sdr.name?.charAt(0).toUpperCase()}
                        </div>
                        {sdr.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsAssignSdrDialogOpen(false)} className="flex-1 rounded-xl font-bold h-11">
                Cancelar
              </Button>
              <Button
                onClick={handleBulkAssignSdr}
                disabled={!bulkAssignSdrId}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold h-11"
              >
                Atribuir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ASSIGN TO CLOSER DIALOG */}
      <Dialog open={isAssignCloserDialogOpen} onOpenChange={setIsAssignCloserDialogOpen}>
        <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-[420px] p-0 overflow-hidden">
          <div className="p-6 bg-[#0B1525] text-white rounded-t-3xl">
            <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">handshake</span>
              Atribuir a Closer
            </DialogTitle>
            <p className="text-sm text-white/70 mt-1">{selectedIds.length} leads selecionados</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selecione o Closer</Label>
              <Select value={bulkAssignCloserId} onValueChange={setBulkAssignCloserId}>
                <SelectTrigger className="h-11 rounded-xl bg-muted border-border">
                  <SelectValue placeholder="Escolha um Closer desta clínica...">
                    {bulkAssignCloserId ? closers.find((c: any) => c.id.toString() === bulkAssignCloserId)?.name : ''}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-white border-slate-100 shadow-xl z-[200]">
                  {closers.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum Closer encontrado nesta clínica</div>
                  )}
                  {closers.map((closer: any) => (
                    <SelectItem key={closer.id} value={closer.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600">
                          {closer.name?.charAt(0).toUpperCase()}
                        </div>
                        {closer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsAssignCloserDialogOpen(false)} className="flex-1 rounded-xl font-bold h-11">
                Cancelar
              </Button>
              <Button
                onClick={handleBulkAssignCloser}
                disabled={!bulkAssignCloserId}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold h-11"
              >
                Atribuir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Leads;
import { useActionPermission } from '@/hooks/use-action-permission';
