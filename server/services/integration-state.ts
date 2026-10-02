import jwt from 'jsonwebtoken'
import { prisma } from '../prisma.js'
import { getJwtSecret } from '../config/security.js'

type Purpose = 'google-calendar' | 'meta-whatsapp'
export function verifyIntegrationState(token: string, purpose: Purpose, secret = getJwtSecret()) {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'], maxAge: '20m' })
  if (typeof payload === 'string' || payload.purpose !== purpose || payload.userType !== 'profissional' ||
      !Number.isSafeInteger(payload.companyId) || payload.companyId <= 0 ||
      !Number.isSafeInteger(payload.userId) || payload.userId <= 0 || typeof payload.exp !== 'number') {
    throw new Error('Estado de integração inválido')
  }
  return payload as jwt.JwtPayload & { companyId: number; userId: number }
}

export async function assertIntegrationOwner(companyId: number, userId: number) {
  const company = await prisma.empresa.findFirst({ where: { id: companyId, ownerId: userId, isActive: true }, select: { id: true } })
  if (!company) throw new Error('Conta sem permissão para conectar esta clínica')
}
