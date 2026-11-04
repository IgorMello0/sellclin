import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { isDefaultRole } from '../bootstrap/default-roles.js'

export const router = Router()

// Listar cargos da empresa do usuário logado
router.get('/', auth(), async (req, res) => {
  try {
    const companyId = req.user?.companyId || undefined

    if (!companyId) {
      return res.status(404).json(createErrorResponse('Empresa não encontrada', 404))
    }

    const roles = await prisma.role.findMany({
      where: { companyId },
      include: {
        permissions: {
          include: { module: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json(createSuccessResponse(roles))
  } catch (error: any) {
    console.error('[Roles] Erro ao listar:', error)
    res.status(500).json(createErrorResponse(error.message, 500))
  }
})

// Buscar um cargo específico com permissões
router.get('/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const role = await prisma.role.findFirst({
      where: { id, companyId: req.user?.companyId || -1 },
      include: {
        permissions: true
      }
    })
    
    if (!role) return res.status(404).json(createErrorResponse('Cargo não encontrado', 404))
    
    res.json(createSuccessResponse(role))
  } catch (error: any) {
    res.status(500).json(createErrorResponse(error.message, 500))
  }
})

// Criar novo cargo
router.post('/', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const { name, value, permissions, isSpecialist, isAdmin, isSDR, isCloser, isManager } = req.body // permissions: Array<{ moduleId: number, hasAccess: boolean }>
    const companyId = req.user?.companyId || undefined
    const professionalId = req.user?.id

    if (!companyId || !professionalId) {
      return res.status(404).json(createErrorResponse('Empresa ou Profissional responsável não encontrado', 404))
    }

    // Verificar se já existe
    const existing = await prisma.role.findFirst({
      where: { companyId, value }
    })

    if (existing) {
      return res.status(400).json(createErrorResponse('Este cargo já existe nesta empresa', 400))
    }

    // Criar cargo e permissões em uma transação
    const created = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          companyId,
          professionalId,
          name,
          value,
          isSpecialist: isSpecialist || false,
          isAdmin: isAdmin || false,
          isSDR: isSDR || false,
          isCloser: isCloser || false,
          isManager: isManager || false
        }
      })

      if (permissions && Array.isArray(permissions)) {
        await tx.rolePermission.createMany({
          data: permissions.map((p: any) => ({
            roleId: newRole.id,
            moduleId: p.moduleId,
            hasAccess: p.hasAccess,
            subPermissions: p.subPermissions || null
          }))
        })
      }

      return newRole
    })

    res.status(201).json(createSuccessResponse(created))
  } catch (error: any) {
    console.error('[Roles] Erro ao criar:', error)
    res.status(500).json(createErrorResponse(error.message, 500))
  }
})

// Atualizar cargo e permissões
router.put('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, permissions, isSpecialist, isAdmin, isSDR, isCloser, isManager } = req.body

    const existing = await prisma.role.findFirst({
      where: { id, companyId: req.user?.companyId || -1 },
      select: { id: true },
    })
    if (!existing) return res.status(404).json(createErrorResponse('Cargo nao encontrado', 404))

    const updated = await prisma.$transaction(async (tx) => {
      // Atualizar nome do cargo
      const role = await tx.role.update({
        where: { id },
        data: { 
          name,
          isSpecialist: isSpecialist !== undefined ? isSpecialist : undefined,
          isAdmin: isAdmin !== undefined ? isAdmin : undefined,
          isSDR: isSDR !== undefined ? isSDR : undefined,
          isCloser: isCloser !== undefined ? isCloser : undefined,
          isManager: isManager !== undefined ? isManager : undefined
        }
      })

      // Atualizar permissões (deleta e recria para simplificar)
      if (permissions && Array.isArray(permissions)) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id }
        })

        await tx.rolePermission.createMany({
          data: permissions.map((p: any) => ({
            roleId: id,
            moduleId: p.moduleId,
            hasAccess: p.hasAccess,
            subPermissions: p.subPermissions || null
          }))
        })
      }

      return role
    })

    res.json(createSuccessResponse(updated))
  } catch (error: any) {
    console.error('[Roles] Erro ao atualizar:', error)
    res.status(500).json(createErrorResponse(error.message, 500))
  }
})

// Deletar cargo
router.delete('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const role = await prisma.role.findFirst({
      where: { id, companyId: req.user?.companyId || -1 },
      select: { id: true, value: true },
    })
    if (!role) return res.status(404).json(createErrorResponse('Cargo nao encontrado', 404))
    if (isDefaultRole(role.value)) {
      return res.status(400).json(createErrorResponse('Este é um cargo padrão do sistema e não pode ser excluído. Você pode ajustar suas permissões.', 400))
    }
    
    // Verificar se há usuários vinculados
    const usersCount = await prisma.usuario.count({
      where: {
        OR: [
          { roleId: id },
          { companyAccess: { some: { roleId: id } } },
        ],
      },
    })
    if (usersCount > 0) {
      return res.status(400).json(createErrorResponse('Não é possível excluir um cargo que possui usuários vinculados', 400))
    }

    await prisma.role.delete({ where: { id } })
    res.json(createSuccessResponse({ id }))
  } catch (error: any) {
    console.error('[Roles] Erro ao deletar:', error)
    res.status(500).json(createErrorResponse(error.message, 500))
  }
})
