import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { verifyIntegrationState, assertIntegrationOwner } from './integration-state.js'
import { prisma } from '../prisma.js'

const secret = 'integration-test-secret-at-least-32-characters'
const payload = { companyId: 5, userId: 7, userType: 'profissional', purpose: 'google-calendar' }
test('OAuth states reject session tokens, other integrations, malformed identities and wrong algorithms', () => {
  assert.equal(verifyIntegrationState(jwt.sign(payload, secret, { expiresIn: '15m' }), 'google-calendar', secret).companyId, 5)
  for (const value of [{ id: 7, type: 'profissional', companyId: 5 }, { ...payload, purpose: 'meta-whatsapp' }, { ...payload, companyId: '5' }, { ...payload, userType: 'usuario' }, { ...payload, userId: -1 }]) {
    assert.throws(() => verifyIntegrationState(jwt.sign(value, secret, { expiresIn: '15m' }), 'google-calendar', secret))
  }
  assert.throws(() => verifyIntegrationState(jwt.sign(payload, secret), 'google-calendar', secret))
  assert.throws(() => verifyIntegrationState(jwt.sign(payload, secret, { expiresIn: -1 }), 'google-calendar', secret))
  assert.throws(() => verifyIntegrationState(jwt.sign(payload, secret, { algorithm: 'HS512', expiresIn: '15m' }), 'google-calendar', secret))
})
test('callbacks recheck active ownership in the database instead of trusting old state claims', async t => {
  const original = prisma.empresa.findFirst
  const query = t.mock.fn(async (args: any) => args.where.ownerId === 7 ? { id: 5 } : null)
  ;(prisma.empresa as any).findFirst = query
  t.after(() => { prisma.empresa.findFirst = original })
  await assertIntegrationOwner(5, 7)
  await assert.rejects(assertIntegrationOwner(5, 8), /permissão/)
  assert.deepEqual(query.mock.calls[0].arguments[0].where, { id: 5, ownerId: 7, isActive: true })
})
