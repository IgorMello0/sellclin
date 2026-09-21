import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import { ensureCompanyDefaults } from '../bootstrap/defaults.js'
import { getJwtSecret } from '../config/security.js'
import {
  consumeEmailToken,
  EMAIL_TOKEN_TYPES,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/email-verification.js'
import { auth } from '../middleware/auth.js'
import { changePassword } from '../services/change-password.js'
import rateLimit from 'express-rate-limit'

export const router = Router()
router.post('/change-password', auth(), rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: req => `${req.user!.type}:${req.user!.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => { res.status(429).json(createErrorResponse('Muitas tentativas. Aguarde antes de tentar novamente.', 429)) },
}), changePassword)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

function resolveGooglePhoto(currentPhotoUrl?: string | null, googlePicture?: string | null) {
  if (currentPhotoUrl?.startsWith('/uploads/')) {
    const fullPath = path.join(process.cwd(), currentPhotoUrl)
    return fs.existsSync(fullPath) ? currentPhotoUrl : googlePicture || null
  }

  return currentPhotoUrl || googlePicture || null
}

router.get('/verify-email', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    if (!token) return res.status(400).json(createErrorResponse('Token ausente', 400))

    const record = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.verification)

    if (record.professionalId) {
      await prisma.professional.update({
        where: { id: record.professionalId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
    } else if (record.userId) {
      await prisma.usuario.update({
        where: { id: record.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
    } else {
      return res.status(400).json(createErrorResponse('Token sem conta vinculada', 400))
    }

    return res.json(createSuccessResponse({ verified: true }))
  } catch (error: any) {
    return res.status(400).json(createErrorResponse(error.message || 'Nao foi possivel verificar o e-mail', 400))
  }
})

router.post('/resend-verification', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    if (!email) return res.status(400).json(createErrorResponse('E-mail obrigatorio', 400))

    const professional = await prisma.professional.findUnique({ where: { email } })
    if (professional) {
      if (professional.emailVerified) return res.json(createSuccessResponse({ alreadyVerified: true }))
      await sendVerificationEmail({
        email: professional.email,
        name: professional.name,
        professionalId: professional.id,
      })
      return res.json(createSuccessResponse({ sent: true }))
    }

    const user = await prisma.usuario.findUnique({ where: { email } })
    if (user) {
      if (user.emailVerified) return res.json(createSuccessResponse({ alreadyVerified: true }))
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        userId: user.id,
      })
      return res.json(createSuccessResponse({ sent: true }))
    }

    return res.json(createSuccessResponse({ sent: true }))
  } catch (error: any) {
    console.error('[Auth] Erro ao reenviar verificacao:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao reenviar e-mail', 500))
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    if (!email) return res.status(400).json(createErrorResponse('E-mail obrigatorio', 400))

    const professional = await prisma.professional.findUnique({ where: { email } })
    if (professional) {
      await sendPasswordResetEmail({
        email: professional.email,
        name: professional.name,
        professionalId: professional.id,
      })
      return res.json(createSuccessResponse({ sent: true }))
    }

    const user = await prisma.usuario.findUnique({ where: { email } })
    if (user) {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        userId: user.id,
      })
      return res.json(createSuccessResponse({ sent: true }))
    }

    return res.json(createSuccessResponse({ sent: true }))
  } catch (error: any) {
    console.error('[Auth] Erro ao solicitar recuperacao de senha:', error)
    return res.status(500).json(createErrorResponse(error.message || 'Erro ao enviar recuperacao de senha', 500))
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const password = String(req.body?.password || '')

    if (!token) return res.status(400).json(createErrorResponse('Token ausente', 400))
    if (password.length < 6) return res.status(400).json(createErrorResponse('A senha deve ter pelo menos 6 caracteres', 400))

    const record = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.passwordReset)
    const passwordHash = await bcrypt.hash(password, 10)

    if (record.professionalId) {
      await prisma.professional.update({
        where: { id: record.professionalId },
        data: {
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          authProvider: 'local',
        },
      })
    } else if (record.userId) {
      await prisma.usuario.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
    } else {
      return res.status(400).json(createErrorResponse('Token sem conta vinculada', 400))
    }

    return res.json(createSuccessResponse({ reset: true }))
  } catch (error: any) {
    return res.status(400).json(createErrorResponse(error.message || 'Nao foi possivel redefinir a senha', 400))
  }
})

router.post('/team-invite/accept', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const password = String(req.body?.password || '')

    if (!token) return res.status(400).json(createErrorResponse('Token ausente', 400))
    if (password.length < 6) return res.status(400).json(createErrorResponse('A senha deve ter pelo menos 6 caracteres', 400))

    const record = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.teamInvite)
    if (!record.userId) return res.status(400).json(createErrorResponse('Convite sem usuario vinculado', 400))

    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.usuario.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    return res.json(createSuccessResponse({ accepted: true }))
  } catch (error: any) {
    return res.status(400).json(createErrorResponse(error.message || 'Nao foi possivel aceitar o convite', 400))
  }
})

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json(createErrorResponse('Token do Google nao fornecido', 400))
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json(createErrorResponse('GOOGLE_CLIENT_ID nao configurado no servidor', 500))
    }

    let payload: any
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch (err: any) {
      console.error('[Auth Google] Token invalido:', err.message)
      return res.status(401).json(createErrorResponse('Token do Google invalido ou expirado', 401))
    }

    if (!payload?.email) {
      return res.status(401).json(createErrorResponse('Nao foi possivel obter o e-mail da conta Google', 401))
    }

    const { email, name, sub: googleId, picture } = payload
    console.log('[Auth Google] Login attempt:', email)

    let professional = await prisma.professional.findFirst({
      where: { googleId },
      include: { company: { select: { id: true, name: true } }, ownedCompanies: { select: { id: true, name: true } } },
    })

    if (professional) {
      const photoUrl = resolveGooglePhoto(professional.photoUrl, picture)
      const shouldVerifyEmail = !professional.emailVerified
      if (photoUrl !== professional.photoUrl || shouldVerifyEmail) {
        professional = await prisma.professional.update({
          where: { id: professional.id },
          data: {
            photoUrl,
            ...(shouldVerifyEmail ? { emailVerified: true, emailVerifiedAt: new Date() } : {}),
          },
          include: { company: { select: { id: true, name: true } }, ownedCompanies: { select: { id: true, name: true } } },
        })
      }
    }

    if (!professional) {
      professional = await prisma.professional.findUnique({
        where: { email },
        include: { company: { select: { id: true, name: true } }, ownedCompanies: { select: { id: true, name: true } } },
      })

      if (professional) {
        professional = await prisma.professional.update({
          where: { id: professional.id },
          data: {
            googleId,
            authProvider: professional.authProvider || 'local',
            photoUrl: resolveGooglePhoto(professional.photoUrl, picture),
            emailVerified: true,
            emailVerifiedAt: professional.emailVerifiedAt || new Date(),
          },
          include: { company: { select: { id: true, name: true } }, ownedCompanies: { select: { id: true, name: true } } },
        })
      }
    }

    if (!professional) {
      return res.status(403).json(createErrorResponse('Cadastro com Google exige checkout. Escolha um plano antes de criar a conta.', 403))
    }

    if (!professional.companyId) {
      const companyName = `Empresa de ${professional.name || name || email.split('@')[0]}`
      const company = await prisma.empresa.create({
        data: {
          name: companyName,
          ownerId: professional.id,
          isActive: true,
        },
      })

      professional = await prisma.professional.update({
        where: { id: professional.id },
        data: {
          companyId: company.id,
          companyName,
        },
        include: { company: { select: { id: true, name: true } }, ownedCompanies: { select: { id: true, name: true } } },
      })

      await ensureCompanyDefaults(prisma, company.id, professional.id)
    } else {
      await ensureCompanyDefaults(prisma, professional.companyId, professional.id)
    }

    const companiesMap = new Map<number, string>()
    if (professional.company) {
      companiesMap.set(professional.company.id, professional.company.name)
    }
    for (const company of professional.ownedCompanies) {
      companiesMap.set(company.id, company.name)
    }
    const availableCompanies = Array.from(companiesMap.entries()).map(([id, companyName]) => ({
      id,
      name: companyName,
    }))

    const allowedCompanies = availableCompanies.map(c => c.id)

    const token = jwt.sign({
      id: professional.id,
      companyId: professional.companyId,
      type: 'profissional',
      allowedCompanies,
    }, getJwtSecret(), { expiresIn: '12h' })

    console.log('[Auth Google] Login bem-sucedido:', email)

    res.json(createSuccessResponse({
      token,
      professional: {
        id: professional.id.toString(),
        name: professional.name,
        email: professional.email,
        phone: professional.phone || '',
        specialization: professional.specialization || '',
        photoUrl: professional.photoUrl || picture || undefined,
        onboardingCompleted: professional.onboardingCompleted,
        company: professional.company ? {
          id: professional.company.id,
          name: professional.company.name,
        } : null,
        companies: availableCompanies,
      },
    }))
  } catch (error: any) {
    console.error('[Auth Google] Erro:', error)
    res.status(500).json(createErrorResponse('Erro interno ao processar login com Google', 500))
  }
})
