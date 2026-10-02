import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from '../services/password-policy.js'
import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import bcrypt from 'bcryptjs'
import { matchesLoginPassword } from '../services/password-policy.js'
import jwt from 'jsonwebtoken'
import { ensureCompanyDefaults } from '../bootstrap/defaults.js'
import { assertCanAddUserToCompany, BillingLimitError } from '../services/billing.js'
import { sendTeamInviteEmail } from '../services/email-verification.js'
import { getJwtSecret } from '../config/security.js'
import { passwordSessionStamp } from '../services/session-security.js'

export const router = Router()

function withoutSensitiveUserFields<T extends Record<string, any>>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user

  const safeCompany = (company: any) => company
    ? { id: company.id, name: company.name, isActive: company.isActive }
    : company

  return {
    ...safeUser,
    company: safeCompany(safeUser.company),
    companyAccess: Array.isArray(safeUser.companyAccess)
      ? safeUser.companyAccess.map((access: any) => ({
          ...access,
          company: safeCompany(access.company),
        }))
      : safeUser.companyAccess,
  }
}

async function getOwnedCompanyIds(professionalId: number) {
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    include: { ownedCompanies: { where: { isActive: true } } },
  })

  if (!professional) {
    return null
  }

  const ownedCompanyIds = professional.ownedCompanies.map((company) => company.id)
  return { professional, ownedCompanyIds }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  const emailAddress = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!emailAddress || typeof password !== 'string' || !password) {
    return res.status(400).json(createErrorResponse('Email e senha sao obrigatorios', 400))
  }
  const user = await prisma.usuario.findUnique({ 
    where: { email: emailAddress },
    include: {
      company: { where: { isActive: true }, select: { id: true, name: true } },
      role: true,
      companyAccess: {
        where: { isActive: true, company: { isActive: true } },
        include: {
          company: { select: { id: true, name: true } },
          role: true,
        },
      },
    }
  })
  if (!await matchesLoginPassword(password, user?.passwordHash)) return res.status(401).json(createErrorResponse('Credenciais inválidas', 401))
  if (!user.isActive || !user.emailVerified) {
    return res.status(403).json(createErrorResponse('Aceite o convite enviado para seu e-mail antes de acessar.', 403))
  }

  
  const availableCompanies = user.companyAccess.length > 0
    ? user.companyAccess.map(ca => ({ id: ca.company.id, name: ca.company.name, role: ca.role?.name }))
    : (user.company ? [{ id: user.company.id, name: user.company.name, role: user.role?.name }] : [])

  const allowedCompanies = availableCompanies.map(c => c.id)

  const token = jwt.sign({ 
    id: user.id, 
    role: user.role?.value || user.role?.name, 
    companyId: user.companyId, 
    type: 'usuario',
      passwordStamp: passwordSessionStamp(user.passwordHash, getJwtSecret()),
    allowedCompanies 
  }, getJwtSecret(), { expiresIn: '12h' })

  // Retornar dados do usuário no mesmo formato que profissional
  res.json(createSuccessResponse({ 
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role?.name, // Nome do cargo para o frontend
      phone: '',
      onboardingCompleted: user.onboardingCompleted,
      companyId: user.companyId,
      companyName: user.company?.name,
      companies: availableCompanies
    }
  }))
})

// Completar o Onboarding para Usuário
router.post('/onboarding/complete', auth(), async (req, res) => {
  try {
    await prisma.usuario.update({
      where: { id: req.user!.id },
      data: { onboardingCompleted: true }
    });
    res.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error('[Onboarding Usuario] Erro ao concluir:', error);
    res.status(500).json(createErrorResponse('Erro ao concluir onboarding', 500));
  }
})

router.get('/', auth(), async (req, res) => {
  try {
    // Lista a equipe da clinica ativa ou, quando solicitado pelo dono, de suas clinicas ativas.
    let ownedCompanyIds: number[] = []

    if (req.user?.type !== 'profissional' && req.user?.type !== 'usuario') {
      return res.status(403).json(createErrorResponse('Tipo de usuario sem acesso a equipe', 403))
    }

    if (req.user?.type === 'usuario') {
      if (!req.user.companyId) {
        return res.status(400).json(createErrorResponse('Clinica nao definida', 400))
      }

      ownedCompanyIds = [req.user.companyId]
    } else {
      // Buscar profissional com as empresas que ele controla ou que estao no token.
      ownedCompanyIds = Array.from(new Set([
        ...(req.user.companyId ? [req.user.companyId] : []),
        ...(req.user.allowedCompanies || []),
      ].filter(Boolean) as number[]))

      // Se o frontend enviou X-Company-Id, filtrar apenas por essa clínica
      const requestedCompanyId = req.headers['x-company-id'] ? Number(req.headers['x-company-id']) : null;
      const allCompanies = req.query.allCompanies === 'true';

      if (!allCompanies) {
        if (requestedCompanyId && ownedCompanyIds.includes(requestedCompanyId)) {
          ownedCompanyIds = [requestedCompanyId];
        } else if (req.user.companyId && ownedCompanyIds.includes(req.user.companyId)) {
          // Se companyId do token foi sobrescrito pelo middleware (via X-Company-Id), usar ele
          ownedCompanyIds = [req.user.companyId];
        }
      }
    }

    if (ownedCompanyIds.length === 0) {
      return res.status(400).json(createErrorResponse('Empresa não encontrada', 400))
    }
    const { skip, take, page, pageSize } = parsePagination(req.query)
    
    // Buscar usuários que pertencem diretamente OU que têm acesso via tabela ponte
    const where = {
      OR: [
        { companyAccess: { some: { companyId: { in: ownedCompanyIds }, isActive: true } } },
        {
          companyId: { in: ownedCompanyIds },
          companyAccess: { none: {} },
        },
      ]
    }
    
    const [items, total] = await Promise.all([
      prisma.usuario.findMany({ 
        where,
        skip, 
        take, 
        orderBy: { id: 'desc' }, 
        include: {
          company: { select: { id: true, name: true } },
          role: true,
          companyAccess: {
            include: {
              company: { select: { id: true, name: true } },
              role: true,
            },
          },
        }
      }),
      prisma.usuario.count({ where })
    ])
    
    res.json(createSuccessResponse(items.map(withoutSensitiveUserFields), { page, pageSize, total }))
  } catch (error: any) {
    console.error('[Usuarios] Erro ao buscar usuários:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao buscar usuários', 500))
  }
})

router.post('/', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const professional = await prisma.professional.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, companyId: true }
    })

    if (!professional || !professional.companyId) {
      return res.status(400).json(createErrorResponse('Profissional não possui empresa associada', 400))
    }
    
    const companyId = req.user.companyId!

    const { name, email, role, isActive, companyIds } = req.body
    const emailAddress = String(email || '').toLowerCase().trim()
    
    // Validações
    if (!name || !emailAddress) {
      return res.status(400).json(createErrorResponse('Nome e email sao obrigatorios', 400))
    }

    const ownership = await getOwnedCompanyIds(req.user.id)
    if (!ownership) {
      return res.status(400).json(createErrorResponse('Profissional nao possui empresa associada', 400))
    }

    // Verificar se email já existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email: emailAddress },
      include: {
        company: true,
        role: true,
        companyAccess: { include: { company: true, role: true } },
      },
    })
    if (existingUser) {
      const existingCompanyIds = Array.from(new Set([
        ...(existingUser.companyId ? [existingUser.companyId] : []),
        ...existingUser.companyAccess.map((access) => access.companyId),
      ]))
      const hasSharedCompany = existingCompanyIds.some((existingCompanyId) => ownership.ownedCompanyIds.includes(existingCompanyId))

      if (hasSharedCompany && (!existingUser.isActive || !existingUser.emailVerified)) {
        const inviteCompanyName = existingUser.company?.name || existingUser.companyAccess[0]?.company?.name
        await sendTeamInviteEmail({
          email: existingUser.email,
          name: existingUser.name,
          companyName: inviteCompanyName,
          userId: existingUser.id,
        })
        return res.json(createSuccessResponse({ ...withoutSensitiveUserFields(existingUser), inviteResent: true }))
      }

      if (hasSharedCompany) {
        return res.status(400).json(createErrorResponse('Este e-mail ja pertence a um funcionario ativo da equipe', 400))
      }

      return res.status(400).json(createErrorResponse('Email ja cadastrado', 400))
    }

    const targetCompanyIds = Array.isArray(companyIds) && companyIds.length > 0
      ? Array.from(new Set(companyIds.map((id: any) => Number(id)).filter(Boolean)))
      : [companyId]

    if (targetCompanyIds.some((targetCompanyId) => !ownership.ownedCompanyIds.includes(targetCompanyId))) {
      return res.status(403).json(createErrorResponse('Uma das clinicas selecionadas nao pertence a sua conta', 403))
    }
    const primaryCompanyId = targetCompanyIds.includes(companyId) ? companyId : targetCompanyIds[0]

    for (const targetCompanyId of targetCompanyIds) {
      try {
        await assertCanAddUserToCompany(professional.id, targetCompanyId)
      } catch (error: any) {
        if (error instanceof BillingLimitError) {
          return res.status(error.status).json(createErrorResponse(error.message, error.status, {
            limitType: error.limitType,
            addonCode: error.addonCode,
            used: error.used,
            limit: error.limit,
            targetCompanyId,
          }))
        }
        throw error
      }
    }

    await ensureCompanyDefaults(prisma, primaryCompanyId, professional.id)
    const requestedRole = req.body.roleId
      ? await prisma.role.findFirst({ where: { id: Number(req.body.roleId), companyId: primaryCompanyId } })
      : null
    if (req.body.roleId && !requestedRole) {
      return res.status(400).json(createErrorResponse('Cargo invalido para a clinica principal', 400))
    }
    const defaultRole = await prisma.role.findUnique({
      where: {
        companyId_value: {
          companyId: primaryCompanyId,
          value: 'comercial',
        },
      },
    })
    const roleId = requestedRole?.id || defaultRole?.id || null
    const roleValue = requestedRole?.value || defaultRole?.value || 'comercial'

      const created = await prisma.usuario.create({ 
      data: { 
        companyId: primaryCompanyId,
        name, 
        email: emailAddress,
        passwordHash: '',
        roleId, 
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
        emailVerified: false,
        emailVerifiedAt: null,
        leadRoutingWeight: req.body.leadRoutingWeight !== undefined ? Number(req.body.leadRoutingWeight) : 1
      },
      include: { company: true, role: true }
    })
    
    for (const cId of targetCompanyIds) {
      await ensureCompanyDefaults(prisma, cId, professional.id)
      const companyRole = await prisma.role.findUnique({
        where: { companyId_value: { companyId: cId, value: roleValue } },
      })
      await prisma.userCompanyAccess.create({
        data: {
          userId: created.id,
          companyId: cId,
          roleId: companyRole?.id || null,
          isActive: true
        }
      })
    }
    
    try {
      await sendTeamInviteEmail({
        email: created.email,
        name: created.name,
        companyName: created.company?.name,
        userId: created.id,
      })
    } catch (emailError) {
      await prisma.usuario.delete({ where: { id: created.id } }).catch((cleanupError) => {
        console.error('[Usuarios] Falha ao limpar usuario apos erro de convite:', cleanupError)
      })
      throw emailError
    }

    const createdWithAccess = await prisma.usuario.findUnique({
      where: { id: created.id },
      include: { company: true, role: true, companyAccess: { include: { company: true, role: true } } },
    })
    res.status(201).json(createSuccessResponse(withoutSensitiveUserFields(createdWithAccess || created)))
  } catch (error: any) {
    console.error('[Usuarios] Erro ao criar usuário:', error)
    console.error('[Usuarios] Stack:', error.stack)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao criar usuário', 500))
  }
})

router.post('/:id/resend-invite', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Somente o profissional pode reenviar convites da equipe', 403))
    }

    const ownership = await getOwnedCompanyIds(req.user.id)
    if (!ownership) {
      return res.status(400).json(createErrorResponse('Profissional nao possui empresa associada', 400))
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        company: true,
        companyAccess: { include: { company: true } },
      },
    })

    if (!usuario) {
      return res.status(404).json(createErrorResponse('Usuario nao encontrado', 404))
    }

    const userCompanyIds = Array.from(new Set([
      ...(usuario.companyId ? [usuario.companyId] : []),
      ...usuario.companyAccess.map((access) => access.companyId),
    ]))
    const hasSharedCompany = userCompanyIds.some((companyId) => ownership.ownedCompanyIds.includes(companyId))
    if (!hasSharedCompany) {
      return res.status(403).json(createErrorResponse('Voce nao tem permissao para reenviar convite deste usuario', 403))
    }

    if (usuario.isActive && usuario.emailVerified) {
      return res.status(400).json(createErrorResponse('Este usuario ja aceitou o convite', 400))
    }

    const inviteCompanyName = usuario.company?.name || usuario.companyAccess[0]?.company?.name
    await sendTeamInviteEmail({
      email: usuario.email,
      name: usuario.name,
      companyName: inviteCompanyName,
      userId: usuario.id,
    })

    res.json(createSuccessResponse({ sent: true }))
  } catch (error: any) {
    console.error('[Usuarios] Erro ao reenviar convite:', error)
    res.status(500).json(createErrorResponse(error.message || 'Erro ao reenviar convite', 500))
  }
})

router.put('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Somente o profissional pode editar membros da equipe', 403))
    }

    const ownership = await getOwnedCompanyIds(req.user.id)
    const professional = ownership?.professional

    if (!professional) {
      return res.status(400).json(createErrorResponse('Profissional não encontrado', 400))
    }
    
    const ownedCompanyIds = ownership!.ownedCompanyIds

    // Verificar se o usuário existe
    const usuario = await prisma.usuario.findUnique({ where: { id }, include: { companyAccess: true } })
    if (!usuario) {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }

    // Só permite editar se o usuário tiver acesso a alguma clínica que o profissional seja dono
    const activeCompanyId = req.user.companyId!
    const belongsToActiveCompany = usuario.companyId === activeCompanyId
      || usuario.companyAccess.some((access) => access.companyId === activeCompanyId && access.isActive)
    if (!belongsToActiveCompany) {
      return res.status(403).json(createErrorResponse('Você não tem permissão para editar este usuário', 403))
    }

    const { name, email, password, role, isActive, companyIds, leadRoutingWeight } = req.body
    const preservePreviousLeadVisibility = req.body.preservePreviousLeadVisibility === true
    
    // Validações
    if (!name || !email) {
      return res.status(400).json(createErrorResponse('Nome e email são obrigatórios', 400))
    }

    if (password !== undefined && password !== '' && !isValidNewPassword(password)) {
      return res.status(400).json(createErrorResponse(PASSWORD_POLICY_MESSAGE, 400))
    }

    // Verificar se email já existe (exceto para o próprio usuário)
    const emailAddress = String(email).trim().toLowerCase()
    if (emailAddress !== usuario.email) {
      const existingUser = await prisma.usuario.findUnique({ where: { email: emailAddress } })
      if (existingUser) {
        return res.status(400).json(createErrorResponse('Email já cadastrado', 400))
      }
    }

    const data: any = { name, email: emailAddress, isActive }
    if (leadRoutingWeight !== undefined) data.leadRoutingWeight = Number(leadRoutingWeight)
    if (password) data.passwordHash = await bcrypt.hash(password, 10)
    if (usuario.isActive === false && isActive === true && !Array.isArray(companyIds)) {
      await assertCanAddUserToCompany(professional.id, activeCompanyId, id)
    }

    // Ao sair de uma funcao operacional, a responsabilidade atual deixa de conceder acesso.
    // Se o gestor optar por manter o historico, registramos explicitamente os leads atuais.
    let activeRequestedRole: any = null
    if (req.body.roleId !== undefined) {
      activeRequestedRole = await prisma.role.findFirst({
        where: { id: Number(req.body.roleId), companyId: activeCompanyId },
      })
      if (!activeRequestedRole) {
        return res.status(400).json(createErrorResponse('Cargo invalido para esta clinica', 400))
      }

      const activeAccess = usuario.companyAccess.find((access) => access.companyId === activeCompanyId && access.isActive)
      const previousRoleId = activeAccess?.roleId || (usuario.companyId === activeCompanyId ? usuario.roleId : null)
      const previousRole = previousRoleId
        ? await prisma.role.findFirst({ where: { id: previousRoleId, companyId: activeCompanyId } })
        : null

      if (previousRole && previousRole.id !== activeRequestedRole.id) {
        const previousAssignments: any[] = []
        if (previousRole.isSDR && !activeRequestedRole.isSDR) {
          previousAssignments.push({ sdrId: id }, { proposals: { some: { sdrId: id } } })
        }
        if (previousRole.isCloser && !activeRequestedRole.isCloser) {
          previousAssignments.push({ closerId: id }, { proposals: { some: { salespersonId: id } } })
        }
        if (previousRole.isSpecialist && !activeRequestedRole.isSpecialist) {
          previousAssignments.push({ especialistaId: id }, { proposals: { some: { specialistId: id } } })
        }

        if (previousAssignments.length > 0) {
          if (preservePreviousLeadVisibility) {
            const previousLeads = await prisma.lead.findMany({
              where: { companyId: activeCompanyId, OR: previousAssignments },
              select: { id: true },
            })
            if (previousLeads.length > 0) {
              await prisma.leadVisibilityGrant.createMany({
                data: previousLeads.map((lead) => ({
                  leadId: lead.id,
                  userId: id,
                  companyId: activeCompanyId,
                  reason: 'role_change',
                })),
                skipDuplicates: true,
              })
            }
          } else {
            await prisma.leadVisibilityGrant.deleteMany({
              where: { userId: id, companyId: activeCompanyId },
            })
          }
        }
      }
    }
    
    // Atualizar Múltiplas Clínicas
    if (Array.isArray(companyIds)) {
      const validCompanyIds = Array.from(new Set(
        companyIds.map((value: any) => Number(value)).filter(Boolean),
      )) as number[]
      if (validCompanyIds.some((companyId) => !ownedCompanyIds.includes(companyId))) {
        return res.status(403).json(createErrorResponse('Uma das clinicas selecionadas nao pertence a sua conta', 403))
      }
      
      if (validCompanyIds.length > 0) {
        const existingCompanyIds = Array.from(new Set([
          ...(usuario.companyId ? [usuario.companyId] : []),
          ...usuario.companyAccess.filter((access) => access.isActive).map((access) => access.companyId),
        ]))

        for (const cId of validCompanyIds) {
          if (
            isActive !== false
            && (!existingCompanyIds.includes(cId) || usuario.isActive === false)
          ) {
            try {
              await assertCanAddUserToCompany(professional.id, cId, id)
            } catch (error: any) {
              if (error instanceof BillingLimitError) {
                return res.status(error.status).json(createErrorResponse(error.message, error.status, {
                  limitType: error.limitType,
                  addonCode: error.addonCode,
                  used: error.used,
                  limit: error.limit,
                  targetCompanyId: cId,
                }))
              }
              throw error
            }
          }
        }
        const primaryCompanyId = validCompanyIds.includes(activeCompanyId) ? activeCompanyId : validCompanyIds[0]
        await ensureCompanyDefaults(prisma, primaryCompanyId, professional.id)
        const requestedRole = req.body.roleId
          ? (primaryCompanyId === activeCompanyId
              ? activeRequestedRole
              : await prisma.role.findFirst({ where: { id: Number(req.body.roleId), companyId: primaryCompanyId } }))
          : null
        if (req.body.roleId && !requestedRole) {
          return res.status(400).json(createErrorResponse('Cargo invalido para a clinica principal', 400))
        }
        const defaultRole = await prisma.role.findUnique({
          where: { companyId_value: { companyId: primaryCompanyId, value: 'comercial' } },
        })
        const roleValue = requestedRole?.value || defaultRole?.value || 'comercial'

        await prisma.userCompanyAccess.deleteMany({
          where: { userId: id, companyId: { in: ownedCompanyIds } }
        });
        
        // Insere os novos
        for (const cId of validCompanyIds) {
          await ensureCompanyDefaults(prisma, cId, professional.id)
          const companyRole = await prisma.role.findUnique({
            where: { companyId_value: { companyId: cId, value: roleValue } },
          })
          await prisma.userCompanyAccess.create({
            data: { userId: id, companyId: cId, roleId: companyRole?.id || null, isActive: isActive !== false }
          });
        }

        const primaryRole = await prisma.role.findUnique({
          where: { companyId_value: { companyId: primaryCompanyId, value: roleValue } },
        })
        data.companyId = primaryCompanyId
        data.roleId = primaryRole?.id || null
      }
    } else if (req.body.roleId !== undefined) {
      await prisma.userCompanyAccess.updateMany({
        where: { userId: id, companyId: activeCompanyId },
        data: { roleId: activeRequestedRole.id },
      })
      if (usuario.companyId === activeCompanyId) data.roleId = activeRequestedRole.id
    }
    
    const updated = await prisma.usuario.update({ 
      where: { id }, 
      data,
      include: { company: true, role: true, companyAccess: true }
    })
    
    res.json(createSuccessResponse(withoutSensitiveUserFields(updated)))
  } catch (error: any) {
    console.error('[Usuarios] Erro ao atualizar usuário:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao atualizar usuário', 500))
  }
})

router.delete('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    
    if (req.user?.type !== 'profissional') {
      return res.status(403).json(createErrorResponse('Somente o profissional pode excluir membros da equipe', 403))
    }

    const companyId = req.user.companyId!

    // Verificar se o usuário pertence à mesma empresa
    const usuario = await prisma.usuario.findFirst({
      where: {
        id,
        OR: [
          { companyId },
          { companyAccess: { some: { companyId } } },
        ],
      },
      include: { companyAccess: true },
    })
    if (!usuario) {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }

    const remainingAccess = usuario.companyAccess.filter((access) => access.companyId !== companyId)
    await prisma.$transaction(async (tx) => {
      await tx.userCompanyPermission.deleteMany({ where: { userId: id, companyId } })
      await tx.userCompanyAccess.deleteMany({ where: { userId: id, companyId } })

      if (remainingAccess.length === 0) {
        await tx.usuario.delete({ where: { id } })
      } else if (usuario.companyId === companyId) {
        await tx.usuario.update({
          where: { id },
          data: {
            companyId: remainingAccess[0].companyId,
            roleId: remainingAccess[0].roleId,
          },
        })
      }
    })
    res.json(createSuccessResponse({ id, removedFromCompanyId: companyId }))
  } catch (error: any) {
    console.error('[Usuarios] Erro ao deletar usuário:', error)
    if (error.code === 'P2025') {
      return res.status(404).json(createErrorResponse('Usuário não encontrado', 404))
    }
    res.status(500).json(createErrorResponse(error.message || 'Erro ao deletar usuário', 500))
  }
})
