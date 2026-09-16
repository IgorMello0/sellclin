import React, { useState, useEffect, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadsApi, clientsApi } from '@/lib/api';
import { loadAllPages, requireApiSuccess } from '@/lib/funnel';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  professional: any;
  services: any[];
  onSuccess: () => void;
  targetType?: 'lead' | 'client';
  editingProposal?: any;
}

export function ProposalDialog({
  open,
  onOpenChange,
  lead,
  professional,
  services,
  onSuccess,
  editingProposal,
  targetType = 'lead'
}: ProposalDialogProps) {
  const { toast } = useToast();
  const [allProfessionals, setAllProfessionals] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [closers, setClosers] = useState<any[]>([]);
  const [sdrs, setSdrs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const savedClientProposals = useRef(new Set<number>());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isAdminOrGestor = professional?.role === 'profissional' || ['admin', 'manager', 'gestor', 'administrador'].some(r => 
    professional?.role?.toLowerCase().includes(r) || professional?.specialization?.toLowerCase().includes(r)
  );

  // Carregar profissionais e especialistas internamente
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        try {
          const { professionalsApi, usuariosApi } = await import('@/lib/api');
          const profRes = await professionalsApi.getAll();
          if (profRes.success) setAllProfessionals(profRes.data || []);

          const users = await loadAllPages<any>(usuariosApi.getAll);
          const members = users.flatMap(user => {
            const access = user.companyAccess?.find((a: any) => a.companyId === professional?.companyId);
            if (access?.isActive === false || (!access && user.companyId !== professional?.companyId)) return [];
            return [{ ...user, role: access?.role || user.role }];
          });
          setAllUsers(members);
          setSpecialists(members.filter(u => u.role?.isSpecialist));
          setClosers(members.filter(u => u.role?.isCloser));
          setSdrs(members.filter(u => u.role?.isSDR));
        } catch (e) {
          console.error('[ProposalDialog] Erro ao carregar dados:', e);
        }
      };
      loadData();
    }
  }, [open, professional?.companyId]);

  useEffect(() => {
    if (lead && open) {
      savedClientProposals.current.clear();
      setShowConfirmModal(false);
      setProposals([
        {
          title: editingProposal?.title || `Proposta para ${lead.name}`,
          value: String(Math.round(Number(editingProposal?.value ?? lead.value ?? 0) * 100)),
          validUntil: editingProposal?.validUntil ? new Date(editingProposal.validUntil).toISOString().slice(0, 10) : '',
          salesperson: (editingProposal?.salespersonId ?? lead.closerId)?.toString() || '',
          specialist: editingProposal?.specialistId?.toString() || '',
          sdr: (editingProposal?.sdrId ?? lead.sdrId)?.toString() || '',
          treatment: '',
          tags: editingProposal?.tags || lead.tags || [] as string[],
          justification: editingProposal?.justification || '',
          showJustification: false,
          removedTags: [] as string[]
        }
      ]);
    }
  }, [lead?.id, open, editingProposal?.id]);

  const formatCurrency = (value: string) => {
    const numeric = value.replace(/\D/g, '');
    if (!numeric) return '';
    const val = Number(numeric) / 100;
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parseCurrency = (value: string) => {
    return Number(value.replace(/\D/g, '')) / 100;
  };

  const handleAddProposal = () => {
    setProposals(prev => [
      ...prev,
      {
        title: `Proposta para ${lead.name} (${prev.length + 1})`,
        value: lead.value > 0 ? (lead.value * 100).toString() : '',
        validUntil: '',
        salesperson: lead?.closerId?.toString() || '',
        specialist: '',
        sdr: lead?.sdrId?.toString() || '',
        treatment: '',
        tags: lead.tags || [] as string[],
        justification: '',
        showJustification: false,
        removedTags: [] as string[]
      }
    ]);
  };

  const handleRemoveProposal = (index: number) => {
    if (proposals.length === 1) return;
    setProposals(prev => prev.filter((_, i) => i !== index));
  };

  const updateProposalField = (index: number, field: string, value: any) => {
    setProposals(prev => prev.map((p, i) => {
      if (i === index) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleSaveProposal = async () => {
    if (!lead || saving.current) return;

    // Validar campos obrigatórios dinamicamente (só cobra se existem pessoas com a flag)
    for (let i = 0; i < proposals.length; i++) {
      const proposal = proposals[i];
      const newValue = parseCurrency(proposal.value);
      
      if (newValue < Number(editingProposal?.value ?? lead?.value ?? 0) && !proposal.justification) {
        toast({ 
          title: `Erro ao salvar proposta #${i + 1}`, 
          description: "O valor é menor que o atual do Lead. Por favor, informe o motivo.", 
          variant: "destructive" 
        });
        return;
      }

      if (specialists.length > 0 && !proposal.specialist) {
        toast({ 
          title: `Erro ao salvar proposta #${i + 1}`, 
          description: "Selecione o Especialista responsável.", 
          variant: "destructive" 
        });
        return;
      }

      if (closers.length > 0 && !proposal.salesperson) {
        toast({ 
          title: `Erro ao salvar proposta #${i + 1}`, 
          description: "Selecione o Vendedor / Closer responsável.", 
          variant: "destructive" 
        });
        return;
      }

      if (sdrs.length > 0 && !proposal.sdr) {
        toast({ 
          title: `Erro ao salvar proposta #${i + 1}`, 
          description: "Selecione o SDR responsável.", 
          variant: "destructive" 
        });
        return;
      }
    }

    saving.current = true;
    setIsSaving(true);
    try {
      const payloads = proposals.map((proposalData, index) => ({
        title: proposalData.title || `Proposta para ${lead.name} (${index + 1})`,
        value: parseCurrency(proposalData.value),
        validUntil: proposalData.validUntil || new Date(Date.now() + 7 * 86400000).toISOString(),
        salespersonId: proposalData.salesperson ? Number(proposalData.salesperson) : null,
        specialistId: proposalData.specialist ? Number(proposalData.specialist) : null,
        sdrId: proposalData.sdr ? Number(proposalData.sdr) : null,
        tags: proposalData.tags,
        justification: proposalData.justification || null,
      }));
      if (editingProposal) {
        requireApiSuccess(await leadsApi.updateProposal(Number(editingProposal.leadId || lead.id), Number(editingProposal.id), payloads[0]));
      } else if (targetType === 'lead') {
        requireApiSuccess(await leadsApi.addProposals(Number(lead.id), payloads));
      } else {
        // Client API creates one at a time: keep successful entries out of retries.
        for (let i = 0; i < payloads.length; i++) {
          if (savedClientProposals.current.has(i)) continue;
          requireApiSuccess(await clientsApi.addProposal(Number(lead.id), payloads[i]));
          savedClientProposals.current.add(i);
        }
      }
      toast({ title: "Propostas Salvas com Sucesso!" });
      onSuccess();
      setShowConfirmModal(false);
      onOpenChange(false);
    } catch (e) {
      console.error('[ProposalDialog] Erro ao salvar propostas:', e);
      if (targetType === 'client' && savedClientProposals.current.size) {
        const saved = new Set(savedClientProposals.current);
        setProposals(prev => prev.filter((_, i) => !saved.has(i)));
        // The unsaved rows become a new retry batch.
        savedClientProposals.current = new Set();
      }
      toast({ title: 'Erro ao salvar propostas', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  if (!lead) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border sm:border-slate-100 bg-white p-0 shadow-2xl">
        <div className="p-4 sm:p-8 bg-gradient-to-br from-orange-50 to-transparent border-b border-orange-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-2xl font-extrabold text-primary font-headline tracking-tight">Proposta Comercial</h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">Defina os termos dos tratamentos para o paciente.</p>
          </div>
          {!editingProposal && <Button
            onClick={handleAddProposal}
            variant="outline"
            className="rounded-xl border-orange-200 text-primary hover:bg-orange-50 hover:text-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Outra Proposta
          </Button>}
        </div>

        <div className="p-4 sm:p-8 space-y-8 divide-y divide-slate-100">
          {proposals.map((proposal, index) => {
            const newValue = parseCurrency(proposal.value);
            const isLowerValue = newValue < Number(editingProposal?.value ?? lead?.value ?? 0);

            return (
              <div key={index} className={cn("space-y-6", index > 0 && "pt-8")}>
                <div className="flex items-center justify-between">
                  <span className="bg-orange-100 text-primary text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Opção de Proposta #{index + 1}
                  </span>
                  {proposals.length > 1 && (
                    <Button 
                      variant="ghost" 
                      onClick={() => handleRemoveProposal(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl px-3"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover Opção
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Título da Proposta</Label>
                      <Input 
                        value={proposal.title}
                        onChange={(e) => updateProposalField(index, 'title', e.target.value)}
                        placeholder="Ex: Reabilitação Oral Completa" 
                        className="rounded-xl border-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Valor Total</Label>
                        <Input 
                          value={formatCurrency(proposal.value)}
                          onChange={(e) => updateProposalField(index, 'value', e.target.value.replace(/\D/g, ''))}
                          placeholder="R$ 0,00" 
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Válido Até</Label>
                        <Input 
                          type="date"
                          value={proposal.validUntil}
                          onChange={(e) => updateProposalField(index, 'validUntil', e.target.value)}
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Vendedor / Consultor</Label>
                        <Select 
                          value={proposal.salesperson}
                          onValueChange={(v) => updateProposalField(index, 'salesperson', v)}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                            <SelectValue placeholder="Selecione">
                              {allUsers.find(u => u.id.toString() === proposal.salesperson)?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {closers.length > 0 ? closers.map(u => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                            )) : (
                              <SelectItem value="none" disabled>Nenhum Closer cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">SDR (Abordagem)</Label>
                        <Select 
                          value={proposal.sdr}
                          onValueChange={(v) => updateProposalField(index, 'sdr', v)}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                            <SelectValue placeholder="Selecione">
                              {allUsers.find(u => u.id.toString() === proposal.sdr)?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {sdrs.length > 0 ? sdrs.map(u => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                            )) : (
                              <SelectItem value="none" disabled>Nenhum SDR cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isLowerValue && (
                      <div className="space-y-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Justificativa Detalhada</Label>
                          <Textarea 
                            value={proposal.justification}
                            onChange={(e) => updateProposalField(index, 'justification', e.target.value)}
                            placeholder="Explique o motivo do valor reduzido..."
                            className="rounded-xl border-orange-200 bg-white min-h-[80px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Profissional Especialista</Label>
                      <Select 
                        value={proposal.specialist}
                        onValueChange={(v) => updateProposalField(index, 'specialist', v)}
                      >
                        <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Selecione o especialista">
                            {specialists.find(p => p.id.toString() === proposal.specialist)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {specialists.length > 0 ? specialists.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          )) : (
                            <SelectItem value="none" disabled>Nenhum especialista encontrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tags da Proposta (Serviços)</Label>
                      <div className="flex flex-wrap gap-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[60px] content-start">
                        {services.map((service) => {
                          const isSelected = proposal.tags.includes(service.name);
                          return (
                            <button
                              key={service.id}
                              onClick={() => {
                                const newTags = isSelected
                                  ? proposal.tags.filter((t: string) => t !== service.name)
                                  : [...proposal.tags, service.name];
                                updateProposalField(index, 'tags', newTags);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border",
                                isSelected
                                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105"
                                  : "bg-white text-slate-400 border-slate-200 hover:border-primary/30 hover:text-primary hover:bg-white shadow-sm"
                              )}
                            >
                              {service.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tratamento Proposto</Label>
                      <Textarea 
                        value={proposal.treatment}
                        onChange={(e) => updateProposalField(index, 'treatment', e.target.value)}
                        placeholder="Descreva o tratamento agendado..." 
                        className="rounded-xl border-slate-200 min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          {isAdminOrGestor ? (
            <Button 
              onClick={handleSaveProposal}
              disabled={isSaving}
              variant="secondary"
              className="rounded-xl px-10 font-bold shadow-lg shadow-secondary/20 gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProposal ? "Salvar Alterações" : "Gerar e Salvar Propostas"}
            </Button>
          ) : (
            <Button 
              onClick={() => setShowConfirmModal(true)}
              variant="secondary"
              className="rounded-xl px-10 font-bold shadow-lg shadow-secondary/20 gap-2"
            >
              Revisar e Gerar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmation Modal */}
    <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white border-0 rounded-3xl shadow-2xl z-[110]">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-800">
            Confirme os Dados da Proposta
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Verifique os dados abaixo antes de gerar a proposta para o lead.
          </p>
        </DialogHeader>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {proposals.map((p, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Proposta</span>
                <span className="text-sm font-bold text-primary">{p.title || 'Sem título'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Valor</span>
                <span className="text-base font-black text-secondary">{formatCurrency(p.value) || 'R$ 0,00'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Especialista</span>
                <span className="text-sm font-medium text-slate-700">
                  {specialists.find(s => s.id.toString() === p.specialist)?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Closer</span>
                <span className="text-sm font-medium text-slate-700">
                  {closers.find(c => c.id.toString() === p.salesperson)?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-xs font-bold text-slate-400 uppercase">SDR</span>
                <span className="text-sm font-medium text-slate-700">
                  {sdrs.find(s => s.id.toString() === p.sdr)?.name || '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="p-6 border-t border-slate-100 bg-white">
          <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="rounded-xl">
            Revisar Dados
          </Button>
          <Button 
            onClick={() => {
              handleSaveProposal();
            }}
            disabled={isSaving}
            className="bg-secondary hover:bg-secondary/90 text-white rounded-xl gap-2 font-bold px-6">
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              'Confirmar e Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
