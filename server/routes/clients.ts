import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { logAudit } from '../utils/audit.js'

export const router = Router()
router.use(auth(), actionPermissions('clientes'))

router.get('/', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query)
    let companyId = req.user?.companyId;

    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      });
      companyId = prof?.companyId || undefined;
    }

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Clínica não identificada.', 400));
    }

    const where: any = { companyId: companyId };
    
    const { search, status } = req.query as any

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } }
      ]
    }
    
    // TEMPORARY DEBUG:
    if (req.query.debug === 'true') {
      return res.json({ success: true, debug: { user: req.user, where } });
    }

    if (status === 'inadimplente') {
      where.payments = {
        some: {
          status: { in: ['pendente', 'atrasado'] }
        }
      }
    }

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          professional: true,
          appointments: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true
            }
          }
        }
      }),
      prisma.client.count({ where })
    ])
    res.json(createSuccessResponse(items, { page, pageSize, total }))
  } catch (error: any) {
    console.error('[Clients] Erro ao buscar clientes:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar clientes', 500))
  }
})

router.get('/:id', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    
    let companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      });
      companyId = prof?.companyId || undefined;
    }

    const item = await prisma.client.findUnique({
      where: { id },
      include: {
        professional: true,
        appointments: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true
          }
        }
      }
    })
    
    if (!item) return res.status(404).json(createErrorResponse('Cliente não encontrado', 404))

    if (companyId) {
      if (item.companyId !== companyId) {
        return res.status(403).json(createErrorResponse('Acesso negado', 403))
      }
    } else if (req.user?.id && item.professionalId !== req.user.id) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }

    res.json(createSuccessResponse(item))
  } catch (error: any) {
    console.error('[Clients] Erro ao buscar cliente:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar cliente', 500))
  }
})

router.post('/', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const { name, email, phone, dateOfBirth, document, notes } = req.body
    
    if (!name) {
      return res.status(400).json(createErrorResponse('O nome é obrigatório', 400))
    }

    let professionalId: number;

    if (req.user?.type === 'profissional') {
      professionalId = req.user.id;
    } else if (req.user?.type === 'usuario') {
      // Buscar o dono da empresa do usuário
      const empresa = await prisma.empresa.findUnique({
        where: { id: req.user.companyId! },
        select: { ownerId: true }
      });
      if (!empresa || !empresa.ownerId) {
        return res.status(400).json(createErrorResponse('Empresa ou Profissional responsável não encontrado', 400));
      }
      professionalId = empresa.ownerId;
    } else {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }
    
    const created = await prisma.client.create({
      data: { professionalId, companyId: req.user.companyId, name, email, phone, dateOfBirth, document, notes }
    })
    
    logAudit(req.user, 'CRIAR_CLIENTE', 'Client', created.id)
    
    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    console.error('[Clients] Erro ao criar cliente:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar cliente', 500))
  }
})

router.put('/:id', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const id = Number(req.params.id)

    let _companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !_companyId) {
      const _prof = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { companyId: true } });
      _companyId = _prof?.companyId || undefined;
    }
    const _checkEntity = await prisma.client.findUnique({ where: { id: Number(req.params.id) }, select: { companyId: true, professionalId: true } });
    if (!_checkEntity) return res.status(404).json(createErrorResponse('client não encontrado', 404));
    if (_companyId && _checkEntity.companyId !== _companyId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    } else if (!_companyId && req.user?.id && _checkEntity.professionalId !== req.user.id) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }

    const { professionalId, name, email, phone, dateOfBirth, document, notes } = req.body
    
    const updated = await prisma.client.update({
      where: { id },
      data: { professionalId, name, email, phone, dateOfBirth, document, notes }
    })
    
    if (req.user?.type === 'profissional') {
      logAudit(req.user.id, 'ATUALIZAR_CLIENTE', 'Client', id)
    }
    
    res.json(createSuccessResponse(updated))
  } catch (error: any) {
    console.error('[Clients] Erro ao atualizar cliente:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Cliente não encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar cliente', 500))
  }
})

router.delete('/:id', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const id = Number(req.params.id)

    let _companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !_companyId) {
      const _prof = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { companyId: true } });
      _companyId = _prof?.companyId || undefined;
    }
    const _checkEntity = await prisma.client.findUnique({ where: { id: Number(req.params.id) }, select: { companyId: true, professionalId: true } });
    if (!_checkEntity) return res.status(404).json(createErrorResponse('client não encontrado', 404));
    if (_companyId && _checkEntity.companyId !== _companyId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    } else if (!_companyId && req.user?.id && _checkEntity.professionalId !== req.user.id) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }

    await prisma.client.delete({ where: { id } })
    
    if (req.user?.type === 'profissional') {
      logAudit(req.user.id, 'DELETAR_CLIENTE', 'Client', id)
    }
    
    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    console.error('[Clients] Erro ao deletar cliente:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Cliente não encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar cliente', 500))
  }
})

router.get('/:id/dossier', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    
    let companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({
        where: { id: req.user.id },
        select: { companyId: true }
      });
      companyId = prof?.companyId || undefined;
    }

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        professional: true,
        appointments: {
          orderBy: { startTime: 'desc' },
          include: { service: true }
        },
        payments: {
          orderBy: { date: 'desc' }
        },
        originLead: {
          include: {
            proposals: {
              orderBy: { createdAt: 'desc' },
              include: { specialist: true, salesperson: true, sdr: true }
            }
          }
        }
      }
    })
    
    if (!client) return res.status(404).json(createErrorResponse('Cliente não encontrado', 404))

    if (companyId && client.companyId !== companyId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    } else if (!companyId && req.user?.id && client.professionalId !== req.user.id) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }

    // Calculando LTV (Lifetime Value)
    const ltv = client.payments
      .filter(p => p.status === 'pago')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Calculando Tickets Pendentes
    const pendingTickets = client.payments
      .filter(p => p.status === 'pendente' || p.status === 'atrasado')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Calculando Recorrência (Dias desde a última visita)
    let daysSinceLastVisit = null;
    const pastAppointments = client.appointments.filter(a => new Date(a.startTime) < new Date());
    if (pastAppointments.length > 0) {
      const lastVisit = new Date(pastAppointments[0].startTime);
      const diffTime = Math.abs(new Date().getTime() - lastVisit.getTime());
      daysSinceLastVisit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Montando a Timeline Comercial
    const timeline = [];
    
    // Cadastro
    timeline.push({
      id: `created-${client.id}`,
      type: 'registration',
      title: '1º Cadastro',
      date: client.createdAt,
      description: client.notes ? `Notas iniciais: ${client.notes}` : 'Cliente cadastrado no sistema',
      icon: 'how_to_reg'
    });

        // Propostas Comerciais
    if (client.originLead?.proposals) {
      client.originLead.proposals.forEach((ficha: any) => {
        timeline.push({
          id: `proposal-${ficha.id}`,
          type: 'proposal',
          title: `Proposta Comercial`,
          date: ficha.createdAt,
          description: `Título: ${ficha.title} | Valor: R$ ${Number(ficha.value).toFixed(2).replace('.', ',')}`,
          icon: 'request_quote'
        });
      });
    }

    // Agendamentos (com serviço se tiver)
    client.appointments.forEach(app => {
      timeline.push({
        id: `app-${app.id}`,
        type: 'appointment',
        title: app.service ? `Sessão: ${app.service.name}` : 'Agendamento Clínico',
        date: app.startTime,
        description: `Status: ${app.status}`,
        icon: app.status === 'concluido' ? 'done_all' : 'calendar_today'
      });
    });

    // Pagamentos (Todos os status)
    client.payments.forEach(pay => {
      let icon = 'payments';
      let title = 'Pagamento Realizado';
      
      if (pay.status === 'pendente') {
        icon = 'schedule';
        title = 'Pagamento Pendente';
      } else if (pay.status === 'atrasado') {
        icon = 'warning';
        title = 'Pagamento Atrasado';
      }
      
      timeline.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        title: title,
        date: pay.date,
        description: `Valor: R$ ${Number(pay.amount).toFixed(2).replace('.', ',')} | Status: ${pay.status}`,
        icon: icon,
        rawStatus: pay.status
      });
    });

    // Ordenar timeline do mais recente pro mais antigo
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Sugerir Retorno se faz muito tempo (Ex: > 180 dias)
    if (daysSinceLastVisit && daysSinceLastVisit > 150) {
      timeline.unshift({
        id: `suggestion-return`,
        type: 'suggestion',
        title: 'Retorno Sugerido',
        date: new Date(), // Hoje
        description: `O paciente não vem há ${daysSinceLastVisit} dias. Ligar para agendar revisão ou limpeza.`,
        icon: 'add_task',
        isActionable: true
      });
    } else if (!daysSinceLastVisit && client.appointments.length === 0) {
      timeline.unshift({
        id: `suggestion-first`,
        type: 'suggestion',
        title: 'Primeiro Contato',
        date: new Date(),
        description: 'Paciente cadastrado mas ainda não possui agendamentos. Entrar em contato.',
        icon: 'add_task',
        isActionable: true
      });
    }

    const dossier = {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        createdAt: client.createdAt,
        leadId: client.originLead?.id
      },
      stats: {
        ltv,
        pendingTickets,
        daysSinceLastVisit,
      },
      timeline,
      proposals: client.originLead?.proposals || []
    };

    res.json(createSuccessResponse(dossier))
  } catch (error: any) {
    console.error('[Clients] Erro ao carregar dossiê:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao carregar dossiê', 500))
  }
})

router.post('/:id/proposals', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const clientId = Number(req.params.id)

    let _companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !_companyId) {
      const _prof = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { companyId: true } });
      _companyId = _prof?.companyId || undefined;
    }
    const _checkEntity = await prisma.client.findUnique({ where: { id: Number(req.params.id) }, select: { companyId: true, professionalId: true } });
    if (!_checkEntity) return res.status(404).json(createErrorResponse('client não encontrado', 404));
    if (_companyId && _checkEntity.companyId !== _companyId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    } else if (!_companyId && req.user?.id && _checkEntity.professionalId !== req.user.id) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }

    const { title, value, status, validUntil, salespersonId, specialistId, sdrId, tags, justification, discountApplied } = req.body

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { originLead: true }
    })

    if (!client) {
      return res.status(404).json(createErrorResponse('Cliente não encontrado', 404))
    }

    let leadId = client.originLead?.id

    if (!client.originLead) {
        // Criar um lead base para anexar a proposta
        const newLead = await prisma.lead.create({
          data: {
            professionalId: client.professionalId,
            companyId: client.companyId,
            name: client.name,
            email: client.email,
            phone: client.phone,
            status: 'comercial_proposal',
            convertedToClientId: client.id,
            sdrId: sdrId ? Number(sdrId) : null,
            closerId: salespersonId ? Number(salespersonId) : null,
          }
        })
        leadId = newLead.id
      } else {
        const leadUpdateData: any = {};
        if (sdrId !== undefined) leadUpdateData.sdrId = sdrId ? Number(sdrId) : null;
        if (salespersonId !== undefined) leadUpdateData.closerId = salespersonId ? Number(salespersonId) : null;
        if (Object.keys(leadUpdateData).length > 0) {
           await prisma.lead.update({
             where: { id: client.originLead.id },
             data: leadUpdateData
           });
        }
      }

    const proposal = await prisma.proposal.create({
      data: {
        leadId,
        title: title || 'Nova Proposta',
        value: value || 0,
        status: status || 'pending',
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        salespersonId: salespersonId ? Number(salespersonId) : null,
        specialistId: specialistId ? Number(specialistId) : null,
        sdrId: sdrId ? Number(sdrId) : null,
        tags: tags || [],
        justification,
        discountApplied: Boolean(discountApplied)
      }
    })

    if (req.user) {
      await logAudit(
        req.user,
        `Criou proposta ${proposal.id} para o cliente ${client.id}`,
        'proposals',
        proposal.id
      )
    }

    res.json(createSuccessResponse(proposal))
  } catch (error: any) {
    console.error('[Clients] Erro ao criar proposta:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar proposta', 500))
  }
})


router.post('/:id/send-to-funnel', auth(), requireModule('clientes'), async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    let companyId = req.user?.companyId;
    if (req.user?.type === 'profissional' && !companyId) {
      const prof = await prisma.professional.findUnique({ where: { id: req.user.id }, select: { companyId: true } });
      companyId = prof?.companyId || undefined;
    }
    
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { originLead: true }
    });
    
    if (!client) {
      return res.status(404).json(createErrorResponse('Cliente não encontrado', 404));
    }
    
    if (companyId && client.companyId !== companyId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403));
    }

    if (client.originLead) {
      await prisma.lead.update({
        where: { id: client.originLead.id },
        data: { status: 'prospect_lead' }
      });
      return res.json(createSuccessResponse({ success: true, message: 'Lead retornado ao funil' }));
    } else {
      const existingLead = client.phone ? await prisma.lead.findFirst({
        where: { phone: client.phone, companyId: client.companyId }
      }) : null;

      if (existingLead) {
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: { status: 'prospect_lead', convertedToClientId: client.id }
        });
        return res.json(createSuccessResponse({ success: true, message: 'Lead existente atualizado e retornado ao funil' }));
      } else {
        const newLead = await prisma.lead.create({
          data: {
            professionalId: client.professionalId,
            companyId: client.companyId,
            name: client.name,
            email: client.email,
            phone: client.phone || `${client.id}-nophone`,
            status: 'prospect_lead',
            convertedToClientId: client.id
          }
        });
        return res.json(createSuccessResponse({ success: true, message: 'Novo lead criado e adicionado ao funil', lead: newLead }));
      }
    }
  } catch (error: any) {
    console.error('[Clients] Erro ao enviar para o funil:', error);
    res.status(500).json(createErrorResponse(error.message || 'Erro ao enviar para o funil', 500));
  }
});
import { actionPermissions } from '../middleware/action-permissions.js'
