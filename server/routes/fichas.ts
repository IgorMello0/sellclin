import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireModule } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { assertClientBelongsToCompany, getCompanyOwnerProfessionalId } from '../services/tenant.js'

export const router = Router()
router.use(auth(), requireModule('clientes'))
router.use(actionPermissions('clientes'))

router.get('/', auth(), async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const { clientId, type } = req.query as any
  const where: any = { client: { companyId: req.user!.companyId } }
  if (clientId) where.clientId = Number(clientId)
  if (type) where.type = type

  const [items, total] = await Promise.all([
    prisma.ficha.findMany({
      where,
      skip,
      take,
      orderBy: { id: 'desc' },
      include: {
        client: true,
        professional: { select: { id: true, name: true, specialization: true } },
        template: true,
      }
    }),
    prisma.ficha.count({ where })
  ])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})

router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const item = await prisma.ficha.findFirst({
    where: { id, client: { companyId: req.user!.companyId } },
    include: {
      client: true,
      professional: { select: { id: true, name: true, specialization: true } },
      template: true,
    }
  })
  if (!item) return res.status(404).json(createErrorResponse('Ficha não encontrada', 404))
  res.json(createSuccessResponse(item))
})

router.post('/', auth(), async (req, res) => {
  const { clientId, type, templateId, content } = req.body
  await assertClientBelongsToCompany(Number(clientId), req.user?.companyId)
  const professionalId = await getCompanyOwnerProfessionalId(req.user?.companyId)
  if (templateId) {
    const template = await prisma.fichaTemplate.findFirst({
      where: { id: Number(templateId), createdBy: professionalId },
      select: { id: true },
    })
    if (!template) return res.status(400).json(createErrorResponse('Template inválido para esta clínica', 400))
  }
  const created = await prisma.ficha.create({
    data: { clientId: Number(clientId), professionalId, type, templateId, content },
  })
  res.status(201).json(createSuccessResponse(created))
})

router.put('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const { type, templateId, content } = req.body
  const current = await prisma.ficha.findFirst({
    where: { id, client: { companyId: req.user!.companyId } },
    select: { id: true },
  })
  if (!current) return res.status(404).json(createErrorResponse('Ficha não encontrada', 404))
  const updated = await prisma.ficha.update({ where: { id: current.id }, data: { type, templateId, content } })
  res.json(createSuccessResponse(updated))
})

router.delete('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const current = await prisma.ficha.findFirst({
    where: { id, client: { companyId: req.user!.companyId } },
    select: { id: true },
  })
  if (!current) return res.status(404).json(createErrorResponse('Ficha não encontrada', 404))
  await prisma.ficha.delete({ where: { id: current.id } })
  res.json(createSuccessResponse({ id }))
})
import { actionPermissions } from '../middleware/action-permissions.js'
