import { loadAllPages } from '@/lib/funnel';
import { useState, useEffect, useRef } from 'react';
import { cn, formatPhone } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, FileText, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useForms, FilledForm } from '@/contexts/FormsContext';
import { FormFillModal } from '@/components/FormFillModal';
import { FormViewModal } from '@/components/FormViewModal';
import { ClientDossierModal } from '@/components/ClientDossierModal';
import { clientsApi } from '@/lib/api';
import { useSectionTour } from '@/hooks/useSectionTour';
import { TourPopover } from '@/components/onboarding/TourPopover';

interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  document: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  professionalId: number;
  appointments?: Array<{ id: number }>;
  status?: 'ativo' | 'inativo';
  totalAppointments?: number;
  lastVisit?: string;
  address?: string;
}

const Clients = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showTimeline, setShowTimeline] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [viewingFormId, setViewingFormId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { professional, hasPermission } = useAuth();
  const allowAction = useActionPermission();
  const { getAssignedTemplates, addFilledForm, getClientForms, getFormById, templates } = useForms();

  // Tour de primeira visita
  const { tourActive, tourStep, tourSteps, tourHandleNext, tourHandlePrev, tourHandleClose } =
    useSectionTour('clients', [
      { id: null, title: '👥 Seus Pacientes', description: 'Aqui você gerencia toda a sua base de pacientes — histórico, contatos e prontuários em um só lugar.', position: 'center' },
      { id: '#clients-add-btn', title: '➕ Novo Paciente', description: 'Clique aqui para cadastrar um novo paciente rapidamente.', position: 'bottom' },
      { id: '#clients-search', title: '🔍 Busca Inteligente', description: 'Encontre qualquer paciente por nome, telefone ou e-mail em segundos.', position: 'bottom' },
      { id: '#clients-table', title: '📋 Lista de Pacientes', description: 'Visualize todos os pacientes. Acesse o Dossiê completo com histórico de atendimentos.', position: 'top' },
    ]);

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchDebounce, setSearchDebounce] = useState('');


  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchDebounce);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDebounce]);

  const listRequest = useRef(0);
  const loadClients = async () => {
    const request = ++listRequest.current;
    setIsLoading(true);
    try {
      const data = await loadAllPages(params => clientsApi.getAll({ ...params, search: searchQuery || undefined }));
      if (request !== listRequest.current) return;
      if (data) {
        const clientsData = data.map((client: any) => ({
          ...client,
          email: client.email || '',
          phone: client.phone || '',
          status: 'ativo' as const,
          totalAppointments: client.appointments?.length || 0,
          lastVisit: client.appointments && client.appointments.length > 0
            ? new Date(client.appointments[0].startTime || client.createdAt).toISOString().split('T')[0]
            : new Date(client.createdAt).toISOString().split('T')[0],
          address: client.notes || '',
        }));
        setClients(clientsData);
      }
    } catch (error) {
      if (request !== listRequest.current) return;
      setClients([]);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
        variant: "destructive",
      });
    } finally {
      if (request === listRequest.current) setIsLoading(false);
    }
  };

  // Recarregar quando searchQuery mudar
  useEffect(() => {
    loadClients();
  }, [searchQuery]);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (client.phone && client.phone.includes(searchQuery))
  );

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!allowAction('clientes', 'editarContatos')) return;
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!professional?.id) {
      toast({
        title: "Erro",
        description: "Profissional não identificado.",
        variant: "destructive",
      });
      return;
    }

    try {
      const clientData = {
        professionalId: Number(professional.id),
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.address || null,
      };

      if (editingClient) {
        const response = await clientsApi.update(editingClient.id, clientData);
        if (response.success) {
          toast({
            title: "Cliente atualizado",
            description: "As informações do cliente foram atualizadas com sucesso.",
          });
          loadClients();
        } else {
          toast({
            title: "Erro",
            description: response.error?.message || "Erro ao atualizar cliente",
            variant: "destructive",
          });
        }
      } else {
        const response = await clientsApi.create(clientData);
        if (response.success) {
          toast({
            title: "Cliente cadastrado",
            description: "Novo cliente foi cadastrado com sucesso.",
          });
          loadClients();
        } else {
          toast({
            title: "Erro",
            description: response.error?.message || "Erro ao cadastrar cliente",
            variant: "destructive",
          });
        }
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      setFormData({ name: '', email: '', phone: '', address: '' });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (clientId: number) => {
    if (!allowAction('clientes', 'excluirContatos')) return;
    try {
      const response = await clientsApi.delete(clientId);
      if (response.success) {
        toast({
          title: "Cliente removido",
          description: "Cliente foi removido com sucesso.",
        });
        loadClients();
      } else {
        toast({
          title: "Erro",
          description: response.error?.message || "Erro ao remover cliente",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover cliente",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'ativo' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getClientRecordCount = (clientId: number) => {
    return getClientForms(clientId.toString()).length;
  };

  const handleViewTimeline = (clientId: number) => {
    setShowTimeline(showTimeline === clientId ? null : clientId);
  };

  const handleOpenFormFill = (client: Client, templateId: string) => {
    setSelectedClient(client);
    setSelectedTemplateId(templateId);
  };

  const handleSaveFilledForm = (data: Record<string, any>) => {
    if (!selectedClient || !selectedTemplateId || !professional) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const filledForm: FilledForm = {
      id: Date.now().toString(),
      templateId: selectedTemplateId,
      templateName: template.nome,
      clientId: selectedClient.id.toString(),
      clientName: selectedClient.name,
      professionalId: professional.id,
      professionalName: professional.name,
      data,
      criadoEm: new Date().toISOString(),
    };

    addFilledForm(filledForm);
    setSelectedTemplateId(null);
    setSelectedClient(null);
  };

  const assignedTemplates = professional ? getAssignedTemplates(professional.id) : [];
  const clientForms = selectedClient ? getClientForms(selectedClient.id.toString()) : [];
  const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;
  const viewingForm = viewingFormId ? getFormById(viewingFormId) : null;
  const viewingTemplate = viewingForm ? templates.find(t => t.id === viewingForm.templateId) : null;

  return (
    <div className="space-y-8 pb-10 min-h-screen animate-in fade-in zoom-in-95 duration-500">
      <TourPopover active={tourActive} step={tourStep} steps={tourSteps} onNext={tourHandleNext} onPrev={tourHandlePrev} onClose={tourHandleClose} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">Pacientes</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">Gerencie sua base de pacientes e históricos clínicos.</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                id="clients-add-btn"
                onClick={() => handleOpenDialog()} 
                size="xl"
                variant="secondary"
                className="h-10 sm:h-12 px-3 sm:px-6 font-bold gap-1 sm:gap-2 shadow-lg shadow-secondary/20 rounded-xl transition-all hover:-translate-y-0.5 text-sm"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="hidden sm:inline">Novo Paciente</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto border-0 shadow-2xl rounded-3xl bg-card p-0">
              <div className="relative p-6 bg-[#0B1525] border-b border-[#0B1525] overflow-hidden shrink-0 rounded-t-3xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <DialogTitle className="text-xl font-bold text-white font-headline relative z-10">
                  {editingClient ? 'Editar Paciente' : 'Novo Paciente'}
                </DialogTitle>
                <p className="text-sm text-white/70 mt-1 relative z-10">
                  {editingClient ? 'Atualize as informações cadastradas' : 'Preencha os dados do novo paciente'}
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    className="h-11 rounded-xl bg-muted/40 border-border focus-visible:ring-secondary/30"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Telefone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      placeholder="(11) 99999-9999"
                      className="h-11 rounded-xl bg-muted/40 border-border focus-visible:ring-secondary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="h-11 rounded-xl bg-muted/40 border-border focus-visible:ring-secondary/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Anotações / Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Informações adicionais..."
                    className="h-11 rounded-xl bg-muted/40 border-border focus-visible:ring-secondary/30"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-border bg-muted/30 flex justify-end gap-3 rounded-b-3xl">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-muted-foreground hover:bg-muted h-11 px-6">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold h-11 px-6 shadow-sm">
                  {editingClient ? 'Atualizar' : 'Salvar Paciente'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total de Pacientes</div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <span className="material-symbols-outlined text-lg">group</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-primary font-headline tracking-tight">{clients.length}</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Cadastrados</p>
          </div>
        </div>
        
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ativos</div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-emerald-600 font-headline tracking-tight">
              {clients.filter(c => c.status === 'ativo').length}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Pacientes Ativos</p>
          </div>
        </div>
        
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novos</div>
            <div className="p-2 bg-secondary/10 text-secondary rounded-xl">
              <span className="material-symbols-outlined text-lg">person_add</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-primary font-headline tracking-tight">0</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Neste Mês</p>
          </div>
        </div>
        
        <div className="premium-card p-4 sm:p-6 border-0 shadow-sm">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Agendamentos</div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <span className="material-symbols-outlined text-lg">event</span>
            </div>
          </div>
          <div className="pt-2">
            <div className="text-3xl font-extrabold text-primary font-headline tracking-tight">
              {clients.reduce((acc, client) => acc + (client.totalAppointments || 0), 0)}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Histórico Total</p>
          </div>
        </div>
      </div>

      {/* Clients Table Area */}
      <div className="premium-card overflow-hidden rounded-3xl border-0 shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-primary font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">list_alt</span>
            Lista de Pacientes
          </h3>
          <div id="clients-search" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#F97316] transition-colors" size={18} />
              <Input
                placeholder="Buscar pacientes por nome, email ou telefone..."
                className="pl-10 bg-white border-slate-200 h-11 focus:ring-2 focus:ring-[#F97316]/20 transition-all rounded-xl"
                value={searchDebounce}
                onChange={(e) => setSearchDebounce(e.target.value)}
              />
            </div>
          </div>
          
          {filteredClients.length > 0 && !isLoading && (
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
        
        <div id="clients-table" className="p-0 overflow-hidden bg-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="material-symbols-outlined text-secondary text-4xl animate-spin mb-3">progress_activity</span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando pacientes...</span>
            </div>
          ) : isMobile ? (
            // Mobile View
            <div className="space-y-3 p-4">
              {paginatedClients.map((client) => (
                <div key={client.id} className="p-4 rounded-2xl border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                        <span className="text-sm font-bold text-primary font-headline">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-primary text-sm">{client.name}</h3>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[9px] uppercase tracking-wider mt-1 font-bold", getStatusColor(client.status))}
                        >
                          {client.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-4 pt-3 border-t border-border">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                        <span className="material-symbols-outlined text-[14px]">phone</span>
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(client)} className="flex-1 h-8 rounded-lg text-[10px] font-bold">
                      <span className="material-symbols-outlined text-[14px] mr-1">edit</span> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleViewTimeline(client.id)} className="flex-1 h-8 rounded-lg text-[10px] font-bold text-secondary border-secondary/20 hover:bg-secondary/5">
                      <span className="material-symbols-outlined text-[14px] mr-1">query_stats</span> Dossiê
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Desktop View
            <div className="w-full">
              <Table className="w-full">
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-border">
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 px-6">Paciente</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12">Contato</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 text-center">Agendamentos</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-12 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-muted/30 border-b-border transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 flex-shrink-0">
                            <span className="text-sm font-bold text-primary font-headline">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-primary text-sm">{client.name}</p>
                            {client.notes && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">location_on</span>
                                {client.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          {client.phone && (
                            <div className="flex items-center text-xs font-bold text-foreground gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-slate-400">phone</span>
                              {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center text-[10px] text-muted-foreground gap-1.5">
                              <span className="material-symbols-outlined text-[12px] text-slate-400">mail</span>
                              {client.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <Badge 
                          variant="outline" 
                          className={cn("text-[9px] uppercase tracking-wider font-bold", getStatusColor(client.status))}
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground font-bold text-xs">
                          {client.totalAppointments}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTimeline(client.id)}
                            className="h-9 px-3 text-[11px] font-bold text-secondary hover:bg-secondary/10 rounded-lg flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">query_stats</span>
                            Dossiê
                          </Button>
                          <div className="w-[1px] h-4 bg-border mx-1"></div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(client)}
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setClientToDelete(client.id)}
                              className="h-9 w-9 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                            >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {filteredClients.length === 0 && !isLoading && (
            <div className="text-center py-16 px-4">
              <span className="material-symbols-outlined text-4xl text-muted mb-2">sentiment_dissatisfied</span>
              <p className="text-sm font-bold text-muted-foreground">
                {searchQuery ? 'Nenhum paciente encontrado com essa busca.' : 'Nenhum paciente cadastrado.'}
              </p>
            </div>
          )}

          {filteredClients.length > 0 && !isLoading && (
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
      
      <ClientDossierModal 
        open={!!showTimeline} 
        clientId={showTimeline} 
        onOpenChange={(open) => setShowTimeline(open ? showTimeline : null)} 
      />

      {/* Form Fill Modal */}
      {selectedClient && selectedTemplate && (
        <FormFillModal
          open={!!selectedTemplateId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTemplateId(null);
              setSelectedClient(null);
            }
          }}
          template={selectedTemplate}
          clientId={selectedClient.id.toString()}
          clientName={selectedClient.name}
          professionalId={professional?.id || ''}
          professionalName={professional?.name || ''}
          onSave={handleSaveFilledForm}
        />
      )}

      {/* Form View Modal */}
      {viewingForm && viewingTemplate && (
        <FormViewModal
          open={!!viewingFormId}
          onOpenChange={(open) => {
            if (!open) setViewingFormId(null);
          }}
          filledForm={viewingForm}
          template={viewingTemplate}
        />
      )}

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent className="sm:max-w-[400px] rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-red-500 text-[24px]">delete</span>
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-slate-800">
              Apagar Cliente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-500 mt-2">
              Você está prestes a excluir este cliente permanentemente. Esta ação não poderá ser desfeita e removerá também pagamentos, agendamentos e históricos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-4 sm:justify-center w-full">
            <AlertDialogCancel className="flex-1 mt-0 bg-white border-slate-200 hover:bg-slate-50 text-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (clientToDelete) {
                  handleDelete(clientToDelete);
                  setClientToDelete(null);
                }
              }} 
              className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0"
            >
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
import { useActionPermission } from '@/hooks/use-action-permission';
