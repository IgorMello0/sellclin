import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { router as owners } from './professionals.js'
import { router as employees } from './usuarios.js'
import { router as accounts } from './auth.js'

function replace(t: any, target: any, name: string, fn: any) {
  const original = target[name]
  const mock = t.mock.fn(fn)
  target[name] = mock
  t.after(() => { target[name] = original })
  return mock
}

async function fixture(t: any) {
  const app = express()
  app.use(express.json())
  app.use('/owners', owners)
  app.use('/employees', employees)
  app.use('/accounts', accounts)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  return async (path: string, body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() as any }
  }
}

for (const [route, model] of [['owners', 'professional'], ['employees', 'usuario']] as const) {
  test(`${route} login does not disclose invitation or verification state before checking the password`, async t => {
    const passwordHash = await bcrypt.hash('Working-pass', 4)
    let record: any = { id: 7, emailVerified: false, isActive: false, passwordHash }
    replace(t, prisma[model], 'findUnique', async () => record)
    const call = await fixture(t)
    const unknown = async () => call(`/${route}/login`, { email: 'test@example.com', password: 'wrong' })
    const unverified = await unknown()
    assert.equal(unverified.status, 401)
    record = null
    assert.deepEqual(await unknown(), unverified)
    record = { id: 7, emailVerified: false, isActive: false, passwordHash }
    assert.equal((await call(`/${route}/login`, { email: 'test@example.com', password: 'Working-pass' })).status, 403)
    assert.equal((await call(`/${route}/login`, { email: 'test@example.com', password: {} })).status, 400)
  })
}

test('verification resend returns the same public result for verified and unknown accounts', async t => {
  let account: any = { emailVerified: true }
  replace(t, prisma.professional, 'findUnique', async () => account)
  replace(t, prisma.usuario, 'findUnique', async () => null)
  const call = await fixture(t)
  const verified = await call('/accounts/resend-verification', { email: 'test@example.com' })
  account = null
  assert.deepEqual(await call('/accounts/resend-verification', { email: 'test@example.com' }), verified)
  assert.equal(verified.body.data.sent, true)
  assert.equal('alreadyVerified' in verified.body.data, false)
})

test('an email provider outage does not disclose whether the requested account exists', async t => {
  const previousEnv = process.env.NODE_ENV
  const previousKey = process.env.RESEND_API_KEY
  process.env.NODE_ENV = 'production'
  delete process.env.RESEND_API_KEY
  t.after(() => {
    if (previousEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnv
    if (previousKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousKey
  })
  let account: any = { id: 7, name: 'Alice', email: 'test@example.com', emailVerified: false }
  replace(t, prisma.professional, 'findUnique', async () => account)
  replace(t, prisma.usuario, 'findUnique', async () => null)
  replace(t, prisma.emailVerificationToken, 'updateMany', async () => ({ count: 0 }))
  replace(t, prisma.emailVerificationToken, 'create', async (args: any) => args.data)
  const call = await fixture(t)
  for (const path of ['/accounts/resend-verification', '/accounts/forgot-password']) {
    const existing = await call(path, { email: 'test@example.com' })
    account = null
    assert.deepEqual(await call(path, { email: 'test@example.com' }), existing)
    assert.equal(existing.status, 200)
    account = { id: 7, name: 'Alice', email: 'test@example.com', emailVerified: false }
  }
})

test('reset and invite reject byte overflow or nonstring passwords before consuming tokens', async t => {
  const transaction = replace(t, prisma, '$transaction', async () => { throw new Error('must not be called') })
  const call = await fixture(t)
  for (const path of ['/accounts/reset-password', '/accounts/team-invite/accept']) {
    for (const password of ['á'.repeat(37), 'a'.repeat(73), 123456, {}]) assert.equal((await call(path, { token: 'test-token', password })).status, 400)
  }
  assert.equal(transaction.mock.callCount(), 0)
})

for (const [path, type, linkedField, model] of [
  ['reset-password', 'password_reset', 'professionalId', 'professional'],
  ['team-invite/accept', 'team_invite', 'userId', 'usuario'],
] as const) {
  test(`${path} consumes the token and changes the linked account within the same transaction`, async t => {
    let consumed = false
    const tx: any = {
      emailVerificationToken: {
        findUnique: async () => ({ id: 1, type, usedAt: null, expiresAt: new Date(Date.now() + 60000), [linkedField]: 7 }),
        updateMany: async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 } },
      },
      [model]: { update: t.mock.fn(async (args: any) => args) },
    }
    const transaction = replace(t, prisma, '$transaction', async (callback: any) => callback(tx))
    const globalWrite = replace(t, prisma[model], 'update', async () => { throw new Error('write outside transaction') })
    const call = await fixture(t)
    const response = await call(`/accounts/${path}`, { token: 'test-token', password: 'Working-pass', id: 999 })
    assert.equal(response.status, 200)
    const args = tx[model].update.mock.calls[0].arguments[0]
    assert.equal(args.where.id, 7)
    assert.equal(await bcrypt.compare('Working-pass', args.data.passwordHash), true)
    assert.equal(globalWrite.mock.callCount(), 0)
    assert.equal(transaction.mock.callCount(), 1)
    assert.equal((await call(`/accounts/${path}`, { token: 'test-token', password: 'Different-pass' })).status, 400)
    assert.equal(tx[model].update.mock.callCount(), 1)
  })
}
