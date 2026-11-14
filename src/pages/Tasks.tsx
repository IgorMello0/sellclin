import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
import { TaskCalendar } from '@/components/tasks/TaskCalendar';
import { toast as actionToast } from 'sonner';
import { 
  Search, 
  Filter, 
  Loader2, 
  Plus, 
  User, 
  RefreshCw, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  X,
  UserCheck,
  MessageCircle,
  ClipboardList,
  CalendarDays,
  Circle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActionPermission } from '@/hooks/use-action-permission';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, conversationsApi, professionalsApi, clientsApi, leadsApi, usuariosApi, getImageUrl } from '@/lib/api';
import { format, isBefore, isToday, startOfDay } from 'date-fns';

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  scheduledAt?: string | null;
  label?: string | null;
  color?: string | null;
  assignedToId: number;
  createdById: number;
  clientId: number | null;
  leadId: number | null;
  isRecurring: boolean;
  recurrenceRule: 'daily' | 'weekly' | 'monthly' | null;
  parentTaskId: number | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: number;
    name: string;
    email: string;
    photoUrl: string | null;
    isUser?: boolean;
  };
  createdBy: {
    id: number;
    name: string;
    email: string;
    photoUrl: string | null;
  };
  client?: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
  lead?: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
}

const defaultLabels = ['Retorno', 'Recepção', 'Financeiro'];
const taskColors = [
  { name: 'Sem cor', value: '' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#059669' },
  { name: 'Amarelo', value: '#ca8a04' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Roxo', value: '#7c3aed' },
];
const labelKey = (label: string) => 'label:' + label.toLocaleLowerCase('pt-BR');

type ContactOption = { id: number; name: string; phone?: string | null };

export default function Tasks() {
  const { professional, hasPermission, hasModuleAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const taskRequest = useRef(0);
  const statusRequests = useRef(new Set<number>());
  const allowAction = useActionPermission();
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Tasks & Filtering State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('list');
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<'pending' | 'in_progress' | 'completed' | null>(null);

  // Relations & Autocomplete / Option Lists
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<ContactOption[]>([]);
  const [linkedLead, setLinkedLead] = useState<ContactOption | null>(null);
  const [linkedClient, setLinkedClient] = useState<ContactOption | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSearchStatus, setLeadSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Dialog & Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    label: '',
    color: '',
    scheduledAt: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    assignedToId: '',
    clientId: '',
    leadId: '',
    isRecurring: false,
    recurrenceRule: 'daily' as 'daily' | 'weekly' | 'monthly'
  });

  // Load Initial Options
  const loadRelationData = useCallback(async () => {
    try {
      const [profsRes, usersRes, clientsRes] = await Promise.all([
        professionalsApi.getAll({ pageSize: 100 }),
        usuariosApi.getAll({ pageSize: 100 }),
        clientsApi.getAll({ pageSize: 100 })
      ]);

      const combinedProfs: any[] = [];
      if (profsRes.success && profsRes.data) {
        combinedProfs.push(...profsRes.data.map((p: any) => ({
          id: `prof-${p.id}`,
          name: p.name,
          email: p.email,
          photoUrl: p.photoUrl || null,
          isUser: false,
          realId: p.id
        })));
      }
      if (usersRes.success && usersRes.data) {
        combinedProfs.push(...usersRes.data.map((u: any) => ({
          id: `user-${u.id}`,
          name: u.name,
          email: u.email,
          photoUrl: null,
          isUser: true,
          realId: u.id
        })));
      }
      setProfessionals(combinedProfs);

      if (clientsRes.success && clientsRes.data) {
        setClients(clientsRes.data);
      }
    } catch (err) {
      console.error('Erro ao carregar dados relacionais:', err);
    }
  }, []);

  // Fetch Tasks from API
  const loadTasks = useCallback(async (silent = false) => {
    const request = ++taskRequest.current;
    if (!silent) {
      setIsLoading(true);
      setLoadError(false);
    }
    try {
      const params: any = {
        search: searchQuery || undefined,
        team: isTeamMode
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (dateFilter !== 'all') params.dueDateRange = dateFilter;

      const res = await tasksApi.getAll(params);
      if (request !== taskRequest.current) return;
      if (res.success && res.data) {
        // Filtragem adicional no client-side para o responsibleFilter
        let filteredTasks = res.data;
        if (responsibleFilter !== 'all') {
          const isFilterUser = responsibleFilter.startsWith('user-');
          const filterId = Number(responsibleFilter.replace('user-', '').replace('prof-', ''));
          filteredTasks = filteredTasks.filter((t: any) => {
            if (isFilterUser) {
              return t.assignedToUserId === filterId || (t.assignedTo && t.assignedTo.isUser && t.assignedTo.id === filterId);
            } else {
              return t.assignedToId === filterId || (t.assignedTo && !t.assignedTo.isUser && t.assignedTo.id === filterId);
            }
          });
        }
        setTasks(filteredTasks);
      } else {
        if (!silent) setLoadError(true);
        toastRef.current({
          title: 'Erro',
          description: res.error?.message || 'Erro ao buscar tarefas.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      if (request !== taskRequest.current) return;
      if (!silent) setLoadError(true);
      toastRef.current({
        title: 'Erro',
        description: 'Erro na conexão com o servidor.',
        variant: 'destructive',
      });
    } finally {
      if (request === taskRequest.current) setIsLoading(false);
    }
  }, [searchQuery, isTeamMode, statusFilter, priorityFilter, dateFilter, responsibleFilter]);

  // Load relation data once on mount or when professional changes
  useEffect(() => {
    if (professional) {
      loadRelationData();
    }
  }, [professional, loadRelationData]);

  // Load tasks when filters or search change
  useEffect(() => {
    if (professional) {
      loadTasks();
    }
  }, [professional, loadTasks]);

  // Handle Create / Edit Form Submission
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.dueDate || !formData.assignedToId) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Título, data de vencimento e profissional responsável são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isAssigneeUser = formData.assignedToId.startsWith('user-');
      const numericId = Number(formData.assignedToId.replace('user-', '').replace('prof-', ''));
      const unchangedAssignee = editingTask?.assignedTo?.id === numericId && Boolean((editingTask?.assignedTo as any)?.isUser) === isAssigneeUser;
      if (!unchangedAssignee && (numericId !== Number(professional?.id) || isAssigneeUser !== (localStorage.getItem('userType') === 'user')) && !allowAction('tarefas', 'atribuirParaOutros')) return;

      const dataToSave = {
        title: formData.title,
        description: formData.description || null,
        label: formData.label.trim() || null,
        color: formData.color || null,
        scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
        priority: formData.priority,
        dueDate: new Date(formData.dueDate).toISOString(),
        assignedToId: numericId,
        assigneeType: isAssigneeUser ? 'user' : 'professional',
        clientId: formData.clientId ? Number(formData.clientId) : null,
        leadId: formData.leadId ? Number(formData.leadId) : null,
        isRecurring: formData.isRecurring,
        recurrenceRule: formData.isRecurring ? formData.recurrenceRule : null,
        status: formData.status
      };

      let res;
      if (editingTask) {
        res = await tasksApi.update(editingTask.id, dataToSave);
      } else {
        res = await tasksApi.create(dataToSave);
      }

      if (res.success) {
        toast({
          title: editingTask ? 'Tarefa atualizada' : 'Tarefa criada',
          description: editingTask 
            ? 'A tarefa foi atualizada com sucesso.' 
            : `A tarefa foi criada e atribuída com sucesso.${formData.priority === 'urgent' ? ' Alertas de urgência enviados!' : ''}`,
        });
        setIsFormOpen(false);
        setEditingTask(null);
        loadTasks();
      } else {
        toast({
          title: 'Erro',
          description: res.error?.message || 'Não foi possível salvar a tarefa.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de processamento.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Form Modal
  const handleOpenForm = (task: Task | null = null, day?: Date) => {
    setLeadSearch('');
    setLeads([]);
    setLinkedLead(task?.lead ?? null);
    setLinkedClient(task?.client ?? null);
    if (task) {
      setEditingTask(task);
      const isUserAssignee = task.assignedTo && (task.assignedTo as any).isUser;
      setFormData({
        title: task.title,
        description: task.description || '',
        label: task.label || '',
        color: task.color || '',
        scheduledAt: task.scheduledAt ? format(new Date(task.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
        status: task.status,
        priority: task.priority,
        dueDate: format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm"),
        assignedToId: task.assignedTo ? (isUserAssignee ? `user-${task.assignedTo.id}` : `prof-${task.assignedTo.id}`) : '',
        clientId: task.clientId ? String(task.clientId) : '',
        leadId: task.leadId ? String(task.leadId) : '',
        isRecurring: task.isRecurring,
        recurrenceRule: (task.recurrenceRule as any) || 'daily'
      });
    } else {
      setEditingTask(null);
      const userType = localStorage.getItem('userType');
      setFormData({
        title: '',
        description: '',
        label: '',
        color: '',
        scheduledAt: '',
        status: 'pending',
        priority: 'medium',
        dueDate: format(day ?? new Date(), "yyyy-MM-dd'T'HH:mm"),
        assignedToId: professional ? (userType === 'user' ? `user-${professional.id}` : `prof-${professional.id}`) : '',
        clientId: '',
        leadId: '',
        isRecurring: false,
        recurrenceRule: 'daily'
      });
    }
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (!professional) return;
    const context = location.state?.taskContact as {
      companyId?: number;
      lead?: ContactOption | null;
      client?: ContactOption | null;
    } | undefined;
    if (!context) return;

    if (context.companyId === professional.companyId && (context.lead || context.client)) {
      handleOpenForm();
      setLinkedLead(context.lead ?? null);
      setLinkedClient(context.lead ? null : context.client ?? null);
      setFormData((data) => ({
        ...data,
        leadId: context.lead ? String(context.lead.id) : '',
        clientId: !context.lead && context.client ? String(context.client.id) : '',
      }));
    }
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, professional, navigate]);

  useEffect(() => {
    const search = leadSearch.trim();
    if (!isFormOpen || search.length < 2) {
      setLeadSearchStatus('idle');
      setLeads([]);
      return;
    }
    let current = true;
    setLeadSearchStatus('loading');
    setLeads([]);
    const timer = window.setTimeout(async () => {
      try {
        const response = await leadsApi.getAll({ search, pageSize: 20 });
        if (!current) return;
        setLeads(response.success ? response.data ?? [] : []);
        setLeadSearchStatus(response.success ? 'ready' : 'error');
      } catch {
        if (current) setLeadSearchStatus('error');
      }
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [isFormOpen, leadSearch, professional?.companyId]);

  const openTaskConversation = async (task: Task) => {
    if (openingConversation) return;
    setOpeningConversation(true);
    try {
      const result = await conversationsApi.list({
        leadId: task.leadId ?? undefined,
        clientId: task.leadId ? undefined : task.clientId ?? undefined,
        pageSize: 1,
      });
      if (!result.success) throw new Error(result.error?.message);
      const conversation = result.data?.[0];
      if (conversation) {
        navigate('/conversas?conversationId=' + conversation.id);
      } else {
        toast({ title: 'Nenhuma conversa encontrada', description: 'Este contato ainda não tem uma conversa disponível para você.' });
      }
    } catch {
      toast({ title: 'Não foi possível abrir a conversa', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setOpeningConversation(false);
    }
  };

  // Delete a Task
  const handleDeleteTask = async () => {
    if (!allowAction('tarefas', 'excluirTarefas')) return;
    if (!taskToDeleteId) return;
    try {
      const res = await tasksApi.delete(taskToDeleteId);
      if (res.success) {
        toast({
          title: 'Tarefa removida',
          description: 'A tarefa foi excluída com sucesso.',
        });
        loadTasks();
      } else {
        toast({
          title: 'Erro',
          description: res.error?.message || 'Não foi possível excluir a tarefa.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão ao excluir a tarefa.',
        variant: 'destructive',
      });
    } finally {
      setTaskToDeleteId(null);
    }
  };

  // Update Status Quick-Move
  const handleUpdateStatus = async (task: Task, newStatus: 'pending' | 'in_progress' | 'completed') => {
    if (statusRequests.current.has(task.id)) return;
    statusRequests.current.add(task.id);

    // Atualização otimista (instantânea na UI)
    setTasks(prevTasks => 
      prevTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    );

    try {
      const res = await tasksApi.update(task.id, { status: newStatus });
      if (res.success) {
        if (newStatus === 'completed' && !task.isRecurring) {
          const companyId = localStorage.getItem('activeCompanyId');
          actionToast.success('Tarefa concluída', {
            description: task.title,
            action: {
              label: 'Desfazer',
              onClick: () => {
                if (localStorage.getItem('activeCompanyId') === companyId) {
                  void handleUpdateStatus({ ...task, status: newStatus }, task.status);
                }
              },
            },
          });
        } else {
          toast({
            title: 'Status atualizado',
            description: 'Tarefa movida para ' + getStatusLabel(newStatus).toLowerCase() + '.',
          });
        }
        loadTasks(true); // silent reload
      } else {
        toast({
          title: 'Erro',
          description: res.error?.message || 'Erro ao atualizar status.',
          variant: 'destructive',
        });
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: task.status } : item));
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro na requisição.',
        variant: 'destructive',
      });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: task.status } : item));
    } finally {
      statusRequests.current.delete(task.id);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('taskId', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
    
    // Delay state update to allow browser to capture opaque drag ghost
    setTimeout(() => {
      setDraggedTaskId(taskId);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, status: 'pending' | 'in_progress' | 'completed') => {
    e.preventDefault();
    setDropTargetStatus(status);
  };

  const handleDragLeave = () => {
    setDropTargetStatus(null);
  };

  const handleDrop = (e: React.DragEvent, status: 'pending' | 'in_progress' | 'completed') => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('taskId');
    const taskId = taskIdStr ? Number(taskIdStr) : draggedTaskId;

    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== status) {
        handleUpdateStatus(task, status);
      }
    }

    setDraggedTaskId(null);
    setDropTargetStatus(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDropTargetStatus(null);
  };

  // Helpers
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low':
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'in_progress': return 'Em Andamento';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (status === 'completed') return false;
    const taskDate = startOfDay(new Date(dateStr));
    const today = startOfDay(new Date());
    return isBefore(taskDate, today);
  };

  const labels = new Map(defaultLabels.map((label) => [labelKey(label), label]));
  for (const task of tasks) {
    if (task.label) labels.set(labelKey(task.label), task.label);
  }
  if (labelFilter !== 'all' && !labels.has(labelFilter)) {
    labels.set(labelFilter, labelFilter.slice('label:'.length));
  }

  const visibleTasks = tasks.filter(t => {
    if (labelFilter !== 'all' && (!t.label || labelKey(t.label) !== labelFilter)) return false;
    if (t.status === 'completed') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isArchived = new Date(t.updatedAt || t.createdAt) < sevenDaysAgo;
      return showArchived ? isArchived : !isArchived;
    }
    return !showArchived;
  });

  const taskGroups = [
    { title: 'Atrasadas', tasks: visibleTasks.filter((task) => isOverdue(task.dueDate, task.status)) },
    { title: 'Hoje', tasks: visibleTasks.filter((task) => task.status !== 'completed' && isToday(new Date(task.dueDate))) },
    { title: 'Próximas', tasks: visibleTasks.filter((task) => task.status !== 'completed' && !isToday(new Date(task.dueDate)) && !isOverdue(task.dueDate, task.status)) },
    { title: showArchived ? 'Arquivadas' : 'Concluídas', tasks: visibleTasks.filter((task) => task.status === 'completed') },
  ];
  const activeFilters = [
    labelFilter !== 'all' && labels.get(labelFilter),
    priorityFilter !== 'all' && getPriorityLabel(priorityFilter),
    dateFilter !== 'all' && ({ today: 'Hoje', overdue: 'Atrasadas', upcoming: 'Próximos dias' }[dateFilter]),
    statusFilter !== 'all' && getStatusLabel(statusFilter),
    responsibleFilter !== 'all' && (professionals.find((person) => person.id === responsibleFilter)?.name || 'Responsável selecionado'),
  ].filter(Boolean);

  // Render Kanban Columns
  const renderKanbanColumn = (colStatus: 'pending' | 'in_progress' | 'completed', colTitle: string, colIcon: React.ReactNode, themeClass: string) => {
    const colTasks = visibleTasks.filter(t => t.status === colStatus);

    return (
      <Card 
        onDragOver={(e) => handleDragOver(e, colStatus)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, colStatus)}
        className={cn(
          "flex flex-col h-full min-h-[500px] p-4 sm:p-5 shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-muted/30 transition-all duration-200",
          dropTargetStatus === colStatus && "bg-secondary/5 border-dashed border-secondary ring-2 ring-secondary/10"
        )}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", themeClass)}>
              {colIcon}
            </div>
            <h4 className="font-bold text-foreground text-sm sm:text-base font-headline">{colTitle}</h4>
          </div>
          <Badge className="bg-primary/10 hover:bg-primary/15 text-primary dark:bg-white/10 dark:hover:bg-white/15 dark:text-white font-bold text-[10px] py-0.5 px-2 rounded-full border-0">
            {colTasks.length}
          </Badge>
        </div>

        {/* Column Body / Cards Stack */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide pr-1">
          {colTasks.map(task => {
            const taskOverdue = isOverdue(task.dueDate, task.status);
            const initials = task.assignedTo?.name
              ? task.assignedTo.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
              : 'U';

            return (
              <div 
                key={task.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "p-4 bg-card text-card-foreground border border-border hover:border-secondary/30 shadow-none hover:shadow-none transition-all duration-300 rounded-2xl flex flex-col gap-3 group relative overflow-hidden cursor-grab active:cursor-grabbing",
                  draggedTaskId === task.id && "opacity-40 border-dashed"
                )}
              >
                {/* Accent line on left for priority */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  task.priority === 'urgent' ? 'bg-red-500' :
                  task.priority === 'high' ? 'bg-orange-500' :
                  task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-500'
                )} />

                {/* Priority & Recurrence & Actions Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-lg", getPriorityColor(task.priority))}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                    {task.isRecurring && (
                      <span 
                        className="material-symbols-outlined text-[14px] text-teal-400 animate-spin-slow" 
                        title={`Recorrência: ${task.recurrenceRule === 'daily' ? 'Diária' : task.recurrenceRule === 'weekly' ? 'Semanal' : 'Mensal'}`}
                      >
                        autorenew
                      </span>
                    )}
                  </div>
                  
                  {/* Quick move dropdown/arrows for mobile and hover states */}
                  <div className="flex items-center gap-1">
                    {colStatus !== 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateStatus(task, colStatus === 'completed' ? 'in_progress' : 'pending')}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5 rounded-lg cursor-pointer"
                        title="Mover para esquerda"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {colStatus !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateStatus(task, colStatus === 'pending' ? 'in_progress' : 'completed')}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5 rounded-lg cursor-pointer"
                        title="Mover para direita"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenForm(task)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-secondary hover:bg-secondary/10 dark:hover:bg-white/5 rounded-lg cursor-pointer"
                      title="Editar"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTaskToDeleteId(task.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h5 className="flex items-center gap-1.5 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-secondary">
                    {task.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />}
                    <span className="truncate">{task.title}</span>
                  </h5>
                  {task.description && (
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                  )}
                </div>

                {task.label && <Badge variant="outline" className="max-w-full self-start break-all">{task.label}</Badge>}

                {/* Client / Lead Relation badge */}
                {(task.client || task.lead) && (
                  <div className="bg-muted rounded-xl p-2 border border-border flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-secondary">
                      {task.client ? 'person' : 'person_add'}
                    </span>
                    <span className="text-[10px] font-bold text-foreground truncate">
                      {task.client ? `Cliente: ${task.client.name}` : `Lead: ${task.lead?.name}`}
                    </span>
                  </div>
                )}

                {/* Footer - Date & Responsável */}
                <div className="flex items-center justify-between border-t border-border dark:border-white/5 pt-2 mt-1">
                  {/* Due Date */}
                  <div className={cn(
                    "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                    taskOverdue ? "text-red-500" : "text-muted-foreground"
                  )}>
                    <span className="material-symbols-outlined text-[13px]">
                      {taskOverdue ? 'error' : 'calendar_today'}
                    </span>
                    <span>
                      {format(new Date(task.dueDate), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>

                  {/* Responsible User Avatar */}
                  <div className="flex items-center gap-1.5" title={`Responsável: ${task.assignedTo?.name}`}>
                    {task.assignedTo?.photoUrl ? (
                      <img 
                        src={getImageUrl(task.assignedTo.photoUrl)} 
                        alt={task.assignedTo.name} 
                        className="h-5 w-5 rounded-full object-cover border border-border dark:border-white/10" 
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-secondary/20 border border-secondary/30 text-secondary text-[8px] font-bold flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground dark:text-slate-300 max-w-[80px] truncate">
                      {task.assignedTo?.name?.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

          {colTasks.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-10 px-4">
              <span className="material-symbols-outlined text-3xl opacity-30 mb-2">dashboard_customize</span>
              <p className="text-xs font-bold uppercase tracking-wider text-center">Coluna vazia</p>
            </div>
          )}
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-primary sm:text-3xl">Tarefas</h1>
        <Button variant="secondary" className="gap-2" onClick={() => handleOpenForm()}>
          <Plus className="size-4" />
          Nova tarefa
        </Button>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-1" aria-label="Escopo das tarefas">
            <Button variant={isTeamMode ? 'ghost' : 'outline'} size="sm" aria-pressed={!isTeamMode} onClick={() => {
              setIsTeamMode(false);
              setResponsibleFilter('all');
            }}><User className="mr-1.5 size-4" />Minhas tarefas</Button>
            {hasPermission('tarefas', 'verTarefasAlheias') && (
              <Button variant={isTeamMode ? 'outline' : 'ghost'} size="sm" aria-pressed={isTeamMode} onClick={() => setIsTeamMode(true)}>
                <UserCheck className="mr-1.5 size-4" />Equipe
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button variant={viewMode === 'list' ? 'outline' : 'ghost'} size="sm" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
              <List className="mr-1.5 size-4" />Lista
            </Button>
            <Button variant={viewMode === 'kanban' ? 'outline' : 'ghost'} size="sm" aria-pressed={viewMode === 'kanban'} onClick={() => {
              setViewMode('kanban');
              setStatusFilter('all');
            }}><LayoutGrid className="mr-1.5 size-4" />Quadro</Button>
            <Button variant={viewMode === 'calendar' ? 'outline' : 'ghost'} size="sm" aria-pressed={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}>
              <CalendarDays className="mr-1.5 size-4" />Calendário
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <div className="relative min-w-40 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar tarefas" placeholder="Buscar tarefas" className="h-9 pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
          </div>
          <Button variant="outline" size="sm" aria-expanded={filtersOpen} aria-controls="task-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Filter className="mr-1.5 size-4" />Filtros{activeFilters.length ? ' (' + activeFilters.length + ')' : ''}
          </Button>
          <Button variant="ghost" size="sm" className="sm:ml-auto" aria-pressed={showArchived} onClick={() => {
            setShowArchived(!showArchived);
            setStatusFilter('all');
          }}>{showArchived ? 'Voltar às tarefas' : 'Arquivadas'}</Button>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 sm:px-4">
            {activeFilters.map((filter, index) => <Badge variant="outline" key={index}>{filter}</Badge>)}
            <Button size="sm" variant="ghost" onClick={() => {
              setLabelFilter('all');
              setPriorityFilter('all');
              setDateFilter('all');
              setStatusFilter('all');
              setResponsibleFilter('all');
            }}>Limpar filtros</Button>
          </div>
        )}

        {filtersOpen && (
          <div id="task-filters" className="grid grid-cols-1 gap-3 border-t border-border bg-muted/30 px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
          {/* Responsible Select */}
          {isTeamMode && (
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Responsável</Label>
              <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                  <SelectValue placeholder="Todos">
                    {responsibleFilter === 'all' 
                      ? 'Todos os Colaboradores' 
                      : (professionals.find(p => String(p.id) === responsibleFilter)?.name || 'Todos os Colaboradores')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos os Colaboradores</SelectItem>
                  {professionals.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
 
          {/* Priority Select */}
          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Prioridade</Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                <SelectValue placeholder="Todas">
                  {priorityFilter === 'all' ? 'Todas as prioridades' : getPriorityLabel(priorityFilter)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
 
          {/* Date Filter */}
          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Vencimento</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                <SelectValue placeholder="Todos os períodos">
                  {dateFilter === 'all' ? 'Qualquer data' : 
                   dateFilter === 'today' ? 'Vence Hoje' :
                   dateFilter === 'overdue' ? 'Atrasadas' :
                   dateFilter === 'upcoming' ? 'Próximos Dias' : 'Qualquer data'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Qualquer data</SelectItem>
                <SelectItem value="today">Vence Hoje</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
                <SelectItem value="upcoming">Próximos Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
 
          <div className="space-y-1">
            <Label htmlFor="task-label-filter" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Etiqueta</Label>
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger id="task-label-filter" className="h-10 rounded-xl bg-muted text-xs">
                <SelectValue>{labels.get(labelFilter) || 'Todas as etiquetas'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etiquetas</SelectItem>
                {[...labels].map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {viewMode !== 'kanban' && (
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                  <SelectValue placeholder="Todos">
                    {statusFilter === 'all' ? 'Qualquer status' : getStatusLabel(statusFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Qualquer status</SelectItem>
                  <SelectItem value="pending">A Fazer</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
 
          </div>
        )}
      </div>

      {/* Main Views Container */}
      {loadError ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as tarefas.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadTasks()}>Tentar novamente</Button>
        </div>
      ) : viewMode === 'calendar' ? (
        <TaskCalendar
          tasks={isLoading ? [] : visibleTasks}
          loading={isLoading}
          showAssignee={isTeamMode}
          onOpen={handleOpenForm}
          onCreate={showArchived ? undefined : (day) => {
            const due = new Date(day);
            due.setHours(9, 0, 0, 0);
            handleOpenForm(null, due);
          }}
        />
      ) : isLoading ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-secondary animate-spin mb-3" />
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Carregando atividades...</span>
        </Card>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderKanbanColumn('pending', 'A Fazer', <Clock className="w-4 h-4 text-indigo-500" />, 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20')}
          {renderKanbanColumn('in_progress', 'Em Andamento', <RefreshCw className="w-4 h-4 text-warning animate-spin-slow" />, 'bg-warning/10 text-warning border border-warning/20')}
          {renderKanbanColumn('completed', 'Concluído', <CheckCircle2 className="w-4 h-4 text-success" />, 'bg-success/10 text-success border border-success/20')}
        </div>
      ) : (
        visibleTasks.length ? (
          <div className="space-y-4">
            {taskGroups.filter((group) => group.tasks.length).map((group) => (
              <section key={group.title} className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                  <span className={cn(group.title === 'Atrasadas' && 'text-destructive')}>{group.title}</span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{group.tasks.length}</span>
                </h2>
                <ul className="divide-y divide-border">
                  {group.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 sm:gap-3 sm:px-4">
                      <Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={task.status === 'completed'} aria-label={task.status === 'completed' ? 'Tarefa concluída' : 'Concluir ' + task.title} onClick={() => void handleUpdateStatus(task, 'completed')}>
                        {task.status === 'completed' ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
                      </Button>
                      <button type="button" className="grid min-w-0 flex-1 gap-1 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_minmax(100px,0.4fr)_110px] sm:items-center sm:gap-4" onClick={() => handleOpenForm(task)}>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {task.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />}
                            <span className="truncate">{task.title}</span>
                          </span>
                          {task.status === 'in_progress' && <span className="mr-2 text-xs text-muted-foreground">Em andamento</span>}
                          {(task.priority === 'urgent' || task.priority === 'high') && <span className={cn('text-xs font-medium', task.priority === 'urgent' ? 'text-destructive' : 'text-muted-foreground')}>Prioridade {getPriorityLabel(task.priority).toLowerCase()}</span>}
                          {(task.lead || task.client) && <span className="block truncate text-xs text-muted-foreground">{task.lead?.name || task.client?.name}</span>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{task.assignedTo?.name || 'Sem responsável'}</span>
                        <time dateTime={task.dueDate} className={cn('whitespace-nowrap text-xs tabular-nums sm:text-right', group.title === 'Atrasadas' ? 'text-destructive' : 'text-muted-foreground')}>
                          {group.title === 'Hoje' ? format(new Date(task.dueDate), 'HH:mm') : format(new Date(task.dueDate), "dd/MM 'às' HH:mm")}
                        </time>
                      </button>
                      {task.label && <Badge variant="outline" className="max-w-20 shrink-0 truncate sm:max-w-32" title={task.label}>{task.label}</Badge>}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
            <ClipboardList className="size-6 text-muted-foreground" />
            <p className="text-sm font-semibold">{showArchived ? 'Nenhuma tarefa arquivada' : 'Nenhuma tarefa para mostrar'}</p>
            <p className="text-xs text-muted-foreground">{searchQuery || activeFilters.length ? 'Ajuste a busca ou os filtros para ver mais tarefas.' : showArchived ? 'As tarefas concluídas há mais de sete dias aparecem aqui.' : 'Crie uma tarefa para organizar o próximo passo.'}</p>
            {!showArchived && !searchQuery && !activeFilters.length && <Button variant="outline" size="sm" className="mt-2" onClick={() => handleOpenForm()}>Criar tarefa</Button>}
          </div>
        )
      )}

      {/* Task Creation / Editing Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent role="dialog" aria-modal="true" aria-labelledby="task-form-title" className="inset-y-0 left-auto right-0 top-0 flex h-dvh w-full max-w-lg flex-col gap-0 overflow-hidden rounded-none border-l border-border bg-card p-0 sm:left-auto sm:top-0 sm:h-dvh sm:max-w-lg sm:translate-x-0 sm:translate-y-0 sm:rounded-none">
          <div className="border-b border-border px-5 py-6 pr-16 sm:px-6 sm:pr-16">
            <DialogTitle id="task-form-title" className="break-words font-headline text-xl">
              {editingTask ? editingTask.title : 'Nova tarefa'}
            </DialogTitle>
          </div>
          <form onSubmit={handleSaveTask} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {editingTask && (editingTask.leadId || editingTask.clientId) && hasModuleAccess('conversas') && (
              <Button type="button" variant="outline" size="sm" disabled={openingConversation} onClick={() => void openTaskConversation(editingTask)}>
                {openingConversation ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MessageCircle className="mr-2 size-4" />}
                Abrir conversa
              </Button>
            )}
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Título *</Label>
              <Input
                id="task-title"
                autoFocus={!editingTask}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Ligar para confirmar consulta..."
                className="h-11 rounded-xl bg-muted border border-border text-foreground focus-visible:ring-secondary focus-visible:ring-offset-0 text-sm"
                required
              />
            </div>
 
            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição detalhada</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Insira notas, observações, links ou detalhes importantes..."
                className="w-full min-h-[90px] p-3 rounded-xl bg-muted border border-border text-foreground focus:border-secondary text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
 
            {/* Grid for parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Responsible user select */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Responsável *</Label>
                <Select
                  value={formData.assignedToId}
                  onValueChange={(val) => setFormData({ ...formData, assignedToId: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                    <SelectValue placeholder="Selecione um profissional">
                      {professionals.find(p => String(p.id) === formData.assignedToId)?.name || 'Selecione um profissional'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {professionals.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              {/* Due date picker */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Vencimento *</Label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="h-11 rounded-xl bg-muted border border-border text-foreground text-sm pr-10 font-headline focus-visible:ring-secondary"
                    required
                  />
                </div>
              </div>
 
              {/* Priority select */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                    <SelectValue placeholder="Média">
                      {getPriorityLabel(formData.priority)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente (Notifica WhatsApp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
 
              {/* Status select (only for editing tasks) */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                    <SelectValue placeholder="A Fazer">
                      {getStatusLabel(formData.status)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pending">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
 
            <details open={Boolean(editingTask?.label || editingTask?.scheduledAt || editingTask?.color)} className="group rounded-xl border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-sm font-semibold hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Planejamento, etiqueta e cor
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="grid gap-x-4 gap-y-3 border-t border-border px-4 py-3.5 sm:grid-cols-2">
                <div className="grid min-w-0 content-start gap-1.5">
                  <Label htmlFor="task-label" className="leading-5">Etiqueta</Label>
                  <Input id="task-label" list="task-label-options" maxLength={40} value={formData.label} placeholder="Ex. Retorno" onChange={(event) => setFormData({ ...formData, label: event.target.value })} />
                  <datalist id="task-label-options">
                    {[...labels.values()].map((label) => <option key={label} value={label} />)}
                  </datalist>
                </div>
                <div className="grid min-w-0 content-start gap-1.5">
                  <Label htmlFor="task-scheduled-at" className="leading-5">Horário planejado</Label>
                  <Input id="task-scheduled-at" className="min-w-0" type="datetime-local" value={formData.scheduledAt} onChange={(event) => setFormData({ ...formData, scheduledAt: event.target.value })} aria-describedby="task-scheduled-help" />
                  <p id="task-scheduled-help" className="text-xs leading-4 text-muted-foreground">Exibido no calendário.</p>
                </div>
                <div className="border-t border-border pt-3 sm:col-span-2">
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium leading-5">Cor da tarefa</legend>
                    <div className="-ml-1 flex flex-wrap gap-1">
                      {taskColors.map(({ name, value }) => (
                        <label key={name} className="relative cursor-pointer p-1" title={name}>
                          <input
                            type="radio"
                            name="task-color"
                            aria-label={name}
                            value={value}
                            checked={formData.color === value}
                            onChange={() => setFormData((data) => ({ ...data, color: value }))}
                            className="peer sr-only"
                          />
                          <span
                            className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground peer-checked:ring-2 peer-checked:ring-primary peer-checked:ring-offset-2 peer-checked:ring-offset-card peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
                            style={{ backgroundColor: value || undefined }}
                          >
                            {!value && <X className="size-4" />}
                            {value && formData.color === value && <CheckCircle2 className="size-4 text-white" />}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            </details>

            {/* Link to Lead or Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border dark:border-white/5 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Associar Cliente</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(val) => setFormData({ ...formData, clientId: val, leadId: val ? '' : formData.leadId })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                    <SelectValue placeholder="Selecione um cliente">
                      {(linkedClient && String(linkedClient.id) === formData.clientId ? linkedClient.name : clients.find(c => String(c.id) === formData.clientId)?.name) || 'Nenhum cliente'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="">Nenhum cliente</SelectItem>
                    {linkedClient && !clients.some((c) => c.id === linkedClient.id) && <SelectItem value={String(linkedClient.id)}>{linkedClient.name}</SelectItem>}
                    {clients.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              <div className="space-y-1.5">
                <Label htmlFor="task-lead-search">Associar lead</Label>
                {formData.leadId ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{linkedLead?.name || 'Lead vinculado'}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Remover vínculo com lead" onClick={() => {
                      setLinkedLead(null);
                      setLeadSearch('');
                      setFormData((data) => ({ ...data, leadId: '' }));
                    }}><X className="size-4" /></Button>
                  </div>
                ) : (
                  <>
                    <Input id="task-lead-search" value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Nome ou telefone" />
                    <div aria-live="polite" className="text-xs text-muted-foreground">
                      {leadSearchStatus === 'loading' && 'Buscando leads…'}
                      {leadSearchStatus === 'error' && 'Falha na busca. Tente digitar novamente.'}
                      {leadSearchStatus === 'ready' && !leads.length && 'Nenhum lead encontrado.'}
                    </div>
                    {leadSearchStatus === 'ready' && leads.length > 0 && (
                      <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                        {leads.map((lead) => (
                          <li key={lead.id}>
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted" onClick={() => {
                              setLinkedLead(lead);
                              setLeadSearch('');
                              setFormData((data) => ({ ...data, leadId: String(lead.id), clientId: '' }));
                            }}>
                              <span className="block truncate">{lead.name}</span>
                              {lead.phone && <span className="block text-xs text-muted-foreground">{lead.phone}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Recurrence Setup */}
            <div className="border-t border-border dark:border-white/5 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-teal-500" />
                    Tarefa Recorrente
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Criar automaticamente a próxima tarefa após a conclusão desta.</p>
                </div>
                <input 
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-5 h-5 accent-secondary rounded-lg border-input cursor-pointer bg-background focus:outline-none"
                />
              </div>
 
              {formData.isRecurring && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Periodicidade da Recorrência</Label>
                  <Select
                    value={formData.recurrenceRule}
                    onValueChange={(val: any) => setFormData({ ...formData, recurrenceRule: val })}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                      <SelectValue placeholder="Diária">
                        {formData.recurrenceRule === 'daily' ? 'Diária (Todo dia)' :
                         formData.recurrenceRule === 'weekly' ? 'Semanal (Toda semana)' :
                         formData.recurrenceRule === 'monthly' ? 'Mensal (Todo mês)' : 'Diária (Todo dia)'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="daily">Diária (Todo dia)</SelectItem>
                      <SelectItem value="weekly">Semanal (Toda semana)</SelectItem>
                      <SelectItem value="monthly">Mensal (Todo mês)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
 
            {/* Buttons */}
            <div className="pt-5 border-t border-border dark:border-white/5 flex justify-end gap-3">
              {editingTask && hasPermission('tarefas', 'excluirTarefas') && (
                <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => {
                  setIsFormOpen(false);
                  setTaskToDeleteId(editingTask.id);
                }}>Excluir</Button>
              )}
              <Button 
                type="button"
                variant="ghost" 
                onClick={() => setIsFormOpen(false)} 
                className="rounded-xl font-bold h-11 px-6 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold h-11 px-6 shadow-none flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingTask ? 'Atualizar Tarefa' : 'Criar Tarefa'}
              </Button>
            </div>
          </form>

        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDeleteId} onOpenChange={() => setTaskToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja remover esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-500 hover:bg-red-600">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
