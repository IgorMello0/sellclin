import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { conversationScope } from '../services/conversation-access.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'

export const router = Router()
router.use(auth(), requireModule('funnel'))

// GET /api/cadence/:stageCode
router.get('/:stageCode', auth(), async (req, res) => {
  try {
    const stageCode = String(req.params.stageCode)
    const companyId = req.user?.companyId

    if (!companyId) return res.status(403).json(createErrorResponse('Acesso negado'))

    const config = await prisma.cadenceConfig.findUnique({
      where: {
        companyId_stageCode: {
          companyId,
          stageCode
        }
      }
    })

    if (!config) {
      return res.json(createSuccessResponse({
        stageCode,
        isActive: true,
        steps: []
      }))
    }

    res.json(createSuccessResponse(config))
  } catch (error: any) {
    console.error('[Cadence] Erro ao buscar configuração:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar configuração da cadência', 500))
  }
})

// PUT /api/cadence/:stageCode
router.put('/:stageCode', auth(), async (req, res) => {
  try {
    const stageCode = String(req.params.stageCode)
    const companyId = req.user?.companyId
    const { isActive, steps } = req.body

    if (!companyId) return res.status(403).json(createErrorResponse('Acesso negado'))
    if (req.user?.type !== 'usuario' && req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Acesso negado.'))
    }

    if (!(await conversationScope(req.user!)).canManage) {
      return res.status(403).json(createErrorResponse('Apenas proprietários ou gestores da clínica podem configurar cadências.', 403))
    }

    const config = await prisma.cadenceConfig.upsert({
      where: {
        companyId_stageCode: {
          companyId,
          stageCode
        }
      },
      update: {
        isActive: isActive !== undefined ? isActive : true,
        steps: steps || []
      },
      create: {
        companyId,
        stageCode,
        isActive: isActive !== undefined ? isActive : true,
        steps: steps || []
      }
    })

    if (isActive) {
      // Retrigger cadence for all leads currently in this stage so they get the new config
      const leads = await prisma.lead.findMany({
        where: { status: stageCode, companyId }
      });
      const { triggerCadenceForLead } = await import('../services/cadence.js');
      for (const lead of leads) {
        await triggerCadenceForLead(lead.id, companyId, stageCode, lead.sdrId || lead.closerId, lead.professionalId).catch(console.error);
      }
    } else if (isActive === false) {
      // Cancel pending tasks if cadence was deactivated
      await prisma.task.updateMany({
        where: { companyId, cadenceStageCode: stageCode, status: { notIn: ['completed', 'cancelled'] } },
        data: { status: 'cancelled' }
      });
    }

    res.json(createSuccessResponse(config))
  } catch (error: any) {
    console.error('[Cadence] Erro ao salvar configuração:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao salvar configuração da cadência', 500))
  }
})
