import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { createErrorResponse, createSuccessResponse } from '../utils/response.js'
import type { Request, Response } from 'express'

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || newPassword.length < 6 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json(createErrorResponse('Informe a senha atual e uma nova senha com no mínimo 6 caracteres e no máximo 72 bytes.', 400))
  }
  const user = req.user
  if (!user || !['profissional', 'usuario'].includes(user.type)) {
    return res.status(403).json(createErrorResponse('Conta sem acesso a esta operação', 403))
  }
  try {
    const account = user.type === 'profissional'
      ? await prisma.professional.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
      : await prisma.usuario.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
    if (!account?.passwordHash || !await bcrypt.compare(currentPassword, account.passwordHash)) {
      return res.status(400).json(createErrorResponse('Senha atual incorreta', 400))
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    // Compare-and-set prevents concurrent password changes from overwriting each other.
    const where = { id: user.id, passwordHash: account.passwordHash }
    const updated = user.type === 'profissional'
      ? await prisma.professional.updateMany({ where, data: { passwordHash } })
      : await prisma.usuario.updateMany({ where, data: { passwordHash } })
    if (!updated.count) return res.status(409).json(createErrorResponse('A senha foi alterada. Confira a senha atual e tente novamente.', 409))
    return res.json(createSuccessResponse({ updated: true }))
  } catch {
    return res.status(500).json(createErrorResponse('Não foi possível alterar a senha', 500))
  }
}
