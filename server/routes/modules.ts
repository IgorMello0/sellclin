import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'

export const router = Router()

// Listar todos os módulos ativos
router.get('/', auth(), async (_req, res) => {
  try {
    const modules = await prisma.module.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })
    res.json(createSuccessResponse(modules))
  } catch (error: any) {
    console.error('[Modules] Erro ao listar módulos:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao listar módulos', 500))
  }
})

// Buscar módulo por código
router.get('/:code', auth(), async (req, res) => {
  try {
    const code = String(req.params.code)
    const module = await prisma.module.findUnique({
      where: { code },
    })
    
    if (!module) {
      return res.status(404).json(createErrorResponse('Módulo não encontrado', 404))
    }
    
    res.json(createSuccessResponse(module))
  } catch (error: any) {
    console.error('[Modules] Erro ao buscar módulo:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar módulo', 500))
  }
})

router.post('/', auth(), (_req, res) => res.status(405).json(
  createErrorResponse('Modulos globais sao gerenciados somente pelo bootstrap do sistema', 405)
))

router.put('/:id', auth(), (_req, res) => res.status(405).json(
  createErrorResponse('Modulos globais sao gerenciados somente pelo bootstrap do sistema', 405)
))

router.delete('/:id', auth(), (_req, res) => res.status(405).json(
  createErrorResponse('Modulos globais sao gerenciados somente pelo bootstrap do sistema', 405)
))
