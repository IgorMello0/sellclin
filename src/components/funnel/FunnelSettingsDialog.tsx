import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { funnelConfigApi } from '@/lib/api';
import { DuplicateFunnelsButton } from './DuplicateFunnelsButton';
import { FunnelOrderControls, useFunnelOrder } from './FunnelOrderControls';
import { stageBehavior } from '../../../server/utils/funnel-stages';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Pencil, RotateCcw } from 'lucide-react';

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

interface FunnelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function FunnelSettingsDialog({ open, onOpenChange, onSaved }: FunnelSettingsDialogProps) {
  const { toast } = useToast();
  const [funnels, setFunnels] = useState<any[]>([]);
  const { isReordering, moveFunnel } = useFunnelOrder(funnels, setFunnels, onSaved);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFunnel, setExpandedFunnel] = useState<number | null>(null);
  const [isAddingFunnel, setIsAddingFunnel] = useState(false);
  const [newFunnelData, setNewFunnelData] = useState({ label: '', code: '', icon: 'filter_alt' });
  const [addingStageToFunnel, setAddingStageToFunnel] = useState<number | null>(null);
  const [newStageData, setNewStageData] = useState({ label: '', code: '', color: 'bg-blue-500' });
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editStageData, setEditStageData] = useState({ label: '', color: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Custom Confirm Dialog State
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Drag and Drop State
  const [draggedStage, setDraggedStage] = useState<{ funnelIdx: number; stageIdx: number } | null>(null);
  const [dragOverStageIdx, setDragOverStageIdx] = useState<number | null>(null);

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmAction({ title, message, onConfirm });
  };

  useEffect(() => {
    if (open) loadFunnels();
  }, [open]);

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

    // Swap orders
    [stages[stageIdx], stages[targetIdx]] = [stages[targetIdx], stages[stageIdx]];

    // Save original state in case of failure
    const originalFunnels = [...funnels];

    // Optimistic update
    const updatedFunnels = [...funnels];
    updatedFunnels[funnelIdx] = {
      ...funnel,
      stages: stages.map((s, i) => ({ ...s, order: i }))
    };
    setFunnels(updatedFunnels);
    setIsSaving(true);

    try {
      const saved = await funnelConfigApi.reorder([{
        id: funnel.id,
        stages: stages.map((s: any, i: number) => ({ id: s.id, order: i }))
      }]);
      if (!saved.success) throw new Error(saved.error?.message);
      // Silently reload to ensure data integrity
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

  const handleResetDefaults = () => {
    askConfirmation(
      'Restaurar Configurações',
      'Restaurar a configuração original? As cópias por operação serão preservadas.',
      async () => {
        try {
          const res = await funnelConfigApi.seedDefaults();
          if (res.success) {
            toast({ title: 'Funis restaurados para o padrão!' });
            loadFunnels();
          }
        } catch (e) {
          toast({ title: 'Erro ao restaurar', variant: 'destructive' });
        }
      }
    );
  };

  // HTML5 Drag and Drop Handlers
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
    
    // Reorder array
    const [removed] = stages.splice(sourceStageIdx, 1);
    stages.splice(targetStageIdx, 0, removed);

    // Save original state in case of failure
    const originalFunnels = [...funnels];

    // Optimistic update
    const updatedFunnels = [...funnels];
    updatedFunnels[targetFunnelIdx] = {
      ...funnel,
      stages: stages.map((s, i) => ({ ...s, order: i }))
    };
    setFunnels(updatedFunnels);
    setIsSaving(true);

    try {
      const saved = await funnelConfigApi.reorder([{
        id: funnel.id,
        stages: stages.map((s: any, i: number) => ({ id: s.id, order: i }))
      }]);
      if (!saved.success) throw new Error(saved.error?.message);
      // Silently reload to ensure data integrity
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border sm:border-slate-100 bg-white p-0 shadow-2xl">
        <div className="p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-transparent border-b border-slate-100">
          <DialogTitle className="text-xl sm:text-2xl font-extrabold text-primary font-headline tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">dashboard_customize</span>
            Configurar Funis e Etapas
          </DialogTitle>
          <p className="text-slate-500 text-xs sm:text-sm mt-2">Personalize os funis e colunas do seu pipeline de vendas.</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-secondary animate-spin" />
            </div>
          ) : (
            <>
              {funnels.map((funnel, funnelIdx) => (
                <div 
                  key={funnel.id} 
                  className={cn(
                    "border border-slate-100 rounded-2xl overflow-hidden bg-white transition-all duration-300 shadow-sm",
                    expandedFunnel === funnel.id ? "ring-1 ring-secondary/20 shadow-md border-secondary/10" : "hover:shadow-md hover:border-slate-200"
                  )}
                >
                  {/* Funnel Header */}
                  <div 
                    className={cn(
                      "flex items-center justify-between p-4.5 cursor-pointer transition-colors duration-300",
                      expandedFunnel === funnel.id ? "bg-slate-50/40 border-b border-slate-100" : "bg-white hover:bg-slate-50/50"
                    )}
                    onClick={() => setExpandedFunnel(expandedFunnel === funnel.id ? null : funnel.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined text-lg">{funnel.icon}</span>
                      </div>
                      <span className="font-extrabold text-primary text-base tracking-tight">{funnel.label}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-orange-50 text-secondary border border-orange-100/60 px-2.5 py-0.5 rounded-full">
                        {funnel.stages?.length || 0} etapas
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      <FunnelOrderControls label={funnel.label} index={funnelIdx} count={funnels.length}
                        disabled={isSaving || isReordering || draggedStage !== null}
                        onMove={direction => void moveFunnel(funnel.id, direction)} />
                      {!SYSTEM_FUNNELS.includes(funnel.code) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFunnel(funnel.id); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50/80 transition-all duration-300"
                          title="Remover funil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {expandedFunnel === funnel.id ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Stages List */}
                  {expandedFunnel === funnel.id && (
                    <div className="p-4 space-y-1.5 bg-white animate-in slide-in-from-top-1 duration-200">
                      {funnel.stages?.map((stage: any, stageIdx: number) => (
                        <div 
                          key={stage.id} 
                          draggable={editingStage !== stage.id}
                          onDragStart={(e) => handleDragStart(e, funnelIdx, stageIdx)}
                          onDragOver={(e) => handleDragOver(e, stageIdx)}
                          onDrop={(e) => handleDropStage(e, funnelIdx, stageIdx)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-all duration-200 group border border-transparent hover:border-slate-100 cursor-grab active:cursor-grabbing",
                            dragOverStageIdx === stageIdx && draggedStage?.funnelIdx === funnelIdx ? "border-dashed border-secondary bg-orange-50/20" : ""
                          )}
                        >
                          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0 cursor-grab" />
                          
                          <div className={cn("w-3 h-3 rounded-full flex-shrink-0 ring-4 ring-slate-100", stage.color)} />

                          {editingStage === stage.id ? (
                            <div className="flex-1 flex items-center gap-2 animate-in fade-in">
                              <Input 
                                value={editStageData.label}
                                onChange={(e) => setEditStageData({ ...editStageData, label: e.target.value })}
                                className="h-8 text-xs rounded-lg flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateStage(stage.id);
                                  if (e.key === 'Escape') setEditingStage(null);
                                }}
                              />
                              <div className="flex gap-1">
                                {COLOR_PALETTE.map(c => (
                                  <button
                                    key={c.value}
                                    onClick={() => setEditStageData({ ...editStageData, color: c.value })}
                                    className={cn(
                                      "w-5 h-5 rounded-full transition-all border-2",
                                      c.preview,
                                      editStageData.color === c.value ? "border-primary scale-125" : "border-transparent hover:scale-110"
                                    )}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                              <Button onClick={() => handleUpdateStage(stage.id)} size="sm" variant="secondary" className="h-8 px-3 rounded-lg text-xs">
                                Salvar
                              </Button>
                              <Button onClick={() => setEditingStage(null)} size="sm" variant="ghost" className="h-8 px-2 rounded-lg text-xs">
                                <span className="material-symbols-outlined text-sm">close</span>
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-semibold text-primary">{stage.label}</span>
                              
                              {stage.isTransition && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                                  Transição
                                </span>
                              )}
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                  onClick={() => handleMoveStage(funnelIdx, stageIdx, 'up')}
                                  disabled={stageIdx === 0}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-primary hover:bg-slate-100 disabled:opacity-10 transition-all duration-200"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveStage(funnelIdx, stageIdx, 'down')}
                                  disabled={stageIdx === funnel.stages.length - 1}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-primary hover:bg-slate-100 disabled:opacity-10 transition-all duration-200"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingStage(stage.id);
                                    setEditStageData({ label: stage.label, color: stage.color });
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-secondary hover:bg-orange-50 transition-all duration-200"
                                  title="Editar etapa"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {!SYSTEM_STAGES.includes(stageBehavior(stage.code)) && (
                                  <button
                                    onClick={() => handleDeleteStage(stage.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                                    title="Remover etapa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add Stage Form */}
                      {addingStageToFunnel === funnel.id ? (
                        <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nome da Etapa</Label>
                            <Input 
                              value={newStageData.label}
                              onChange={(e) => setNewStageData({ ...newStageData, label: e.target.value })}
                              placeholder="Ex: Em Negociação"
                              className="h-9 text-xs rounded-lg"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cor</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {COLOR_PALETTE.map(c => (
                                <button
                                  key={c.value}
                                  onClick={() => setNewStageData({ ...newStageData, color: c.value })}
                                  className={cn(
                                    "w-6 h-6 rounded-full transition-all border-2",
                                    c.preview,
                                    newStageData.color === c.value ? "border-primary scale-125 shadow-lg" : "border-transparent hover:scale-110"
                                  )}
                                  title={c.label}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button 
                              onClick={() => handleAddStage(funnel.id)} 
                              size="sm" 
                              variant="secondary" 
                              className="rounded-lg text-xs font-bold h-8 px-4"
                              disabled={isSaving}
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
                            </Button>
                            <Button 
                              onClick={() => setAddingStageToFunnel(null)} 
                              size="sm" 
                              variant="ghost" 
                              className="rounded-lg text-xs h-8"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingStageToFunnel(funnel.id);
                            setNewStageData({ label: '', code: '', color: 'bg-blue-500' });
                          }}
                          className="w-full py-3 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-secondary hover:border-secondary/30 hover:bg-orange-50/10 transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar Etapa
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Funnel Section */}
              {isAddingFunnel ? (
                <div className="p-5 border-2 border-dashed border-secondary/30 rounded-2xl bg-secondary/5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                    <Plus className="w-4 h-4 text-secondary" />
                    Criar Novo Funil
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nome do Funil</Label>
                      <Input 
                        value={newFunnelData.label}
                        onChange={(e) => setNewFunnelData({ ...newFunnelData, label: e.target.value })}
                        placeholder="Ex: Pós-Procedimento"
                        className="h-10 rounded-xl text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ícone</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ICON_OPTIONS.map(icon => (
                          <button
                            key={icon.value}
                            onClick={() => setNewFunnelData({ ...newFunnelData, icon: icon.value })}
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center transition-all border",
                              newFunnelData.icon === icon.value 
                                ? "bg-primary text-white border-primary shadow-md" 
                                : "bg-white text-slate-400 border-slate-200 hover:border-primary/30 hover:text-primary"
                            )}
                            title={icon.label}
                          >
                            <span className="material-symbols-outlined text-base">{icon.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button 
                      onClick={handleCreateFunnel} 
                      variant="secondary" 
                      className="rounded-xl text-xs font-bold h-10 px-6"
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Funil'}
                    </Button>
                    <Button 
                      onClick={() => setIsAddingFunnel(false)} 
                      variant="ghost" 
                      className="rounded-xl text-xs h-10"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <DuplicateFunnelsButton onSaved={() => { void loadFunnels(); onSaved(); }} />
                  <button
                    onClick={() => setIsAddingFunnel(true)}
                    className="flex-1 py-4 border border-dashed border-slate-300 hover:border-secondary/40 hover:bg-orange-50/30 rounded-2xl text-sm font-bold text-slate-400 hover:text-secondary transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4 text-secondary" />
                    Criar Novo Funil
                  </button>
                  <button
                    onClick={handleResetDefaults}
                    className="py-4 px-6 border border-slate-200 bg-white hover:bg-red-50/50 hover:text-red-500 hover:border-red-100 rounded-2xl text-xs font-bold text-slate-400 transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.99]"
                    title="Restaurar configuração padrão"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrões
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t border-slate-100">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="rounded-xl"
          >
            Fechar
          </Button>
          <Button 
            variant="secondary"
            onClick={() => {
              onSaved();
              onOpenChange(false);
            }}
            className="rounded-xl px-8 font-bold shadow-lg shadow-secondary/20"
          >
            Aplicar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Custom Confirmation Dialog */}
    <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
      <DialogContent className="sm:max-w-[400px] p-6 rounded-3xl border-0 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined text-2xl">info</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-primary">{confirmAction?.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{confirmAction?.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <Button 
            variant="ghost" 
            onClick={() => setConfirmAction(null)} 
            className="flex-1 rounded-xl h-10 text-xs font-bold"
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              confirmAction?.onConfirm();
              setConfirmAction(null);
            }} 
            className="flex-1 rounded-xl h-10 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
