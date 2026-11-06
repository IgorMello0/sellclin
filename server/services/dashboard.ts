import type { Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { ZodError } from 'zod'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { parseDashboardQuery } from './dashboard-filters.js'
import { boletoGroupBy, getDashboardScope, originKey, paymentStatuses } from './dashboard-scope.js'

export function createDashboardMetricsHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
  try {
    const range = parseDashboardQuery(req.query);
    const { startDate, endDate, period } = range;
    
    const scope = await getDashboardScope(prisma, req.user!, range);
    const { leadWhere, appointmentWhere, proposalWhere, saleWhere, discountWhere,
      hasBillingPermission, finalProspectStages } = scope;

    // 3. Consultas em Paralelo para Performance
    const [
      leadsCount,
      agendamentosConfirmados,
      avaliacoesComparecidas,
      oportunidades,
      faturamentoTotalAgg,
      leadsFechados,
      faturamentoPorMetodo,
      funilStatus,
      origemData,
      faturamentoFechadoAgg,
      totalDiscountAgg,
      fechadosNoFunil,
      leadsQueCompraram
    ] = await Promise.all([
      // 1. Total de Novos Leads (Criados no período)
      prisma.lead.count({ where: leadWhere }),
      
      // 2. Avaliações Agendadas (Para o período selecionado)
      prisma.appointment.count({ 
        where: appointmentWhere
      }),
      
      // 3. Avaliações Comparecidas (Leads que estão em status de comparecimento ou superior)
      prisma.lead.count({ 
        where: scope.attendedWhere
      }),
      
      // 4. Oportunidades (Leads em Proposta ou superior no período)
      prisma.proposal.count({ where: proposalWhere }),
      
      // 5. Faturamento Total (Tudo que foi orçado - Leads em Proposta ou superior - Total histórico ou período)
      prisma.proposal.aggregate({
        _sum: { value: true },
        where: proposalWhere
      }),

      // 6. Total de Vendas Fechadas (Mudaram para status de fechamento no período)
      prisma.sale.count({ where: saleWhere }),

      // 7. Faturamento por Método (Baseado na tabela de Pagamentos - O MAIS PRECISO)
      prisma.payment.groupBy({
        by: ['method', 'status'],
        _sum: { amount: true },
        where: scope.paymentWhere
      }),

      // 8. Situação atual dos leads criados no período selecionado.
      prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true },
        where: scope.leadWhere
      }),

      // 9. Leads por Origem (criados no período selecionado)
      prisma.lead.groupBy({
        by: ['origin'],
        _count: { id: true },
        where: scope.leadWhere
      }),

      // 11. Faturamento Fechado (Valor dos leads que viraram fechamento no periodo)
      prisma.sale.aggregate({ _sum: { amount: true }, where: saleWhere }),
      // 12. Descontos aplicados às vendas confirmadas no período.
      prisma.proposal.aggregate({ _sum: { discountValue: true }, where: discountWhere }),
      prisma.lead.count({ where: scope.funnelClosedWhere }),
      prisma.lead.count({ where: { ...scope.leadWhere, sales: { some: { confirmedAt: { gte: startDate, lt: endDate }, voidedAt: null } } } })
    ]);

    // Cálculo da Receita Real
    // Regra: Boleto (transferencia) no entra na Receita Total nem no Faturamento Total. Carto, Pix e Dinheiro entram sempre (pago ou pendente).
    let faturamentoOrcado = Number(faturamentoTotalAgg._sum.value) || 0;
    let faturamentoFechado = Number(faturamentoFechadoAgg._sum.amount) || 0;
    let totalDiscount = Number(totalDiscountAgg._sum.discountValue) || 0;
    
    // 4. KPIs de Eficiência Matemáticos
    
    // Ticket Orçado: Faturamento (Valor de Proposta) / Oportunidades (Número de Propostas)
    let ticketOrcado = oportunidades > 0 
      ? (faturamentoOrcado / oportunidades) 
      : 0; 
      
    // Ticket Fechado: Receita (Valor Fechado) / Vendas Fechadas (Número de Contratos)
    let ticketFechado = leadsFechados > 0 
      ? (faturamentoFechado / leadsFechados) 
      : 0;
      
    // Taxa de Conversão de Leads: Vendas Fechadas / Total de Leads
    const conversaoLeads = leadsCount > 0 
      ? ((leadsQueCompraram / leadsCount) * 100)
      : 0;

    // Taxa exibida no card: contratos confirmados no período / propostas criadas no período.
    // As bases são independentes, então o resultado pode superar 100% quando propostas antigas fecham agora.
    const conversaoPropostas = oportunidades > 0
      ? ((leadsFechados / oportunidades) * 100)
      : 0;

    // Taxa de Conversao Financeira: Faturamento Fechado / Faturamento Orcado
    let conversaoFinanceira = faturamentoOrcado > 0 
      ? ((faturamentoFechado / faturamentoOrcado) * 100) 
      : 0;

    if (!hasBillingPermission) {
      faturamentoOrcado = 0;
      faturamentoFechado = 0;
      ticketOrcado = 0;
      ticketFechado = 0;
      conversaoFinanceira = 0;
      totalDiscount = 0;
    }

    let parcelamentoMedioBoleto = 0;
    if (hasBillingPermission) {
      // Cálculo do Parcelamento Médio de Boleto:
      // Dividir o número de boletos gerados (método 'transferencia') pelo número de contratos fechados que têm boleto
      const boletosGrouped = await prisma.payment.groupBy({
        by: [...boletoGroupBy],
        where: { ...scope.paymentWhere, method: 'transferencia', status: { in: [...paymentStatuses] } },
        _count: { id: true }
      });

      const totalBoletos = boletosGrouped.reduce((acc, curr) => acc + curr._count.id, 0);
      const uniqueContratosComBoleto = boletosGrouped.length;
      parcelamentoMedioBoleto = uniqueContratosComBoleto > 0 
        ? Number((totalBoletos / uniqueContratosComBoleto).toFixed(1))
        : 0;
    }
      
    // Processamento dos Agrupamentos (Sub-Métricas)
    const metodos = hasBillingPermission ? {
      boleto: {
        gerados: faturamentoPorMetodo.filter(m => m.method === 'transferencia' && paymentStatuses.some(status => status === m.status)).reduce((acc, curr) => acc + (Number(curr._sum.amount) || 0), 0)
        // Removido boleto.pagos conforme solicitado
      },
      cartao: faturamentoPorMetodo.filter(m => m.method === 'cartao' && paymentStatuses.some(status => status === m.status)).reduce((acc, curr) => acc + (Number(curr._sum.amount) || 0), 0),
      pix: faturamentoPorMetodo.filter(m => m.method === 'pix' && paymentStatuses.some(status => status === m.status)).reduce((acc, curr) => acc + (Number(curr._sum.amount) || 0), 0),
      dinheiro: faturamentoPorMetodo.filter(m => m.method === 'dinheiro' && paymentStatuses.some(status => status === m.status)).reduce((acc, curr) => acc + (Number(curr._sum.amount) || 0), 0),
    } : {
      boleto: { gerados: 0, pagos: 0 },
      cartao: 0,
      pix: 0,
      dinheiro: 0
    };

    const totalLeadsGlobal = funilStatus.reduce((acc, curr) => acc + curr._count.id, 0);

    const funil = {
      novos: totalLeadsGlobal, 
      contatados: funilStatus.filter(s => {
        const topStage = finalProspectStages[0] || 'prospect_lead';
        return s.status !== topStage;
      }).reduce((acc, curr) => acc + curr._count.id, 0),
      agendamentos: funilStatus.filter(s => {
        const ignoredStages = finalProspectStages.slice(0, 2);
        if (ignoredStages.length === 0) ignoredStages.push('prospect_lead', 'prospect_qualified');
        return !ignoredStages.includes(s.status);
      }).reduce((acc, curr) => acc + curr._count.id, 0),
      fechados: fechadosNoFunil,
    };

    const origemMap = new Map<string, { origin: string, count: number }>();
    
    origemData.forEach(o => {
      const rawOrigin = (o.origin || '').trim();
      const key = originKey(o.origin);
      const displayOrigin = !rawOrigin || key === 'desconhecido' ? 'Desconhecido' : rawOrigin;
      
      if (origemMap.has(key)) {
        origemMap.get(key)!.count += o._count.id;
      } else {
        origemMap.set(key, { origin: displayOrigin, count: o._count.id });
      }
    });

    const origem = Array.from(origemMap.values()).sort((a, b) => b.count - a.count);
    
    const data = {
      period,
      leads: leadsCount,
      agendamentos: agendamentosConfirmados,
      comparada: avaliacoesComparecidas,
      oportunidades: oportunidades,
      contratos: leadsFechados,
      faturamento: faturamentoOrcado,
      faturamentoFechado: faturamentoFechado,
      totalDiscount,
      ticketOrcado: ticketOrcado,
      ticketFechado: ticketFechado,
      conversao: conversaoLeads.toFixed(1),
      conversaoPropostas: conversaoPropostas.toFixed(1),
      conversaoFinanceira: conversaoFinanceira.toFixed(1),
      parcelamentoMedioBoleto,
      metodos,
      funil,
      origem
    };

    res.json(createSuccessResponse(data));
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json(createErrorResponse('Filtros inválidos. Verifique as datas e os responsáveis selecionados.', 400));
      return;
    }
    console.error('[Dashboard] Erro ao buscar métricas:', error);
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar métricas', 500));
  }
  }
}
