import { Router } from 'express'
import { ownerSubPermissions } from '../config/permission-keys.js'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { logAudit } from '../utils/audit.js'
import { getCompanyModuleEntitlements, OPERATIONAL_SUBSCRIPTION_STATUSES, ALWAYS_ALLOWED_MODULES } from '../services/billing.js'

export const router = Router()

async function getPlanPermissionContext(companyId?: number | null) {
  const entitlements = await getCompanyModuleEntitlements(companyId)
  const statusAllowsUsage = OPERATIONAL_SUBSCRIPTION_STATUSES.has(entitlements.subscriptionStatus)

  return {
    planCode: entitlements.planCode,
    subscriptionStatus: entitlements.subscriptionStatus,
    canAccessModule(moduleCode: string) {
      if (ALWAYS_ALLOWED_MODULES.has(moduleCode)) return true
      return statusAllowsUsage && entitlements.moduleCodes.has(moduleCode)
    },
  }
}

// ==================== PERMISSÕES DE PROFISSIONAIS ====================

// Obter permissões de um profissional
router.get('/professional/:id', auth(), async (req, res) => {
  try {
    const professionalId = Number(req.params.id)
    const isOwnProfile = req.user?.type === 'profissional' && req.user.id === professionalId

    if (!isOwnProfile) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }

    // Buscar todas as permissões do profissional
    const permissions = await prisma.professionalPermission.findMany({
      where: { professionalId },
      include: { module: true },
    })

    // Buscar todos os módulos para mostrar os que não têm permissão definida
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    // Mapear permissões
    const permissionsMap = allModules.map((module) => {
      const permission = permissions.find((p) => p.moduleId === module.id)
      return {
        moduleId: module.id,
        moduleCode: module.code,
        moduleName: module.name,
        moduleIcon: module.icon,
        hasAccess: (req.user?.isCompanyOwner === true || permission?.hasAccess === true),
        subPermissions: permission?.subPermissions ?? null,
      }
    })

    res.json(createSuccessResponse(permissionsMap))
  } catch (error: any) {
    console.error('[Permissions] Erro ao buscar permissões do profissional:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar permissões', 500))
  }
})

// Atualizar permissões de um profissional (apenas admin)
router.put('/professional/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const professionalId = Number(req.params.id)
    if (req.user?.id !== professionalId) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }
    const { permissions } = req.body as { permissions: Array<{ moduleId: number; hasAccess: boolean }> }

    if (!Array.isArray(permissions)) {
      return res.status(400).json(createErrorResponse('Formato de permissões inválido', 400))
    }

    // Verificar se o profissional existe
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    })

    if (!professional) {
      return res.status(404).json(createErrorResponse('Profissional não encontrado', 404))
    }

    // Atualizar ou criar permissões
    const results = []
    for (const perm of permissions) {
      const result = await prisma.professionalPermission.upsert({
        where: {
          professionalId_moduleId: {
            professionalId,
            moduleId: perm.moduleId,
          },
        },
        update: {
          hasAccess: perm.hasAccess,
        },
        create: {
          professionalId,
          moduleId: perm.moduleId,
          hasAccess: perm.hasAccess,
        },
        include: { module: true },
      })
      results.push(result)
    }
    
    if (req.user?.type === 'profissional') {
      logAudit(req.user.id, 'ATUALIZAR_PERMISSOES_PROFISSIONAL', 'ProfessionalPermission', professionalId)
    }

    res.json(createSuccessResponse(results))
  } catch (error: any) {
    console.error('[Permissions] Erro ao atualizar permissões do profissional:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar permissões', 500))
  }
})

// ==================== PERMISSÕES DE USUÁRIOS ====================

// Obter permissões de um usuário
router.get('/user/:id', auth(), async (req, res) => {
  try {
    const userId = Number(req.params.id)
    
    // Buscar o usuário para validação
    const user = await prisma.usuario.findFirst({
      where: {
        id: userId,
        OR: [
          { companyId: req.user?.companyId || -1 },
          { companyAccess: { some: { companyId: req.user?.companyId || -1, isActive: true } } },
        ],
      },
      include: {
        companyAccess: {
          where: { companyId: req.user?.companyId || -1, isActive: true },
          include: { role: true },
        },
      },
    })

    if (!user) {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }

    const isProfessional = req.user?.type === 'profissional'
    const isOwnUser = req.user?.type === 'usuario' && req.user?.id === userId
    if (!isOwnUser && !isProfessional) {
      return res.status(403).json(createErrorResponse('Acesso negado', 403))
    }

    // Buscar permissões do usuário
    const permissions = await prisma.userCompanyPermission.findMany({
      where: { userId, companyId: req.user?.companyId || -1 },
      include: { module: true },
    })

    const activeRoleId = user.companyAccess[0]?.roleId || (user.companyId === req.user?.companyId ? user.roleId : null)
    const rolePermissions = activeRoleId
      ? await prisma.rolePermission.findMany({
          where: { roleId: activeRoleId },
        })
      : []

    // Se for profissional, buscar suas próprias permissões para filtrar
    let professionalPermissions: any[] = []
    if (isProfessional) {
      professionalPermissions = await prisma.professionalPermission.findMany({
        where: { professionalId: req.user.id },
        include: { module: true },
      })
    }

    // Buscar todos os módulos
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    // Mapear permissões (usuário só pode ter acesso aos módulos que o profissional tem)
    const permissionsMap = allModules.map((module) => {
      const userPermission = permissions.find((p) => p.moduleId === module.id)
      const rolePermission = rolePermissions.find((p) => p.moduleId === module.id)
      
      // Se for profissional, verificar se ele tem acesso ao módulo
      if (isProfessional) {
        const profPermission = professionalPermissions.find((p) => p.moduleId === module.id)
        const professionalHasAccess = (req.user?.isCompanyOwner === true || profPermission?.hasAccess === true)
        
        return {
          moduleId: module.id,
          moduleCode: module.code,
          moduleName: module.name,
          moduleIcon: module.icon,
          hasAccess: userPermission?.hasAccess ?? rolePermission?.hasAccess ?? false,
          canEdit: professionalHasAccess, // Só pode editar se o profissional tem acesso
        }
      }

      return {
        moduleId: module.id,
        moduleCode: module.code,
        moduleName: module.name,
        moduleIcon: module.icon,
        hasAccess: userPermission?.hasAccess ?? rolePermission?.hasAccess ?? false,
        subPermissions: rolePermission?.subPermissions ?? null,
        canEdit: true,
      }
    })

    res.json(createSuccessResponse(permissionsMap))
  } catch (error: any) {
    console.error('[Permissions] Erro ao buscar permissões do usuário:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar permissões', 500))
  }
})

// Atualizar permissões de um usuário (profissional da mesma empresa)
router.put('/user/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const userId = Number(req.params.id)
    const { permissions } = req.body as { permissions: Array<{ moduleId: number; hasAccess: boolean }> }

    if (!Array.isArray(permissions)) {
      return res.status(400).json(createErrorResponse('Formato de permissões inválido', 400))
    }

    // Buscar o usuário
    const companyId = req.user?.companyId || -1
    const user = await prisma.usuario.findFirst({
      where: {
        id: userId,
        OR: [
          { companyId },
          { companyAccess: { some: { companyId, isActive: true } } },
        ],
      },
    })

    if (!user) {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }

    if (req.user?.type === 'profissional') {
      const professionalPermissions = await prisma.professionalPermission.findMany({
        where: { professionalId: req.user.id },
      })

      // Validar que o profissional não está dando permissões que ele não tem
      for (const perm of permissions) {
        if (perm.hasAccess) {
          const profPerm = professionalPermissions.find((p) => p.moduleId === perm.moduleId)
          const professionalHasAccess = profPerm?.hasAccess ?? true
          
          if (!professionalHasAccess) {
            const module = await prisma.module.findUnique({ where: { id: perm.moduleId } })
            return res.status(403).json(
              createErrorResponse(
                `Você não pode dar acesso ao módulo "${module?.name}" pois você não tem acesso a ele`,
                403
              )
            )
          }
        }
      }
    }

    // Atualizar ou criar permissões
    const results = []
    for (const perm of permissions) {
      const result = await prisma.userCompanyPermission.upsert({
        where: {
          userId_companyId_moduleId: {
            userId,
            companyId,
            moduleId: perm.moduleId,
          },
        },
        update: {
          hasAccess: perm.hasAccess,
        },
        create: {
          userId,
          companyId,
          moduleId: perm.moduleId,
          hasAccess: perm.hasAccess,
        },
        include: { module: true },
      })
      results.push(result)
    }
    
    if (req.user?.type === 'profissional') {
      logAudit(req.user.id, 'ATUALIZAR_PERMISSOES_USUARIO', 'UserPermission', userId)
    }

    res.json(createSuccessResponse(results))
  } catch (error: any) {
    console.error('[Permissions] Erro ao atualizar permissões do usuário:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar permissões', 500))
  }
})

router.get('/my-permissions', auth(), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(createErrorResponse('Nao autenticado', 401))
    }

    const planContext = await getPlanPermissionContext(req.user.companyId)
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })

    const withPlan = (module: { code: string; name: string }, internalHasAccess: boolean, subPermissions?: any) => {
      const planHasAccess = planContext.canAccessModule(module.code)
      return {
        moduleCode: module.code,
        moduleName: module.name,
        hasAccess: internalHasAccess && planHasAccess,
        blockedByPlan: !planHasAccess,
        planCode: planContext.planCode,
        subscriptionStatus: planContext.subscriptionStatus,
        subPermissions: subPermissions || null
      }
    }

    if (req.user.isCompanyOwner === true) {
      return res.json(createSuccessResponse(allModules.map((module) => withPlan(module, true, ownerSubPermissions(module.code)))))
    }

    if (req.user.type === 'profissional') {
      const profPermissions = await prisma.professionalPermission.findMany({
        where: { professionalId: req.user.id },
      })

      const permissions = allModules.map((module) => {
        const perm = profPermissions.find((permission) => permission.moduleId === module.id)
        return withPlan(module, perm?.hasAccess ?? false, perm?.subPermissions)
      })

      return res.json(createSuccessResponse(permissions))
    }

    if (req.user.type === 'usuario') {
      const user = await prisma.usuario.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: { permissions: true },
          },
          companyAccess: {
            where: req.user.companyId ? { companyId: req.user.companyId } : undefined,
            include: {
              role: {
                include: { permissions: true },
              },
            },
          },
        },
      })

      const activeAccess = user?.companyAccess?.[0]
      const rolePermissions = activeAccess?.role?.permissions || (user?.companyId === req.user.companyId ? user?.role?.permissions : []) || []
      const userPermissions = await prisma.userCompanyPermission.findMany({
        where: { userId: req.user.id, companyId: req.user.companyId || -1 },
      })

      const permissions = allModules.map((module) => {
        const individual = userPermissions.find((permission) => permission.moduleId === module.id)
        const rolePermission = rolePermissions.find((permission) => permission.moduleId === module.id)
        return withPlan(module, individual?.hasAccess ?? rolePermission?.hasAccess ?? false, rolePermission?.subPermissions)
      })

      return res.json(createSuccessResponse(permissions))
    }

    return res.json(createSuccessResponse([]))
  } catch (error: any) {
    console.error('[Permissions] Erro ao buscar permissoes do usuario logado:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar permissoes', 500))
  }
})
