import { Router } from 'express'
import { actionPermissions } from '../middleware/action-permissions.js'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { getCompanyOwnerProfessionalId } from '../services/tenant.js'

export const router = Router()
router.use(auth(), requireModule('clientes'))
router.use(actionPermissions('clientes'))

router.get('/', auth(), async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const createdBy = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const where = { companyId: req.user!.companyId!, createdBy }
  const [items, total] = await Promise.all([
    prisma.fichaTemplate.findMany({
      where,
      skip,
      take,
      orderBy: { id: 'desc' },
      include: { creator: { select: { id: true, name: true } } }
    }),
    prisma.fichaTemplate.count({ where })
  ])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})

router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const createdBy = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const item = await prisma.fichaTemplate.findFirst({
    where: { id, companyId: req.user!.companyId!, createdBy },
    include: { creator: { select: { id: true, name: true } } }
  })
  if (!item) return res.status(404).json(createErrorResponse('Template não encontrado', 404))
  res.json(createSuccessResponse(item))
})

router.post('/', auth(), async (req, res) => {
  const { name, description, category, fields } = req.body
  const createdBy = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const created = await prisma.fichaTemplate.create({ data: { name, description, category, fields, createdBy, companyId: req.user!.companyId! } })
  res.status(201).json(createSuccessResponse(created))
})

router.put('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const { name, description, category, fields } = req.body
  const createdBy = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const current = await prisma.fichaTemplate.findFirst({ where: { id, companyId: req.user!.companyId!, createdBy }, select: { id: true } })
  if (!current) return res.status(404).json(createErrorResponse('Template não encontrado', 404))
  const updated = await prisma.fichaTemplate.update({ where: { id: current.id }, data: { name, description, category, fields } })
  res.json(createSuccessResponse(updated))
})

router.delete('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const createdBy = await getCompanyOwnerProfessionalId(req.user?.companyId)
  const current = await prisma.fichaTemplate.findFirst({ where: { id, companyId: req.user!.companyId!, createdBy }, select: { id: true } })
  if (!current) return res.status(404).json(createErrorResponse('Template não encontrado', 404))
  await prisma.fichaTemplate.delete({ where: { id: current.id } })
  res.json(createSuccessResponse({ id }))
})
