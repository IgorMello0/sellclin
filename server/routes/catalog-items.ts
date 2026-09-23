import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { getCompanyOwnerProfessionalId } from '../services/tenant.js'

export const router = Router()

// Catalog items are shared infrastructure for appointments, leads and the sales funnel.
// Any authenticated clinic user may read them; mutations remain protected by the
// internal catalog permission used by owners and administrators.
router.get('/', auth(), async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query)
    const profId = await getCompanyOwnerProfessionalId(req.user?.companyId)

    const where: any = { professionalId: profId };

    const [items, total] = await Promise.all([
      prisma.catalogItem.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: { category: true, appointments: true }
      }),
      prisma.catalogItem.count({ where })
    ])
    res.json(createSuccessResponse(items, { page, pageSize, total }))
  } catch (error: any) {
    console.error('[Catalog] Erro ao buscar itens:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar itens', 500))
  }
})

router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const item = await prisma.catalogItem.findFirst({
    where: { id, professionalId },
    include: { category: true, appointments: true }
  })
  if (!item) return res.status(404).json(createErrorResponse('Item de catálogo não encontrado', 404))
  res.json(createSuccessResponse(item))
})

router.post('/', auth(), requireModule('catalogos'), async (req, res) => {
  try {
    const { categoryId, name, description, price, imageUrl, status, durationMinutes } = req.body
    
    const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)

    const categoryIdNum = categoryId ? Number(categoryId) : null
    
    const created = await prisma.catalogItem.create({
      data: { 
        professionalId, 
        categoryId: categoryIdNum, 
        name, 
        description, 
        price: Number(price), 
        imageUrl, 
        status, 
        durationMinutes: Number(durationMinutes) || 30
      }
    })
    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao criar item de catálogo', 400))
  }
})

router.put('/:id', auth(), requireModule('catalogos'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { categoryId, name, description, price, imageUrl, status, durationMinutes } = req.body
    
    const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
    const current = await prisma.catalogItem.findFirst({ where: { id, professionalId } });
    if (!current) return res.status(404).json(createErrorResponse('Item não encontrado', 404));

    const categoryIdNum = categoryId ? Number(categoryId) : null
    
    const updated = await prisma.catalogItem.update({
      where: { id },
      data: { 
        categoryId: categoryIdNum, 
        name, 
        description, 
        price: price !== undefined ? Number(price) : undefined, 
        imageUrl, 
        status, 
        durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : undefined
      }
    })
    res.json(createSuccessResponse(updated))
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao atualizar item de catálogo', 400))
  }
})

router.delete('/:id', auth(), requireModule('catalogos'), async (req, res) => {
  const id = Number(req.params.id)
  const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const current = await prisma.catalogItem.findFirst({ where: { id, professionalId }, select: { id: true } })
  if (!current) return res.status(404).json(createErrorResponse('Item não encontrado', 404))
  await prisma.catalogItem.delete({ where: { id: current.id } })
  res.json(createSuccessResponse({ id }))
})
