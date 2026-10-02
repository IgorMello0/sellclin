import { Router } from 'express'
import { prisma } from '../prisma.js'
import { auth, requireCompanyOwner } from '../middleware/auth.js'
import { createErrorResponse, createSuccessResponse, parsePagination } from '../utils/response.js'
import { matchesLoginPassword } from '../services/password-policy.js'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../config/security.js'
import { passwordSessionStamp } from '../services/session-security.js'

export const router = Router()

// Login de profissional
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const emailAddress = typeof email === 'string' ? email.trim().toLowerCase() : ''
    
    if (!emailAddress || typeof password !== 'string' || !password) {
      return res.status(400).json(createErrorResponse('Email e senha são obrigatórios', 400))
    }
    
    const professional = await prisma.professional.findUnique({
      where: { email: emailAddress },
      include: {
        company: { select: { id: true, name: true } },
        ownedCompanies: { select: { id: true, name: true } },
      }
    })
    if (!await matchesLoginPassword(password, professional?.passwordHash)) {
      return res.status(401).json(createErrorResponse('Credenciais inválidas', 401))
    }
    
    if (!professional.emailVerified) {
      return res.status(403).json(createErrorResponse('Verifique seu e-mail antes de acessar. Enviamos um link de confirmação para sua caixa de entrada.', 403))
    }

    const companiesMap = new Map<number, string>()
    if (professional.company) {
      companiesMap.set(professional.company.id, professional.company.name)
    }
    for (const c of professional.ownedCompanies) {
      companiesMap.set(c.id, c.name)
    }
    const availableCompanies = Array.from(companiesMap.entries()).map(([id, name]) => ({ id, name }))

    const allowedCompanies = availableCompanies.map(c => c.id)

    const token = jwt.sign({ 
      id: professional.id, 
      companyId: professional.companyId, 
      type: 'profissional',
      passwordStamp: passwordSessionStamp(professional.passwordHash, getJwtSecret()),
      allowedCompanies 
    }, getJwtSecret(), { expiresIn: '12h' })
    
    res.json(createSuccessResponse({ 
      token, 
      professional: { 
        id: professional.id.toString(), 
        name: professional.name, 
        email: professional.email, 
        phone: professional.phone || '', 
        specialization: professional.specialization || '',
        photoUrl: professional.photoUrl || '',
        onboardingCompleted: professional.onboardingCompleted,
        company: professional.company ? {
          id: professional.company.id,
          name: professional.company.name
        } : null,
        companies: availableCompanies
      } 
    }))
  } catch (error) {
    console.error('[Login] Erro:', error)
    res.status(500).json(createErrorResponse('Erro interno do servidor', 500))
  }
})
router.get('/me', auth(), async (req, res) => {
  try {
    const professional = await prisma.professional.findUnique({
      where: { id: req.user!.id },
      include: {
        company: { select: { id: true, name: true } },
        ownedCompanies: { select: { id: true, name: true } },
      }
    })
    if (!professional) {
      return res.status(404).json(createErrorResponse('Profissional não encontrado', 404))
    }

    const companiesMap = new Map<number, string>()
    if (professional.company) {
      companiesMap.set(professional.company.id, professional.company.name)
    }
    for (const c of professional.ownedCompanies) {
      companiesMap.set(c.id, c.name)
    }
    const availableCompanies = Array.from(companiesMap.entries()).map(([id, name]) => ({ id, name }))

    const allowedCompanies = availableCompanies.map(c => c.id)

    const activeCompanyId = req.user?.companyId || professional.companyId
    let activeCompany = professional.company
    if (activeCompanyId && activeCompanyId !== professional.companyId) {
      const found = professional.ownedCompanies.find(c => c.id === activeCompanyId)
      if (found) {
        activeCompany = found as any
      }
    }

    const token = jwt.sign({ 
      id: professional.id, 
      companyId: activeCompanyId, 
      type: 'profissional',
      passwordStamp: passwordSessionStamp(professional.passwordHash, getJwtSecret()),
      allowedCompanies 
    }, getJwtSecret(), { expiresIn: '12h' })

    res.json(createSuccessResponse({
      ...professional,
      companyId: activeCompanyId,
      company: activeCompany,
      passwordHash: undefined,
      companies: availableCompanies,
      token
    }))
  } catch (error) {
    console.error('[Profile] Erro:', error)
    res.status(500).json(createErrorResponse('Erro interno do servidor', 500))
  }
})

// Completar o Onboarding
router.post('/onboarding/complete', auth(), async (req, res) => {
  try {
    const { companyName, logoUrl, faturamentoMensal, quantidadeFuncionarios, quantidadeClinicas, canalAquisicao, objetivoCrm } = req.body;
    
    const onboardingData = {
      faturamentoMensal,
      quantidadeFuncionarios,
      quantidadeClinicas,
      canalAquisicao,
      objetivoCrm
    };

    // Atualizar professional e empresa
    const professional = await prisma.professional.update({
      where: { id: req.user!.id },
      data: { 
        onboardingCompleted: true,
        onboardingData,
        ...(companyName && { companyName }),
        ...(logoUrl && { logoUrl })
      }
    });

    if (professional.companyId && companyName) {
      await prisma.empresa.update({
        where: { id: professional.companyId },
        data: { name: companyName }
      });
    }

    res.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error('[Onboarding] Erro ao concluir:', error);
    res.status(500).json(createErrorResponse('Erro ao concluir onboarding', 500));
  }
})

// Atualizar perfil do profissional logado
router.put('/me', auth(), async (req, res) => {
  try {
    const { name, phone, specialization, photoUrl, bio, crm } = req.body

    const updated = await prisma.professional.update({
      where: { id: req.user!.id },
      data: { 
        name, 
        phone, 
        specialization, 
        photoUrl,
        bio,
        crm
      },
      include: { company: { select: { id: true, name: true, isActive: true } } }
    })

    res.json(createSuccessResponse(updated))
  } catch (error) {
    console.error('[Profile] Erro ao atualizar:', error)
    res.status(500).json(createErrorResponse('Erro interno do servidor', 500))
  }
})

// Listar profissionais
router.get('/', auth(), async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query)
  
  const where: any = { companyId: req.user!.companyId }

  const [items, total] = await Promise.all([
    prisma.professional.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        specialization: true,
        phone: true,
        companyId: true
      }
    }),
    prisma.professional.count({ where })
  ])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})

// Obter por id
router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id)
  const item = await prisma.professional.findFirst({
    where: { id, companyId: req.user!.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialization: true,
      companyId: true,
      companyName: true,
      logoUrl: true,
      contractType: true,
      bio: true,
      crm: true,
      photoUrl: true,
      onboardingCompleted: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!item) return res.status(404).json(createErrorResponse('Profissional não encontrado', 404))
  res.json(createSuccessResponse(item))
})

// O cadastro publico cria apenas uma intencao de compra em /api/billing/signup-checkout.
router.post('/', (_req, res) => res.status(403).json(
  createErrorResponse('Cadastro publico exige checkout. Use /api/billing/signup-checkout.', 403),
))

// Adicionar profissional à mesma equipe (logado)
router.post('/equipe', auth(), requireCompanyOwner(), async (req, res) => {
  return res.status(410).json(createErrorResponse(
    'Esta rota foi desativada. Cadastre membros da equipe em /api/usuarios para aplicar limites e permissoes.',
    410
  ))
})

// Atualizar
router.put('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  const id = Number(req.params.id)
  const { name, email, phone, specialization, companyName, logoUrl, contractType } = req.body
  const target = await prisma.professional.findFirst({
    where: { id, companyId: req.user!.companyId },
    select: { id: true },
  })
  if (!target) return res.status(404).json(createErrorResponse('Profissional nao encontrado', 404))
  const updated = await prisma.professional.update({
    where: { id: target.id },
    data: { name, email, phone, specialization, companyName, logoUrl, contractType },
    select: { id: true, name: true, email: true, phone: true, specialization: true, companyId: true },
  })
  res.json(createSuccessResponse(updated))
})

// Deletar
router.delete('/:id', auth(), requireCompanyOwner(), async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user!.id) {
    return res.status(400).json(createErrorResponse('O proprietario nao pode excluir a propria conta por esta rota', 400))
  }
  const target = await prisma.professional.findFirst({
    where: { id, companyId: req.user!.companyId },
    select: { id: true },
  })
  if (!target) return res.status(404).json(createErrorResponse('Profissional nao encontrado', 404))
  await prisma.professional.delete({ where: { id: target.id } })
  res.json(createSuccessResponse({ id }))
})

// Listar clientes de um profissional
router.get('/:id/clientes', auth(), async (req, res) => {
  const professionalId = Number(req.params.id)
  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, companyId: req.user!.companyId },
    select: { id: true },
  })
  if (!professional) return res.status(404).json(createErrorResponse('Profissional nao encontrado', 404))
  const { skip, take, page, pageSize } = parsePagination(req.query)
  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where: { professionalId, companyId: req.user!.companyId },
      skip,
      take,
      include: { appointments: true, payments: true, fichas: true, chatHistories: true, conversas: true },
      orderBy: { id: 'desc' }
    }),
    prisma.client.count({ where: { professionalId, companyId: req.user!.companyId } })
  ])
  res.json(createSuccessResponse(items, { page, pageSize, total }))
})
