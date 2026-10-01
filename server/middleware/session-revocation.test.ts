import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { auth } from './auth.js'
import { prisma } from '../prisma.js'
import { getJwtSecret } from '../config/security.js'
import { passwordSessionStamp } from '../services/session-security.js'

test('auth middleware revokes both owner and employee sessions after a password change', async () => {
  const originalProfessional = prisma.professional.findUnique
  const originalUser = prisma.usuario.findUnique
  const originalAccess = prisma.userCompanyAccess.findUnique
  let hash = 'old-bcrypt-hash'
  const db = prisma as any
  db.professional.findUnique = async () => ({ passwordHash: hash, companyId: 5, company: { id: 5, isActive: true }, ownedCompanies: [{ id: 5 }] })
  db.usuario.findUnique = async () => ({ passwordHash: hash, companyId: 5, isActive: true, company: { id: 5, isActive: true }, companyAccess: [], role: { value: 'sdr' } })
  db.userCompanyAccess.findUnique = async () => null
  const token = (type: string) => jwt.sign({ id: 7, type, companyId: 5, passwordStamp: passwordSessionStamp(hash, getJwtSecret()) }, getJwtSecret(), { expiresIn: '12h' })
  const call = async (value: string) => {
    const req: any = { headers: { authorization: `Bearer ${value}` } }
    const res: any = { code: 200, status(code: number) { this.code = code; return this }, json(body: unknown) { this.body = body; return this } }
    let accepted = false
    await auth()(req, res, () => { accepted = true })
    return { accepted, status: res.code, user: req.user }
  }
  try {
    const owner = token('profissional')
    const employee = token('usuario')
    assert.equal((await call(owner)).user.isCompanyOwner, true)
    assert.equal((await call(employee)).user.isCompanyOwner, false)
    hash = 'new-bcrypt-hash'
    for (const value of [owner, employee]) {
      const result = await call(value)
      assert.equal(result.accepted, false)
      assert.equal(result.status, 401)
    }
    assert.equal((await call(token('profissional'))).accepted, true)
    assert.equal((await call(token('usuario'))).accepted, true)
    const legacy = jwt.sign({ id: 7, type: 'usuario', companyId: 5 }, getJwtSecret(), { expiresIn: '12h' })
    assert.equal((await call(legacy)).status, 401)
    const state = jwt.sign({ companyId: 5, userId: 7, userType: 'profissional' }, getJwtSecret(), { expiresIn: '15m' })
    assert.equal((await call(state)).status, 401)
  } finally {
    db.professional.findUnique = originalProfessional
    db.usuario.findUnique = originalUser
    db.userCompanyAccess.findUnique = originalAccess
  }
})
