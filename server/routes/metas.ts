import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { getCompanyOwnerProfessionalId } from '../services/tenant.js'

export const router = Router()
router.use(auth(), requireModule('metas'))
router.use(auth(), actionPermissions('metas'))
router.use((req, res, next) => {
  if (!req.user?.companyId) return res.status(400).json(createErrorResponse('Clínica não definida', 400))
  next()
})

// Listar metas da clínica ativa
router.get('/', auth(), async (req, res) => {
  try {
    const companyId = req.user!.companyId!

    const items = await prisma.goal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    })
    
    // Converter Decimals para Number para facilitar o uso no frontend
    const mappedItems = items.map(item => ({
      ...item,
      revenueTarget: Number(item.revenueTarget),
      avgTicket: Number(item.avgTicket)
    }))
    
    res.json(createSuccessResponse(mappedItems))
  } catch (error: any) {
    console.error('[Metas] Erro ao buscar metas:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar metas', 500))
  }
})

// Salvar nova meta
router.post('/', auth(), async (req, res) => {
  try {
    const { name, revenueTarget, avgTicket, schedulingRate, showupRate, closingRate } = req.body
    
    if (!name) {
      return res.status(400).json(createErrorResponse('Dados incompletos', 400))
    }

    const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
    
    const created = await prisma.goal.create({
      data: { 
        professionalId,
        companyId: req.user!.companyId!,
        name, 
        revenueTarget: Number(revenueTarget), 
        avgTicket: Number(avgTicket), 
        schedulingRate: Number(schedulingRate), 
        showupRate: Number(showupRate), 
        closingRate: Number(closingRate)
      }
    })
    
    res.json(createSuccessResponse(created))
  } catch (error: any) {
    console.error('[Metas] Erro ao salvar meta:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao salvar meta', 500))
  }
})

// Deletar meta
router.delete('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const deleted = await prisma.goal.deleteMany({ where: { id, companyId: req.user!.companyId! } })
    if (!deleted.count) return res.status(404).json(createErrorResponse('Meta não encontrada', 404))
    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    console.error('[Metas] Erro ao excluir meta:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao excluir meta', 500))
  }
})
import { actionPermissions } from '../middleware/action-permissions.js'
