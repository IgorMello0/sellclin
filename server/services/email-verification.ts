import crypto from 'node:crypto'
import { prisma } from '../prisma.js'

export const EMAIL_TOKEN_HOURS = 24
export const EMAIL_TOKEN_TYPES = {
  verification: 'email_verification',
  teamInvite: 'team_invite',
  passwordReset: 'password_reset',
} as const

type EmailTokenType = typeof EMAIL_TOKEN_TYPES[keyof typeof EMAIL_TOKEN_TYPES]

function getPublicAppUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    'https://sellclin.com'
  ).replace(/\/$/, '')
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function addHours(date: Date, hours: number) {
  const next = new Date(date)
  next.setHours(next.getHours() + hours)
  return next
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'SellClin <noreply@sellclin.com>'

  if (!apiKey) {
    console.warn('RESEND_API_KEY nao configurada. O e-mail nao foi enviado.');
    return { success: true, mocked: true } // Bypass para não quebrar em desenvolvimento local
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = body?.message || body?.error || body?.name || 'Erro ao enviar e-mail pela Resend'
    if (/domain is not verified/i.test(message)) {
      throw new Error('Dominio do remetente nao verificado na Resend. Verifique o dominio sellclin.com e use EMAIL_FROM="SellClin <noreply@sellclin.com>".')
    }
    throw new Error(message)
  }
}

async function createEmailToken(params: {
  email: string
  type: EmailTokenType
  professionalId?: number | null
  userId?: number | null
}) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const email = params.email.toLowerCase().trim()

  await prisma.emailVerificationToken.updateMany({
    where: {
      email,
      type: params.type,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  })

  await prisma.emailVerificationToken.create({
    data: {
      email,
      tokenHash,
      type: params.type,
      professionalId: params.professionalId || null,
      userId: params.userId || null,
      expiresAt: addHours(new Date(), EMAIL_TOKEN_HOURS),
    },
  })

  return token
}

export async function sendVerificationEmail(params: {
  email: string
  name: string
  professionalId?: number | null
  userId?: number | null
}) {
  const token = await createEmailToken({
    email: params.email,
    type: EMAIL_TOKEN_TYPES.verification,
    professionalId: params.professionalId,
    userId: params.userId,
  })
  const link = `${getPublicAppUrl()}/verificar-email?token=${encodeURIComponent(token)}`

  await sendResendEmail(
    params.email,
    'Confirme seu e-mail no SellClin',
    `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2>Confirme seu e-mail</h2>
        <p>Ola, ${params.name}. Clique no botao abaixo para ativar sua conta no SellClin.</p>
        <p><a href="${link}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Verificar e-mail</a></p>
        <p style="color:#64748b;font-size:13px;">Este link expira em ${EMAIL_TOKEN_HOURS} horas.</p>
      </div>
    `
  )

  return { link }
}

export async function sendTeamInviteEmail(params: {
  email: string
  name: string
  companyName?: string | null
  userId: number
}) {
  const token = await createEmailToken({
    email: params.email,
    type: EMAIL_TOKEN_TYPES.teamInvite,
    userId: params.userId,
  })
  const link = `${getPublicAppUrl()}/aceitar-convite?token=${encodeURIComponent(token)}`

  await sendResendEmail(
    params.email,
    `Convite para acessar ${params.companyName || 'SellClin'}`,
    `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2>Voce recebeu um convite</h2>
        <p>Ola, ${params.name}. Voce foi convidado para acessar ${params.companyName || 'uma clinica'} no SellClin.</p>
        <p><a href="${link}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Aceitar convite</a></p>
        <p style="color:#64748b;font-size:13px;">Este link expira em ${EMAIL_TOKEN_HOURS} horas.</p>
      </div>
    `
  )

  return { link }
}

export async function sendPasswordResetEmail(params: {
  email: string
  name: string
  professionalId?: number | null
  userId?: number | null
}) {
  const token = await createEmailToken({
    email: params.email,
    type: EMAIL_TOKEN_TYPES.passwordReset,
    professionalId: params.professionalId,
    userId: params.userId,
  })
  const link = `${getPublicAppUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`

  await sendResendEmail(
    params.email,
    'Redefina sua senha no SellClin',
    `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2>Redefinir senha</h2>
        <p>Ola, ${params.name}. Recebemos uma solicitacao para criar uma nova senha no SellClin.</p>
        <p><a href="${link}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Criar nova senha</a></p>
        <p style="color:#64748b;font-size:13px;">Este link expira em ${EMAIL_TOKEN_HOURS} horas. Se voce nao solicitou, ignore este e-mail.</p>
      </div>
    `
  )

  return { link }
}

export async function consumeEmailToken(token: string, type: EmailTokenType) {
  const tokenHash = hashToken(token)
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  })

  if (!record || record.type !== type || record.usedAt) {
    throw new Error('Link invalido ou ja utilizado.')
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new Error('Link expirado. Solicite um novo envio.')
  }

  await prisma.emailVerificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  return record
}
