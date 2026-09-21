import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createSuccessResponse, createErrorResponse } from '../utils/response.js'
import {
  assertClientBelongsToCompany,
  assertLeadBelongsToCompany,
  assertProfessionalBelongsToCompany,
  assertUserBelongsToCompany,
} from '../services/tenant.js'
import { processCadenceTaskCompletion } from '../services/cadence.js'

export const router = Router()
router.use(auth(), requireModule('tarefas'))
router.use(auth(), actionPermissions('tarefas'))

// Helper para calcular a próxima data com base na regra de recorrência
function getNextDueDate(currentDate: Date, rule: string): Date {
  const nextDate = new Date(currentDate)
  switch (rule) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    default:
      nextDate.setDate(nextDate.getDate() + 1)
  }
  return nextDate
}

function safeTaskParty(party: any, isUser = false) {
  if (!party) return null
  const { passwordHash: _passwordHash, ...safeParty } = party
  return isUser ? { ...safeParty, isUser: true } : safeParty
}

function mapTaskResponse(task: any) {
  const {
    assignedTo: assignedProfessional,
    assignedToUser,
    createdBy: creatorProfessional,
    createdByUser,
    company,
    ...safeTask
  } = task

  return {
    ...safeTask,
    company: company ? { id: company.id, name: company.name } : company,
    assignedTo: safeTaskParty(assignedProfessional) || safeTaskParty(assignedToUser, true),
    createdBy: safeTaskParty(creatorProfessional) || safeTaskParty(createdByUser, true),
  }
}

// Helper para disparar alertas urgentes (WhatsApp/E-mail)
async function fnAlertUrgentTask(task: any, assignee: any, creatorName: string, company: any) {
  const msg = `⚠️ *SALESCLIN CRM: TAREFA URGENTE DELEGADA!*\n\nOlá, ${assignee.name}. Uma nova tarefa urgente foi delegada a você por ${creatorName}.\n\n📌 *Tarefa:* ${task.title}\n📅 *Vencimento:* ${new Date(task.dueDate).toLocaleDateString('pt-BR')}\n📝 *Descrição:* ${task.description || 'Sem descrição.'}\n\nPor favor, verifique o seu painel do CRM.`

  console.log(`[Alerts] Iniciando alertas urgentes para ${assignee.name} (${assignee.email} / ${assignee.phone})`)

  // Alerta por E-mail (Simulação no console / SMTP Integrável)
  console.log(`[Alerts - E-mail] Enviando para: ${assignee.email}\nAssunto: TAREFA URGENTE - SellClin CRM\nCorpo: ${msg}`)

  // Alerta por WhatsApp (Evolution API / Meta API)
  if (assignee.phone) {
    const cleanPhone = assignee.phone.replace(/\D/g, '')
    if (company && company.whatsapp_provider === 'evolution' && company.evolution_api_url && company.evolution_instance) {
      try {
        console.log(`[Alerts - WhatsApp] Disparando via Evolution API para: ${cleanPhone}`)
        const baseUrl = company.evolution_api_url.replace(/\/+$/, '')
        const response = await fetch(`${baseUrl}/message/sendText/${company.evolution_instance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Adicione 'apikey' se a Evolution API exigir, geralmente buscada nas configurações da empresa ou .env
            'apikey': process.env.EVOLUTION_API_KEY || company.apiKey || ''
          },
          body: JSON.stringify({
            number: cleanPhone,
            options: {
              delay: 1000,
              presence: 'composing'
            },
            textMessage: {
              text: msg.replace(/\*/g, '') // remove markdown asterisks
            }
          })
        })
        if (!response.ok) {
          console.error(`[Alerts - WhatsApp] Erro no envio via Evolution: Status ${response.status}`)
        } else {
          console.log(`[Alerts - WhatsApp] Mensagem enviada com sucesso para ${cleanPhone}`)
        }
      } catch (err) {
        console.error('[Alerts - WhatsApp] Erro na requisição WhatsApp:', err)
      }
    } else {
      console.log(`[Alerts - WhatsApp Simulador] Provedor de WhatsApp não configurado na empresa. Mensagem simulada para: ${cleanPhone}`)
    }
  }
}

// 1. Listar tarefas do usuário logado (com filtros e busca)
router.get('/', auth(), async (req, res) => {
  try {
    const professionalId = req.user!.id
    const companyId = req.user!.companyId
    const { status, priority, dueDateRange, search, team, leadId, includeCadence } = req.query as any

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Clínica não definida', 400))
    }

    const where: any = {
      companyId
    }

    if (leadId) {
      where.leadId = Number(leadId)
    }

    if (includeCadence !== 'true') {
      where.cadenceStageCode = null;
    }

    // Se não for rota da equipe, restringe às tarefas atribuídas ou criadas pelo usuário
    if (team !== 'true' || !await hasActionPermission(req, 'tarefas', 'verTarefasAlheias')) {
      if (req.user?.type === 'usuario') {
        where.OR = [
          { assignedToUserId: professionalId },
          { createdByUserId: professionalId }
        ]
      } else {
        where.OR = [
          { assignedToId: professionalId },
          { createdById: professionalId }
        ]
      }
    }

    // Filtro por Status (pendente, em andamento, concluído)
    if (status) {
      where.status = status
    }

    // Filtro por Prioridade (low, medium, high, urgent)
    if (priority) {
      where.priority = priority
    }

    // Filtro de Data
    if (dueDateRange) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

      if (dueDateRange === 'today') {
        where.dueDate = {
          gte: todayStart,
          lte: todayEnd
        }
      } else if (dueDateRange === 'overdue') {
        where.dueDate = {
          lt: todayStart
        }
      } else if (dueDateRange === 'upcoming') {
        where.dueDate = {
          gt: todayEnd
        }
      }
    }

    // Busca textual no título ou descrição
    // Usa AND para combinar a restrição de propriedade (OR) com a busca textual (OR),
    // evitando que a busca exponha tarefas de outros usuários.
    if (search) {
      const searchConditions = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions }
        ]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, phone: true, photoUrl: true }
        },
        assignedToUser: {
          select: { id: true, name: true, email: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true, photoUrl: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        client: {
          select: { id: true, name: true, email: true, phone: true }
        },
        lead: {
          select: { id: true, name: true, email: true, phone: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ]
    })

    // Normalizar a resposta das tarefas para unificar assignedTo e createdBy
    const mappedTasks = tasks.map(mapTaskResponse)

    res.json(createSuccessResponse(mappedTasks))
  } catch (error: any) {
    console.error('[Tasks] Erro ao buscar tarefas:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar tarefas', 500))
  }
})

// 2. Criar nova tarefa
router.post('/', auth(), async (req, res) => {
  try {
    const creatorId = req.user!.id
    const companyId = req.user!.companyId
    const { title, description, priority, dueDate, assignedToId, assigneeType, clientId, leadId, isRecurring, recurrenceRule } = req.body

    if (!title || !dueDate || !assignedToId) {
      return res.status(400).json(createErrorResponse('Título, data de vencimento e responsável são obrigatórios.', 400))
    }

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Clínica não definida', 400))
    }

    const isAssigneeUser = assigneeType === 'user';
    const isCreatorUser = req.user!.type === 'usuario';

    if (clientId) await assertClientBelongsToCompany(Number(clientId), companyId)
    if (leadId) await assertLeadBelongsToCompany(Number(leadId), companyId)
    if (isAssigneeUser) {
      await assertUserBelongsToCompany(Number(assignedToId), companyId)
    } else {
      await assertProfessionalBelongsToCompany(Number(assignedToId), companyId)
    }

    const data: any = {
      title,
      description,
      status: 'pending',
      priority: priority || 'medium',
      dueDate: new Date(dueDate),
      companyId,
      clientId: clientId ? Number(clientId) : null,
      leadId: leadId ? Number(leadId) : null,
      isRecurring: !!isRecurring,
      recurrenceRule: isRecurring ? (recurrenceRule || 'daily') : null
    }

    if (isAssigneeUser) {
      data.assignedToUserId = Number(assignedToId);
    } else {
      data.assignedToId = Number(assignedToId);
    }

    if (isCreatorUser) {
      data.createdByUserId = creatorId;
    } else {
      data.createdById = creatorId;
    }

    const task = await prisma.task.create({
      data,
      include: {
        assignedTo: true,
        assignedToUser: true,
        createdBy: true,
        createdByUser: true,
        company: true
      }
    })

    // Se foi atribuído a outra pessoa, dispara notificação no sininho
    const isAssignedToSelf = isAssigneeUser 
      ? (isCreatorUser && task.assignedToUserId === creatorId) 
      : (!isCreatorUser && task.assignedToId === creatorId);

    if (!isAssignedToSelf) {
      const creatorName = isCreatorUser ? task.createdByUser?.name : task.createdBy?.name;
      
      const notificationData: any = {
        title: 'Nova tarefa atribuída',
        content: `${creatorName || 'Alguém'} delegou uma tarefa a você: "${task.title}"`,
        type: 'task_assigned',
        companyId: task.companyId,
        taskId: task.id
      };

      if (isAssigneeUser) {
        notificationData.recipientUserId = task.assignedToUserId;
      } else {
        notificationData.recipientId = task.assignedToId;
      }

      await prisma.notification.create({
        data: notificationData
      })

      // Dispara alerta se for tarefa URGENTE
      if (task.priority === 'urgent') {
        const assigneeInfo = isAssigneeUser ? task.assignedToUser : task.assignedTo;
        if (assigneeInfo) {
          await fnAlertUrgentTask(task, assigneeInfo, creatorName || 'Alguém', task.company)
        }
      }
    }

    res.status(201).json(createSuccessResponse(mapTaskResponse(task)))
  } catch (error: any) {
    console.error('[Tasks] Erro ao criar tarefa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar tarefa', 500))
  }
})

// 3. Atualizar tarefa (Status, Recorrência, etc)
router.put('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const companyId = req.user!.companyId
    const { title, description, status, priority, dueDate, assignedToId, assigneeType, clientId, leadId, isRecurring, recurrenceRule } = req.body

    const existingTask = await prisma.task.findFirst({
      where: { id, companyId },
      include: { assignedTo: true, assignedToUser: true, createdBy: true, createdByUser: true, company: true }
    })

    if (!existingTask || (!await hasActionPermission(req, 'tarefas', 'verTarefasAlheias') && !ownsTask(req.user!, existingTask))) {
      return res.status(404).json(createErrorResponse('Tarefa não encontrada', 404))
    }

    // Se status mudou para concluída e a tarefa é recorrente
    const isNowCompleted = status === 'completed' && existingTask.status !== 'completed'

    const isAssigneeUser = assigneeType === 'user' || req.body.assignedToUserId !== undefined;

    if (clientId) await assertClientBelongsToCompany(Number(clientId), companyId)
    if (leadId) await assertLeadBelongsToCompany(Number(leadId), companyId)
    if (assignedToId !== undefined) {
      if (isAssigneeUser) {
        await assertUserBelongsToCompany(Number(assignedToId), companyId)
      } else {
        await assertProfessionalBelongsToCompany(Number(assignedToId), companyId)
      }
    }

    const data: any = {
      title,
      description,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      clientId: clientId !== undefined ? (clientId ? Number(clientId) : null) : undefined,
      leadId: leadId !== undefined ? (leadId ? Number(leadId) : null) : undefined,
      isRecurring: isRecurring !== undefined ? !!isRecurring : undefined,
      recurrenceRule: isRecurring ? (recurrenceRule || 'daily') : (isRecurring === false ? null : undefined)
    }

    if (assignedToId !== undefined) {
      if (isAssigneeUser) {
        data.assignedToUserId = Number(assignedToId);
        data.assignedToId = null;
      } else {
        data.assignedToId = Number(assignedToId);
        data.assignedToUserId = null;
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: true,
        assignedToUser: true,
        createdBy: true,
        createdByUser: true,
        company: true
      }
    })

      // Lógica de Notificações Aprimorada: Notificar Administradores e Criador
      const isUpdaterSelf = updated.createdByUserId 
        ? (req.user!.type === 'usuario' && updated.createdByUserId === req.user!.id)
        : (req.user!.type === 'profissional' && updated.createdById === req.user!.id);
  
      if (isNowCompleted) {
        const updaterName = req.user!.type === 'usuario' ? updated.assignedToUser?.name : updated.assignedTo?.name;
        
        const baseNotification = {
          title: 'Tarefa concluída',
          content: `${updaterName || 'Alguém'} concluiu a tarefa: "${updated.title}"`,
          type: 'task_completed',
          companyId: updated.companyId,
          taskId: updated.id
        };

        const recipientsToNotify = new Set<string>();
        
        // 1. O dono da clínica (admin principal)
        const company = await prisma.empresa.findUnique({ where: { id: updated.companyId } });
        if (company && company.ownerId) {
          recipientsToNotify.add(`prof_${company.ownerId}`);
        }

        // 2. Outros administradores / gerentes
        const adminUsers = await prisma.usuario.findMany({
          where: {
            isActive: true,
            companyAccess: { some: { companyId: updated.companyId } },
            role: { isManager: true }
          }
        });
        
        for (const admin of adminUsers) {
          recipientsToNotify.add(`user_${admin.id}`);
        }

        // 3. O criador da tarefa (se diferente de quem está atualizando)
        if (!isUpdaterSelf) {
          if (updated.createdByUserId) {
            recipientsToNotify.add(`user_${updated.createdByUserId}`);
          } else if (updated.createdById) {
            recipientsToNotify.add(`prof_${updated.createdById}`);
          }
        }

        // Remover o próprio updater para ele não ser notificado das próprias ações
        if (req.user!.type === 'usuario') {
          recipientsToNotify.delete(`user_${req.user!.id}`);
        } else {
          recipientsToNotify.delete(`prof_${req.user!.id}`);
        }

        const notificationsData = Array.from(recipientsToNotify).map(recipient => {
          const [type, idStr] = recipient.split('_');
          return {
            ...baseNotification,
            recipientUserId: type === 'user' ? Number(idStr) : null,
            recipientId: type === 'prof' ? Number(idStr) : null,
          };
        });

        if (notificationsData.length > 0) {
          await prisma.notification.createMany({
            data: notificationsData
          });
        }
      }

    // Lógica de Recorrência Automática
    if (isNowCompleted && updated.isRecurring && updated.recurrenceRule) {
      const nextDate = getNextDueDate(updated.dueDate, updated.recurrenceRule)
      console.log(`[Tasks] Tarefa recorrente finalizada. Criando próxima recorrência para: ${nextDate.toISOString()}`)

      const nextTaskData: any = {
        title: updated.title,
        description: updated.description,
        status: 'pending',
        priority: updated.priority,
        dueDate: nextDate,
        companyId: updated.companyId,
        clientId: updated.clientId,
        leadId: updated.leadId,
        isRecurring: true,
        recurrenceRule: updated.recurrenceRule,
        parentTaskId: updated.parentTaskId || updated.id // Link para o pai raiz
      };

      if (updated.assignedToUserId) {
        nextTaskData.assignedToUserId = updated.assignedToUserId;
      } else {
        nextTaskData.assignedToId = updated.assignedToId;
      }

      if (updated.createdByUserId) {
        nextTaskData.createdByUserId = updated.createdByUserId;
      } else {
        nextTaskData.createdById = updated.createdById;
      }

      const nextTask = await prisma.task.create({
        data: nextTaskData,
        include: {
          assignedTo: true,
          assignedToUser: true,
          createdBy: true,
          createdByUser: true
        }
      })

      // Notificar o responsável da próxima tarefa agendada
      const isNextAssignedToSelf = nextTask.assignedToUserId 
        ? (req.user!.type === 'usuario' && nextTask.assignedToUserId === req.user!.id)
        : (req.user!.type === 'profissional' && nextTask.assignedToId === req.user!.id);

      if (!isNextAssignedToSelf) {
        const nextNotificationData: any = {
          title: 'Nova recorrência agendada',
          content: `Uma tarefa recorrente foi reiniciada para ${nextDate.toLocaleDateString('pt-BR')}: "${nextTask.title}"`,
          type: 'task_assigned',
          companyId: nextTask.companyId,
          taskId: nextTask.id
        };

        if (nextTask.assignedToUserId) {
          nextNotificationData.recipientUserId = nextTask.assignedToUserId;
        } else {
          nextNotificationData.recipientId = nextTask.assignedToId;
        }

        await prisma.notification.create({
          data: nextNotificationData
        })
      }
    }

    // Lógica de Cadência: Se foi concluída e for uma task de cadência, avança o passo
    if (isNowCompleted && updated.cadenceStageCode && updated.cadenceStepIndex !== null) {
      processCadenceTaskCompletion(updated.id).catch(console.error);
    }

    res.json(createSuccessResponse(mapTaskResponse(updated)))
  } catch (error: any) {
    console.error('[Tasks] Erro ao atualizar tarefa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar tarefa', 500))
  }
})

// 4. Deletar tarefa
router.delete('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const companyId = req.user!.companyId

    const existingTask = await prisma.task.findFirst({
      where: { id, companyId }
    })

    if (!existingTask || (!await hasActionPermission(req, 'tarefas', 'verTarefasAlheias') && !ownsTask(req.user!, existingTask))) {
      return res.status(404).json(createErrorResponse('Tarefa não encontrada', 404))
    }

    await prisma.task.delete({
      where: { id }
    })

    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    console.error('[Tasks] Erro ao deletar tarefa:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar tarefa', 500))
  }
})
import { actionPermissions, hasActionPermission } from '../middleware/action-permissions.js'
function ownsTask(user: { id: number; type: string }, task: any) {
  return user.type === 'usuario'
    ? task.assignedToUserId === user.id || task.createdByUserId === user.id
    : task.assignedToId === user.id || task.createdById === user.id
}
