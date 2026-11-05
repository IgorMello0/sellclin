import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { getCompanyOwnerProfessionalId } from '../services/tenant.js'

export const router = Router()
router.use(auth(), requireModule('catalogos'))

router.get('/', auth(), async (req, res) => {
  try {
    const { skip, take, page, pageSize } = parsePagination(req.query)
    
    const profId = await getCompanyOwnerProfessionalId(req.user?.companyId)

    const where = { companyId: req.user!.companyId!, professionalId: profId };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: { catalogItems: true }
      }),
      prisma.category.count({ where })
    ])
    res.json(createSuccessResponse(items, { page, pageSize, total }))
  } catch (error: any) {
    console.error('[Categories] Erro ao buscar categorias:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar categorias', 500))
  }
})

router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const item = await prisma.category.findFirst({
    where: { id, companyId: req.user!.companyId!, professionalId },
    include: { catalogItems: true }
  })
  if (!item) return res.status(404).json(createErrorResponse('Categoria não encontrada', 404))
  res.json(createSuccessResponse(item))
})

router.post('/', auth(), async (req, res) => {
  try {
    const { name, description, status } = req.body
    
    const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)

    const created = await prisma.category.create({ 
      data: { companyId: req.user!.companyId!, professionalId, name, description, status }
    })
    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao criar categoria', 400))
  }
})

router.put('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, description, status } = req.body
    
    const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
    const current = await prisma.category.findFirst({ where: { id, companyId: req.user!.companyId!, professionalId } });
    if (!current) return res.status(404).json(createErrorResponse('Categoria não encontrada', 404));

    const updated = await prisma.category.update({ 
      where: { id }, 
      data: { name, description, status } 
    })
    res.json(createSuccessResponse(updated))
  } catch (error: any) {
    res.status(400).json(createErrorResponse(error.message || 'Erro ao atualizar categoria', 400))
  }
})

router.delete('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const item = await prisma.category.findFirst({ where: { id, companyId: req.user!.companyId!, professionalId }, select: { id: true } })
  if (!item) return res.status(404).json(createErrorResponse('Categoria não encontrada', 404))
  await prisma.category.delete({ where: { id: item.id } })
  res.json(createSuccessResponse({ id }))
})
