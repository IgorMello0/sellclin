import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import {
  assertClientBelongsToCompany,
  assertUserBelongsToCompany,
  getCompanyOwnerProfessionalId,
  assertProfessionalBelongsToCompany
} from '../services/tenant.js'
import { logAudit } from '../utils/audit.js'
import { deleteAppointmentFromGoogle, syncAppointmentToGoogle } from '../services/google-calendar.js'

export const router = Router()
router.use(auth(), actionPermissions('agendamentos'))

router.get('/', auth(), requireModule('agendamentos'), async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const { professionalId, clientId, status } = req.query as any
  let profId: number | undefined;
  let companyId: number | undefined;

  if (req.user?.type === 'profissional') {
    profId = req.user.id;
    companyId = req.user.companyId;
  } else if (req.user?.type === 'usuario') {
    // Buscar o dono da empresa do usuário
    const empresa = await prisma.empresa.findUnique({
      where: { id: req.user.companyId! },
      select: { ownerId: true }
    });
    profId = empresa?.ownerId || undefined;
    companyId = req.user.companyId;
  } else if (professionalId) {
    profId = Number(professionalId);
    companyId = req.user?.companyId;
  }

  if (!profId) {
    return res.json(createSuccessResponse([], { page, pageSize, total: 0 }));
  }

  const where: any = { professionalId: profId };
  if (companyId) {
    where.companyId = companyId;
  }
  if (clientId) where.clientId = Number(clientId)
  if (status) where.status = status
  if (!await hasActionPermission(req, 'agendamentos', 'verAgendamentosAlheios')) {
    where.OR = req.user!.type === 'usuario'
      ? [{ sdrId: req.user!.id }, { especialistaId: req.user!.id }, { lead: { sdrId: req.user!.id } }, { lead: { closerId: req.user!.id } }]
      : [{ professionalId: req.user!.id }]
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take,
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
      include: { 
        professional: true, 
        client: true, 
        lead: { include: { proposals: true } }, 
        service: true, 
        appointmentLogs: true, 
        payments: true,
        sdr: { select: { id: true, name: true,  } },
        especialista: { select: { id: true, name: true,  } }
      }
    }),
    prisma.appointment.count({ where })
  ])

    let restrictedRole: any = null;
    if (req.user?.type === 'usuario') {
      const dbUser = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        include: { role: true }
      });
      if (dbUser?.role && !dbUser.role.isAdmin && !dbUser.role.isManager) {
        restrictedRole = dbUser.role;
      }
    }

    const maskedItems = items.map(item => {
      if (restrictedRole) {
        let isMine = false;
        if (restrictedRole.isSDR) {
          isMine = item.sdrId === req.user!.id || item.lead?.sdrId === req.user!.id || !!item.lead?.proposals?.some((p: any) => p.sdrId === req.user!.id);
        }
        if (restrictedRole.isCloser) {
          isMine = isMine || item.especialistaId === req.user!.id || item.lead?.closerId === req.user!.id || !!item.lead?.proposals?.some((p: any) => p.salespersonId === req.user!.id);
        }
        if (!isMine) {
          return {
            ...item,
            client: { ...item.client, name: 'Horário Reservado (Ocupado)', phone: '', email: '' },
            lead: { ...item.lead, name: 'Horário Reservado', phone: '', email: '' },
            notes: 'Reservado por outro membro da equipe',
          };
        }
      }
      return item;
    });

  res.json(createSuccessResponse(maskedItems, { page, pageSize, total }))
})

// Check availability (olheiro em tempo real)
router.get('/check-availability', auth(), requireModule('agendamentos'), async (req, res) => {
  try {
    const { professionalId, startTime, endTime } = req.query as any
    if (!professionalId || !startTime || !endTime) {
      return res.status(400).json(createErrorResponse('Parâmetros incompletos', 400))
    }

    const conflicting = await prisma.appointment.findFirst({
      where: {
        professionalId: Number(professionalId),
        status: { not: 'cancelado' },
        AND: [
          { startTime: { lt: new Date(endTime) } },
          { endTime: { gt: new Date(startTime) } }
        ]
      }
    })

    if (conflicting) {
      return res.json(createSuccessResponse({ available: false }))
    }
    return res.json(createSuccessResponse({ available: true }))
  } catch (error) {
    return res.status(500).json(createErrorResponse('Erro ao verificar disponibilidade', 500))
  }
})

// Horários disponíveis para um dia específico
router.get('/available-slots', auth(), requireModule('agendamentos'), async (req, res) => {
  try {
    let { professionalId, date, durationMinutes, isUsuario } = req.query as any
    if (!professionalId || !date) {
      return res.status(400).json(createErrorResponse('Parâmetros incompletos', 400))
    }

    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      date = `${year}-${month}-${day}`;
    }

    const duration = Number(durationMinutes) || 60
    const SLOT_INTERVAL = 15 // minutos

    // 1. Busca os horários da empresa
    let openHourStr = "08:00";
    let closeHourStr = "20:00";
    
    if (isUsuario === 'true') {
      const user = await prisma.usuario.findUnique({
        where: { id: Number(professionalId) },
        include: { company: { select: { openHour: true, closeHour: true } } }
      })
      if (user?.company) {
        openHourStr = user.company.openHour || openHourStr;
        closeHourStr = user.company.closeHour || closeHourStr;
      }
    } else {
      const prof = await prisma.professional.findUnique({
        where: { id: Number(professionalId) },
        include: { company: { select: { openHour: true, closeHour: true } } }
      })
      if (prof?.company) {
        openHourStr = prof.company.openHour || openHourStr;
        closeHourStr = prof.company.closeHour || closeHourStr;
      }
    }

    const [openH, openM] = openHourStr.split(':').map(Number)
    const [closeH, closeM] = closeHourStr.split(':').map(Number)
    
    const startMinutes = openH * 60 + openM
    const endMinutes = closeH * 60 + closeM
    const totalMinutes = endMinutes - startMinutes

    // Busca todos agendamentos do profissional no dia usando fuso de Brasília (UTC-3)
    const dayStart = new Date(`${date}T00:00:00.000-03:00`)
    const dayEnd   = new Date(`${date}T23:59:59.999-03:00`)
    const whereClause: any = {
      status: { not: 'cancelado' },
      startTime: { gte: dayStart, lte: dayEnd }
    };
    if (isUsuario === 'true') {
      whereClause.especialistaId = Number(professionalId);
    } else {
      whereClause.professionalId = Number(professionalId);
      whereClause.especialistaId = null;
    }

    const existingAppointments = await prisma.appointment.findMany({
      where: whereClause,
      select: { startTime: true, endTime: true }
    })

    // Gera todos os slots possíveis
    const slots: string[] = []
    const now = new Date() // Tempo UTC atual

    for (let m = 0; m <= totalMinutes - duration; m += SLOT_INTERVAL) {
      const currentMin = startMinutes + m
      const slotHour   = Math.floor(currentMin / 60)
      const slotMinute = currentMin % 60
      
      // Cria o objeto de data para este slot específico forçando o fuso -03:00
      const slotStart = new Date(`${date}T${String(slotHour).padStart(2,'0')}:${String(slotMinute).padStart(2,'0')}:00-03:00`)
      const slotEnd   = new Date(slotStart.getTime() + duration * 60000)

      // 1. Restrição de Passado: Não mostrar horários que já passaram se for hoje
      if (slotStart < now) {
        continue;
      }

      // 2. Verifica conflito com qualquer agendamento existente
      const hasConflict = existingAppointments.some(apt => {
        const aptStart = new Date(apt.startTime)
        const aptEnd   = new Date(apt.endTime)
        return slotStart < aptEnd && slotEnd > aptStart
      })

      if (!hasConflict) {
        slots.push(`${String(slotHour).padStart(2,'0')}:${String(slotMinute).padStart(2,'0')}`)
      }
    }

    return res.json(createSuccessResponse(slots))
  } catch (error) {
    return res.status(500).json(createErrorResponse('Erro ao buscar horários disponíveis', 500))
  }
})

router.get('/:id', auth(), requireModule('agendamentos'), async (req, res) => {
  const id = Number(req.params.id)
  const item = await prisma.appointment.findFirst({
    where: { id, companyId: req.user!.companyId },
      include: {
        professional: { select: { id: true, name: true, specialization: true } },
        client: true,
        lead: { include: { proposals: true } },
        service: true,
        appointmentLogs: true,
        payments: true,
      }
  })
  if (!item) return res.status(404).json(createErrorResponse('Agendamento não encontrado', 404))
    let restrictedRole: any = null;
    if (req.user?.type === 'usuario') {
      const dbUser = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        include: { role: true }
      });
      if (dbUser?.role && !dbUser.role.isAdmin && !dbUser.role.isManager) {
        restrictedRole = dbUser.role;
      }
    }

    if (restrictedRole) {
      let isMine = false;
      if (restrictedRole.isSDR) {
        isMine = item.sdrId === req.user!.id || item.lead?.sdrId === req.user!.id || !!item.lead?.proposals?.some((p: any) => p.sdrId === req.user!.id);
      }
      if (restrictedRole.isCloser) {
        isMine = isMine || item.especialistaId === req.user!.id || item.lead?.closerId === req.user!.id || !!item.lead?.proposals?.some((p: any) => p.salespersonId === req.user!.id);
      }
      if (!isMine) {
        return res.json(createSuccessResponse({
          ...item,
          client: { ...item.client, name: 'Horário Reservado (Ocupado)', phone: '', email: '' },
          lead: { ...item.lead, name: 'Horário Reservado', phone: '', email: '' },
          notes: 'Reservado por outro membro da equipe',
        }));
      }
    }

  res.json(createSuccessResponse(item))
})

router.post('/', auth(), requireModule('agendamentos'), async (req, res) => {
  try {
    const { clientId, leadId, tags, serviceId, startTime, endTime, status, notes, sdrId, especialistaId, consultationAmount, consultationPaymentMethod } = req.body
    
    let professionalId: number;
    if (req.body.professionalId) {
      professionalId = Number(req.body.professionalId);
      await assertProfessionalBelongsToCompany(professionalId, req.user?.companyId);
    } else {
      professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId);
    }

    let finalSdrId = sdrId ? Number(sdrId) : null;
    let finalEspecialistaId = especialistaId ? Number(especialistaId) : null;

    if (clientId) {
      await assertClientBelongsToCompany(Number(clientId), req.user?.companyId);
      if (!finalSdrId || !finalEspecialistaId) {
        const client = await prisma.client.findUnique({
          where: { id: Number(clientId) },
          include: { originLead: { select: { sdrId: true, closerId: true } } }
        });
        if (client?.originLead) {
          if (!finalSdrId && client.originLead.sdrId) finalSdrId = client.originLead.sdrId;
          if (!finalEspecialistaId && client.originLead.closerId) finalEspecialistaId = client.originLead.closerId;
        }
      }
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: Number(leadId), companyId: req.user!.companyId },
        select: { id: true, sdrId: true, closerId: true },
      })
      if (!lead) return res.status(400).json(createErrorResponse('Lead inválido para esta clínica', 400))
      
      if (!finalSdrId && lead.sdrId) finalSdrId = lead.sdrId;
      if (!finalEspecialistaId && lead.closerId) finalEspecialistaId = lead.closerId;
    }
    if (serviceId) {
      const service = await prisma.catalogItem.findFirst({
        where: { id: Number(serviceId), professionalId },
        select: { id: true },
      })
      if (!service) return res.status(400).json(createErrorResponse('Serviço inválido para esta clínica', 400))
    }
    if (sdrId) await assertUserBelongsToCompany(Number(sdrId), req.user?.companyId)
    if (especialistaId) await assertUserBelongsToCompany(Number(especialistaId), req.user?.companyId)

    // Overbooking Validation
    const overbookingWhere: any = {
      status: { not: 'cancelado' },
      AND: [
        { startTime: { lt: new Date(endTime) } },
        { endTime: { gt: new Date(startTime) } }
      ]
    };
    if (req.body.especialistaId) {
      overbookingWhere.especialistaId = Number(req.body.especialistaId);
    } else {
      overbookingWhere.professionalId = professionalId;
      overbookingWhere.especialistaId = null;
    }

    const conflicting = await prisma.appointment.findFirst({
      where: overbookingWhere
    });

    if (conflicting) {
      return res.status(409).json(createErrorResponse('Este horário já está ocupado para este profissional.', 409));
    }

    // Update tags if provided
    if (tags && Array.isArray(tags)) {
      if (leadId) {
        await prisma.lead.update({ where: { id: Number(leadId) }, data: { tags } });
      } else if (clientId) {
        await prisma.client.update({ where: { id: Number(clientId) }, data: { tags } });
      }
    }

    const created = await prisma.appointment.create({
      data: { 
        professionalId, 
        companyId: req.user.companyId,
        clientId: clientId ? Number(clientId) : null, 
        leadId: leadId ? Number(leadId) : null,
        serviceId: serviceId ? Number(serviceId) : null, 
        startTime: new Date(startTime), 
        endTime: new Date(endTime), 
        status: status || 'agendado', 
        notes,
        sdrId: finalSdrId,
        especialistaId: finalEspecialistaId
      },
      include: { 
        professional: { select: { id: true, name: true, specialization: true } }, client: true, lead: true, service: true, appointmentLogs: true, payments: true,
        sdr: { select: { id: true, name: true,  } },
        especialista: { select: { id: true, name: true,  } }
      }
    })

    // Create consultation payment if provided
    if (consultationAmount && consultationPaymentMethod && Number(consultationAmount) > 0) {
      let paymentClientId = created.clientId;
      let finalLeadId = created.leadId;
      
      if (!paymentClientId && finalLeadId) {
        const lead = await prisma.lead.findUnique({ where: { id: finalLeadId } });
        if (lead) {
          if (lead.convertedToClientId) {
            paymentClientId = lead.convertedToClientId;
          } else {
            // Auto-convert to client to receive the payment
            const newClient = await prisma.client.create({
              data: {
                professionalId,
                companyId: req.user.companyId,
                name: lead.name,
                email: lead.email || null,
                phone: lead.phone || null,
                notes: lead.notes || null,
                avatar: lead.avatar || null,
              }
            });
            await prisma.lead.update({
              where: { id: finalLeadId },
              data: { convertedToClientId: newClient.id, convertedAt: new Date() }
            });
            paymentClientId = newClient.id;
            
            // Link appointment to this new client
            await prisma.appointment.update({
              where: { id: created.id },
              data: { clientId: paymentClientId }
            });
          }
        }
      }

      if (paymentClientId) {
        await prisma.payment.create({
          data: {
            appointmentId: created.id,
            clientId: paymentClientId,
            professionalId,
            companyId: req.user.companyId,
            amount: Number(consultationAmount),
            method: consultationPaymentMethod,
            status: 'pago',
            date: new Date(),
          }
        });
      }
    }

    const synced = await syncAppointmentToGoogle(created.id)
    
    logAudit(req.user, 'CRIAR_AGENDAMENTO', 'Appointment', created.id)
    
    res.status(201).json(createSuccessResponse(synced || created))
  } catch (error: any) {
    console.error('[Appointments] Erro ao criar agendamento:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar agendamento', 500))
  }
})

router.put('/:id', auth(), requireModule('agendamentos'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { clientId, serviceId, startTime, endTime, status, notes, sdrId, especialistaId } = req.body

    const current = await prisma.appointment.findFirst({ where: { id, companyId: req.user!.companyId } });
    if (!current) return res.status(404).json(createErrorResponse('Agendamento não encontrado', 404));

    let professionalId = current.professionalId;
    if (req.body.professionalId) {
      professionalId = Number(req.body.professionalId);
      await assertProfessionalBelongsToCompany(professionalId, req.user?.companyId);
    }
    if (clientId) await assertClientBelongsToCompany(Number(clientId), req.user?.companyId)
    if (serviceId) {
      const service = await prisma.catalogItem.findFirst({
        where: { id: Number(serviceId), professionalId },
        select: { id: true },
      })
      if (!service) return res.status(400).json(createErrorResponse('Serviço inválido para esta clínica', 400))
    }
    if (sdrId) await assertUserBelongsToCompany(Number(sdrId), req.user?.companyId)
    if (especialistaId) await assertUserBelongsToCompany(Number(especialistaId), req.user?.companyId)

    // Verificar se o usuário tem permissão sobre este profissional
    let canEdit = false;
    if (req.user?.type === 'profissional' && current.professionalId === req.user.id) {
      canEdit = true;
    } else if (req.user?.type === 'usuario') {
      const empresa = await prisma.empresa.findUnique({ where: { id: req.user.companyId! } });
      if (empresa?.ownerId === current.professionalId) {
        canEdit = true;
      }
    }

    if (!canEdit) return res.status(403).json(createErrorResponse('Acesso negado', 403));

    // Overbooking Validation
    const putOverbookingWhere: any = {
      id: { not: id },
      status: { not: 'cancelado' },
      AND: [
        { startTime: { lt: new Date(endTime || current.endTime) } },
        { endTime: { gt: new Date(startTime || current.startTime) } }
      ]
    };
    
    const finalEspecialistaId = req.body.hasOwnProperty('especialistaId') ? req.body.especialistaId : current.especialistaId;
    
    if (finalEspecialistaId) {
      putOverbookingWhere.especialistaId = Number(finalEspecialistaId);
    } else {
      putOverbookingWhere.professionalId = professionalId;
      putOverbookingWhere.especialistaId = null;
    }

    const conflicting = startTime && endTime ? await prisma.appointment.findFirst({
      where: putOverbookingWhere
    }) : null;

    if (conflicting) {
      return res.status(409).json(createErrorResponse('Este horário já está ocupado.', 409));
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { 
        professionalId: req.body.professionalId ? Number(req.body.professionalId) : undefined,
        clientId: clientId ? Number(clientId) : undefined, 
        serviceId: serviceId ? Number(serviceId) : undefined, 
        startTime: startTime ? new Date(startTime) : undefined, 
        endTime: endTime ? new Date(endTime) : undefined, 
        status, 
        notes,
        sdrId: sdrId !== undefined ? (sdrId ? Number(sdrId) : null) : undefined,
        especialistaId: especialistaId !== undefined ? (especialistaId ? Number(especialistaId) : null) : undefined
      },
      include: { 
        lead: true, professional: { select: { id: true, name: true, specialization: true } }, client: true, service: true, appointmentLogs: true, payments: true,
        sdr: { select: { id: true, name: true,  } },
        especialista: { select: { id: true, name: true,  } }
      }
    })

    const synced = await syncAppointmentToGoogle(updated.id)
  
  if (req.user?.type === 'profissional') {
    logAudit(req.user.id, 'ATUALIZAR_AGENDAMENTO', 'Appointment', id)
  }

  // Update Lead's isScheduled status
  if (updated.leadId) {
    const leadUpdateData: any = {};
    
    if (status === 'concluido') {
      leadUpdateData.status = 'prospect_attended';
    }

    if (status === 'cancelado') {
      const remainingAppointments = await prisma.appointment.count({
        where: { leadId: updated.leadId, id: { not: updated.id }, status: { not: 'cancelado' } }
      });
      leadUpdateData.isScheduled = remainingAppointments > 0;
    } else {
      leadUpdateData.isScheduled = true;
    }

    if (Object.keys(leadUpdateData).length > 0) {
      await prisma.lead.update({ 
        where: { id: updated.leadId }, 
        data: leadUpdateData 
      });
    }
  }
  
    res.json(createSuccessResponse(synced || updated))
  } catch (error: any) {
    console.error('[Appointments] Erro ao atualizar agendamento:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar agendamento', 500))
  }
})

router.delete('/:id', auth(), requireModule('agendamentos'), async (req, res) => {
  const id = Number(req.params.id)

  const current = await prisma.appointment.findFirst({ where: { id, companyId: req.user!.companyId } });
  if (!current) return res.status(404).json(createErrorResponse('Agendamento não encontrado', 404));

  let canEdit = false;
  if (req.user?.type === 'profissional' && current.professionalId === req.user.id) {
    canEdit = true;
  } else if (req.user?.type === 'usuario') {
    const empresa = await prisma.empresa.findUnique({ where: { id: req.user.companyId! } });
    if (empresa?.ownerId === current.professionalId) {
      canEdit = true;
    }
  }

  if (!canEdit && req.user?.role !== 'admin') {
    return res.status(403).json(createErrorResponse('Acesso negado', 403));
  }

  await deleteAppointmentFromGoogle(id)
  await prisma.appointment.delete({ where: { id } })
  
  if (current.leadId) {
    const remainingAppointments = await prisma.appointment.count({
      where: { leadId: current.leadId, status: { not: 'cancelado' } }
    });
    if (remainingAppointments === 0) {
      await prisma.lead.update({
        where: { id: current.leadId },
        data: { isScheduled: false }
      });
    }
  }

  if (req.user?.type === 'profissional') {
    logAudit(req.user.id, 'DELETAR_AGENDAMENTO', 'Appointment', id)
  }
  
  res.json(createSuccessResponse({ id }))
})
import { actionPermissions, hasActionPermission } from '../middleware/action-permissions.js'
