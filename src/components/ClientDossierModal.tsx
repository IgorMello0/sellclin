import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientsApi, paymentsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProposalDialog } from '@/components/funnel/ProposalDialog';

interface ClientDossierModalProps {
  clientId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDossierModal({ clientId, open, onOpenChange }: ClientDossierModalProps) {
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<any>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  
  const [showProposalModal, setShowProposalModal] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && clientId) {
      loadDossier();
    } else {
      setDossier(null);
    }
  }, [open, clientId]);

  const loadDossier = async () => {
    setLoading(true);
    try {
      const response = await clientsApi.getDossier(clientId!);
      if (response.success) {
        setDossier(response.data);
      } else {
        toast({
          title: "Erro",
          description: response.error?.message || "Erro ao carregar dossiê do cliente",
          variant: "destructive",
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Erro ao se conectar com o servidor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [sendingToFunnel, setSendingToFunnel] = useState(false);

  const handleSendToFunnel = async () => {
    if (!clientId) return;
    setSendingToFunnel(true);
    try {
      const response = await clientsApi.sendToFunnel(clientId);
      if (response.success) {
        toast({ title: "Sucesso", description: response.data?.message || "Lead retornado ao funil!" });
      } else {
        toast({ title: "Erro", description: response.error?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao enviar para o funil.", variant: "destructive" });
    } finally {
      setSendingToFunnel(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!dossier?.client?.phone) {
      toast({ title: "Aviso", description: "O cliente não tem telefone cadastrado." });
      return;
    }
    const phone = dossier.client.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const handleSaveNotes = async () => {
    if (!clientId) return;
    setSavingNotes(true);
    try {
      const response = await clientsApi.update(clientId, { notes: notesValue });
      if (response.success) {
        setDossier((prev: any) => ({
          ...prev,
          client: { ...prev.client, notes: notesValue }
        }));
        setIsEditingNotes(false);
        toast({ title: "Sucesso", description: "Notas comerciais salvas." });
      } else {
        toast({ title: "Erro", description: response.error?.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar notas.", variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-[95vw] w-full md:max-w-4xl p-0 border-0 shadow-2xl rounded-none sm:rounded-3xl bg-slate-50 overflow-hidden h-[100vh] sm:h-[85vh] flex flex-col">
        <DialogTitle className="sr-only">Dossiê Comercial do Paciente</DialogTitle>
        
        {loading || !dossier ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-secondary mb-3" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Carregando Dossiê...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 md:p-6 border-b border-slate-100 bg-[#0B1525] relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-transparent pointer-events-none" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 shrink-0">
                    <span className="text-xl md:text-2xl font-bold text-white font-headline">
                      {dossier.client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg md:text-xl font-bold text-white font-headline">
                        {dossier.client.name}
                      </h3>
                      {dossier.stats.ltv > 5000 && (
                        <Badge variant="outline" className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5">
                          <span className="material-symbols-outlined text-[12px] mr-1">star</span> VIP
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-1.5 text-white/70 text-xs">
                      <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">phone</span> {dossier.client.phone || 'Sem número'}</span>
                      <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">mail</span> {dossier.client.email || 'Sem email'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <Button 
                    onClick={handleSendToFunnel}
                    disabled={sendingToFunnel}
                    variant="outline"
                    className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-xl font-bold h-9 px-4 text-xs transition-all"
                  >
                    {sendingToFunnel ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <span className="material-symbols-outlined text-[16px] mr-1.5">arrow_forward</span>}
                    Voltar para o Funil
                  </Button>
                  <Button onClick={handleWhatsAppClick} className="flex-1 md:flex-none bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold h-9 px-4 text-xs shadow-md shadow-[#25D366]/20 border-0 transition-all">
                    <span className="material-symbols-outlined text-[16px] mr-1.5">chat</span> WhatsApp
                  </Button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-slate-50/50">
              
              {/* Commercial Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-secondary/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">LTV (Total Pago)</div>
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-extrabold text-primary font-headline">
                    R$ {dossier.stats.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-2 py-1 rounded-md inline-flex w-fit">
                    <span className="material-symbols-outlined text-[12px] mr-1">trending_up</span> Cliente Comprador
                  </div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-secondary/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tickets Pendentes</div>
                    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                      <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-extrabold text-primary font-headline">
                    R$ {dossier.stats.pendingTickets.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center mt-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex w-fit">
                    Em aberto / A receber
                  </div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-secondary/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ausência</div>
                    <div className="p-1.5 bg-secondary/10 text-secondary rounded-lg">
                      <span className="material-symbols-outlined text-[16px]">update</span>
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-extrabold text-primary font-headline">
                    {dossier.stats.daysSinceLastVisit !== null ? `${dossier.stats.daysSinceLastVisit} Dias` : 'Nenhum'}
                  </div>
                  <div className="flex items-center mt-2 text-[10px] font-bold text-secondary bg-secondary/5 px-2 py-1 rounded-md inline-flex w-fit">
                    <span className="material-symbols-outlined text-[12px] mr-1">notifications_active</span> Tempo sem consultar
                  </div>
                </div>
              </div>

              {/* Layout: Left Content, Right Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left Column: Notes & History */}
                <div className="lg:col-span-2 space-y-5">
                  
                  {/* Gatilhos e Objeções */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-base font-bold text-primary font-headline flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-500 text-[18px]">lightbulb</span>
                        Notas Comerciais & Objeções
                      </h4>
                      {!isEditingNotes ? (
                        <Button onClick={() => { setNotesValue(dossier.client.notes || ''); setIsEditingNotes(true); }} variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold rounded-lg border-slate-200">
                          <span className="material-symbols-outlined text-[14px] mr-1">edit</span> Editar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button onClick={() => setIsEditingNotes(false)} variant="ghost" size="sm" className="h-8 px-3 text-[11px] font-bold rounded-lg text-slate-500">
                            Cancelar
                          </Button>
                          <Button onClick={handleSaveNotes} disabled={savingNotes} size="sm" className="h-8 px-3 text-[11px] font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white border-0">
                            {savingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <span className="material-symbols-outlined text-[14px] mr-1">save</span>}
                            Salvar
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {isEditingNotes ? (
                      <div className="mt-3">
                        <Textarea 
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Digite aqui os gatilhos de venda, objeções e informações importantes sobre a negociação..."
                          className="min-h-[100px] text-sm resize-none focus-visible:ring-orange-500"
                        />
                      </div>
                    ) : (
                      <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50 text-slate-700 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400"></div>
                        <div className="whitespace-pre-line text-xs leading-relaxed">
                          {dossier.client.notes ? (
                            dossier.client.notes
                          ) : (
                            <span className="text-slate-400 italic font-medium">Nenhuma nota comercial registrada para este cliente. Edite para adicionar gatilhos de venda.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Propostas Comerciais */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-base font-bold text-primary font-headline flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[18px]">request_quote</span>
                        Propostas Comerciais
                      </h4>
                      <Button onClick={() => setShowProposalModal(true)} variant="secondary" size="sm" className="h-8 px-3 text-[11px] font-bold rounded-lg shadow-sm hover:-translate-y-0.5 transition-transform">
                        <span className="material-symbols-outlined text-[14px] mr-1">add</span> Nova
                      </Button>
                    </div>
                    
                    {!dossier.proposals || dossier.proposals.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">request_quote</span>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma proposta registrada</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                        {dossier.proposals.map((proposal: any) => (
                          <div key={proposal.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer hover:border-secondary/30 transition-all hover:shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0 shadow-sm">
                                <span className="material-symbols-outlined text-[16px]">request_quote</span>
                              </div>
                              <div>
                                <h5 className="font-bold text-primary text-xs">{proposal.title}</h5>
                                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">calendar_today</span> {new Date(proposal.createdAt).toLocaleDateString('pt-BR')}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded-sm",
                                    (proposal.status === 'accepted' || proposal.status === 'comercial_closed') ? 'bg-emerald-100 text-emerald-700' :
                                    proposal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-orange-100 text-orange-700'
                                  )}>
                                    {(proposal.status === 'accepted' || proposal.status === 'comercial_closed') ? 'Paga' : proposal.status === 'rejected' ? 'Cancelada' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="font-bold text-primary text-xs">
                              R$ {Number(proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Timeline / Next Steps */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h4 className="text-base font-bold text-primary font-headline flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                      Jornada do Cliente
                    </h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent pt-1 pb-4">
                      
                      {dossier.timeline.map((item: any, index: number) => {
                        const isSuggestion = item.type === 'suggestion';
                        const isPayment = item.type === 'payment';
                        
                        return (
                          <div key={item.id} className={cn("relative flex items-start group mb-6", isSuggestion && "is-active")}>
                            {/* Icon Circle */}
                            <div className={cn(
                              "flex flex-col items-center justify-center w-10 h-10 rounded-full border-[3px] border-white shadow-md shrink-0 z-10",
                              isSuggestion ? "bg-secondary text-white" : 
                              isPayment ? "bg-emerald-500 text-white" : 
                              "bg-slate-100 text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors"
                            )}>
                              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                            </div>
                            
                            {/* Content Card */}
                            <div className={cn(
                              "ml-3 w-full p-3 rounded-xl border relative overflow-hidden transition-all",
                              isSuggestion ? "bg-secondary/5 border-secondary/20 shadow-sm" : 
                              "bg-white border-slate-100 group-hover:border-slate-200"
                            )}>
                              {isSuggestion && <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>}
                              
                              <div className={cn("flex items-center justify-between mb-1.5", isSuggestion && "pl-2")}>
                                <span className={cn("text-xs font-bold", isSuggestion ? "text-primary" : "text-slate-700")}>
                                  {item.title}
                                </span>
                                <span className={cn("text-[9px] font-bold uppercase tracking-wider", isSuggestion ? "text-secondary" : "text-slate-400")}>
                                  {new Date(item.date).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <p className={cn("text-[11px] leading-relaxed", isSuggestion ? "text-slate-600 pl-2 font-medium" : "text-slate-500")}>
                                {item.description}
                              </p>
                              
                              {item.isActionable && (
                                <div className="mt-3 pl-2 flex gap-2">
                                  <Button onClick={() => { onOpenChange(false); navigate('/agenda'); }} size="sm" className="h-7 px-3 text-[10px] bg-secondary hover:bg-secondary/90 rounded-md font-bold">
                                    Agendar Agora
                                  </Button>
                                </div>
                              )}
                              

                            </div>
                          </div>
                        );
                      })}
                      
                      {dossier.timeline.length === 0 && (
                        <div className="ml-10 text-xs text-slate-500 italic">
                          Nenhuma interação registrada.
                        </div>
                      )}
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          </>
        )}
      </DialogContent>
      {/* Nova Proposta Modal */}
      {showProposalModal && dossier?.client && (
        <ProposalDialog
          open={showProposalModal}
          onOpenChange={setShowProposalModal}
          lead={{ id: dossier.client.id, name: dossier.client.name, value: 0, tags: [] }}
          professional={dossier.professional || {}}
          services={[]}
          onSuccess={loadDossier}
          targetType="client"
        />
      )}
    </Dialog>
  );
}
