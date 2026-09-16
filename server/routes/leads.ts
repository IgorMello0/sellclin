import { createLeadProposals, proposalInput, validateProposalTeam } from '../services/funnel-proposals.js'
import { leadVisibility } from '../services/funnel-access.js'
import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { logAudit } from '../utils/audit.js'
import { assertLeadBelongsToCompany, assertUserBelongsToCompany } from '../services/tenant.js'
import { triggerCadenceForLead } from '../services/cadence.js'

export const router = Router()
router.use(auth(), requireModule('funnel'))

const PAYMENT_METHOD_ALIASES: Record<string, 'pix' | 'cartao' | 'dinheiro' | 'transferencia'> = {
  pix: 'pix',
  cartao: 'cartao',
  credito: 'cartao',
  debito: 'cartao',
  dinheiro: 'dinheiro',
  transferencia: 'transferencia',
  boleto: 'transferencia',
}

const PAYMENT_STATUS_ALIASES: Record<string, 'pago' | 'pendente' | 'atrasado' | 'cancelado'> = {
  pago: 'pago',
  paid: 'pago',
  pendente: 'pendente',
  pending: 'pendente',
  atrasado: 'atrasado',
  overdue: 'atrasado',
  cancelado: 'cancelado',
  canceled: 'cancelado',
  cancelled: 'cancelado',
}

async function assertLeadAccess(leadId: number, reqUser: any) {
  const companyId = reqUser?.companyId;
  if (!companyId) return { error: true, status: 403, message: 'Clínica não identificada' };
  const visibility = await leadVisibility(prisma, reqUser, companyId);
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id: leadId }, visibility] } });
  if (!lead) return { error: true, status: 404, message: 'Lead não encontrado ou acesso negado' };
  return { error: false, lead };
}

// Listar todos os leads
router.get('/', auth(), async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query)
    const { search, status, professionalId, cadenceSort } = req.query as any
    let companyId = req.user?.companyId;

    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      });
      companyId = prof?.companyId || undefined;
    }

    if (!companyId) {
      return res.status(400).json(createErrorResponse('ClÃ­nica nÃ£o identificada.', 400));
    }

    const where: any = { AND: [await leadVisibility(prisma, req.user, companyId)] };

    if (search) {
      const searchStr = String(search);
      const numericSearch = searchStr.replace(/\D/g, '');

      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { phone: { contains: searchStr, mode: 'insensitive' } }
      ]

      if (numericSearch.length > 0) {
        where.OR.push({ phone: { contains: numericSearch } });
      }
    }
    if (status) {
      where.status = status
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        include: {
          activities: { orderBy: { createdAt: 'asc' } },
          proposals: { orderBy: { createdAt: 'desc' }, include: { specialist: true, salesperson: true, sdr: true } },
          appointments: { orderBy: { startTime: 'desc' }, take: 1 },
          tasks: { where: { status: 'pending', cadenceStageCode: { not: null } }, orderBy: { dueDate: 'asc' }, take: 1 }
        },
        orderBy: cadenceSort === 'asc' ? [{ contactCount: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }] : [{ id: 'asc' }]
      }),
      prisma.lead.count({ where })
    ])
    res.json(createSuccessResponse(items, { page, pageSize, total }))
  } catch (error: any) {
    console.error('[Leads] Erro ao buscar leads:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar leads', 500))
  }
})

// Buscar lead por ID
router.get('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const item = await prisma.lead.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'asc' } },
        proposals: { orderBy: { createdAt: 'desc' }, include: { specialist: true, salesperson: true, sdr: true } },
        tasks: { where: { status: 'pending', cadenceStageCode: { not: null } }, orderBy: { dueDate: 'asc' }, take: 1 }
      }
    })
    if (!item) return res.status(404).json(createErrorResponse('Lead nÃ£o encontrado', 404))

    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    res.json(createSuccessResponse(item))
  } catch (error: any) {
    console.error('[Leads] Erro ao buscar lead:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar lead', 500))
  }
})

// Criar novo lead
router.post('/', auth(), async (req, res) => {
  try {
    let { name, value, origin, status, avatar, phone, email, notes, responsible, tags, sdrId: requestedSdrId, closerId: requestedCloserId, especialistaId: requestedEspecialistaId } = req.body

    if (!name) {
      return res.status(400).json(createErrorResponse('O nome Ã© obrigatÃ³rio', 400))
    }

    if (phone) {
      phone = String(phone).replace(/\D/g, '');
    }

    let professionalId: number;
    let companyId = req.user?.companyId || null;

    if (req.user?.type === 'profissional') {
      professionalId = req.user.id;
      if (!companyId) {
        const professional = await prisma.professional.findUnique({
          where: { id: req.user.id },
          select: { companyId: true },
        });
        companyId = professional?.companyId || null;
      }
    } else if (req.user?.type === 'usuario') {
      // Buscar o dono da empresa do usuÃ¡rio
      const empresa = await prisma.empresa.findUnique({
        where: { id: req.user.companyId! },
        select: { ownerId: true }
      });

      if (!empresa || !empresa.ownerId) {
        return res.status(400).json(createErrorResponse('Empresa ou Profissional responsÃ¡vel nÃ£o encontrado', 400));
      }
      professionalId = empresa.ownerId;
    } else {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }

    let sdrId: number | undefined = undefined;
    let closerId: number | undefined = requestedCloserId ? Number(requestedCloserId) : undefined;
    let especialistaId: number | undefined = requestedEspecialistaId ? Number(requestedEspecialistaId) : undefined;

    // Se a interface enviar o SDR (pode ser um ID numÃ©rico, null para forÃ§ar nenhum, ou undefined/'random')
    if (requestedSdrId === 'random') {
      sdrId = undefined; // ForÃ§a a roleta
    } else if (requestedSdrId !== undefined) {
      sdrId = requestedSdrId === null ? undefined : Number(requestedSdrId);
    }

    if (sdrId) await assertUserBelongsToCompany(sdrId, companyId)

    // Verificar se o criador do lead Ã© SDR ou Closer e o SDR nÃ£o foi explicitamente definido no request
    if (req.user?.type === 'usuario' && req.user?.id) {
      const criador = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        include: { role: true }
      });
      if (criador?.role) {
        const isSdrPuro = criador.role.isSDR && !criador.role.isAdmin && !criador.role.isManager;

        if (isSdrPuro) {
          sdrId = req.user.id; // SDR puro nÃ£o pode delegar, sempre vai para ele
        } else if (criador.role.isSDR && requestedSdrId === undefined) {
          sdrId = req.user.id; // Para quem tambÃ©m Ã© admin, mas nÃ£o enviou sdrId
        }

        if (criador.role.isCloser) closerId = req.user.id;
      }
    }

    // Roteamento AutomÃ¡tico de SDRs (apenas se quem criou NÃƒO for um SDR)
    if (!sdrId && companyId) {
      const empresa = await prisma.empresa.findUnique({
        where: { id: companyId },
        select: { leadRoutingMode: true }
      });

      if (empresa && empresa.leadRoutingMode !== 'manual') {
        const sdrs = await prisma.usuario.findMany({
          where: {
            companyId,
            isActive: true,
            role: { isSDR: true }
          },
          select: { id: true, leadRoutingWeight: true }
        });

        if (sdrs.length > 0) {
          if (empresa.leadRoutingMode === 'automatic_equal') {
            // DistribuiÃ§Ã£o uniforme (Roleta randomizada)
            const randomIndex = Math.floor(Math.random() * sdrs.length);
            sdrId = sdrs[randomIndex].id;
          } else if (empresa.leadRoutingMode === 'semi_automatic') {
            // DistribuiÃ§Ã£o ponderada (Pesos customizados)
            const totalWeight = sdrs.reduce((acc, sdr) => acc + (sdr.leadRoutingWeight || 1), 0);
            let random = Math.random() * totalWeight;
            for (const sdr of sdrs) {
              random -= (sdr.leadRoutingWeight || 1);
              if (random <= 0) {
                sdrId = sdr.id;
                break;
              }
            }
            if (!sdrId) sdrId = sdrs[sdrs.length - 1].id;
          }
        }
      }
    }

    if (phone) {
      const existingLead = await prisma.lead.findFirst({
        where: { phone, companyId },
        select: { id: true, name: true },
      });

      if (existingLead) {
        return res.status(409).json(createErrorResponse(
          `Este telefone ja pertence ao lead ${existingLead.name} (ID ${existingLead.id}).`,
          409
        ));
      }
    }

    const created = await prisma.lead.create({
      data: {
        professionalId,
        companyId,
        sdrId,
        closerId,
        especialistaId,
        name,
        value: Number(value) || 0,
        origin,
        status,
        avatar,
        phone,
        email,
        notes,
        responsible,
        tags: tags || []
      }
    })

    if (sdrId) {
      const assignedSdr = await prisma.usuario.findUnique({ where: { id: sdrId }, select: { name: true }});
      if (assignedSdr) {
        let actCreator = 'Sistema';
        if (req.user?.type === 'usuario') {
          const u = await prisma.usuario.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (u) actCreator = u.name;
        } else if (req.user?.type === 'profissional') {
          const p = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (p) actCreator = p.name;
        }

        await prisma.leadActivity.create({
          data: {
            leadId: created.id,
            type: 'system',
            content: `O lead foi atribuído para o SDR ${assignedSdr.name}.`,
            createdBy: actCreator
          }
        });
      }
    }

    // Disparar cadência ao criar o lead (se a etapa atual tiver uma configurada)
    await triggerCadenceForLead(created.id, created.companyId!, created.status, created.sdrId || created.closerId, created.professionalId).catch(console.error);

    logAudit(req.user, 'CRIAR_LEAD', 'Lead', created.id)

    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    console.error('[Leads] Erro ao criar lead:', error)
    if (error.code === 'P2002') {
      return res.status(400).json(createErrorResponse('JÃ¡ existe um lead com este nÃºmero de telefone nesta clÃ­nica.', 400))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar lead', 500))
  }
})

// Importar Leads (Batch)
router.post('/import', auth(), async (req, res) => {
  try {
    const { leads, defaultSdrId, defaultCloserId, defaultStage } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json(createErrorResponse('Formato inválido. Esperado um array de leads.', 400));
    }

    let currentCompanyId = req.user?.companyId;
    if (req.user?.type === 'profissional') {
      const p = await prisma.professional.findUnique({ where: { id: req.user.id }});
      currentCompanyId = p?.companyId;
    }

    if (!currentCompanyId) {
       return res.status(403).json(createErrorResponse('CompanyId não encontrado.', 403));
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const leadData of leads) {
      if (!leadData.name) continue;

      const cleanPhone = leadData.phone ? String(leadData.phone).replace(/\D/g, '') : null;

      let existingLead = null;
      if (cleanPhone) {
        existingLead = await prisma.lead.findFirst({
          where: { phone: cleanPhone, companyId: currentCompanyId }
        });
      }

      if (existingLead) {
        const extraNote = leadData.notes ? `\n[Importação]: ${leadData.notes}` : '\n[Importação]: Atualizado via importação de planilha.';
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
             notes: existingLead.notes ? existingLead.notes + extraNote : extraNote.trim(),
             activities: {
                create: { type: 'sistema', content: 'Lead atualizado via importação de planilha.', createdBy: 'Sistema' }
             }
          }
        });
        updatedCount++;
      } else {
        await prisma.lead.create({
          data: {
            name: leadData.name,
            phone: cleanPhone,
            email: leadData.email || null,
            value: leadData.value ? Number(leadData.value) : 0,
            origin: leadData.origin || 'Importação Manual',
            notes: leadData.notes || null,
            status: defaultStage || 'prospect_lead',
            sdrId: defaultSdrId ? Number(defaultSdrId) : null,
            closerId: defaultCloserId ? Number(defaultCloserId) : null,
            companyId: currentCompanyId,
            professionalId: req.user.id
          }
        });
        createdCount++;
      }
    }

    res.status(200).json(createSuccessResponse({ createdCount, updatedCount }));
  } catch (error: any) {
    console.error('[Leads] Erro ao importar leads:', error);
    res.status(500).json(createErrorResponse(error.message || 'Erro ao importar leads', 500));
  }
});

// Adicionar Atividade ao Lead
router.post('/:id/activities', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    const { type, content, createdBy } = req.body

    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        type,
        content,
        createdBy
      }
    })

    res.status(201).json(createSuccessResponse(activity))
  } catch (error: any) {
    console.error('[Leads] Erro ao criar atividade:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar atividade', 500))
  }
})

// Atualizar Atividade do Lead
router.put('/:id/activities/:activityId', auth(), async (req, res) => {
  try {
    const activityId = Number(req.params.activityId)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    const { content } = req.body

    const updated = await prisma.leadActivity.update({
      where: { id: activityId },
      data: { content }
    })

    res.json(createSuccessResponse(updated))
  } catch (error: any) {
    console.error('[Leads] Erro ao atualizar atividade:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar atividade', 500))
  }
})

// Deletar Atividade do Lead
router.delete('/:id/activities/:activityId', auth(), async (req, res) => {
  try {
    const activityId = Number(req.params.activityId)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    await prisma.leadActivity.delete({
      where: { id: activityId }
    })
    res.json(createSuccessResponse({ id: activityId }))
  } catch (error: any) {
    console.error('[Leads] Erro ao deletar atividade:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar atividade', 500))
  }
})

// Listar Propostas do Lead
router.get('/:id/proposals', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const proposals = await prisma.proposal.findMany({
      where: { leadId: id },
      include: {
        specialist: true,
        salesperson: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(createSuccessResponse(proposals))
  } catch (error: any) {
    console.error('[Leads] Erro ao buscar propostas:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar propostas', 500))
  }
})

// A batch is committed in full; failed attempts never leave half-created proposals.
router.post('/:id/proposals/batch', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const proposals = await createLeadProposals(prisma, id, req.body.proposals, String(req.user!.id));
    if (['prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended'].includes(access.lead!.status)) {
      await triggerCadenceForLead(id, access.lead!.companyId!, 'comercial_proposal', access.lead!.sdrId || access.lead!.closerId, access.lead!.professionalId).catch(console.error);
    }
    res.status(201).json(createSuccessResponse(proposals));
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao salvar propostas', 400));
  }
});

router.post('/:id/proposals', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const proposals = await createLeadProposals(prisma, id, [req.body], String(req.user!.id));
    res.status(201).json(createSuccessResponse(proposals[0]));
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao salvar proposta', 400));
  }
});

// Atualizar Proposta do Lead
router.put('/:id/proposals/:proposalId', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    const proposalId = Number(req.params.proposalId)
    const { title, value, validUntil, salespersonId, specialistId, sdrId, tags, justification, discountApplied, stage, status } = req.body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (value !== undefined) updateData.value = Number(value) || 0
    if (validUntil !== undefined) updateData.validUntil = new Date(validUntil)
    if (salespersonId !== undefined) updateData.salespersonId = salespersonId ? Number(salespersonId) : null
    if (specialistId !== undefined) updateData.specialistId = specialistId ? Number(specialistId) : null
    if (sdrId !== undefined) updateData.sdrId = sdrId ? Number(sdrId) : null
    if (tags !== undefined) updateData.tags = tags
    if (justification !== undefined) updateData.justification = justification
    if (discountApplied !== undefined) updateData.discountApplied = Boolean(discountApplied)
    if (stage !== undefined || status !== undefined) {
      updateData.status = stage || status
    }

    proposalInput.partial().parse(updateData);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${id} FOR UPDATE`;
      await validateProposalTeam(tx, _companyId!, updateData);
      const proposal = await tx.proposal.update({
        where: { id: proposalId, leadId: id },
        data: updateData
      })

      if (value !== undefined || sdrId !== undefined || salespersonId !== undefined) {
        const leadUpdateData: any = {};
        if (value !== undefined) leadUpdateData.value = Number(value) || 0;
        if (sdrId !== undefined) leadUpdateData.sdrId = sdrId ? Number(sdrId) : null;
        if (salespersonId !== undefined) leadUpdateData.closerId = salespersonId ? Number(salespersonId) : null;

        if (Object.keys(leadUpdateData).length > 0) {
          await tx.lead.update({
            where: { id },
            data: leadUpdateData
          })
        }
      }

      return proposal;
    });
    res.json(createSuccessResponse(result))
  } catch (error: any) {
    console.error('[Leads] Erro ao atualizar proposta:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar proposta', 500))
  }
})


// Atualizar lead
router.put('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));

    const data = req.body

    // Map snake_case to camelCase if needed for Prisma
    const editableFields = ['name', 'value', 'origin', 'avatar', 'status', 'phone', 'email', 'responsible', 'isScheduled', 'is_scheduled', 'tags', 'contactCount', 'discountApplied', 'discount_applied', 'justification', 'remarketingProposals', 'remarketing_proposals', 'isPaid', 'notes', 'subStatus', 'sdrId', 'closerId', 'especialistaId'];
    const prismaData: any = Object.fromEntries(Object.entries(data).filter(([key]) => editableFields.includes(key)));

    if (data.especialistaId !== undefined) {
      prismaData.especialistaId = data.especialistaId === null ? null : Number(data.especialistaId);
    }
    if (prismaData.phone) {
      prismaData.phone = String(prismaData.phone).replace(/\D/g, '');
    }
    if (data.is_scheduled !== undefined) {
      prismaData.isScheduled = Boolean(data.is_scheduled)
      delete prismaData.is_scheduled
    }
    if (data.value !== undefined) prismaData.value = Number(data.value)
    if (data.isPaid !== undefined) {
      prismaData.isPaid = Boolean(data.isPaid)
    }
    if (data.discount_applied !== undefined) {
      prismaData.discountApplied = Boolean(data.discount_applied)
      delete prismaData.discount_applied
    }
    if (data.remarketing_proposals !== undefined) {
      prismaData.remarketingProposals = data.remarketing_proposals
      delete prismaData.remarketing_proposals
    }

    for (const key of ['sdrId', 'closerId', 'especialistaId']) {
      if (prismaData[key] != null) {
        prismaData[key] = Number(prismaData[key]);
        await assertUserBelongsToCompany(prismaData[key], access.lead!.companyId);
      }
    }
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${id} FOR UPDATE`;
      // Buscar lead atual para verificar se jÃ¡ foi convertido
      const currentLead = await tx.lead.findUnique({ where: { id } })
      if (!currentLead) {
        throw Object.assign(new Error('Lead não encontrado'), { code: 'P2025' });
      }

      if (data.proposalId !== undefined) {
        if (!['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(prismaData.status)) throw new Error('Selecione uma etapa de fechamento.');
        const proposal = await tx.proposal.update({ where: { id: Number(data.proposalId), leadId: id }, data: { status: 'accepted' } });
        prismaData.value = proposal.value;
      }

      // Regra de Negócio: Cancelamento/Rollback automático ao voltar estágio
      if (prismaData.status && prismaData.status !== currentLead.status) {
        const newStatus = prismaData.status;

        let userName = 'Sistema';
        if (req.user?.type === 'usuario') {
          const u = await tx.usuario.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (u) userName = u.name;
        } else if (req.user?.type === 'profissional') {
          const p = await tx.professional.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (p) userName = p.name;
        }

        const getStageLabel = (s: string) => {
          const map: any = { 'prospect_lead': 'Novos Leads', 'prospect_qualified': 'Qualificados', 'prospect_scheduled': 'Agendados', 'prospect_attended': 'Consulta Feita', 'comercial_lead': 'Novos Leads', 'comercial_consult': 'Avaliação', 'comercial_proposal': 'Proposta', 'comercial_follow': 'Follow-up', 'comercial_negotiation': 'Negociação', 'comercial_closed': 'Fechado', 'comercial_lost': 'Perdido', 'sales_payment': 'Pagamento Pendente', 'sales_contract': 'Contrato Assinado', 'sales_post': 'Pós-Venda' };
          return map[s] || s;
        };

        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: 'system',
            content: `Estágio alterado de "${getStageLabel(currentLead.status)}" para "${getStageLabel(newStatus)}" por ${userName}.`,
            createdBy: userName
          }
        });

        // TIMESTAMP LOGIC & SUB-STATUS AUTOMATION
        if (['prospect_attended', 'comercial_consult', 'comercial_proposal', 'comercial_follow', 'comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(newStatus)) {
          if (!currentLead.attendedAt) prismaData.attendedAt = new Date();
        }
        if (['comercial_proposal', 'comercial_follow', 'comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(newStatus)) {
          if (!currentLead.proposalAt) prismaData.proposalAt = new Date();
        }
        if (['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(newStatus)) {
          if (!currentLead.closedAt) prismaData.closedAt = new Date();
          // Se avançou para uma etapa de fechamento, marcar automaticamente como Ganho
          prismaData.subStatus = 'won';
        }

        // 1. Se voltou para antes de Agendados (Novos Leads ou Qualificados)
        if (newStatus === 'prospect_lead' || newStatus === 'prospect_qualified') {
          // Cancelar todos os agendamentos ativos/confirmados deste lead
          await tx.appointment.updateMany({
            where: {
              leadId: id,
              status: { in: ['agendado', 'confirmado'] }
            },
            data: { status: 'cancelado' }
          });
          prismaData.isScheduled = false;
        }

        // 2. Se voltou para antes de Proposta (Novos Leads, Qualificados, Agendados, Consulta Feita)
        const beforeProposalStatuses = ['prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended'];
        if (beforeProposalStatuses.includes(newStatus)) {
          // Cancelar todas as propostas pendentes/ativas do lead
          await tx.proposal.updateMany({
            where: {
              leadId: id,
              status: 'pending'
            },
            data: { status: 'rejected' }
          });
        }

        // 3. Se voltou para antes de Fechado (Comercial ou ProspecÃ§Ã£o)
        const beforeClosedStatuses = [
          'prospect_lead', 'prospect_qualified', 'prospect_scheduled',
          'prospect_attended', 'comercial_lead', 'comercial_consult', 'comercial_proposal', 'comercial_follow', 'comercial_negotiation'
        ];
        if (beforeClosedStatuses.includes(newStatus)) {
          // Preserve the existing client when reopening a sale.
          prismaData.closedAt = null;
          if (currentLead.subStatus === 'won') prismaData.subStatus = null;
          prismaData.isPaid = false; // resetar flag de pago
        }
      }

      // ConversÃ£o automÃ¡tica: quando status muda para 'comercial_closed' OU quando hÃ¡ propostas de remarketing (fechamento parcial)
      const isClosing = ['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post'].includes(prismaData.status)
      const isPartialClosing = prismaData.remarketingProposals !== undefined
      const alreadyConverted = !!currentLead.convertedToClientId

      if ((isClosing || isPartialClosing) && !alreadyConverted) {
        // Criar cliente automaticamente a partir dos dados do lead
        const newClient = await tx.client.create({
          data: {
            professionalId: currentLead.professionalId,
            companyId: currentLead.companyId,
            name: currentLead.name,
            email: currentLead.email || null,
            phone: currentLead.phone || null,
            notes: currentLead.notes || null,
            avatar: currentLead.avatar || null,
          }
        })

        // Atualizar lead com referÃªncia ao cliente criado
        prismaData.convertedToClientId = newClient.id
        prismaData.convertedAt = new Date()


        const updated = await tx.lead.update({
          where: { id },
          data: prismaData
        })



        return {
          ...updated,
          converted: true,
          convertedClient: newClient
        };
      }

      const updated = await tx.lead.update({
        where: { id },
        data: prismaData
      })



      return updated;
    });
    if (prismaData.status && prismaData.status !== access.lead!.status) {
      await triggerCadenceForLead(id, result.companyId!, result.status, result.sdrId || result.closerId, result.professionalId).catch(console.error);
    }
    if (req.user?.type === 'profissional') logAudit(req.user.id, 'ATUALIZAR_LEAD', 'Lead', id);
    res.json(createSuccessResponse(result));
  } catch (error: any) {
    console.error('[Leads] Erro ao atualizar lead:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Lead nÃ£o encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar lead', 500))
  }
})

// Confirm payment logic
router.post('/:id/confirm-payment', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    const { payments, proposalId, discountValue, discountPercentage, justification } = req.body // Array of { amount, date, method, status } + optional proposalId

    if (Number(discountValue) > 0 || Number(discountPercentage) > 0) {
      if (!justification || justification.trim().length === 0) {
        return res.status(400).json(createErrorResponse('Justificativa Ã© obrigatÃ³ria quando hÃ¡ desconto.', 400));
      }

      // Validate user discount limits
      if (req.user?.type === 'usuario') {
        if (req.user?.role === 'sdr' || req.user?.role === 'closer') {
          const empresa = await prisma.empresa.findUnique({ where: { id: _companyId || _checkEntity.companyId! }, select: { maxDiscountPercentage: true } });
          const maxAllowed = Number(empresa?.maxDiscountPercentage || 0);
          if (Number(discountPercentage) > maxAllowed) {
            return res.status(403).json(createErrorResponse(`Desconto excede o limite autorizado de ${maxAllowed}%. PeÃ§a autorizaÃ§Ã£o.`, 403));
          }
        }
      }
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json(createErrorResponse('Informe ao menos um pagamento.', 400))
    }

    const normalizedPayments = payments.map((payment: any) => ({
      ...payment,
      amount: Number(payment.amount),
      date: new Date(payment.date),
      method: PAYMENT_METHOD_ALIASES[String(payment.method || '').trim().toLowerCase()],
      status: PAYMENT_STATUS_ALIASES[String(payment.status || 'pago').trim().toLowerCase()],
    }))

    const invalidPayment = normalizedPayments.find((payment: any) => (
      !Number.isFinite(payment.amount)
      || payment.amount <= 0
      || !payment.method
      || !payment.status
      || Number.isNaN(payment.date.getTime())
    ))

    if (invalidPayment) {
      return res.status(400).json(createErrorResponse('Pagamento invalido. Confira valor, data e metodo.', 400))
    }

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${id} FOR UPDATE`;
      const lead = await tx.lead.findUnique({ where: { id } })
      if (!lead) throw new Error('Lead não encontrado');

      if (proposalId && !await tx.proposal.findFirst({ where: { id: Number(proposalId), leadId: id } })) {
        throw new Error('Proposta não pertence a este lead.');
      }
      let clientId = lead.convertedToClientId

      // Se o lead ainda nÃ£o foi convertido, criar cliente
      if (!clientId) {
        const newClient = await tx.client.create({
          data: {
            professionalId: lead.professionalId,
            companyId: lead.companyId,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            notes: lead.notes,
            avatar: lead.avatar || null,
          }
        })
        clientId = newClient.id

        await tx.lead.update({
          where: { id },
          data: {
            convertedToClientId: clientId,
            convertedAt: new Date()
          }
        })
      }

      // Criar os pagamentos no banco de dados
      const paymentRecords = []
      for (const p of normalizedPayments) {
        const payment = await tx.payment.create({
          data: {
            clientId: clientId,
            professionalId: lead.professionalId,
            companyId: lead.companyId,
            amount: p.amount,
            date: p.date,
            method: p.method,
            status: p.status || 'pago'
          }
        })
        paymentRecords.push(payment)
      }

      // Se uma proposta foi vinculada, marcar como aceita
      if (proposalId) {
        const updateData: any = { status: 'accepted' };
        if (Number(discountValue) > 0 || Number(discountPercentage) > 0) {
          updateData.discountApplied = true;
          updateData.discountValue = Number(discountValue) || 0;
          updateData.discountPercentage = Number(discountPercentage) || 0;
          updateData.justification = justification;
        }

        await tx.proposal.update({
          where: { id: Number(proposalId), leadId: id },
          data: updateData
        });
      }

      if (Number(discountValue) > 0 || Number(discountPercentage) > 0) {
        let userName = 'UsuÃ¡rio';
        if (req.user?.type === 'usuario') {
          const u = await tx.usuario.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (u) userName = u.name;
        } else if (req.user?.type === 'profissional') {
          const p = await tx.professional.findUnique({ where: { id: req.user.id }, select: { name: true }});
          if (p) userName = p.name;
        }

        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: 'DESCONTO_APLICADO',
            content: `${userName} deu ${Number(discountPercentage)}% (R$ ${Number(discountValue)}) de desconto. Justificativa: ${justification}`,
            createdBy: String(req.user?.id)
          }
        });
      }

      // Atualiza status do Lead para pago e move para o funil pós-venda ou similar se quiser
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          isPaid: true,
          status: 'comercial_closed', // Garantir que não volte pra trás devido a race condition do drag and drop
          closedAt: lead.closedAt || new Date(),
          subStatus: 'won'
        }
      })

      return { payments: paymentRecords, lead: updatedLead };
    });
    res.json(createSuccessResponse(result));
  } catch (error: any) {
    console.error('[Leads] Erro ao confirmar pagamento:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao confirmar pagamento', 500))
  }
})

// Deletar mÃºltiplos leads de uma vez
router.delete('/bulk', auth(), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(createErrorResponse('IDs invÃ¡lidos', 400));
    }

    const numericIds = ids.map((id: any) => Number(id));
    for (const leadId of numericIds) {
      const access = await assertLeadAccess(leadId, req.user);
      if (access.error) return res.status(access.status).json(createErrorResponse(`Acesso negado ao lead ${leadId}`, access.status));
    }

    await prisma.lead.deleteMany({ where: { id: { in: numericIds } } });

    logAudit(req.user!, 'BULK_DELETAR_LEADS', 'Lead', 0);
    res.json(createSuccessResponse({ deleted: numericIds.length }));
  } catch (error: any) {
    console.error('[Leads] Erro ao deletar leads em massa:', error);
    res.status(500).json(createErrorResponse('Erro ao deletar leads', 500));
  }
});

// Atualizar atribuição em lote
router.patch('/bulk-assignment', auth(), async (req, res) => {
  try {
    const { ids, sdrId, closerId, especialistaId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(createErrorResponse('IDs invÃ¡lidos', 400));
    }

    const numericIds = ids.map((id: any) => Number(id));

    let companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { companyId: true } });
      companyId = prof?.companyId || undefined;
    }

    for (const leadId of numericIds) {
      const access = await assertLeadAccess(leadId, req.user);
      if (access.error) return res.status(access.status).json(createErrorResponse(`Acesso negado ao lead ${leadId}`, access.status));
    }

    // Se estÃ¡ atribuindo a SDR, verificar que o SDR pertence Ã  clÃ­nica
    if (sdrId !== undefined && sdrId !== null) {
      const sdr = await prisma.usuario.findUnique({ where: { id: parseInt(sdrId) }, select: { companyId: true } });
      if (!sdr || (companyId && sdr.companyId !== companyId)) {
        return res.status(403).json(createErrorResponse('SDR nÃ£o pertence a esta clÃ­nica', 403));
      }
    }

    // Se estÃ¡ atribuindo a Closer, verificar que o Closer pertence Ã  clÃ­nica
    if (closerId !== undefined && closerId !== null) {
      const closer = await prisma.usuario.findUnique({ where: { id: parseInt(closerId) }, select: { companyId: true } });
      if (!closer || (companyId && closer.companyId !== companyId)) {
        return res.status(403).json(createErrorResponse('Closer nÃ£o pertence a esta clÃ­nica', 403));
      }
    }

    // Se estÃ¡ atribuindo a Especialista, verificar que o Especialista pertence Ã  clÃ­nica
    if (especialistaId !== undefined && especialistaId !== null) {
      const especialista = await prisma.usuario.findUnique({ where: { id: parseInt(especialistaId) }, select: { companyId: true } });
      if (!especialista || (companyId && especialista.companyId !== companyId)) {
        return res.status(403).json(createErrorResponse('Especialista nÃ£o pertence a esta clÃ­nica', 403));
      }
    }

    await prisma.lead.updateMany({
      where: { id: { in: numericIds } },
      data: {
        ...(sdrId !== undefined && { sdrId: sdrId === null ? null : Number(sdrId) }),
        ...(closerId !== undefined && { closerId: closerId === null ? null : Number(closerId) }),
        ...(especialistaId !== undefined && { especialistaId: especialistaId === null ? null : Number(especialistaId) })
      }
    });

    logAudit(req.user!, 'BULK_ATRIBUIR_LEADS', 'Lead', 0);
    res.json(createSuccessResponse({ updated: numericIds.length }));
  } catch (error: any) {
    console.error('[Leads] Erro ao reatribuir leads em massa:', error);
    res.status(500).json(createErrorResponse('Erro ao reatribuir leads', 500));
  }
});


router.delete('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const access = await assertLeadAccess(Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const _checkEntity = access.lead;
    const _companyId = _checkEntity.companyId;

    await prisma.lead.delete({ where: { id } })

    if (req.user?.type === 'profissional') {
      logAudit(req.user.id, 'DELETAR_LEAD', 'Lead', id)
    }

    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    console.error('[Leads] Erro ao deletar lead:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Lead nÃ£o encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar lead', 500))
  }
})

// Atualizar atribuiÃ§Ã£o de equipe (SDR/Closer)
router.patch('/:id/assignment', auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { sdrId, closerId, especialistaId } = req.body;

    const leadId = parseInt(id);
    const access = await assertLeadAccess(leadId, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));
    const lead = access.lead;

    if (sdrId !== undefined && sdrId !== null) {
      await assertUserBelongsToCompany(parseInt(sdrId), req.user?.companyId)
    }
    if (closerId !== undefined && closerId !== null) {
      await assertUserBelongsToCompany(parseInt(closerId), req.user?.companyId)
    }
    if (especialistaId !== undefined && especialistaId !== null) {
      await assertUserBelongsToCompany(parseInt(especialistaId), req.user?.companyId)
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(sdrId !== undefined && { sdrId: sdrId === null ? null : Number(sdrId) }),
        ...(closerId !== undefined && { closerId: closerId === null ? null : Number(closerId) }),
        ...(especialistaId !== undefined && { especialistaId: especialistaId === null ? null : Number(especialistaId) })
      },
      include: {
        sdr: { select: { name: true } },
        closer: { select: { name: true } },
        especialista: { select: { name: true } }
      }
    });

    let userName = 'Sistema';
    if (req.user?.type === 'usuario') {
      const u = await prisma.usuario.findUnique({ where: { id: req.user.id }, select: { name: true }});
      if (u) userName = u.name;
    } else if (req.user?.type === 'profissional') {
      const p = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { name: true }});
      if (p) userName = p.name;
    }

    if (sdrId !== undefined) {
      const parsedSdr = sdrId === null ? null : Number(sdrId);
      if (lead.sdrId !== parsedSdr) {
        const content = parsedSdr === null ? 'SDR responsÃ¡vel removido.' : `O SDR responsÃ¡vel foi alterado para ${updated.sdr?.name || 'outro usuÃ¡rio'}.`;
        await prisma.leadActivity.create({
          data: { leadId: updated.id, type: 'system', content, createdBy: userName }
        });
      }
    }

    if (closerId !== undefined) {
      const parsedCloser = closerId === null ? null : Number(closerId);
      if (lead.closerId !== parsedCloser) {
        const content = parsedCloser === null ? 'Closer responsÃ¡vel removido.' : `O Closer responsÃ¡vel foi alterado para ${updated.closer?.name || 'outro usuÃ¡rio'}.`;
        await prisma.leadActivity.create({
          data: { leadId: updated.id, type: 'system', content, createdBy: userName }
        });
      }
    }

    logAudit(req.user!, 'ATUALIZAR_EQUIPE_LEAD', 'Lead', updated.id);
    res.json(createSuccessResponse(updated));
  } catch (error: any) {
    console.error('[Leads] Erro ao reatribuir equipe:', error);
    res.status(500).json(createErrorResponse('Erro ao reatribuir equipe', 500));
  }
});

// Registrar novo contato na cadência
router.post('/:id/cadence-contact', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const access = await assertLeadAccess(id, req.user);
    if (access.error) return res.status(access.status).json(createErrorResponse(access.message, access.status));

    let userName = 'Sistema';
    if (req.user?.type === 'usuario') {
      const u = await prisma.usuario.findUnique({ where: { id: req.user.id }, select: { name: true }});
      if (u) userName = u.name;
    } else if (req.user?.type === 'profissional') {
      const p = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { name: true }});
      if (p) userName = p.name;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        contactCount: { increment: 1 }
      }
    });

    await prisma.leadActivity.create({
      data: {
        leadId: id,
        type: 'contact',
        content: `Contato de cadência realizado (Contato #${updated.contactCount})`,
        createdBy: userName
      }
    });

    logAudit(req.user!, 'REGISTRAR_CONTATO_CADENCIA', 'Lead', id);
    res.json(createSuccessResponse({ contactCount: updated.contactCount }));
  } catch (error: any) {
    console.error('[Leads] Erro ao registrar contato da cadência:', error);
    res.status(500).json(createErrorResponse('Erro ao registrar contato', 500));
  }
});

