import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { claimEmailToken, verifySessionToken } from './session-security.js'

const secret = 'a-test-secret-with-at-least-32-characters'

test('valid account sessions work; OAuth states and malformed identities cannot authenticate', () => {
  for (const type of ['profissional', 'usuario', 'cliente']) {
    const token = jwt.sign({ id: 12, type }, secret, { expiresIn: '12h' })
    assert.equal(verifySessionToken(token, secret).type, type)
  }
  for (const payload of [{ companyId: 12 }, { id: 12, type: 'admin' }, { id: -1, type: 'usuario' }, { id: '12', type: 'usuario' }]) {
    assert.throws(() => verifySessionToken(jwt.sign(payload, secret, { expiresIn: '12h' }), secret))
  }
  assert.throws(() => verifySessionToken(jwt.sign({ id: 12, type: 'usuario' }, secret), secret))
  assert.throws(() => verifySessionToken(jwt.sign({ id: 12, type: 'usuario' }, secret, { expiresIn: -1 }), secret))
  assert.throws(() => verifySessionToken(jwt.sign({ id: 12, type: 'usuario' }, secret, { algorithm: 'HS512', expiresIn: '12h' }), secret))
  assert.throws(() => verifySessionToken(jwt.sign({ id: 12, type: 'usuario' }, 'other-secret', { expiresIn: '12h' }), secret))
})

test('concurrent email token claims allow only one request', async () => {
  let used = false
  const claim = async (where: Parameters<Parameters<typeof claimEmailToken>[2]>[0]) => {
    assert.equal(where.id, 7)
    assert.equal(where.type, 'password_reset')
    assert.equal(where.usedAt, null)
    assert.ok(where.expiresAt.gt instanceof Date)
    if (used) return { count: 0 }
    used = true
    return { count: 1 }
  }
  const results = await Promise.allSettled([
    claimEmailToken(7, 'password_reset', claim), claimEmailToken(7, 'password_reset', claim),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
})

test('expired or previously used tokens are rejected when the database claim matches no row', async () => {
  await assert.rejects(claimEmailToken(7, 'password_reset', async () => ({ count: 0 })), /Link invalido/)
})
