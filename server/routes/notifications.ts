import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth } from '../middleware/auth.js'
import { createSuccessResponse, createErrorResponse } from '../utils/response.js'

export const router = Router()

// Listar notificações do usuário logado
router.get('/', auth(), async (req, res) => {
  try {
    const recipientId = req.user!.id
    const companyId = req.user!.companyId
    const isUser = req.user!.type === 'usuario'

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Clínica não definida', 400))
    }

    const where: any = { companyId }
    if (isUser) {
      where.recipientUserId = recipientId
    } else {
      where.recipientId = recipientId
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Pegar as 20 mais recentes
    })

    res.json(createSuccessResponse(notifications))
  } catch (error) {
    console.error('[Notifications] Erro ao buscar:', error)
    res.status(500).json(createErrorResponse('Erro ao buscar notificações', 500))
  }
})

// Marcar todas como lidas
router.put('/read-all', auth(), async (req, res) => {
  try {
    const recipientId = req.user!.id
    const companyId = req.user!.companyId
    const isUser = req.user!.type === 'usuario'

    if (!companyId) {
      return res.status(400).json(createErrorResponse('Clínica não definida', 400))
    }

    const where: any = { companyId, read: false }
    if (isUser) {
      where.recipientUserId = recipientId
    } else {
      where.recipientId = recipientId
    }

    await prisma.notification.updateMany({
      where,
      data: {
        read: true
      }
    })

    res.json(createSuccessResponse({ success: true }))
  } catch (error) {
    console.error('[Notifications] Erro ao marcar todas como lidas:', error)
    res.status(500).json(createErrorResponse('Erro ao atualizar notificações', 500))
  }
})

// Marcar uma específica como lida
router.put('/:id/read', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const recipientId = req.user!.id
    const isUser = req.user!.type === 'usuario'

    const where = { id, companyId: req.user!.companyId, ...(isUser ? { recipientUserId: recipientId } : { recipientId }) }
    const notification = await prisma.notification.findFirst({
      where
    })

    if (!notification) {
      return res.status(404).json(createErrorResponse('Notificação não encontrada', 404))
    }

    const isOwnNotification = isUser 
      ? notification.recipientUserId === recipientId
      : notification.recipientId === recipientId;

    if (!isOwnNotification) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }

    const updated = await prisma.notification.update({
      where,
      data: { read: true }
    })

    res.json(createSuccessResponse(updated))
  } catch (error) {
    console.error('[Notifications] Erro ao marcar como lida:', error)
    res.status(500).json(createErrorResponse('Erro ao atualizar notificação', 500))
  }
})
