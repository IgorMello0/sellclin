import { Router } from 'express'
import { auth, requireModule } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = Router()
router.use(auth(), requireModule('funnel'))
router.use(ownerConfiguration)

const DEFAULT_STATUSES = [
  { code: 'aguardando', label: 'Aguardando', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { code: 'ligar_tarde', label: 'Ligar mais tarde', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { code: 'retorna_amanha', label: 'Retorna amanhã', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { code: 'nao_respondeu', label: 'Não respondeu', color: 'bg-red-100 text-red-700 border-red-200' },
  { code: 'negociacao', label: 'Em negociação', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

async function ensureDefaultStatuses(companyId: number) {
  const count = await prisma.leadStatus.count({
    where: { companyId }
  })

  if (count === 0) {
    await prisma.$transaction(
      DEFAULT_STATUSES.map((status, index) => 
        prisma.leadStatus.create({
          data: {
            companyId,
            code: status.code,
            label: status.label,
            color: status.color,
            order: index,
            isDefault: true,
            isActive: true
          }
        })
      )
    )
  }
}

// GET /api/lead-statuses
router.get('/', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user

    await ensureDefaultStatuses(companyId)

    const statuses = await prisma.leadStatus.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        order: 'asc'
      }
    })

    res.json({ success: true, data: statuses })
  } catch (error: any) {
    console.error('Error fetching lead statuses:', error)
    res.status(500).json({ success: false, error: 'Erro ao buscar status' })
  }
})

// POST /api/lead-statuses
router.post('/', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const { label, color } = req.body

    const code = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    const maxOrderStatus = await prisma.leadStatus.findFirst({
      where: { companyId },
      orderBy: { order: 'desc' }
    })
    
    const newOrder = maxOrderStatus ? maxOrderStatus.order + 1 : 0

    const newStatus = await prisma.leadStatus.create({
      data: {
        companyId,
        code: `${code}_${Date.now()}`, // Ensure unique code
        label,
        color,
        order: newOrder,
        isDefault: false,
        isActive: true
      }
    })

    res.json({ success: true, data: newStatus })
  } catch (error: any) {
    console.error('Error creating lead status:', error)
    res.status(500).json({ success: false, error: 'Erro ao criar status' })
  }
})

// PUT /api/lead-statuses/:id
router.put('/:id', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const id = parseInt(req.params.id)
    const { label, color } = req.body

    const existingStatus = await prisma.leadStatus.findFirst({
      where: { id, companyId }
    })

    if (!existingStatus) {
      return res.status(404).json({ success: false, error: 'Status não encontrado' })
    }

    const updated = await prisma.leadStatus.update({
      where: { id },
      data: { label, color }
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error updating lead status:', error)
    res.status(500).json({ success: false, error: 'Erro ao atualizar status' })
  }
})

// PUT /api/lead-statuses/reorder
router.put('/reorder/all', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const { statuses } = req.body

    await prisma.$transaction(
      statuses.map((s: { id: number, order: number }) =>
        prisma.leadStatus.update({
          where: { id: s.id, companyId },
          data: { order: s.order }
        })
      )
    )

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error reordering lead statuses:', error)
    res.status(500).json({ success: false, error: 'Erro ao reordenar status' })
  }
})

// DELETE /api/lead-statuses/:id
router.delete('/:id', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const id = parseInt(req.params.id)

    const existingStatus = await prisma.leadStatus.findFirst({
      where: { id, companyId }
    })

    if (!existingStatus) {
      return res.status(404).json({ success: false, error: 'Status não encontrado' })
    }

    if (existingStatus.isDefault) {
      return res.status(400).json({ success: false, error: 'Não é possível remover um status padrão' })
    }

    // Instead of deleting, just deactivate to keep history
    await prisma.leadStatus.update({
      where: { id },
      data: { isActive: false }
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting lead status:', error)
    res.status(500).json({ success: false, error: 'Erro ao deletar status' })
  }
})

export default router
import { ownerConfiguration } from '../middleware/action-permissions.js'
