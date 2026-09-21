import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { createErrorResponse } from '../utils/response.js'
import { prisma } from '../prisma.js'
import { canCompanyAccessModule } from '../services/billing.js'
import { getJwtSecret } from '../config/security.js'

export type AuthUser = {
  id: number
  role?: string | null
  companyId?: number | null
  allowedCompanies?: number[]
  type: 'usuario' | 'profissional' | 'cliente'
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}

export function auth(required = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.substring(7) : undefined

    if (!token) {
      if (required) return res.status(401).json(createErrorResponse('Não autenticado', 401))
      return next()
    }

    try {
      const payload = jwt.verify(token, getJwtSecret()) as AuthUser & { allowedCompanies?: number[] }

      // Always rebuild tenant access from the database. JWT claims are only identity hints.
      if (payload.type === 'profissional') {
        const professional = await prisma.professional.findUnique({
          where: { id: payload.id },
          select: {
            companyId: true,
            company: { select: { id: true, isActive: true } },
            ownedCompanies: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        })

        if (!professional) {
          return res.status(401).json(createErrorResponse('Conta nao encontrada', 401))
        }

        payload.allowedCompanies = Array.from(new Set([
          ...(professional.company?.isActive ? [professional.company.id] : []),
          ...professional.ownedCompanies.map(company => company.id),
        ]))
      } else if (payload.type === 'usuario') {
        const user = await prisma.usuario.findUnique({
          where: { id: payload.id },
          select: {
            companyId: true,
            isActive: true,
            company: { select: { id: true, isActive: true } },
            companyAccess: {
              where: { isActive: true, company: { isActive: true } },
              select: { companyId: true },
            },
          },
        })

        if (!user?.isActive) {
          return res.status(401).json(createErrorResponse('Conta inativa ou nao encontrada', 401))
        }

        payload.allowedCompanies = Array.from(new Set([
          ...(user.company?.isActive ? [user.company.id] : []),
          ...user.companyAccess.map(access => access.companyId),
        ]))
      }

      if (payload.type !== 'cliente' && !payload.allowedCompanies?.length) {
        return res.status(403).json(createErrorResponse('Nenhuma clinica ativa disponivel para esta conta', 403))
      }

      if (payload.companyId && !payload.allowedCompanies?.includes(payload.companyId)) {
        payload.companyId = payload.allowedCompanies?.[0] || null
      }
      
      // Se o frontend solicitar troca de contexto (clínica)
      const targetCompanyId = req.headers['x-company-id']
      if (targetCompanyId) {
        const id = Number(targetCompanyId)
        // Verifica se o usuário tem permissão para acessar esta clínica
        if (payload.allowedCompanies && payload.allowedCompanies.includes(id)) {
          payload.companyId = id
        } else if ((payload.type as string) !== 'admin') {
          // Bloqueia a troca se a clínica não estiver na lista (a menos que seja super admin)
          return res.status(403).json(createErrorResponse('Acesso negado a esta clínica', 403))
        } else {
          payload.companyId = id
        }
      }

      // Role claims can become stale after an owner changes a team member's role.
      // Resolve the role for the active company on every authenticated request.
      if (payload.type === 'usuario' && payload.companyId) {
        const [companyAccess, user] = await Promise.all([
          prisma.userCompanyAccess.findUnique({
            where: {
              userId_companyId: {
                userId: payload.id,
                companyId: payload.companyId,
              },
            },
            select: { isActive: true, role: { select: { value: true } } },
          }),
          prisma.usuario.findUnique({
            where: { id: payload.id },
            select: { role: { select: { value: true } } },
          }),
        ])

        if (companyAccess && !companyAccess.isActive) {
          return res.status(403).json(createErrorResponse('Acesso inativo nesta clinica', 403))
        }

        payload.role = companyAccess?.role?.value || user?.role?.value || null
      }
      
      req.user = payload
      return next()
    } catch {
      return res.status(401).json(createErrorResponse('Token inválido', 401))
    }
  }
}

export function requireCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.companyId) return res.status(400).json(createErrorResponse('Empresa não definida', 400))
  return next()
}

export function requireCompanyAccess(paramName?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const companyId = paramName ? Number(req.params[paramName]) : req.user?.companyId

    if (!companyId || !Number.isInteger(companyId)) {
      return res.status(400).json(createErrorResponse('Empresa nao definida', 400))
    }

    if (!req.user?.allowedCompanies?.includes(companyId)) {
      return res.status(403).json(createErrorResponse('Acesso negado a esta clinica', 403))
    }

    return next()
  }
}

export function requireCompanyOwner(paramName?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.type !== 'profissional') {
        return res.status(403).json(createErrorResponse('Apenas o proprietario pode realizar esta acao', 403))
      }

      const companyId = paramName ? Number(req.params[paramName]) : req.user.companyId
      if (!companyId || !Number.isInteger(companyId)) {
        return res.status(400).json(createErrorResponse('Empresa nao definida', 400))
      }

      const company = await prisma.empresa.findFirst({
        where: { id: companyId, ownerId: req.user.id },
        select: { id: true },
      })

      if (!company) {
        return res.status(403).json(createErrorResponse('Apenas o proprietario pode realizar esta acao', 403))
      }

      return next()
    } catch (error) {
      console.error('[Auth] Erro ao validar proprietario:', error)
      return res.status(500).json(createErrorResponse('Erro ao validar acesso', 500))
    }
  }
}

export function requireRoles(roles: Array<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json(createErrorResponse('Sem permissão', 403))
    }
    return next()
  }
}

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json(createErrorResponse('Não autenticado', 401))
      }

      // Importar prisma aqui para evitar circular dependency
      const { prisma } = await import('../prisma.js')

      // Buscar o módulo pelo código
      const module = await prisma.module.findUnique({
        where: { code: moduleCode },
      })

      if (!module) {
        return res.status(503).json(createErrorResponse('Modulo nao configurado', 503))
      }

      const planAccess = await canCompanyAccessModule(req.user.companyId, moduleCode)
      if (!planAccess.hasAccess) {
        return res.status(403).json(
          createErrorResponse('Este modulo nao esta incluido no plano da clinica', 403)
        )
      }

      // Admin tem acesso a todos os modulos liberados pelo plano
      if (req.user.role === 'admin') {
        return next()
      }

      // Verificar permissão baseado no tipo de usuário
      if (req.user.type === 'profissional') {
        // Buscar permissão do profissional
        const permission = await prisma.professionalPermission.findUnique({
          where: {
            professionalId_moduleId: {
              professionalId: req.user.id,
              moduleId: module.id,
            },
          },
        })

        // Se não há permissão definida, por padrão tem acesso
        // Se há permissão, verificar se hasAccess é true
        if (permission && !permission.hasAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a este módulo', 403))
        }

        return next()
      } else if (req.user.type === 'usuario') {
        // Buscar o acesso do usuário à clínica ativa com o respectivo cargo e permissões
        const companyAccess = await prisma.userCompanyAccess.findUnique({
          where: {
            userId_companyId: {
              userId: req.user.id,
              companyId: req.user.companyId || 0,
            },
          },
          include: {
            role: {
              include: {
                permissions: {
                  where: { moduleId: module.id },
                },
              },
            },
          },
        })

        // Buscar o usuário global para fallback do cargo
        const userWithRole = await prisma.usuario.findUnique({
          where: { id: req.user.id },
          include: {
            role: {
              include: {
                permissions: {
                  where: { moduleId: module.id }
                }
              }
            }
          }
        })

        if (!userWithRole) {
          return res.status(403).json(createErrorResponse('Usuário não encontrado', 403))
        }

        const activeRole = companyAccess?.role || userWithRole.role
        const rolePermission = activeRole?.permissions[0]

        // Buscar permissão individual (override)
        const individualPermission = req.user.companyId
          ? await prisma.userCompanyPermission.findUnique({
              where: {
                userId_companyId_moduleId: {
                  userId: req.user.id,
                  companyId: req.user.companyId,
                  moduleId: module.id,
                },
              },
            })
          : null

        // Segue a mesma hierarquia de prioridade do frontend/permissions API:
        // 1. Permissão Individual (se existir)
        // 2. Permissão do Cargo (se existir)
        // 3. Padrão: Permitido (true)
        const hasAccess = individualPermission?.hasAccess ?? rolePermission?.hasAccess ?? true

        if (!hasAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a este módulo', 403))
        }

        return next()
      }

      // Tipo de usuário desconhecido
      return res.status(403).json(createErrorResponse('Tipo de usuário inválido', 403))
    } catch (error) {
      console.error('[Auth] Erro ao verificar permissão de módulo:', error)
      return res.status(500).json(createErrorResponse('Erro ao verificar permissão', 500))
    }
  }
}

export function requirePermission(moduleCode: string, permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json(createErrorResponse('Não autenticado', 401))
      }

      // Importar prisma aqui para evitar circular dependency
      const { prisma } = await import('../prisma.js')

      // Buscar o módulo pelo código
      const module = await prisma.module.findUnique({
        where: { code: moduleCode },
      })

      if (!module) {
        return res.status(503).json(createErrorResponse('Modulo nao configurado', 503))
      }

      const planAccess = await canCompanyAccessModule(req.user.companyId, moduleCode)
      if (!planAccess.hasAccess) {
        return res.status(403).json(
          createErrorResponse('Este modulo nao esta incluido no plano da clinica', 403)
        )
      }

      // Team administrators still obey explicit granular restrictions.
      if (req.user.type === 'profissional' && req.user.role === 'admin') {
        return next()
      }

      // Profissional tem acesso a tudo por padrão
      if (req.user.type === 'profissional') {
        const permission = await prisma.professionalPermission.findUnique({
          where: {
            professionalId_moduleId: {
              professionalId: req.user.id,
              moduleId: module.id,
            },
          },
        })

        if (permission && !permission.hasAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a este módulo', 403))
        }

        const subPerms = permission?.subPermissions as Record<string, boolean> | null
        const hasSubAccess = subPerms && subPerms[permissionKey] !== undefined ? subPerms[permissionKey] : true

        if (!hasSubAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a esta funcionalidade', 403))
        }

        return next()
      } else if (req.user.type === 'usuario') {
        // Buscar o acesso do usuário à clínica ativa com o respectivo cargo e permissões
        const companyAccess = await prisma.userCompanyAccess.findUnique({
          where: {
            userId_companyId: {
              userId: req.user.id,
              companyId: req.user.companyId || 0,
            },
          },
          include: {
            role: {
              include: {
                permissions: {
                  where: { moduleId: module.id },
                },
              },
            },
          },
        })

        // Buscar o usuário global para fallback do cargo
        const userWithRole = await prisma.usuario.findUnique({
          where: { id: req.user.id },
          include: {
            role: {
              include: {
                permissions: {
                  where: { moduleId: module.id }
                }
              }
            }
          }
        })

        if (!userWithRole) {
          return res.status(403).json(createErrorResponse('Usuário não encontrado', 403))
        }

        const activeRole = companyAccess?.role || userWithRole.role
        const rolePermission = activeRole?.permissions[0]

        // Buscar permissão individual (override)
        const individualPermission = req.user.companyId
          ? await prisma.userCompanyPermission.findUnique({
              where: {
                userId_companyId_moduleId: {
                  userId: req.user.id,
                  companyId: req.user.companyId,
                  moduleId: module.id,
                },
              },
            })
          : null

        const hasAccess = individualPermission?.hasAccess ?? rolePermission?.hasAccess ?? true

        if (!hasAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a este módulo', 403))
        }

        // Se tem acesso ao módulo principal, verifica a sub-permissão granular
        const subPerms = rolePermission?.subPermissions as Record<string, boolean> | null
        const hasSubAccess = subPerms && subPerms[permissionKey] !== undefined ? subPerms[permissionKey] : true

        if (!hasSubAccess) {
          return res.status(403).json(createErrorResponse('Acesso negado a esta funcionalidade', 403))
        }

        return next()
      }

      return res.status(403).json(createErrorResponse('Tipo de usuário inválido', 403))
    } catch (error) {
      console.error('[Auth] Erro ao verificar sub-permissão:', error)
      return res.status(500).json(createErrorResponse('Erro ao verificar permissão', 500))
    }
  }
}
