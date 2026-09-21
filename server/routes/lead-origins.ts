import { Router } from 'express'
import { auth, requireModule } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = Router()
router.use(auth(), requireModule('funnel'))
router.use(ownerConfiguration)

const DEFAULT_ORIGINS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'indicação', label: 'Indicação' },
  { value: 'meta ads', label: 'Meta Ads' },
  { value: 'google', label: 'Google' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'whatsapp', label: 'Whatsapp' },
  { value: 'site', label: 'Site' },
  { value: 'outro', label: 'Outro' },
];

async function ensureDefaultOrigins(companyId: number) {
  const count = await (prisma as any).leadOriginConfig.count({
    where: { companyId }
  })

  if (count === 0) {
    await prisma.$transaction(
      DEFAULT_ORIGINS.map((origin, index) => 
        (prisma as any).leadOriginConfig.create({
          data: {
            companyId,
            value: origin.value,
            label: origin.label,
            order: index,
            isDefault: true,
            isActive: true
          }
        })
      )
    )
  }
}

// GET /api/lead-origins
router.get('/', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user

    await ensureDefaultOrigins(companyId)

    const origins = await (prisma as any).leadOriginConfig.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        order: 'asc'
      }
    })

    res.json({ success: true, data: origins })
  } catch (error) {
    console.error('Erro ao buscar origens:', error)
    res.status(500).json({ success: false, error: { message: 'Erro ao buscar origens' } })
  }
})

// POST /api/lead-origins
router.post('/', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const { label } = req.body
    
    if (!label) {
      return res.status(400).json({ success: false, error: { message: 'Label é obrigatório' } })
    }

    const value = label.toLowerCase().replace(/\s+/g, '_')

    // Find highest order
    const lastOrigin = await (prisma as any).leadOriginConfig.findFirst({
      where: { companyId },
      orderBy: { order: 'desc' }
    })

    const newOrder = lastOrigin ? lastOrigin.order + 1 : 0

    const newOrigin = await (prisma as any).leadOriginConfig.create({
      data: {
        companyId,
        value,
        label,
        order: newOrder,
        isDefault: false,
        isActive: true
      }
    })

    res.json({ success: true, data: newOrigin })
  } catch (error) {
    console.error('Erro ao criar origem:', error)
    res.status(500).json({ success: false, error: { message: 'Erro ao criar origem' } })
  }
})

// PUT /api/lead-origins/:id
router.put('/:id', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const { id } = req.params
    const { label } = req.body

    const existing = await (prisma as any).leadOriginConfig.findFirst({
      where: {
        id: Number(id),
        companyId
      }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Origem não encontrada' } })
    }

    const updated = await (prisma as any).leadOriginConfig.update({
      where: { id: Number(id) },
      data: {
        label: label !== undefined ? label : existing.label,
        // Optional: you can update value too, but usually it's safer to keep value intact
      }
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Erro ao atualizar origem:', error)
    res.status(500).json({ success: false, error: { message: 'Erro ao atualizar origem' } })
  }
})

// DELETE /api/lead-origins/:id (Soft delete)
router.delete('/:id', auth(), async (req: any, res) => {
  try {
    const { companyId } = req.user
    const { id } = req.params

    const existing = await (prisma as any).leadOriginConfig.findFirst({
      where: {
        id: Number(id),
        companyId
      }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Origem não encontrada' } })
    }

    await (prisma as any).leadOriginConfig.update({
      where: { id: Number(id) },
      data: { isActive: false }
    })

    res.json({ success: true, message: 'Origem removida' })
  } catch (error) {
    console.error('Erro ao remover origem:', error)
    res.status(500).json({ success: false, error: { message: 'Erro ao remover origem' } })
  }
})

export { router as leadOriginsRouter }
import { ownerConfiguration } from '../middleware/action-permissions.js'
