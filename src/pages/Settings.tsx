import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { 
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings as SettingsIcon,
  Building,
  Clock,
  CreditCard,
  Lock,
  Monitor,
  Plus,
  Tag,
  Trash2,
  Users,
  Mail,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FunnelsSettingsView from './settings/FunnelsSettingsView';
import CadenceSettingsView from './settings/CadenceSettingsView';
import LeadStatusesSettingsView from './settings/LeadStatusesSettingsView';
import LeadOriginsSettingsView from './settings/LeadOriginsSettingsView';
import { LeadRoutingSettingsView } from './settings/LeadRoutingSettingsView';
import { BillingSettingsView } from './settings/BillingSettingsView';
import { SecuritySettingsView } from './settings/SecuritySettingsView';
import DiscountSettingsView from './settings/DiscountSettingsView';

import { useAuth } from '@/contexts/AuthContext';
import { catalogsApi, professionalsApi, usuariosApi, permissionsApi, empresasApi, rolesApi, modulesApi, billingApi, type BillingStatus, type BillingUsage } from '@/lib/api';
import Profile from './Profile';

// -- CARGOS HELPERS REMOVIDOS (Agora vêm do banco) --

// -- COMPONENTES DE CONFIGURAÇÃO --

const ServicosView = () => {
  const { professional: authUser } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [targetProfId, setTargetProfId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '', durationMinutes: '30' });

  const loadTargetProfessional = async () => {
    try {
      if (authUser?.role === 'profissional') {
        setTargetProfId(Number(authUser.id));
      } else {
        // Para admins ou usuários de equipe, buscamos o profissional dono da clínica
        const res = await professionalsApi.getAll({ pageSize: 1 });
        if (res.success && res.data && res.data.length > 0) {
          // Sempre pegamos o primeiro (dono) para gerenciar serviços da clínica
          setTargetProfId(Number(res.data[0].id));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadServices = async (profId: number) => {
    try {
      setLoading(true);
      const res = await catalogsApi.getAll({ professionalId: profId });
      setServices(res.data || []);
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível carregar serviços', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargetProfessional();
  }, []);

  useEffect(() => {
    if (targetProfId) {
      loadServices(targetProfId);
    }
  }, [targetProfId]);

  const handleSave = async () => {
    if (!newService.name || !newService.price || !targetProfId) {
      toast({ title: 'Aviso', description: 'Preencha nome e preço', variant: 'destructive' });
      return;
    }
    try {
      await catalogsApi.create({
        professionalId: targetProfId,
        name: newService.name,
        price: parseFloat(newService.price.replace(',', '.')),
        durationMinutes: parseInt(newService.durationMinutes) || 30,
        status: 'ativo'
      });
      toast({ title: 'Sucesso', description: 'Serviço adicionado' });
      setIsAdding(false);
      setNewService({ name: '', price: '', durationMinutes: '30' });
      loadServices(targetProfId);
    } catch (e) {
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await catalogsApi.delete(id);
      toast({ title: 'Sucesso', description: 'Serviço removido' });
      if (targetProfId) loadServices(targetProfId);
    } catch (e) {
      toast({ title: 'Erro', description: 'Falha ao remover', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-sm">Serviços Ativos ({services.length})</h3>
        <Button size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4 mr-2" /> {isAdding ? 'Cancelar' : 'Novo'}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium text-sm">Novo Serviço</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Serviço</Label>
                <Input value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} placeholder="Ex: Limpeza de Pele" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço (R$)</Label>
                <Input value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} placeholder="150,00" className="h-8 text-sm" type="number" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Duração Média (minutos)</Label>
                <Input value={newService.durationMinutes} onChange={e => setNewService({...newService, durationMinutes: e.target.value})} className="h-8 text-sm" type="number" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleSave}>Salvar Serviço</Button>
            </div>
          </CardContent>
        </Card>
      )}

        <div className="space-y-3">
          {services.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50 hover:border-primary/30 transition-colors">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                  <span className="font-semibold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price || 0)}
                  </span>
                  <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/>{s.durationMinutes} min</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4"/></Button>
            </div>
          ))}
          {services.length === 0 && !isAdding && (
            <div className="text-sm text-center py-6 text-muted-foreground border border-dashed rounded-lg">
              Nenhum serviço cadastrado para este profissional.
            </div>
          )}
        </div>
    </div>
  );
};

const EquipeView = ({ isSpecialistMode = false }: { isSpecialistMode?: boolean }) => {
  const { toast } = useToast();
  const { professional } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [clinicas, setClinicas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', roleId: '', companyIds: [] as number[], leadRoutingWeight: 1 });
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);

  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null);
  const [buyingUserExtra, setBuyingUserExtra] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  
  const isOwner = professional?.type === 'profissional' || professional?.role === 'profissional' || professional?.role === 'admin';
  const [selectedClinicFilter, setSelectedClinicFilter] = useState<string>(professional?.companyId ? String(professional.companyId) : '');

  const validRoles = roles.filter((role) => role?.id !== undefined && role?.id !== null && (isSpecialistMode ? role.isSpecialist : !role.isSpecialist));
  
  const filteredTeam = team.filter((user) => {
    const isSpec = user.role?.isSpecialist || false;
    const matchesMode = isSpecialistMode ? isSpec : !isSpec;
    if (!matchesMode) return false;
    
    if (selectedClinicFilter !== 'all') {
      const filterId = Number(selectedClinicFilter);
      const belongsDirectly = user.companyId === filterId && !user.companyAccess?.length;
      const belongsViaAccess = user.companyAccess?.some((ca: any) => ca.companyId === filterId && ca.isActive);
      return belongsDirectly || belongsViaAccess;
    }
    
    return true;
  });
  const getUserDisplayName = (user: any) => String(user?.name || user?.email || 'Usuario');
  const getUserEmail = (user: any) => String(user?.email || 'E-mail nao informado');
  const getUserInitials = (user: any) => {
    const displayName = getUserDisplayName(user);
    return displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  };
  const getRoleIdValue = (roleId: unknown) => (roleId === undefined || roleId === null ? '' : String(roleId));

  const loadRoles = async () => {
    try {
      const res = await rolesApi.getAll();
      if (res.success) setRoles(res.data || []);
    } catch (e) {
      console.error('Erro ao carregar cargos:', e);
    }
  };

  const loadClinicas = async () => {
    try {
      const res = await empresasApi.myCompanies();
      if (res.success) {
        const merged = new Map<number, any>();
        for (const clinic of professional?.companies || []) {
          if (clinic?.id) merged.set(Number(clinic.id), clinic);
        }
        for (const clinic of res.data || []) {
          if (clinic?.id) merged.set(Number(clinic.id), clinic);
        }
        const availableClinics = Array.from(merged.values());
        setClinicas(availableClinics);
        setSelectedClinicFilter((current) => current || (availableClinics[0]?.id ? String(availableClinics[0].id) : ''));
      } else {
        const availableClinics = professional?.companies || [];
        setClinicas(availableClinics);
        setSelectedClinicFilter((current) => current || (availableClinics[0]?.id ? String(availableClinics[0].id) : ''));
      }
    } catch (e) {
      console.error('Erro ao carregar clínicas', e);
      const availableClinics = professional?.companies || [];
      setClinicas(availableClinics);
      setSelectedClinicFilter((current) => current || (availableClinics[0]?.id ? String(availableClinics[0].id) : ''));
    }
  };

  const loadTeam = async () => {
    try {
      setLoading(true);
      const res = await usuariosApi.getAll({ pageSize: 50, allCompanies: true });
      if (res.success && res.data) {
        setTeam(res.data);
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível carregar a equipe', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadBillingUsage = async (companyId?: number) => {
    try {
      const res = await billingApi.getUsage(companyId);
      if (res.success && res.data) setBillingUsage(res.data);
    } catch (e) {
      console.error('Erro ao carregar limites de billing:', e);
    }
  };

  useEffect(() => {
    loadTeam();
    loadRoles();
    loadClinicas();
  }, []);

  useEffect(() => {
    const companyId = Number(selectedClinicFilter);
    if (companyId) loadBillingUsage(companyId);
  }, [selectedClinicFilter]);

  const handleBuyUserExtra = async () => {
    setBuyingUserExtra(true);
    try {
      const res = await billingApi.createAddonCheckout({
        addonCode: 'extra_user',
        targetCompanyId: billingUsage?.users.companyId || professional?.companyId,
        billingCycle: billingUsage?.billingCycle,
        quantity: 1,
      });
      if (res.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      throw new Error(res.error?.message || 'Nao foi possivel abrir o checkout.');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBuyingUserExtra(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email) {
      toast({ title: 'Atenção', description: 'Preencha nome e e-mail.', variant: 'destructive' });
      return;
    }
    
    setIsSavingMember(true);
    try {
      const res = await usuariosApi.create({
        name: newMember.name,
        email: newMember.email,
        roleId: newMember.roleId ? Number(newMember.roleId) : null,
        isActive: true,
        companyIds: newMember.companyIds.length > 0 ? newMember.companyIds : undefined,
        leadRoutingWeight: newMember.leadRoutingWeight
      });
      if (res.success) {
        toast({ title: 'Convite enviado', description: `${newMember.name} receberá um e-mail para definir a senha.` });
        setIsAdding(false);
        setNewMember({ name: '', email: '', roleId: '', companyIds: [], leadRoutingWeight: 1 });
        loadTeam();
        loadBillingUsage(Number(selectedClinicFilter) || undefined);
      } else {
        throw new Error(res.error?.message || 'Erro ao adicionar');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleResendInvite = async (user: any) => {
    setResendingInviteId(user.id);
    try {
      const res = await usuariosApi.resendInvite(user.id);
      if (res.success) {
        toast({ title: 'Convite reenviado', description: `${user.name} recebera um novo link para definir a senha.` });
      } else {
        throw new Error(res.error?.message || 'Nao foi possivel reenviar o convite');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleDeleteMember = async (id: number) => {
    try {
      const res = await usuariosApi.delete(id);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Membro removido da equipe.' });
        if (selectedUserId === id) setSelectedUserId(null);
        loadTeam();
        loadBillingUsage(Number(selectedClinicFilter) || undefined);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const loadUserPermissions = async (userId: number) => {
    setLoadingPermissions(true);
    try {
      const res = await permissionsApi.getUserPermissions(userId);
      if (res.success && res.data) {
        const officialModuleCodes = ['dashboard', 'agendamentos', 'clientes', 'funnel', 'metas', 'tarefas', 'campanhas'];
        const filtered = res.data.filter((p: any) => officialModuleCodes.includes(p.moduleCode));
        setUserPermissions(filtered);
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível carregar permissões', variant: 'destructive' });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const [editingMember, setEditingMember] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSelectUser = (user: any) => {
    if (selectedUserId === user.id) {
      setSelectedUserId(null);
      setEditingMember(null);
      return;
    }
    setSelectedUserId(user.id);
    
    // Configura o membro em edição com as clínicas que ele já possui acesso
    const userCompanyIds = Array.from(new Set([
      ...(Array.isArray(user.companyAccess)
        ? user.companyAccess.map((ca: any) => Number(ca?.companyId)).filter(Boolean)
        : []),
      ...(user.companyId ? [Number(user.companyId)] : []),
    ]));

    setEditingMember({ 
      ...user, 
      roleId: getRoleIdValue(user.roleId),
      companyIds: userCompanyIds
    });
    loadUserPermissions(user.id);
  };

  const handleUpdateProfile = async () => {
    if (!editingMember) return;
    setSavingProfile(true);
    try {
      const res = await usuariosApi.update(editingMember.id, {
        name: editingMember.name,
        email: editingMember.email,
        roleId: editingMember.roleId ? Number(editingMember.roleId) : null,
        companyIds: editingMember.companyIds,
        leadRoutingWeight: editingMember.leadRoutingWeight !== undefined ? Number(editingMember.leadRoutingWeight) : undefined
      });
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Perfil atualizado!' });
        loadTeam();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingMember || !resetPassword) {
      toast({ title: 'Atenção', description: 'Digite a nova senha.', variant: 'destructive' });
      return;
    }
    if (resetPassword.length < 6) {
      toast({ title: 'Atenção', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await usuariosApi.update(editingMember.id, {
        name: editingMember.name,
        email: editingMember.email,
        password: resetPassword
      });
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Senha redefinida com sucesso!' });
        setResetPassword('');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleTogglePermission = (moduleId: number) => {
    setUserPermissions(prev => prev.map(p => 
      p.moduleId === moduleId ? { ...p, hasAccess: !p.hasAccess } : p
    ));
  };

  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    setSavingPermissions(true);
    try {
      const res = await permissionsApi.updateUserPermissions(
        selectedUserId, 
        userPermissions.map(p => ({ moduleId: p.moduleId, hasAccess: p.hasAccess }))
      );
      if (res.success) {
        toast({ title: 'Salvo!', description: 'Permissões individuais atualizadas.' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPermissions(false);
    }
  };

  const getRoleBadge = (roleName?: string) => {
    const roleKey = roleName?.toLowerCase() || '';
    const colors: Record<string, string> = {
      admin: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
      comercial: 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900',
      closer: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      sdr: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      dentista: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      especialista: 'bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900',
    };
    
    // Also try to match substring if it's "sdr (abordagem)"
    let matchedColor = colors[roleKey];
    if (!matchedColor) {
      if (roleKey.includes('closer')) matchedColor = colors.closer;
      else if (roleKey.includes('sdr')) matchedColor = colors.sdr;
      else if (roleKey.includes('dentista')) matchedColor = colors.dentista;
      else if (roleKey.includes('especialista')) matchedColor = colors.especialista;
      else matchedColor = 'bg-primary/10 text-primary border-primary/20';
    }
    
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${matchedColor}`}>
        {roleName || 'Sem Cargo'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-2xl text-sm border border-blue-200/50 dark:border-blue-800/50 flex items-start gap-3 shadow-sm">
        <Users className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="leading-relaxed">
          <strong className="block mb-0.5 text-blue-900 dark:text-blue-100 font-bold">Gestão de Equipe</strong>
          Adicione funcionários e controle o acesso. Eles acessam o sistema pela mesma tela de login.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="font-medium text-sm">
            {isSpecialistMode ? 'Especialistas' : 'Membros da Equipe'} ({filteredTeam.length})
          </h3>
          {billingUsage && (
            <p className="text-xs text-muted-foreground mt-1">
              {billingUsage.users.used} / {billingUsage.users.limit ?? 'ilimitado'} usuários ativos nesta clínica
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && clinicas.length > 1 && (
            <Select value={selectedClinicFilter} onValueChange={setSelectedClinicFilter}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Filtrar por clínica...">
                  {clinicas.find(c => String(c.id) === selectedClinicFilter)?.name || 'Selecione a clínica'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clinicas.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {billingUsage && !billingUsage.users.canCreate ? (
            <Button size="sm" onClick={handleBuyUserExtra} disabled={buyingUserExtra}>
              <Plus className="w-4 h-4 mr-2" /> {buyingUserExtra ? 'Abrindo...' : 'Comprar extra'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIsAdding(!isAdding)}>
              <Plus className="w-4 h-4 mr-2" /> {isAdding ? 'Cancelar' : (isSpecialistMode ? 'Novo Especialista' : 'Novo Membro')}
            </Button>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="p-4 border rounded-lg bg-muted/50 space-y-4 mb-4">
          <h4 className="font-medium text-sm">Novo Funcionário</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} placeholder="Ex: Maria Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail (Login)</Label>
              <Input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} placeholder="maria@clinica.com" />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Função</Label>
              <Select value={newMember.roleId} onValueChange={v => setNewMember({...newMember, roleId: v})}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Selecione um cargo...">
                    {validRoles.find(r => String(r.id) === newMember.roleId)?.name || 'Selecione um cargo...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="item-aligned" className="z-[200]">
                  {validRoles.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            

            {clinicas.length > 0 && (
              <div className="space-y-2 sm:col-span-2 mt-2">
                <Label className="mb-2 block">Acesso às Clínicas (Multi-Tenancy)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-4 bg-background/50">
                  {clinicas.map(c => (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`new-clinica-${c.id}`} 
                        checked={newMember.companyIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewMember({...newMember, companyIds: [...newMember.companyIds, c.id]});
                          } else {
                            setNewMember({...newMember, companyIds: newMember.companyIds.filter(id => id !== c.id)});
                          }
                        }}
                      />
                      <label htmlFor={`new-clinica-${c.id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {c.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleAddMember} disabled={isSavingMember}>
              {isSavingMember ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar convite
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-center py-4 text-muted-foreground">Carregando {isSpecialistMode ? 'especialistas' : 'equipe'}...</div>
        ) : filteredTeam.length === 0 ? (
          <div className="text-sm text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Nenhum {isSpecialistMode ? 'especialista' : 'membro'} cadastrado.
          </div>
        ) : filteredTeam.map((u) => (
          <div key={u.id}>
            <div 
              className={`flex justify-between items-center p-3 border rounded-lg hover:bg-muted transition-colors cursor-pointer ${selectedUserId === u.id ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => handleSelectUser(u)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs uppercase">
                  {getUserInitials(u)}
                </div>
                <div>
                  <div className="font-medium text-sm">{getUserDisplayName(u)}</div>
                  <div className="text-xs text-muted-foreground">{getUserEmail(u)}</div>
                  {(!u.isActive || !u.emailVerified) && (
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      Convite pendente
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getRoleBadge(u.role?.name)}
                {(!u.isActive || !u.emailVerified) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleResendInvite(u); }}
                    disabled={resendingInviteId === u.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    {resendingInviteId === u.id ? 'Enviando...' : 'Reenviar'}
                  </Button>
                )}
                <Button 
                  variant="ghost" size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleDeleteMember(u.id); }} 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {selectedUserId === u.id && editingMember && (
              <div className="mt-2 p-5 border rounded-lg bg-background space-y-6 animate-in slide-in-from-top-2 duration-200 shadow-inner">
                {/* Editar Perfil */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Editar Perfil
                    </h4>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleUpdateProfile} 
                      disabled={savingProfile}
                      className="h-7 text-xs px-4 border-primary text-primary hover:bg-primary hover:text-white"
                    >
                      {savingProfile ? 'Salvando...' : 'Atualizar Dados'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase text-muted-foreground font-bold">Nome</Label>
                      <Input 
                        value={editingMember?.name || ''} 
                        onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase text-muted-foreground font-bold">E-mail</Label>
                      <Input 
                        value={editingMember?.email || ''} 
                        onChange={e => setEditingMember({...editingMember, email: e.target.value})}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] uppercase text-muted-foreground font-bold">Cargo</Label>
                      <Select 
                        value={editingMember?.roleId || ''} 
                        onValueChange={v => setEditingMember({...editingMember, roleId: v})}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecione um cargo...">
                            {validRoles.find(r => String(r.id) === editingMember?.roleId)?.name || 'Selecione um cargo...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="z-[250]">
                          {validRoles.map(r => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>


                    {clinicas.length > 0 && (
                      <div className="space-y-2 sm:col-span-2 mt-4">
                        <Label className="text-[11px] uppercase text-muted-foreground font-bold mb-2 block">Acesso às Clínicas (Multi-Tenancy)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/20">
                          {clinicas.map(c => (
                            <div key={c.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`edit-clinica-${c.id}`} 
                                checked={editingMember?.companyIds?.includes(c.id)}
                                onCheckedChange={(checked) => {
                                  const current = editingMember?.companyIds || [];
                                  if (checked) {
                                    setEditingMember({...editingMember, companyIds: [...current, c.id]});
                                  } else {
                                    setEditingMember({...editingMember, companyIds: current.filter((id: number) => id !== c.id)});
                                  }
                                }}
                              />
                              <label htmlFor={`edit-clinica-${c.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                {c.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Resetar Senha */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-500" />
                      Resetar Senha
                    </h4>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[11px] uppercase text-muted-foreground font-bold">Nova Senha</Label>
                      <div className="relative">
                        <Input
                          type="password"
                          value={resetPassword}
                          onChange={e => setResetPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResetPassword}
                      disabled={savingPassword || !resetPassword}
                      className="h-9 text-xs px-4 border-orange-400 text-orange-600 hover:bg-orange-500 hover:text-white"
                    >
                      {savingPassword ? 'Salvando...' : 'Resetar Senha'}
                    </Button>
                  </div>
                </div>


              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const InfoNegocioView = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState({
    id: 0,
    name: '',
    domain: '',
    whatsapp: '',
    plan: '',
    openHour: '08:00',
    closeHour: '20:00',
    leadRoutingMode: 'manual',
    chargeConsultation: false,
  });

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const res = await empresasApi.getMyCompany();
      if (res.success && res.data) {
        setCompanyData({
          id: res.data.id,
          name: res.data.name || '',
          domain: res.data.domain || '',
          whatsapp: res.data.whatsapp || '',
          plan: res.data.plan || '',
          openHour: res.data.openHour || '08:00',
          closeHour: res.data.closeHour || '20:00',
          leadRoutingMode: res.data.leadRoutingMode || 'manual',
          chargeConsultation: res.data.chargeConsultation || false,
        });
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível carregar dados da empresa', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!companyData.name) {
      toast({ title: 'Atenção', description: 'O nome da empresa é obrigatório.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await empresasApi.update(companyData.id, {
        name: companyData.name,
        domain: companyData.domain || null,
        whatsapp: companyData.whatsapp || null,
        plan: companyData.plan || null,
        openHour: companyData.openHour,
        closeHour: companyData.closeHour,
        chargeConsultation: companyData.chargeConsultation,
      });
      if (res.success) {
        toast({ title: 'Salvo!', description: 'Informações da empresa atualizadas.' });
      } else {
        throw new Error(res.error?.message || 'Erro ao salvar');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-center py-8 text-muted-foreground">Carregando dados da empresa...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm border border-blue-100 dark:border-blue-900 flex items-start gap-3">
        <Building className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5">Dados da Empresa</strong>
          Informações cadastrais da sua empresa no sistema. Estas informações são compartilhadas com toda a equipe.
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome da Empresa *</Label>
        <Input 
          value={companyData.name} 
          onChange={e => setCompanyData({...companyData, name: e.target.value})} 
          placeholder="Ex: Clínica Estética Premium" 
        />
      </div>

      <div className="space-y-2">
        <Label>Domínio / Site</Label>
        <Input 
          value={companyData.domain} 
          onChange={e => setCompanyData({...companyData, domain: e.target.value})} 
          placeholder="www.minhaempresa.com.br" 
        />
      </div>

      <div className="space-y-2">
        <Label>WhatsApp</Label>
        <Input 
          value={companyData.whatsapp} 
          onChange={e => setCompanyData({...companyData, whatsapp: e.target.value})} 
          placeholder="(11) 99999-9999" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Horário de Abertura</Label>
          <Input 
            type="time"
            value={companyData.openHour} 
            onChange={e => setCompanyData({...companyData, openHour: e.target.value})} 
          />
        </div>
        <div className="space-y-2">
          <Label>Horário de Fechamento</Label>
          <Input 
            type="time"
            value={companyData.closeHour} 
            onChange={e => setCompanyData({...companyData, closeHour: e.target.value})} 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Plano Atual</Label>
        <Input 
          value={companyData.plan} 
          onChange={e => setCompanyData({...companyData, plan: e.target.value})} 
          placeholder="Ex: Profissional, Básico" 
          disabled
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">O plano é gerenciado pela plataforma.</p>
      </div>

      {/* Toggle Consulta Paga */}
      <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900">
        <div className="space-y-1">
          <Label className="font-bold text-sm">Cobrar Consulta de Avaliação?</Label>
          <p className="text-xs text-muted-foreground">Ao ativar, o modal de agendamento mostrará campos para valor e método de pagamento da consulta.</p>
        </div>
        <Switch
          checked={companyData.chargeConsultation}
          onCheckedChange={(val) => setCompanyData({...companyData, chargeConsultation: val})}
        />
      </div>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar Informações da Empresa'}
      </Button>
    </div>
  );
};

const SUB_PERMISSIONS_CONFIG: Record<string, Array<{ key: string; label: string }>> = {
  dashboard: [
    { key: 'verFaturamento', label: 'Ver Faturamento e Receita' },
    { key: 'verDesempenhoEquipe', label: 'Ver Desempenho da Equipe' },
    { key: 'verMetricasLeads', label: 'Ver Métricas Quantitativas de Leads' },
  ],
  agendamentos: [
    { key: 'verAgendamentosAlheios', label: 'Ver Agenda de Outros Profissionais' },
    { key: 'criarAgendamentos', label: 'Criar Agendamentos' },
    { key: 'editarAgendamentos', label: 'Editar/Reagendar Agendamentos' },
    { key: 'cancelarAgendamentos', label: 'Cancelar Agendamentos' },
  ],
  clientes: [
    { key: 'verClientes', label: 'Acesso à aba de Clientes Ativos' },
    { key: 'verLeads', label: 'Acesso à aba de Leads' },
    { key: 'exportarContatos', label: 'Permitir Exportar Contatos' },
    { key: 'editarContatos', label: 'Criar e Editar Fichas' },
    { key: 'excluirContatos', label: 'Permitir Excluir Contatos' },
  ],
  funnel: [
    { key: 'moverFases', label: 'Permitir Mover Oportunidades de Fase' },
    { key: 'criarPropostas', label: 'Criar Novas Propostas' },
    { key: 'aprovarPropostas', label: 'Fechar/Aprovar Propostas' },
    { key: 'excluirOportunidades', label: 'Excluir Oportunidades do Funil' },
  ],
  tarefas: [
    { key: 'atribuirParaOutros', label: 'Delegar Tarefas para Outros Membros' },
    { key: 'verTarefasAlheias', label: 'Ver Tarefas de Outros Profissionais' },
    { key: 'excluirTarefas', label: 'Excluir Tarefas' },
  ],
  metas: [
    { key: 'gerenciarMetas', label: 'Gerenciar Metas da Clínica (Criar/Editar/Excluir)' },
    { key: 'verMetasEquipe', label: 'Ver Metas de Outros Colaboradores' },
  ],
  campanhas: [
    { key: 'criarCampanhas', label: 'Criar/Disparar Campanhas' },
    { key: 'conectarWhatsApp', label: 'Conectar/Gerenciar Instância do WhatsApp' },
    { key: 'excluirCampanhas', label: 'Excluir Campanhas do Histórico' },
  ],
};

const CargosView = () => {
  const { toast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [isSpecialistRole, setIsSpecialistRole] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [isManagerRole, setIsManagerRole] = useState(false);
  const [isSDRRole, setIsSDRRole] = useState(false);
  const [isCloserRole, setIsCloserRole] = useState(false);

  const loadModules = async () => {
    try {
      const res = await modulesApi.getAll();
      if (res.success) {
        const officialModuleCodes = ['dashboard', 'agendamentos', 'clientes', 'funnel', 'metas', 'tarefas', 'campanhas'];
        const filtered = (res.data || []).filter((m: any) => officialModuleCodes.includes(m.code));
        setModules(filtered);
      } else {
        toast({ title: 'Erro', description: res.error?.message || 'Erro ao carregar módulos', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao carregar módulos', variant: 'destructive' });
    }
  };

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await rolesApi.getAll();
      if (res.success) setRoles(res.data || []);
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao carregar cargos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    loadModules();
  }, []);

  const handleAddRole = async () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) {
      toast({ title: 'Aviso', description: 'Digite o nome do cargo', variant: 'destructive' });
      return;
    }
    const value = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    
    try {
      const res = await rolesApi.create({ 
        name: trimmed, 
        value,
        permissions: modules.map(m => ({ moduleId: m.id, hasAccess: true })),
        isSpecialist: isSpecialistRole,
        isAdmin: isAdminRole,
        isManager: isManagerRole,
        isSDR: isSDRRole,
        isCloser: isCloserRole
      });
      if (res.success) {
        toast({ title: 'Cargo criado!', description: `"${trimmed}" agora está salvo no banco de dados.` });
        setNewRoleName('');
        setIsSpecialistRole(false);
        setIsAdminRole(false);
        setIsManagerRole(false);
        setIsSDRRole(false);
        setIsCloserRole(false);
        setIsAdding(false);
        
        // Selecionar e expandir automaticamente as permissões do novo cargo
        if (res.data) {
          const newRole = res.data;
          setSelectedRoleId(newRole.id);
          const currentPermissions = modules.map(m => ({
            moduleId: m.id,
            moduleName: m.name,
            moduleCode: m.code,
            hasAccess: true,
            subPermissions: {}
          }));
          setRolePermissions(currentPermissions);
        }
        
        loadRoles();
      } else {
        throw new Error(res.error?.message || 'Erro ao criar');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleSelectRole = (role: any) => {
    if (selectedRoleId === role.id) {
      setSelectedRoleId(null);
      return;
    }
    setSelectedRoleId(role.id);
    setIsSpecialistRole(!!role.isSpecialist);
    setIsAdminRole(!!role.isAdmin);
    setIsManagerRole(!!role.isManager);
    setIsSDRRole(!!role.isSDR);
    setIsCloserRole(!!role.isCloser);
    
    const currentPermissions = modules.map(m => {
      const existing = role.permissions?.find((p: any) => p.moduleId === m.id);
      return {
        moduleId: m.id,
        moduleName: m.name,
        moduleCode: m.code,
        hasAccess: existing ? existing.hasAccess : true,
        subPermissions: existing ? (existing.subPermissions || {}) : {}
      };
    });
    setRolePermissions(currentPermissions);
  };

  const handleTogglePermission = (moduleId: number) => {
    setRolePermissions(prev => prev.map(p => 
      p.moduleId === moduleId ? { ...p, hasAccess: !p.hasAccess } : p
    ));
  };

  const handleToggleSubPermission = (moduleId: number, key: string) => {
    setRolePermissions(prev => prev.map(p => {
      if (p.moduleId === moduleId) {
        const subPerms = { ...(p.subPermissions || {}) };
        const currentVal = subPerms[key] !== undefined ? subPerms[key] : true;
        subPerms[key] = !currentVal;
        return { ...p, subPermissions: subPerms };
      }
      return p;
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingPermissions(true);
    try {
      const role = roles.find(r => r.id === selectedRoleId);
      const res = await rolesApi.update(selectedRoleId, {
        name: role.name,
        isSpecialist: isSpecialistRole,
        isAdmin: isAdminRole,
        isManager: isManagerRole,
        isSDR: isSDRRole,
        isCloser: isCloserRole,
        permissions: rolePermissions.map(p => ({ 
          moduleId: p.moduleId, 
          hasAccess: p.hasAccess,
          subPermissions: p.subPermissions || {}
        }))
      });
      if (res.success) {
        toast({ title: 'Salvo!', description: 'Permissões do cargo atualizadas.' });
        loadRoles();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDeleteRole = async (id: number) => {
    try {
      const res = await rolesApi.delete(id);
      if (res.success) {
        toast({ title: 'Removido', description: 'Cargo removido com sucesso.' });
        loadRoles();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao remover cargo', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-2xl text-sm border border-blue-200/50 dark:border-blue-800/50 flex items-start gap-3 shadow-sm">
        <Tag className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="leading-relaxed">
          <strong className="block mb-0.5 text-blue-900 dark:text-blue-100 font-bold">Cargos e Funções</strong>
          Crie cargos personalizados e defina o que cada um pode acessar no sistema.
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-medium text-sm">Cargos Disponíveis ({roles.length})</h3>
        <Button size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4 mr-2" /> {isAdding ? 'Cancelar' : 'Novo Cargo'}
        </Button>
      </div>

      {isAdding && (
        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
          <h4 className="font-medium text-sm">Novo Cargo</h4>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Input 
                value={newRoleName} 
                onChange={e => setNewRoleName(e.target.value)} 
                placeholder="Ex: Auxiliar, Dentista, Marketing..."
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddRole()}
              />
              <Button onClick={handleAddRole}>Adicionar</Button>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isSpecialist" 
                checked={isSpecialistRole}
                onCheckedChange={(checked) => setIsSpecialistRole(checked as boolean)}
              />
              <label 
                htmlFor="isSpecialist" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Este cargo representa um Especialista (ex: Médico, Dentista)?
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isSDR" 
                checked={isSDRRole}
                onCheckedChange={(checked) => setIsSDRRole(checked as boolean)}
              />
              <label 
                htmlFor="isSDR" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Este cargo tem função de SDR (Abordagem / Pré-venda)?
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isCloser" 
                checked={isCloserRole}
                onCheckedChange={(checked) => setIsCloserRole(checked as boolean)}
              />
              <label 
                htmlFor="isCloser" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Este cargo tem função de Closer (Fechamento de vendas)?
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isAdmin" 
                checked={isAdminRole}
                onCheckedChange={(checked) => setIsAdminRole(checked as boolean)}
              />
              <label 
                htmlFor="isAdmin" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Este cargo é Administrador?
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isManager" 
                checked={isManagerRole}
                onCheckedChange={(checked) => setIsManagerRole(checked as boolean)}
              />
              <label 
                htmlFor="isManager" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Permissão de Gestor Comercial (Pode visualizar todos os leads)
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-center py-4 text-muted-foreground">Carregando cargos...</div>
        ) : roles.length === 0 ? (
          <div className="text-sm text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Nenhum cargo cadastrado.
          </div>
        ) : roles.map(role => (
          <div key={role.id}>
            <div 
              className={`flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:border-primary/30 transition-colors cursor-pointer ${selectedRoleId === role.id ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => handleSelectRole(role)}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-primary/10 text-primary border-primary/20">
                  {role.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{role.value}</span>
                <span className="text-[10px] text-muted-foreground/70 hidden sm:inline-block font-normal ml-2">
                  (clique para ver/configurar permissões)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {selectedRoleId === role.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {selectedRoleId === role.id && (
              <div className="mt-2 p-4 border rounded-lg bg-background space-y-4 animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    Módulos Liberados para "{role.name}"
                  </h4>
                  <Button 
                    size="sm" 
                    onClick={handleSavePermissions} 
                    disabled={savingPermissions}
                    className="h-7 text-xs px-4"
                  >
                    {savingPermissions ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </div>

                <div className="space-y-4 p-4 border rounded-xl bg-muted/20">
                  <h4 className="text-sm font-semibold">Configurações de Funções (Flags)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-isSpecialist-${role.id}`}
                        checked={isSpecialistRole}
                        onCheckedChange={(checked) => setIsSpecialistRole(checked as boolean)}
                      />
                      <label 
                        htmlFor={`edit-isSpecialist-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        É um Especialista?
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-isSDR-${role.id}`}
                        checked={isSDRRole}
                        onCheckedChange={(checked) => setIsSDRRole(checked as boolean)}
                      />
                      <label 
                        htmlFor={`edit-isSDR-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Função de SDR?
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-isCloser-${role.id}`}
                        checked={isCloserRole}
                        onCheckedChange={(checked) => setIsCloserRole(checked as boolean)}
                      />
                      <label 
                        htmlFor={`edit-isCloser-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Função de Closer?
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-isAdmin-${role.id}`}
                        checked={isAdminRole}
                        onCheckedChange={(checked) => setIsAdminRole(checked as boolean)}
                      />
                      <label 
                        htmlFor={`edit-isAdmin-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        É Administrador?
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-isManager-${role.id}`}
                        checked={isManagerRole}
                        onCheckedChange={(checked) => setIsManagerRole(checked as boolean)}
                      />
                      <label 
                        htmlFor={`edit-isManager-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        É Gestor Comercial? (Visualiza todos os leads)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {rolePermissions.map(p => {
                    const subPermsList = SUB_PERMISSIONS_CONFIG[p.moduleCode] || [];
                    return (
                      <div 
                        key={p.moduleId} 
                        className={`p-4 border rounded-2xl transition-all duration-300 ${
                          p.hasAccess 
                            ? 'bg-green-50/20 dark:bg-green-950/5 border-green-100 dark:border-green-900/60 shadow-sm' 
                            : 'bg-muted/30 border-slate-100 dark:border-slate-800/40 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.moduleName}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{p.moduleCode}</span>
                          </div>
                          <Switch 
                            checked={p.hasAccess} 
                            onCheckedChange={() => handleTogglePermission(p.moduleId)}
                          />
                        </div>

                        {p.hasAccess && subPermsList.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-dashed border-green-100/50 dark:border-green-900/40 space-y-2.5 pl-2 animate-in fade-in slide-in-from-top-1">
                            <h5 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Permissões Granulares</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {subPermsList.map(sub => {
                                const isChecked = p.subPermissions?.[sub.key] !== undefined 
                                  ? p.subPermissions[sub.key] 
                                  : true;
                                return (
                                  <div key={sub.key} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-xs hover:border-green-200/50 transition-colors">
                                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium pr-2">{sub.label}</span>
                                    <Switch 
                                      checked={isChecked}
                                      onCheckedChange={() => handleToggleSubPermission(p.moduleId, sub.key)}
                                      className="scale-90"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


const ClinicasView = () => {
  const { toast } = useToast();
  const { switchCompany, professional } = useAuth();
  const [clinicas, setClinicas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newClinica, setNewClinica] = useState({ name: '', domain: '', whatsapp: '' });
  const [isSavingClinica, setIsSavingClinica] = useState(false);
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [buyingClinicExtra, setBuyingClinicExtra] = useState(false);
  const [openingPlanCheckout, setOpeningPlanCheckout] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: '', domain: '', whatsapp: '', openHour: '08:00', closeHour: '20:00' });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadClinicas = async () => {
    try {
      setLoading(true);
      const res = await empresasApi.myCompanies();
      if (res.success) {
        const merged = new Map<number, any>();
        for (const clinic of professional?.companies || []) {
          if (clinic?.id) merged.set(Number(clinic.id), clinic);
        }
        for (const clinic of res.data || []) {
          if (clinic?.id) merged.set(Number(clinic.id), clinic);
        }
        setClinicas(Array.from(merged.values()));
      } else {
        setClinicas(professional?.companies || []);
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao carregar clínicas', variant: 'destructive' });
      setClinicas(professional?.companies || []);
    } finally {
      setLoading(false);
    }
  };

  const loadBillingUsage = async () => {
    try {
      const res = await billingApi.getUsage();
      if (res.success && res.data) setBillingUsage(res.data);
    } catch (e) {
      console.error('Erro ao carregar limites de billing:', e);
    }
  };

  const loadBillingStatus = async () => {
    try {
      const res = await billingApi.getStatus();
      if (res.success && res.data) setBillingStatus(res.data);
    } catch (e) {
      console.error('Erro ao carregar assinatura:', e);
    }
  };

  useEffect(() => {
    loadClinicas();
    loadBillingUsage();
    loadBillingStatus();
  }, []);

  const handleBuyClinicExtra = async () => {
    setBuyingClinicExtra(true);
    try {
      const res = await billingApi.createAddonCheckout({
        addonCode: 'extra_clinic',
        billingCycle: billingUsage?.billingCycle,
        quantity: 1,
      });
      if (res.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      throw new Error(res.error?.message || 'Nao foi possivel abrir o checkout.');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBuyingClinicExtra(false);
    }
  };

  const handleOpenPlanCheckout = async () => {
    if (!billingStatus) return;

    setOpeningPlanCheckout(true);
    try {
      const res = await billingApi.createCheckout(billingStatus.planCode, billingStatus.billingCycle);
      if (res.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      throw new Error(res.error?.message || 'Nao foi possivel abrir o checkout do plano.');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setOpeningPlanCheckout(false);
    }
  };

  const handleChangePlan = async (planCode: 'start' | 'pro', billingCycle: 'monthly' | 'yearly') => {
    setChangingPlan(true);
    try {
      const res = await billingApi.changePlan(planCode, billingCycle);
      if (!res.success) {
        throw new Error(res.error?.message || 'Nao foi possivel alterar o plano.');
      }
      toast({
        title: 'Alteracao agendada',
        description: 'A AbacatePay vai aplicar a troca no proximo ciclo de cobranca.',
      });
      loadBillingStatus();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelingSubscription(true);
    try {
      const res = await billingApi.cancelSubscription();
      if (!res.success) {
        throw new Error(res.error?.message || 'Nao foi possivel cancelar a assinatura.');
      }
      toast({
        title: 'Assinatura cancelada',
        description: 'O cancelamento foi aplicado agora e novas cobrancas nao serao geradas.',
      });
      loadBillingStatus();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleCreate = async () => {
    if (!newClinica.name) {
      toast({ title: 'Atenção', description: 'Nome da clínica é obrigatório', variant: 'destructive' });
      return;
    }
    setIsSavingClinica(true);
    try {
      const res = await empresasApi.create({
        name: newClinica.name,
        domain: newClinica.domain,
        whatsapp: newClinica.whatsapp,
        isActive: true,
      });
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Clínica criada! A página será recarregada para atualizar seu acesso.' });
        setIsAdding(false);
        setNewClinica({ name: '', domain: '', whatsapp: '' });
        loadClinicas();
        loadBillingUsage();
        
        // Timeout para atualizar a página e o token JWT ler a nova clínica
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao criar', variant: 'destructive' });
    } finally {
      setIsSavingClinica(false);
    }
  };

  const startEditing = (c: any) => {
    setEditingId(c.id);
    setEditData({
      name: c.name || '',
      domain: c.domain || '',
      whatsapp: c.whatsapp || '',
      openHour: c.openHour || '08:00',
      closeHour: c.closeHour || '20:00'
    });
  };

  const handleUpdate = async () => {
    if (!editData.name) {
      toast({ title: 'Atenção', description: 'O nome da empresa é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await empresasApi.update(editingId!, editData);
      if (res.success) {
        toast({ title: 'Salvo!', description: 'Informações da filial atualizadas.' });
        setEditingId(null);
        loadClinicas();
      } else {
        throw new Error(res.error?.message || 'Erro ao salvar');
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const planLabel = billingStatus?.planCode === 'pro'
    ? 'Pro'
    : billingStatus?.planCode === 'enterprise'
      ? 'Enterprise'
      : 'Start';
  const cycleLabel = billingStatus?.billingCycle === 'yearly' ? 'anual' : 'mensal';
  const subscriptionStatusLabel: Record<string, string> = {
    trialing: 'Teste gratis',
    active: 'Plano ativo',
    expired: 'Teste encerrado',
    payment_pending: 'Pagamento pendente',
    canceled: 'Cancelado',
  };
  const isSubscriptionBlocked = billingStatus ? ['expired', 'payment_pending', 'canceled'].includes(billingStatus.status) : false;
  const trialEndsAtLabel = billingStatus?.trialEndsAt
    ? new Date(billingStatus.trialEndsAt).toLocaleDateString('pt-BR')
    : null;
  const targetPlanCode = billingStatus?.planCode === 'pro' ? 'start' : 'pro';
  const targetPlanLabel = targetPlanCode === 'pro' ? 'Pro' : 'Start';
  const targetBillingCycle = billingStatus?.billingCycle === 'yearly' ? 'monthly' : 'yearly';
  const targetBillingCycleLabel = targetBillingCycle === 'yearly' ? 'anual' : 'mensal';
  const pendingPlanLabel = billingStatus?.pendingPlanCode === 'pro'
    ? 'Pro'
    : billingStatus?.pendingPlanCode === 'start'
      ? 'Start'
      : null;
  const pendingCycleLabel = billingStatus?.pendingBillingCycle === 'yearly' ? 'anual' : 'mensal';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-background border p-4 rounded-xl shadow-sm">
        <div>
          <h3 className="text-lg font-bold">Minhas Clínicas</h3>
          <p className="text-sm text-muted-foreground">Gerencie as filiais da sua rede (Multi-Tenancy)</p>
          {billingUsage && (
            <p className="text-xs text-muted-foreground mt-1">
              {billingUsage.clinics.used} / {billingUsage.clinics.limit ?? 'ilimitado'} clínicas no plano
            </p>
          )}
        </div>
        {billingUsage && !billingUsage.clinics.canCreate ? (
          <Button onClick={handleBuyClinicExtra} disabled={buyingClinicExtra}>
            <Plus className="w-4 h-4 mr-2" /> {buyingClinicExtra ? 'Abrindo...' : 'Comprar clínica extra'}
          </Button>
        ) : (
          <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
            {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-2" /> Nova Clínica</>}
          </Button>
        )}
      </div>

      {billingStatus && (
        <Card className={isSubscriptionBlocked ? 'border-orange-300 bg-orange-50/70' : 'border-primary/15 bg-primary/5'}>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2 ${isSubscriptionBlocked ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary'}`}>
                  {isSubscriptionBlocked ? <AlertCircle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-foreground">Plano {planLabel}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isSubscriptionBlocked ? 'bg-orange-200 text-orange-900' : 'bg-primary text-primary-foreground'}`}>
                      {subscriptionStatusLabel[billingStatus.status] || billingStatus.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ciclo {cycleLabel}
                    {billingStatus.status === 'trialing' && ` - teste termina em ${trialEndsAtLabel || 'breve'}`}
                  </p>
                  {billingStatus.status === 'trialing' ? (
                    <p className="text-sm font-medium text-orange-800">
                      Faltam {Math.max(0, billingStatus.daysRemaining)} dia{billingStatus.daysRemaining === 1 ? '' : 's'}. Depois do teste, o login continua, mas os módulos operacionais ficam bloqueados até ativar o plano.
                    </p>
                  ) : billingStatus.planChangeStatus === 'PENDING' && pendingPlanLabel ? (
                    <p className="text-sm font-medium text-blue-700">
                      Alteracao agendada para Plano {pendingPlanLabel} {pendingCycleLabel}. A troca entra no proximo ciclo de cobranca.
                    </p>
                  ) : isSubscriptionBlocked ? (
                    <p className="text-sm font-medium text-orange-900">
                      Esta clínica está sem assinatura ativa. Ative o plano para liberar os módulos operacionais novamente.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-emerald-700">
                      Assinatura ativa. Os módulos do plano continuam liberados conforme as permissões internas da equipe.
                    </p>
                  )}
                </div>
              </div>

              {billingStatus.status !== 'active' ? (
                <Button onClick={handleOpenPlanCheckout} disabled={openingPlanCheckout} className="w-full lg:w-auto">
                  <CreditCard className="h-4 w-4 mr-2" />
                  {openingPlanCheckout ? 'Abrindo...' : 'Ativar plano'}
                </Button>
              ) : (
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  {billingStatus.planCode !== 'enterprise' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleChangePlan(targetPlanCode, billingStatus.billingCycle)}
                        disabled={changingPlan || cancelingSubscription}
                      >
                        {changingPlan ? 'Agendando...' : `Trocar para ${targetPlanLabel}`}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleChangePlan(billingStatus.planCode as 'start' | 'pro', targetBillingCycle)}
                        disabled={changingPlan || cancelingSubscription}
                      >
                        {changingPlan ? 'Agendando...' : `Trocar para ${targetBillingCycleLabel}`}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    disabled={changingPlan || cancelingSubscription || !billingStatus.abacateSubscriptionId}
                  >
                    {cancelingSubscription ? 'Cancelando...' : 'Cancelar assinatura'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdding && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Clínica / Filial *</Label>
                <Input value={newClinica.name} onChange={e => setNewClinica({...newClinica, name: e.target.value})} placeholder="Ex: Matriz, Filial Centro..." />
              </div>
              <div className="space-y-2">
                <Label>Domínio / Subdomínio</Label>
                <Input value={newClinica.domain} onChange={e => setNewClinica({...newClinica, domain: e.target.value})} placeholder="Ex: centro.sellclin.com" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp (Opcional)</Label>
                <Input value={newClinica.whatsapp} onChange={e => setNewClinica({...newClinica, whatsapp: e.target.value})} placeholder="Ex: 11999999999" />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full sm:w-auto" disabled={isSavingClinica}>
              {isSavingClinica ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Filial"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando clínicas...</div>
      ) : clinicas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma clínica encontrada para este acesso. Saia e entre novamente para renovar o token ou verifique se a clínica está vinculada ao proprietário.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinicas.map((c) => (
            <Card key={c.id} className={c.id === professional?.companyId ? "border-primary shadow-sm ring-1 ring-primary/20" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    {c.name}
                  </CardTitle>
                  {c.id === professional?.companyId && (
                    <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Ativa
                    </span>
                  )}
                </div>
                <CardDescription>{c.domain || 'Sem domínio'}</CardDescription>
              </CardHeader>
              
              {editingId === c.id ? (
                <CardContent className="pt-2 pb-4 space-y-4 animate-in fade-in">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome da Filial</Label>
                      <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Domínio / Site</Label>
                      <Input value={editData.domain} onChange={e => setEditData({...editData, domain: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input value={editData.whatsapp} onChange={e => setEditData({...editData, whatsapp: e.target.value})} className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Abertura</Label>
                        <Input type="time" value={editData.openHour} onChange={e => setEditData({...editData, openHour: e.target.value})} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fechamento</Label>
                        <Input type="time" value={editData.closeHour} onChange={e => setEditData({...editData, closeHour: e.target.value})} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
                    <Button size="sm" disabled={savingEdit} onClick={handleUpdate}>
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-4">
                    ID da Clínica: {c.id}
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <Button variant="outline" size="sm" onClick={() => startEditing(c)} className="h-7 text-xs px-3">
                      <SettingsIcon className="w-3.5 h-3.5 mr-1.5" /> Editar
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                      Troque de clínica pelo Dashboard
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};



// Map of components per setting
type SettingsItem = {
  key: string;
  name: string;
  description: string;
  icon: string;
  ownerOnly?: boolean;
};

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

const ProfileSettingsView = () => <Profile embedded />;

const PlaceholderSettingsView = ({ title, description, icon }: { title: string; description: string; icon: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
      <span className="material-symbols-outlined text-[24px]">{icon}</span>
    </div>
    <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

const EspecialistasView = () => <EquipeView isSpecialistMode={true} />;

const ViewsMap: Record<string, React.FC<any>> = {
  profile: ProfileSettingsView,
  security: SecuritySettingsView,
  notifications: () => <PlaceholderSettingsView title="Notificacoes" description="Preferencias de alertas, lembretes e avisos serao organizadas nesta area." icon="notifications" />,
  services: ServicosView,
  team: EquipeView,
  specialists: EspecialistasView,
  roles: CargosView,
  clinics: ClinicasView,
  business: InfoNegocioView,
  funnels: FunnelsSettingsView,
  cadence: CadenceSettingsView,
  lead_statuses: LeadStatusesSettingsView,
  lead_origins: LeadOriginsSettingsView,
  lead_routing: LeadRoutingSettingsView,
  billing: BillingSettingsView,
  discount: DiscountSettingsView,
};

const tabSlugs: Record<string, string> = {
  profile: 'perfil',
  billing: 'planos',
  security: 'seguranca',
  notifications: 'notificacoes',
  business: 'clinica',
  services: 'servicos',
  team: 'equipe',
  specialists: 'especialistas',
  roles: 'cargos',
  clinics: 'unidades',
  funnels: 'funis',
  cadence: 'cadencia',
  lead_statuses: 'status',
  lead_origins: 'origens',
  lead_routing: 'roteamento',
  discount: 'desconto',
};

const tabKeysBySlug = Object.fromEntries(Object.entries(tabSlugs).map(([key, slug]) => [slug, key]));

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState('profile');
  const { professional: authUser } = useAuth();
  const isOwner = authUser?.role === 'profissional' || authUser?.role === 'admin';


  const settingsSections: SettingsSection[] = [
    {
      title: 'Conta',
      items: [
        { key: 'profile', name: 'Perfil', description: 'Dados pessoais e foto do usuario', icon: 'person' },
        { key: 'billing', name: 'Planos e Cobrança', description: 'Gerencie sua assinatura e pagamentos', icon: 'credit_card', ownerOnly: true },
        { key: 'security', name: 'Seguranca', description: 'Senha e acesso da conta', icon: 'lock' },
        { key: 'notifications', name: 'Notificacoes', description: 'Alertas e preferencias', icon: 'notifications' },
      ],
    },
    {
      title: 'Organizacao',
      items: [
        { key: 'business', name: 'Clinica', description: 'Dados comerciais da empresa', icon: 'business', ownerOnly: true },
        { key: 'services', name: 'Servicos', description: 'Servicos oferecidos', icon: 'medical_services', ownerOnly: true },
        { key: 'team', name: 'Equipe', description: 'Usuarios e convites', icon: 'group', ownerOnly: true },
        { key: 'specialists', name: 'Especialistas', description: 'Gerenciar prestadores', icon: 'medical_information', ownerOnly: true },
        { key: 'roles', name: 'Cargos', description: 'Funcoes e permissoes', icon: 'badge', ownerOnly: true },
        { key: 'clinics', name: 'Minhas clinicas', description: 'Filiais e multi-clinica', icon: 'apartment', ownerOnly: true },
      ],
    },
    {
      title: 'Comercial',
      items: [
        { key: 'funnels', name: 'Funis de Vendas', description: 'Pipelines e etapas do comercial', icon: 'view_kanban', ownerOnly: true },
        { key: 'cadence', name: 'Cadência de Contatos', description: 'Fluxos de acompanhamento', icon: 'timelapse', ownerOnly: true },
        { key: 'lead_statuses', name: 'Status', description: 'Status rápidos dos negócios', icon: 'label', ownerOnly: true },
        { key: 'lead_origins', name: 'Origens', description: 'Fontes de captação de leads', icon: 'share', ownerOnly: true },
        { key: 'lead_routing', name: 'Roteamento', description: 'Distribuição automática de leads', icon: 'route', ownerOnly: true },
        { key: 'discount', name: 'Desconto', description: 'Configurar limites de descontos', icon: 'local_offer', ownerOnly: true },
      ],
    },
  ];

  const visibleSections = settingsSections
    .map(section => ({ ...section, items: section.items.filter(item => !item.ownerOnly || isOwner) }))
    .filter(section => section.items.length > 0);

  const allItems = visibleSections.flatMap(section => section.items);
  const selectedItem = allItems.find(item => item.key === selectedKey) || allItems[0];
  const ActiveView = selectedItem ? ViewsMap[selectedItem.key] : null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedSlug = params.get('tab') || params.get('view');
    const requestedTab = requestedSlug ? (tabKeysBySlug[requestedSlug] || requestedSlug) : null;
    if (requestedTab && allItems.some(item => item.key === requestedTab)) {
      setSelectedKey(requestedTab);
      const canonicalSlug = tabSlugs[requestedTab] || requestedTab;
      if (requestedSlug !== canonicalSlug || params.has('view')) {
        params.set('tab', canonicalSlug);
        params.delete('view');
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    } else {
      setSelectedKey('profile');
    }
  }, [isOwner, location.pathname, location.search, navigate]);

  const handleSelect = (item: SettingsItem) => {
    setSelectedKey(item.key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabSlugs[item.key] || item.key);
    url.searchParams.delete('view');
    navigate(`${url.pathname}${url.search}`, { replace: true });
  };

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 md:p-8 relative">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie sua conta, equipe, clinicas e preferencias do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm h-fit lg:sticky lg:top-6">
          <div className="space-y-4">
            {visibleSections.map(section => (
              <div key={section.title}>
                <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
                <div className="space-y-1">
                  {section.items.map(item => {
                    const active = selectedItem?.key === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-[18px] ${active ? 'text-orange-400' : 'text-slate-400'}`}>{item.icon}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item.name}</p>
                            <p className={`truncate text-[11px] ${active ? 'text-slate-300' : 'text-slate-400'}`}>{item.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {selectedItem && (
            <div className="mb-5 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <span className="material-symbols-outlined text-[20px]">{selectedItem.icon}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedItem.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>
              </div>
            </div>
          )}

          {ActiveView && <ActiveView name={selectedItem?.name} />}
        </section>
      </div>
    </div>
  );
};

export default Settings;
