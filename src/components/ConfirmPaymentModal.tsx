import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { leadsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Minus } from 'lucide-react';
import { format, addMonths } from 'date-fns';

interface Proposal {
  id: number;
  title: string;
  value: number;
  status: string;
  createdAt: string;
}

interface PaymentBlock {
  id: string;
  method: string;
  installmentsCount: number;
  totalValue: number;
}

interface ConfirmPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  leadValue: number;
  proposalId?: number | string | null;
  onSuccess: () => void;
}

export function ConfirmPaymentModal({ open, onOpenChange, leadId, leadValue, proposalId, onSuccess }: ConfirmPaymentModalProps) {
  const [paymentBlocks, setPaymentBlocks] = useState<PaymentBlock[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>('none');
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [justification, setJustification] = useState<string>('');
  const { toast } = useToast();
  const allowAction = useActionPermission();

  // Buscar propostas do lead quando o modal abre
  useEffect(() => {
    if (open && leadId) {
      fetchProposals();
    }
    if (!open) {
      setSelectedProposalId('none');
      setProposals([]);
    }
  }, [open, leadId, proposalId]);

  const fetchProposals = async () => {
    if (!leadId) return;
    setLoadingProposals(true);
    try {
      const res = await leadsApi.getProposals(Number(leadId));
      if (res.success && res.data) {
        setProposals(res.data);
        
        if (proposalId) {
          setSelectedProposalId(proposalId.toString());
        } else {
          const validProposals = res.data.filter((p: Proposal) => p.status !== 'rejected' && p.status !== 'lost');
          if (validProposals.length === 1) {
            setSelectedProposalId(validProposals[0].id.toString());
          } else if (res.data.length === 1) {
            setSelectedProposalId(res.data[0].id.toString());
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar propostas:', e);
    } finally {
      setLoadingProposals(false);
    }
  };

  const getOriginalValue = () => {
    const selectedProposal = proposals.find(p => p.id.toString() === selectedProposalId);
    return selectedProposal ? Number(selectedProposal.value) : leadValue;
  };

  const getActiveValue = () => {
    return Math.max(0, getOriginalValue() - discountValue);
  };

  // Inicializa o primeiro bloco com o valor total
  useEffect(() => {
    if (open) {
      const activeValue = getActiveValue();
      setPaymentBlocks([{
        id: Date.now().toString(),
        method: 'cartao',
        installmentsCount: 1,
        totalValue: activeValue
      }]);
    }
  }, [open, selectedProposalId, leadValue, proposals, discountValue]);

  // Recalcular detalhamento das parcelas sempre que os blocos mudarem
  useEffect(() => {
    if (!open) return;
    
    let newInstallments: any[] = [];
    const today = new Date();

    paymentBlocks.forEach(block => {
      const count = block.installmentsCount || 1;
      const valuePerInstallment = block.totalValue / count;
      
      for (let i = 0; i < count; i++) {
        const isBoleto = block.method === 'boleto';
        const monthsToAdd = isBoleto ? i + 1 : i;
        newInstallments.push({
          blockId: block.id,
          installmentNumber: i + 1,
          amount: valuePerInstallment,
          date: format(addMonths(today, monthsToAdd), 'yyyy-MM-dd'),
          method: block.method,
          status: isBoleto ? 'pendente' : 'pago'
        });
      }
    });

    setInstallments(newInstallments);
  }, [paymentBlocks, open]);

  const handleBlockChange = (id: string, field: string, value: any) => {
    setPaymentBlocks(prev => prev.map(block => {
      if (block.id === id) {
        return { ...block, [field]: value };
      }
      return block;
    }));
  };

  const handleAddBlock = () => {
    setPaymentBlocks(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        method: 'pix',
        installmentsCount: 1,
        totalValue: 0
      }
    ]);
  };

  const handleRemoveBlock = (id: string) => {
    if (paymentBlocks.length === 1) return;
    setPaymentBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleInstallmentChange = (index: number, field: string, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    
    // Cascading date changes
    if (field === 'date') {
      const changedInstallment = updated[index];
      const dateParts = String(value).split('-');
      if (dateParts.length === 3) {
        const newDay = dateParts[2];
        for (let i = index + 1; i < updated.length; i++) {
          if (updated[i].blockId === changedInstallment.blockId && updated[i].method === 'transferencia') {
            const currentParts = updated[i].date?.split('-');
            if (currentParts && currentParts.length === 3) {
              // Note: date-fns addMonths handles month overflow, but we just want to update the day of the month here
              // However, if a month doesn't have that day (e.g. Feb 30), it will render an invalid date in native input, but browser corrects it or rejects.
              updated[i] = { ...updated[i], date: `${currentParts[0]}-${currentParts[1]}-${newDay}` };
            }
          }
        }
      }
    }

    setInstallments(updated);
  };

  const handleCurrencyChange = (value: string, callback: (numericValue: number) => void) => {
    const digits = value.replace(/\D/g, '');
    const numericValue = digits ? Number(digits) / 100 : 0;
    callback(numericValue);
  };

  const handleSubmit = async () => {
    if (!allowAction('funnel', 'aprovarPropostas')) return;
    if (!leadId) return;

    const activeValue = getActiveValue();
    const blocksTotal = paymentBlocks.reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);
    
    // Validar se a soma dos blocos bate
    if (Math.abs(blocksTotal - activeValue) > 0.1) {
      toast({
        title: "Soma Incorreta",
        description: `A soma das formas de pagamento (R$ ${blocksTotal.toFixed(2)}) deve ser exatamente igual ao valor cobrado (R$ ${activeValue.toFixed(2)}).`,
        variant: "destructive"
      });
      return;
    }

    // Validar se a soma das parcelas bate (caso o usuario edite os inputs de detalhamento)
    const totalInput = installments.reduce((acc, curr) => acc + Number(curr.amount), 0);
    if (Math.abs(totalInput - activeValue) > 0.1) {
      toast({
        title: "Valores das parcelas divergentes",
        description: `A soma das parcelas manuais (R$ ${totalInput.toFixed(2)}) não bate com o valor (R$ ${activeValue.toFixed(2)}).`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const originalValue = getOriginalValue();
      const payload = {
        proposalId: selectedProposalId !== 'none' ? Number(selectedProposalId) : null,
        discountValue: discountValue,
        discountPercentage: originalValue > 0 ? Number(((discountValue / originalValue) * 100).toFixed(2)) : 0,
        justification: justification,
        payments: installments.map(i => ({
          amount: Number(i.amount),
          date: new Date(i.date).toISOString(),
          method: i.method,
          status: i.status
        }))
      };

      const res = await leadsApi.confirmPayment(Number(leadId), payload);
      
      if (res.success) {
        toast({
          title: "Pagamento Confirmado! 💰",
          description: selectedProposalId !== 'none' 
            ? "Pagamento registrado e proposta marcada como aceita." 
            : "Os dados foram enviados para o dossiê do cliente.",
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({ title: "Erro", description: res.error?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao confirmar pagamento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activeValue = getActiveValue();
  const blocksTotal = paymentBlocks.reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white border-0 shadow-2xl rounded-3xl p-0 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-start gap-4 bg-white shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[24px]">payments</span>
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-800 font-headline">
              Confirmar Recebimento
            </DialogTitle>
            <p className="text-slate-500 text-sm mt-1">
              Defina as formas de pagamento e as parcelas para o valor de <strong className="text-emerald-600">R$ {activeValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6 bg-slate-50/30 flex-1 overflow-y-auto custom-scrollbar">
          {/* Seletor de Proposta */}
          {proposals.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">description</span>
                Proposta Vinculada
              </Label>
              {loadingProposals ? (
                <div className="h-12 w-full flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm font-medium animate-pulse mt-2">
                  <span className="material-symbols-outlined animate-spin mr-2 text-[18px]">refresh</span>
                  Buscando propostas...
                </div>
              ) : (
                <Select value={selectedProposalId} onValueChange={setSelectedProposalId}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors mt-2">
                    <SelectValue placeholder="Selecione uma proposta...">
                      {selectedProposalId === 'none' 
                        ? 'Nenhuma proposta (usar valor do lead)' 
                        : (() => {
                            const p = proposals.find(p => p.id.toString() === selectedProposalId);
                            return p ? `${p.title} — R$ ${Number(p.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '';
                          })()
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma proposta (usar valor do lead)</SelectItem>
                    {proposals.filter(p => p.status !== 'rejected' && p.status !== 'lost').map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full bg-orange-400`} />
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{p.title}</span>
                          </div>
                          <div className="ml-auto text-right flex flex-col items-end pl-4">
                            <span className="font-bold text-slate-900">R$ {Number(p.value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 mt-0.5">
                              Pendente
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Seção de Desconto */}
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in">
            <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">local_offer</span>
              Desconto
            </Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 relative">
                <Label className="text-[10px] uppercase text-slate-500 font-bold">Valor do Desconto (R$)</Label>
                <span className="absolute left-3 top-8 text-slate-400 font-medium text-sm">R$</span>
                <Input 
                  type="number"
                  value={discountValue === 0 ? '' : discountValue}
                  onChange={e => {
                    let v = Number(e.target.value);
                    if (v < 0) v = 0;
                    const originalValue = getOriginalValue();
                    if (v > originalValue) v = originalValue;
                    setDiscountValue(v);
                  }}
                  className="h-10 text-sm pl-9 bg-slate-50 border-slate-200 font-semibold text-slate-700 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5 relative">
                <Label className="text-[10px] uppercase text-slate-500 font-bold">Porcentagem (%)</Label>
                <Input 
                  type="number"
                  value={getOriginalValue() > 0 && discountValue > 0 ? Number((discountValue / getOriginalValue()) * 100).toFixed(2) : ''}
                  onChange={e => {
                    let p = Number(e.target.value);
                    if (p < 0) p = 0;
                    if (p > 100) p = 100;
                    setDiscountValue((p / 100) * getOriginalValue());
                  }}
                  className="h-10 text-sm bg-slate-50 border-slate-200 font-semibold text-slate-700 focus:bg-white pr-8"
                />
                <span className="absolute right-3 top-8 text-slate-400 font-bold text-sm">%</span>
              </div>
            </div>

            {discountValue > 0 && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10px] uppercase text-slate-500 font-bold">Justificativa (Obrigatória)</Label>
                <textarea 
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all"
                  rows={2}
                  placeholder="Por que este desconto foi concedido?"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                Formas de Pagamento
              </Label>
              <div className="text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                Soma: <strong className={Math.abs(blocksTotal - activeValue) > 0.1 ? "text-red-500" : "text-emerald-600"}>
                  R$ {blocksTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </strong> 
                / R$ {activeValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </div>
            </div>

            <div className="space-y-3">
              {paymentBlocks.map((block, index) => (
                <div key={block.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative animate-in fade-in slide-in-from-bottom-2">
                  
                  {paymentBlocks.length > 1 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pagamento #{index + 1}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemoveBlock(block.id)}
                        className="h-6 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className={`${(block.method === 'cartao' || block.method === 'transferencia') ? 'sm:col-span-4' : 'sm:col-span-7'} space-y-1.5`}>
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Método</Label>
                      <Select 
                        value={block.method} 
                        onValueChange={(val) => { 
                          handleBlockChange(block.id, 'method', val);
                          if(val !== 'cartao' && val !== 'transferencia') {
                            handleBlockChange(block.id, 'installmentsCount', 1);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200">
                          <SelectValue>
                            {block.method === 'cartao' ? 'Cartão de Crédito' : 
                             block.method === 'debito' ? 'Cartão de Débito' : 
                             block.method === 'pix' ? 'PIX' : 
                             block.method === 'dinheiro' ? 'Dinheiro' : 
                             block.method === 'transferencia' ? 'Boleto' : block.method}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                          <SelectItem value="debito">Cartão de Débito</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="transferencia">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(block.method === 'cartao' || block.method === 'transferencia') && (
                      <div className="sm:col-span-3 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold flex items-center justify-between gap-1 w-full">
                          <span>Parcelas</span>
                          <span className="lowercase font-bold text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {block.method === 'transferencia' ? 36 : 24}x
                          </span>
                        </Label>
                        <div className="relative">
                          <input 
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={block.installmentsCount || ''}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                // Allow clearing the input temporarily
                                handleBlockChange(block.id, 'installmentsCount', '');
                                return;
                              }
                              let val = parseInt(e.target.value.replace(/\D/g, ''));
                              if (isNaN(val)) val = 1;
                              const max = block.method === 'transferencia' ? 36 : 24;
                              if (val > max) val = max;
                              handleBlockChange(block.id, 'installmentsCount', val);
                            }}
                            onBlur={(e) => {
                              if (!block.installmentsCount || block.installmentsCount < 1) {
                                handleBlockChange(block.id, 'installmentsCount', 1);
                              }
                            }}
                            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-center font-bold text-slate-700 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none pr-4"
                          />
                          <span className="text-slate-400 font-bold text-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">x</span>
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-5 space-y-1.5">
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Valor Desta Parte (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R$</span>
                        <Input 
                          type="text"
                          value={block.totalValue === 0 ? '' : block.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          onChange={(e) => handleCurrencyChange(e.target.value, (val) => handleBlockChange(block.id, 'totalValue', val))}
                          className="h-10 text-sm pl-9 bg-slate-50 border-slate-200 font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={handleAddBlock}
              variant="outline"
              className="w-full rounded-xl border-dashed border-2 border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 h-12"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Forma de Pagamento (Entrada / Divisão)
            </Button>
          </div>

          <div className="space-y-3 mt-4">
            <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 pl-1">
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              Detalhamento Final das Parcelas
            </Label>
            <div className="space-y-2.5">
              {installments.map((inst, idx) => {
                if (inst.method === 'cartao' && inst.installmentNumber > 1) return null;
                const isGroupedCartao = inst.method === 'cartao';
                const block = paymentBlocks.find(b => b.id === inst.blockId);
                const cartaoText = isGroupedCartao && block ? `CARTÃO ${block.installmentsCount}x` : 'CARTÃO';

                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md">
                    
                    <div className="flex-1 w-full flex items-center gap-2">
                       <div className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded w-16 text-center shrink-0">
                          {inst.method === 'cartao' ? cartaoText : inst.method === 'debito' ? 'DÉBITO' : inst.method === 'transferencia' ? 'BOLETO' : inst.method.toUpperCase()}
                       </div>
                      {inst.method === 'transferencia' ? (
                        <Input 
                          type="date"
                          value={inst.date}
                          onChange={(e) => handleInstallmentChange(idx, 'date', e.target.value)}
                          className="h-10 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors w-full"
                        />
                      ) : (
                         <div className="h-10 text-sm bg-slate-50 border-slate-200 w-full rounded-md flex items-center px-3 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                           Pagamento Imediato
                         </div>
                      )}
                    </div>
                    
                    <div className="flex-1 relative w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                      <Input 
                        type="text"
                        value={isGroupedCartao && block ? block.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : (inst.amount ? Number(inst.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '')}
                        disabled={isGroupedCartao}
                        onChange={(e) => handleCurrencyChange(e.target.value, (val) => handleInstallmentChange(idx, 'amount', val))}
                        className="h-10 text-sm pl-9 bg-slate-50 border-slate-200 font-semibold text-slate-700 focus:bg-white transition-colors disabled:opacity-70"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-5 bg-white border-t border-slate-200 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] z-10">
            <div className="text-sm font-medium text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto text-center sm:text-left">
              Total Final: <span className={Math.abs(installments.reduce((acc, curr) => acc + Number(curr.amount), 0) - activeValue) > 0.1 ? "text-red-500 font-bold ml-1" : "text-emerald-600 font-extrabold text-base ml-1"}>
                R$ {installments.reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </span>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 border-0 shadow-lg shadow-emerald-500/20 text-white flex-1 sm:flex-none h-10 px-6 transition-all hover:scale-[1.02]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="material-symbols-outlined text-[18px] mr-1.5">check_circle</span>}
                Confirmar
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
import { useActionPermission } from '@/hooks/use-action-permission';
