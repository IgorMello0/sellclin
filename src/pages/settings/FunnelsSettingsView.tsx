import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { funnelConfigApi, empresasApi } from '@/lib/api';
import { DuplicateFunnelsButton } from '@/components/funnel/DuplicateFunnelsButton';
import { FunnelOrderControls, useFunnelOrder } from '@/components/funnel/FunnelOrderControls';
import { stageBehavior } from '../../../server/utils/funnel-stages';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

const COLOR_PALETTE = [
  { value: 'bg-blue-500', label: 'Azul', preview: 'bg-blue-500' },
  { value: 'bg-indigo-500', label: 'Índigo', preview: 'bg-indigo-500' },
  { value: 'bg-violet-500', label: 'Violeta', preview: 'bg-violet-500' },
  { value: 'bg-emerald-500', label: 'Esmeralda', preview: 'bg-emerald-500' },
  { value: 'bg-orange-500', label: 'Laranja', preview: 'bg-orange-500' },
  { value: 'bg-amber-500', label: 'Âmbar', preview: 'bg-amber-500' },
  { value: 'bg-red-500', label: 'Vermelho', preview: 'bg-red-500' },
  { value: 'bg-cyan-500', label: 'Ciano', preview: 'bg-cyan-500' },
  { value: 'bg-blue-600', label: 'Azul Escuro', preview: 'bg-blue-600' },
  { value: 'bg-purple-500', label: 'Roxo', preview: 'bg-purple-500' },
  { value: 'bg-pink-500', label: 'Rosa', preview: 'bg-pink-500' },
  { value: 'bg-green-600', label: 'Verde', preview: 'bg-green-600' },
  { value: 'bg-slate-500', label: 'Cinza', preview: 'bg-slate-500' },
];

const ICON_OPTIONS = [
  { value: 'person_search', label: 'Busca' },
  { value: 'handshake', label: 'Negócio' },
  { value: 'payments', label: 'Pagamento' },
  { value: 'filter_alt', label: 'Funil' },
  { value: 'shopping_cart', label: 'Carrinho' },
  { value: 'support_agent', label: 'Suporte' },
  { value: 'campaign', label: 'Marketing' },
  { value: 'loyalty', label: 'Fidelidade' },
  { value: 'medical_services', label: 'Médico' },
  { value: 'calendar_today', label: 'Agenda' },
];

const SYSTEM_FUNNELS = ['prospecting', 'commercial', 'sales'];
const SYSTEM_STAGES = [
  'prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended',
  'comercial_consult', 'comercial_proposal', 'comercial_follow', 'comercial_closed',
  'sales_payment', 'sales_contract', 'sales_post'
];

export default function FunnelsSettingsView({ name }: { name?: string }) {
  const { toast } = useToast();
  const [funnels, setFunnels] = useState<any[]>([]);
  const { isReordering, moveFunnel } = useFunnelOrder(funnels, setFunnels);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFunnel, setExpandedFunnel] = useState<number | null>(null);
  const [isAddingFunnel, setIsAddingFunnel] = useState(false);
  const [newFunnelData, setNewFunnelData] = useState({ label: '', code: '', icon: 'filter_alt' });
  const [addingStageToFunnel, setAddingStageToFunnel] = useState<number | null>(null);
  const [newStageData, setNewStageData] = useState({ label: '', code: '', color: 'bg-blue-500' });
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editStageData, setEditStageData] = useState({ label: '', color: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [contactCadence, setContactCadence] = useState<number>(5);
  const [isSavingCadence, setIsSavingCadence] = useState(false);

  // Drag and Drop State
  const [draggedStage, setDraggedStage] = useState<{ funnelIdx: number; stageIdx: number } | null>(null);
  const [dragOverStageIdx, setDragOverStageIdx] = useState<number | null>(null);

  useEffect(() => {
    loadFunnels();
    loadCompanyCadence();
  }, []);

  const loadCompanyCadence = async () => {
    try {
      const res = await empresasApi.getMyCompany();
      if (res.success && res.data) {
        setCompanyId(res.data.id);
        setContactCadence(res.data.contactCadence ?? 5);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCadence = async () => {
    if (!companyId) return;
    setIsSavingCadence(true);
    try {
      const res = await empresasApi.update(companyId, { contactCadence });
      if (res.success) {
        toast({ title: 'Cadência salva com sucesso!' });
      } else {
        toast({ title: 'Erro ao salvar cadência', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro ao salvar cadência', variant: 'destructive' });
    } finally {
      setIsSavingCadence(false);
    }
  };

  const loadFunnels = async () => {
    setIsLoading(true);
    try {
      const res = await funnelConfigApi.getAll();
      if (res.success) setFunnels(res.data || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar funis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  };

  const handleCreateFunnel = async () => {
    if (!newFunnelData.label) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const code = newFunnelData.code || newFunnelData.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const res = await funnelConfigApi.create({
        code,
        label: newFunnelData.label,
        icon: newFunnelData.icon,
        order: funnels.length
      });

      if (res.success) {
        toast({ title: 'Funil criado com sucesso!' });
        setNewFunnelData({ label: '', code: '', icon: 'filter_alt' });
        setIsAddingFunnel(false);
        loadFunnels();
      } else {
        toast({ title: res.error?.message || 'Erro ao criar funil', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro ao criar funil', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFunnel = (funnelId: number) => {
    askConfirmation(
      'Remover Funil',
      'Tem certeza? Os leads deste funil serão movidos para a primeira etapa do primeiro funil ativo.',
      async () => {
        try {
          const res = await funnelConfigApi.delete(funnelId);
          if (res.success) {
            toast({ title: 'Funil removido!' });
            loadFunnels();
          }
        } catch (e) {
          toast({ title: 'Erro ao remover funil', variant: 'destructive' });
        }
      }
    );
  };

  const handleAddStage = async (funnelId: number) => {
    if (!newStageData.label) {
      toast({ title: 'Nome da etapa é obrigatório', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const code = newStageData.code || newStageData.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const funnel = funnels.find(f => f.id === funnelId);
      const order = funnel?.stages?.length || 0;

      const res = await funnelConfigApi.addStage(funnelId, {
        code,
        label: newStageData.label,
        color: newStageData.color,
        order
      });

      if (res.success) {
        toast({ title: 'Etapa adicionada!' });
        setNewStageData({ label: '', code: '', color: 'bg-blue-500' });
        setAddingStageToFunnel(null);
        loadFunnels();
      } else {
        toast({ title: res.error?.message || 'Erro ao criar etapa', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro ao criar etapa', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStage = async (stageId: number) => {
    setIsSaving(true);
    try {
      const res = await funnelConfigApi.updateStage(stageId, {
        label: editStageData.label,
        color: editStageData.color
      });

      if (res.success) {
        toast({ title: 'Etapa atualizada!' });
        setEditingStage(null);
        loadFunnels();
      }
    } catch (e) {
      toast({ title: 'Erro ao atualizar etapa', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStage = (stageId: number) => {
    askConfirmation(
      'Remover Etapa',
      'Tem certeza? Os leads desta etapa serão movidos para a primeira etapa do mesmo funil.',
      async () => {
        try {
          const res = await funnelConfigApi.deleteStage(stageId);
          if (res.success) {
            toast({ title: 'Etapa removida!' });
            loadFunnels();
          }
        } catch (e) {
          toast({ title: 'Erro ao remover etapa', variant: 'destructive' });
        }
      }
    );
  };

  const handleMoveStage = async (funnelIdx: number, stageIdx: number, direction: 'up' | 'down') => {
    if (isSaving || isReordering) return;
    const funnel = funnels[funnelIdx];
    const stages = [...funnel.stages];
    const targetIdx = direction === 'up' ? stageIdx - 1 : stageIdx + 1;
    if (targetIdx < 0 || targetIdx >= stages.length) return;

    [stages[stageIdx], stages[targetIdx]] = [stages[targetIdx], stages[stageIdx]];

    const originalFunnels = [...funnels];
    const updatedFunnels = [...funnels];
    updatedFunnels[funnelIdx] = {
      ...funnel,
      stages: stages.map((s: any, i: number) => ({ ...s, order: i }))
    };
    setFunnels(updatedFunnels);
    setIsSaving(true);

    try {
      const saved = await funnelConfigApi.reorder([{
        id: funnel.id,
        stages: stages.map((s: any, i: number) => ({ id: s.id, order: i }))
      }]);
      if (!saved.success) throw new Error(saved.error?.message);
      const res = await funnelConfigApi.getAll();
      if (res.success) {
        setFunnels(res.data || []);
      }
    } catch (e) {
      setFunnels(originalFunnels);
      toast({ title: 'Erro ao reordenar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, funnelIdx: number, stageIdx: number) => {
    if (editingStage !== null || isSaving || isReordering) {
      e.preventDefault();
      return;
    }
    setDraggedStage({ funnelIdx, stageIdx });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-40');
  };

  const handleDragOver = (e: React.DragEvent, stageIdx: number) => {
    e.preventDefault();
    setDragOverStageIdx(stageIdx);
  };

  const handleDropStage = async (e: React.DragEvent, targetFunnelIdx: number, targetStageIdx: number) => {
    e.preventDefault();
    if (isSaving || isReordering || !draggedStage || draggedStage.funnelIdx !== targetFunnelIdx) {
      return;
    }

    const { stageIdx: sourceStageIdx } = draggedStage;
    if (sourceStageIdx === targetStageIdx) return;

    const funnel = funnels[targetFunnelIdx];
    const stages = [...funnel.stages];
    
    const [removed] = stages.splice(sourceStageIdx, 1);
    stages.splice(targetStageIdx, 0, removed);

    const originalFunnels = [...funnels];
    const updatedFunnels = [...funnels];
    updatedFunnels[targetFunnelIdx] = {
      ...funnel,
      stages: stages.map((s: any, i: number) => ({ ...s, order: i }))
    };
    setFunnels(updatedFunnels);
    setIsSaving(true);

    try {
      const saved = await funnelConfigApi.reorder([{
        id: funnel.id,
        stages: stages.map((s: any, i: number) => ({ id: s.id, order: i }))
      }]);
      if (!saved.success) throw new Error(saved.error?.message);
      const res = await funnelConfigApi.getAll();
      if (res.success) {
        setFunnels(res.data || []);
      }
    } catch (err) {
      setFunnels(originalFunnels);
      toast({ title: 'Erro ao reordenar etapas', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
    setDraggedStage(null);
    setDragOverStageIdx(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="text-sm text-slate-500 font-medium">
          Personalize as etapas e funis que serão exibidos no seu pipeline comercial.
        </p>
        <div className="flex flex-wrap gap-2">
          <DuplicateFunnelsButton onSaved={loadFunnels} />
          <Button
            onClick={() => {
              setIsAddingFunnel(true);
              setExpandedFunnel(null);
            }}
            size="sm"
            variant="secondary"
            className="h-10 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Funil
          </Button>
        </div>
      </div>

      {/* Help Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm text-blue-800 shadow-sm">
        <div className="text-blue-500 mt-0.5">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>info</span>
        </div>
        <div className="space-y-2">
          <p>
            <strong>Como organizar seus Funis:</strong> Você pode criar diferentes funis para segmentar o processo (ex: Prospecção, Vendas) e adicionar etapas dentro de cada um. 
            Arraste as etapas pelo ícone lateral (<GripVertical className="inline w-4 h-4 text-slate-400 -mt-0.5" />) para mudar a ordem. Para editar o nome ou a cor de uma etapa, clique no ícone do lápis.
          </p>
          <p>
            <strong>Cadência de Contatos:</strong> A cadência define o objetivo de tentativas de contato com o cliente (ex: ligar 5 vezes). 
            Esse número aparece no cartão de cada lead lá na tela do Comercial e seus vendedores podem ir somando (+1) cada vez que tentarem falar com a pessoa.
          </p>
        </div>
      </div>

      <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Cadência de Contato (CRM)</Label>
          <p className="text-sm text-muted-foreground">Número de tentativas (bolinhas) mostradas no cartão do Kanban.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input 
            type="number"
            min="1"
            max="20"
            value={contactCadence}
            onChange={(e) => setContactCadence(parseInt(e.target.value) || 5)}
            className="w-20 text-center font-medium"
          />
          <Button onClick={handleSaveCadence} disabled={isSavingCadence} variant="secondary">
            {isSavingCadence ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {funnels.map((funnel, funnelIdx) => (
            <div 
              key={funnel.id} 
              className={cn(
                "border border-slate-200 rounded-2xl overflow-hidden bg-white transition-all duration-300",
                expandedFunnel === funnel.id ? "ring-2 ring-primary/5 shadow-md border-primary/20" : "hover:shadow-sm hover:border-slate-300"
              )}
            >
              {/* Funnel Header */}
              <div 
                className={cn(
                  "flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors duration-300",
                  expandedFunnel === funnel.id ? "bg-slate-50/50 border-b border-slate-100" : "bg-white hover:bg-slate-50/50"
                )}
                onClick={() => setExpandedFunnel(expandedFunnel === funnel.id ? null : funnel.id)}
              >
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    expandedFunnel === funnel.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  )}>
                    <span className="material-symbols-outlined text-[20px]">{funnel.icon}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-base block">{funnel.label}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                      {funnel.stages?.length || 0} etapas
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                  <FunnelOrderControls label={funnel.label} index={funnelIdx} count={funnels.length}
                    disabled={isSaving || isReordering || draggedStage !== null}
                    onMove={direction => void moveFunnel(funnel.id, direction)} />
                  {!SYSTEM_FUNNELS.includes(funnel.code) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(funnel.id); }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300"
                      title="Remover funil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-500">
                    {expandedFunnel === funnel.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Stages List */}
              {expandedFunnel === funnel.id && (
                <div className="p-4 sm:p-5 space-y-2 bg-white/50">
                  {funnel.stages?.map((stage: any, stageIdx: number) => (
                    <div 
                      key={stage.id} 
                      draggable={editingStage !== stage.id}
                      onDragStart={(e) => handleDragStart(e, funnelIdx, stageIdx)}
                      onDragOver={(e) => handleDragOver(e, stageIdx)}
                      onDrop={(e) => handleDropStage(e, funnelIdx, stageIdx)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-white hover:bg-slate-50 transition-all duration-200 group border border-slate-100 hover:border-slate-200 cursor-grab active:cursor-grabbing shadow-sm",
                        dragOverStageIdx === stageIdx && draggedStage?.funnelIdx === funnelIdx ? "border-dashed border-primary bg-primary/5" : ""
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0 cursor-grab hidden sm:block" />
                        
                        <div className={cn("w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm", stage.color)} />

                        {editingStage === stage.id ? (
                          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-in fade-in">
                            <Input 
                              value={editStageData.label}
                              onChange={(e) => setEditStageData({ ...editStageData, label: e.target.value })}
                              className="h-9 text-sm rounded-lg flex-1 min-w-[200px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateStage(stage.id);
                                if (e.key === 'Escape') setEditingStage(null);
                              }}
                            />
                            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-100">
                              {COLOR_PALETTE.map(c => (
                                <button
                                  key={c.value}
                                  onClick={() => setEditStageData({ ...editStageData, color: c.value })}
                                  className={cn(
                                    "w-6 h-6 rounded-full transition-all border-2",
                                    c.preview,
                                    editStageData.color === c.value ? "border-primary scale-110 shadow-sm" : "border-transparent hover:scale-110 opacity-70 hover:opacity-100"
                                  )}
                                  title={c.label}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <Button onClick={() => handleUpdateStage(stage.id)} size="sm" variant="secondary" className="h-9 flex-1 sm:flex-none">
                                Salvar
                              </Button>
                              <Button onClick={() => setEditingStage(null)} size="sm" variant="outline" className="h-9">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-semibold text-slate-700">{stage.label}</span>
                            
                            {stage.isTransition && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200">
                                Transição
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      {!editingStage && (
                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 ml-6 sm:ml-0 justify-end">
                          <button
                            onClick={() => handleMoveStage(funnelIdx, stageIdx, 'up')}
                            disabled={stageIdx === 0}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveStage(funnelIdx, stageIdx, 'down')}
                            disabled={stageIdx === funnel.stages.length - 1}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></div>
                          <button
                            onClick={() => {
                              setEditingStage(stage.id);
                              setEditStageData({ label: stage.label, color: stage.color });
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-secondary hover:bg-orange-50 transition-colors"
                            title="Editar etapa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!SYSTEM_STAGES.includes(stageBehavior(stage.code)) && (
                            <button
                              onClick={() => handleDeleteStage(stage.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Remover etapa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Stage Form */}
                  {addingStageToFunnel === funnel.id ? (
                    <div className="p-4 mt-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nova Etapa</h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Nome da Etapa</Label>
                          <Input 
                            value={newStageData.label}
                            onChange={(e) => setNewStageData({ ...newStageData, label: e.target.value })}
                            placeholder="Ex: Em Negociação"
                            className="h-10 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Cor de Identificação</Label>
                          <div className="flex flex-wrap gap-2 p-2 bg-white rounded-xl border border-slate-200">
                            {COLOR_PALETTE.map(c => (
                              <button
                                key={c.value}
                                onClick={() => setNewStageData({ ...newStageData, color: c.value })}
                                className={cn(
                                  "w-7 h-7 rounded-full transition-all border-2",
                                  c.preview,
                                  newStageData.color === c.value ? "border-primary scale-110 shadow-md" : "border-transparent hover:scale-110 opacity-70 hover:opacity-100"
                                )}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button 
                            onClick={() => handleAddStage(funnel.id)} 
                            className="h-10 px-6 font-medium"
                            disabled={isSaving}
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Salvar Etapa
                          </Button>
                          <Button 
                            onClick={() => setAddingStageToFunnel(null)} 
                            variant="outline" 
                            className="h-10"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingStageToFunnel(funnel.id);
                        setNewStageData({ label: '', code: '', color: 'bg-blue-500' });
                      }}
                      className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-700 transition-all font-medium flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Nova Etapa
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add Funnel Section */}
          {isAddingFunnel && (
            <div className="mt-6 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col space-y-1.5">
                <h3 className="font-semibold text-lg leading-none tracking-tight flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Criar Novo Funil
                </h3>
                <p className="text-sm text-muted-foreground">Defina o nome e o ícone para o seu novo processo comercial.</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Funil</Label>
                  <Input 
                    value={newFunnelData.label}
                    onChange={(e) => setNewFunnelData({ ...newFunnelData, label: e.target.value })}
                    placeholder="Ex: Pós-Venda VIP"
                    className="h-11"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    {ICON_OPTIONS.map(icon => (
                      <button
                        key={icon.value}
                        onClick={() => setNewFunnelData({ ...newFunnelData, icon: icon.value })}
                        className={cn(
                          "aspect-square rounded-lg flex items-center justify-center transition-all",
                          newFunnelData.icon === icon.value 
                            ? "bg-primary text-white shadow-md scale-110" 
                            : "bg-white text-slate-500 hover:bg-slate-200 hover:text-slate-700 border border-slate-200"
                        )}
                        title={icon.label}
                      >
                        <span className="material-symbols-outlined text-lg">{icon.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button 
                    onClick={handleCreateFunnel} 
                    className="flex-1 sm:flex-none h-11 px-8"
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Criar Funil
                  </Button>
                  <Button 
                    onClick={() => setIsAddingFunnel(false)} 
                    variant="outline" 
                    className="flex-1 sm:flex-none h-11"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
