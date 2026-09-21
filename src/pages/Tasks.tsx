import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  Filter, 
  Loader2, 
  Plus, 
  Calendar, 
  User, 
  RefreshCw, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  UserCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, professionalsApi, clientsApi, leadsApi, usuariosApi, getImageUrl } from '@/lib/api';
import { format, isBefore, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
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

export default function Tasks() {
  const { professional, hasPermission } = useAuth();
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
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<'pending' | 'in_progress' | 'completed' | null>(null);

  // Relations & Autocomplete / Option Lists
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Dialog & Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
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
      const [profsRes, usersRes, clientsRes, leadsRes] = await Promise.all([
        professionalsApi.getAll({ pageSize: 100 }),
        usuariosApi.getAll({ pageSize: 100 }),
        clientsApi.getAll({ pageSize: 100 }),
        leadsApi.getAll({ pageSize: 100 })
      ]);

      let combinedProfs: any[] = [];
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
      if (leadsRes.success && leadsRes.data) {
        setLeads(leadsRes.data);
      }
    } catch (err) {
      console.error('Erro ao carregar dados relacionais:', err);
    }
  }, []);

  // Fetch Tasks from API
  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const params: any = {
        search: searchQuery || undefined,
        team: isTeamMode
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (dateFilter !== 'all') params.dueDateRange = dateFilter;

      const res = await tasksApi.getAll(params);
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
        toastRef.current({
          title: 'Erro',
          description: res.error?.message || 'Erro ao buscar tarefas.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toastRef.current({
        title: 'Erro',
        description: 'Erro na conexão com o servidor.',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setIsLoading(false);
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
  const handleOpenForm = (task: Task | null = null) => {
    if (task) {
      setEditingTask(task);
      const isUserAssignee = task.assignedTo && (task.assignedTo as any).isUser;
      setFormData({
        title: task.title,
        description: task.description || '',
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
        status: 'pending',
        priority: 'medium',
        dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        assignedToId: professional ? (userType === 'user' ? `user-${professional.id}` : `prof-${professional.id}`) : '',
        clientId: '',
        leadId: '',
        isRecurring: false,
        recurrenceRule: 'daily'
      });
    }
    setIsFormOpen(true);
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
    const previousTasks = [...tasks];

    // Atualização otimista (instantânea na UI)
    setTasks(prevTasks => 
      prevTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    );

    try {
      const res = await tasksApi.update(task.id, { status: newStatus });
      if (res.success) {
        toast({
          title: 'Status atualizado',
          description: `Tarefa movida para ${newStatus === 'completed' ? 'Concluída' : newStatus === 'in_progress' ? 'Em Andamento' : 'A Fazer'}.`,
        });
        loadTasks(true); // silent reload
      } else {
        toast({
          title: 'Erro',
          description: res.error?.message || 'Erro ao atualizar status.',
          variant: 'destructive',
        });
        setTasks(previousTasks); // Rollback
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Erro na requisição.',
        variant: 'destructive',
      });
      setTasks(previousTasks); // Rollback
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

  // Metrics Calculations (Bento Grid)
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const visibleTasks = tasks.filter(t => {
    if (t.status === 'completed') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isArchived = new Date(t.updatedAt || t.createdAt) < sevenDaysAgo;
      return showArchived ? isArchived : !isArchived;
    }
    return !showArchived;
  });

  const pendingCount = visibleTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const overdueCount = visibleTasks.filter(t => isOverdue(t.dueDate, t.status)).length;

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
                  <h5 className="font-bold text-foreground text-sm leading-snug group-hover:text-secondary transition-colors line-clamp-1">{task.title}</h5>
                  {task.description && (
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                  )}
                </div>

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
    <div className="relative space-y-10 pb-10 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-30">
        <div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-primary font-headline tracking-tight">Painel de Tarefas</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">
            Organize afazeres da clínica, configure recorrências e gerencie delegações de forma integrada.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* My Tasks vs Team Tasks Switch */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setIsTeamMode(false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold font-headline flex items-center gap-1.5 transition-all cursor-pointer",
                !isTeamMode 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
            >
              <User className="w-3.5 h-3.5" />
              Minhas
            </button>
            <button
              onClick={() => setIsTeamMode(true)}
              disabled={!hasPermission('tarefas', 'verTarefasAlheias')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold font-headline flex items-center gap-1.5 transition-all cursor-pointer",
                isTeamMode 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Equipe
            </button>
          </div>
          
          {/* Archive Toggle */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 ml-2">
            <button
              onClick={() => setShowArchived(false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold font-headline flex items-center gap-1.5 transition-all cursor-pointer",
                !showArchived 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
            >
              Ativas
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold font-headline flex items-center gap-1.5 transition-all cursor-pointer",
                showArchived 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
            >
              Arquivadas
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                viewMode === 'kanban' 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
              title="Quadro Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                viewMode === 'list' 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              )}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Button 
            onClick={() => handleOpenForm()} 
            variant="secondary"
            className="h-10 px-5 font-bold gap-2 shadow-lg shadow-secondary/20 rounded-xl transition-all hover:-translate-y-0.5 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <Card className="p-4 sm:p-5 flex flex-col justify-between min-h-[110px] shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total de Tarefas</div>
            <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400 select-none">fact_check</span>
          </div>
          <div className="mt-2">
            <h3 className="stats-value">{totalCount}</h3>
            <p className="text-[9px] text-muted-foreground/80 font-bold uppercase mt-1 tracking-wider">Registradas no painel</p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between min-h-[110px] shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Concluídas</div>
            <span className="material-symbols-outlined text-2xl text-emerald-600 dark:text-emerald-400 select-none">check_circle</span>
          </div>
          <div className="mt-2">
            <h3 className="stats-value text-emerald-600 dark:text-emerald-400">{completedCount}</h3>
            <p className="text-[9px] text-muted-foreground/80 font-bold uppercase mt-1 tracking-wider">
              {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% de taxa de conclusão` : 'Nenhuma tarefa'}
            </p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between min-h-[110px] shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ativas</div>
            <span className="material-symbols-outlined text-2xl text-amber-600 dark:text-amber-400 select-none">hourglass_empty</span>
          </div>
          <div className="mt-2">
            <h3 className="stats-value text-amber-600 dark:text-amber-400">{pendingCount}</h3>
            <p className="text-[9px] text-muted-foreground/80 font-bold uppercase mt-1 tracking-wider">A fazer ou Em Andamento</p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between min-h-[110px] shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atrasadas</div>
            <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400 select-none">alarm_on</span>
          </div>
          <div className="mt-2">
            <h3 className="stats-value text-red-600 dark:text-red-400">{overdueCount}</h3>
            <p className="text-[9px] text-muted-foreground/80 font-bold uppercase mt-1 tracking-wider">Vencidas e sem conclusão</p>
          </div>
        </Card>
      </div>

      {/* Filters Bar Card */}
      <Card className="p-5 sm:p-6 space-y-4 shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-secondary" />
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filtrar Atividades</h3>
        </div>
 
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Text Search */}
          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Busca livre</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Título ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs rounded-xl bg-muted border border-border text-foreground focus-visible:ring-secondary focus-visible:ring-offset-0"
              />
            </div>
          </div>
 
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
 
          {/* Status Select for List View */}
          {viewMode === 'list' && (
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
 
          {/* Clear Filters Button */}
          <div className="flex items-end">
            {(searchQuery || priorityFilter !== 'all' || dateFilter !== 'all' || statusFilter !== 'all' || responsibleFilter !== 'all') && (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setPriorityFilter('all');
                  setDateFilter('all');
                  setStatusFilter('all');
                  setResponsibleFilter('all');
                }}
                variant="ghost"
                className="h-10 text-destructive hover:bg-destructive/10 text-xs font-bold gap-2 w-full rounded-xl cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Views Container */}
      {isLoading ? (
        <Card className="flex flex-col items-center justify-center py-32">
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
        /* List View */
        <Card className="overflow-hidden p-0 shadow-none hover:translate-y-0 hover:shadow-none border border-border bg-card">
          <div className="p-0 bg-transparent">
            <Table>
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12 px-6">Atividade</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12">Responsável</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12">Prioridade</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12">Vencimento</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12">Conexões</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground h-12 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map(task => {
                  const taskOverdue = isOverdue(task.dueDate, task.status);
                  const initials = task.assignedTo?.name
                    ? task.assignedTo.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'U';

                  return (
                    <TableRow key={task.id} className="hover:bg-muted/40 border-b border-border transition-colors">
                      {/* Title & Description */}
                      <TableCell className="px-6 py-4">
                        <div>
                          <p className="font-bold text-foreground text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 max-w-sm">{task.description}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Responsible */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {task.assignedTo?.photoUrl ? (
                            <img src={getImageUrl(task.assignedTo.photoUrl)} alt={task.assignedTo.name} className="h-6 w-6 rounded-full object-cover border border-border dark:border-white/10" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-secondary/20 border border-secondary/30 text-secondary text-[9px] font-bold flex items-center justify-center">
                              {initials}
                            </div>
                          )}
                          <span className="text-xs font-bold text-muted-foreground dark:text-slate-300">{task.assignedTo?.name}</span>
                        </div>
                      </TableCell>

                      {/* Priority */}
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-lg", getPriorityColor(task.priority))}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </TableCell>

                      {/* Due Date */}
                      <TableCell>
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-bold",
                          taskOverdue ? "text-red-500" : "text-muted-foreground dark:text-slate-300"
                        )}>
                          <span className="material-symbols-outlined text-[14px]">
                            {taskOverdue ? 'error' : 'calendar_today'}
                          </span>
                          <span>{format(new Date(task.dueDate), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                            task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20' :
                            task.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20' :
                            'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20'
                          )}
                        >
                          {getStatusLabel(task.status)}
                        </Badge>
                      </TableCell>

                      {/* Connections */}
                      <TableCell>
                        {task.client ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground dark:text-slate-300 text-xs font-bold" title="Cliente associado">
                            <span className="material-symbols-outlined text-[15px] text-secondary">person</span>
                            <span className="truncate max-w-[120px]">{task.client.name}</span>
                          </div>
                        ) : task.lead ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground dark:text-slate-300 text-xs font-bold" title="Lead associado">
                            <span className="material-symbols-outlined text-[15px] text-secondary">person_add</span>
                            <span className="truncate max-w-[120px]">{task.lead.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Sem conexão</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {task.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(task, 'completed')}
                              className="h-8 w-8 p-0 text-emerald-500 hover:text-white hover:bg-emerald-500/25 rounded-lg cursor-pointer"
                              title="Marcar como concluída"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm(task)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-secondary hover:bg-muted dark:hover:bg-white/5 rounded-lg cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTaskToDeleteId(task.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {tasks.length === 0 && (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-4xl text-muted-foreground mb-2">task_alt</span>
                <p className="text-sm font-bold text-muted-foreground">Nenhuma tarefa cadastrada ou correspondente aos filtros.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Task Creation / Editing Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[95vw] max-w-[620px] border-0 shadow-2xl rounded-3xl bg-card p-0 overflow-hidden text-foreground">
          {/* Header */}
          <div className="p-6 bg-[#0B1525] border-b border-[#0B1525] rounded-t-3xl">
            <DialogTitle className="text-xl font-bold text-white font-headline">
              {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
            </DialogTitle>
            <p className="text-xs text-white/70 mt-1">
              {editingTask ? 'Atualize as informações da sua tarefa.' : 'Preencha os campos abaixo para planejar e delegar uma nova tarefa.'}
            </p>
          </div>

          <form onSubmit={handleSaveTask} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Título da Tarefa *</Label>
              <Input
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
                      {clients.find(c => String(c.id) === formData.clientId)?.name || 'Nenhum cliente'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="">Nenhum cliente</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Associar Lead</Label>
                <Select
                  value={formData.leadId}
                  onValueChange={(val) => setFormData({ ...formData, leadId: val, clientId: val ? '' : formData.clientId })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted border border-border text-foreground focus:ring-secondary">
                    <SelectValue placeholder="Selecione um lead">
                      {leads.find(l => String(l.id) === formData.leadId)?.name || 'Nenhum lead'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="">Nenhum lead</SelectItem>
                    {leads.map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
import { useActionPermission } from '@/hooks/use-action-permission';
