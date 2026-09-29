import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Loader2, Download, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ProposalViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
  lead: any;
  companyInfo?: any;
}

export function ProposalViewer({ open, onOpenChange, proposal, lead, companyInfo }: ProposalViewerProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPDF = () => {
    // Usar a função de impressão nativa que é 100% confiável
    window.print();
  };

  if (!proposal || !lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto p-0 border-0 rounded-3xl bg-slate-100/50 backdrop-blur-xl print:m-0 print:p-0 print:bg-white print:max-h-none print:overflow-visible">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* 1. Configuração de Página */
            @page {
              size: A4;
              margin: 0;
            }

            /* 2. Esconder TUDO de forma radical */
            html, body {
              height: 100%;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: visible !important;
            }

            /* Esconde o root do React e overlays do Dialog */
            #root, 
            [data-radix-portal],
            .no-print {
              display: none !important;
            }

            /* 3. Mostrar APENAS a print-area e forçar no topo */
            [data-radix-portal] {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
            }
            
            /* Esconder o overlay escuro e o botão de fechar do Dialog */
            [data-radix-portal] > div:first-child,
            button[aria-label="Close"] {
              display: none !important;
            }

            .print-area {
              display: flex !important;
              flex-direction: column !important;
              visibility: visible !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 210mm !important;
              height: 297mm !important; /* Travar no tamanho A4 */
              max-height: 297mm !important;
              margin: 0 !important;
              padding: 12mm 15mm !important;
              background: white !important;
              border: none !important;
              box-shadow: none !important;
              z-index: 99999 !important;
              overflow: hidden !important; /* Evitar que qualquer coisa "vaze" para pág 2 */
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .print-area * {
              visibility: visible !important;
            }
          }
        `}} />
        <DialogHeader className="p-6 bg-white border-b sticky top-0 z-10 flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-xl font-bold text-primary font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">description</span>
              Visualização da Proposta
            </DialogTitle>
            <p className="text-xs text-[#64748b] font-medium">Documento gerado em {safeFormatDate(proposal?.createdAt)}</p>
          </div>
          <Button 
            onClick={handleExportPDF} 
            variant="secondary"
            className="rounded-xl font-bold gap-2 shadow-lg shadow-secondary/20 h-11 px-6"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </DialogHeader>

        <div className="p-8 flex justify-center print:p-0">
          {/* Document Content */}
          <div 
            ref={documentRef}
            className="bg-white w-full max-w-[800px] shadow-2xl p-12 rounded-sm min-h-[1000px] flex flex-col text-[#1e293b] font-sans border border-[#f1f5f9] print-area"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-primary/10 pb-8 mb-10">
              <div className="space-y-4">
                <img src="/logo-oficial-v3.png" alt="Logo" className="h-12 w-auto" />
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Proposta Comercial</h1>
                  <p className="text-sm font-bold text-secondary">#{proposal.id || '2024-001'}</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">Emitido por</p>
                <p className="text-sm font-black text-primary uppercase">{companyInfo?.name || "SellClin CRM"}</p>
                <p className="text-[10px] text-[#64748b]">{companyInfo?.address || "Av. Paulista, 1000 - São Paulo, SP"}</p>
                <p className="text-[10px] text-[#64748b]">{companyInfo?.phone || "(11) 99999-9999"}</p>
              </div>
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="space-y-3">
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-[#f1f5f9] pb-2">Dados do Cliente</h3>
                <div className="space-y-1">
                  <p className="text-base font-bold text-[#0f172a]">{lead.name}</p>
                  <p className="text-sm text-[#64748b]">{lead.phone || "Telefone não informado"}</p>
                  <p className="text-sm text-[#64748b]">{lead.email || "E-mail não informado"}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-[#f1f5f9] pb-2">Detalhes da Proposta</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Data de Emissão:</span>
                    <span className="font-bold">{safeFormatDate(proposal?.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Validade:</span>
                    <span className="font-bold text-secondary">
                      {proposal?.validUntil ? safeFormatDate(proposal.validUntil) : "30 dias"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Closer:</span>
                    <span className="font-bold">{proposal.salesperson?.name || proposal.salespersonName || "Não informado"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">SDR:</span>
                    <span className="font-bold">{proposal.sdr?.name || "Não informado"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Profissional:</span>
                    <span className="font-bold">{proposal.specialist?.name || "Não informado"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment / Items */}
            <div className="flex-1 space-y-8">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-[#f1f5f9] pb-2">Tratamento Proposto</h3>
                <div className="bg-[#f8fafc] p-6 rounded-xl border border-[#f1f5f9]">
                  <h4 className="text-lg font-bold text-primary mb-3">{proposal.title || "Plano de Tratamento Personalizado"}</h4>
                  <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">
                    {proposal.treatment || "Nenhum detalhamento do tratamento foi fornecido."}
                  </p>
                </div>
              </div>

              {proposal.tags && proposal.tags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-[#f1f5f9] pb-2">Serviços Inclusos</h3>
                  <div className="flex flex-wrap gap-2">
                    {proposal.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="bg-white border border-[#e2e8f0] text-[#475569] px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {proposal.observations && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-b border-[#f1f5f9] pb-2">Observações Adicionais</h3>
                  <p className="text-sm text-[#64748b] italic leading-relaxed">
                    {proposal.observations}
                  </p>
                </div>
              )}
            </div>

            {/* Summary / Total */}
            <div className="mt-12 pt-8 border-t-2 border-primary/5">
              <div className="bg-primary p-8 rounded-2xl text-white flex justify-between items-center shadow-xl shadow-primary/20">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Investimento Total</p>
                  <p className="text-xs opacity-80">Condições válidas conforme política vigente.</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black font-headline tracking-tighter">
                    {Number(proposal.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {proposal.discountApplied && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mt-1 flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      Desconto Aplicado
                    </p>
                  )}
                  {proposal.status === 'accepted' && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mt-1 flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Proposta Paga
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-[#f1f5f9] text-center space-y-4">
              <p className="text-[10px] text-[#94a3b8] font-medium leading-relaxed max-w-lg mx-auto">
                Este documento é uma proposta comercial e não garante reserva de horários ou valores após a data de validade informada. Sujeito a alteração conforme avaliação clínica.
              </p>
              <div className="flex justify-center items-center gap-6 pt-4">
                <div className="h-[1px] w-20 bg-[#f1f5f9]"></div>
                <img src="/logo-oficial-v3.png" alt="SellClin" className="h-6 opacity-30 grayscale" />
                <div className="h-[1px] w-20 bg-[#f1f5f9]"></div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
