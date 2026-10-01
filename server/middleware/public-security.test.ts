import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import express from 'express'
import cors from 'cors'
import { corsOptions, installAuthLimits, verifyMetaBody } from './public-security.js'
import { createErrorResponse } from '../utils/response.js'

test('Meta requires a secret and a signature matching the original body', () => {
  const body = '{"object":"whatsapp_business_account"}'
  const signature = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`
  assert.equal(verifyMetaBody(body, signature, 'secret'), true)
  for (const [payload, header, secret] of [[body + ' ', signature, 'secret'], [body, signature, undefined], [body, undefined, 'secret'], [body, signature + 'zz', 'secret'], [undefined, signature, 'secret']]) {
    assert.equal(verifyMetaBody(payload, header, secret), false)
  }
})

test('server failures hide internal messages and details; validation remains useful', () => {
  const result = createErrorResponse('database password=secret', 500, { stack: 'internal stack' })
  assert.equal(JSON.stringify(result).includes('secret'), false)
  assert.equal(JSON.stringify(result).includes('stack'), false)
  assert.equal(createErrorResponse('E-mail inválido', 400).error.message, 'E-mail inválido')
})

test('HTTP protections share login/account budgets, limit recovery and enforce CORS', async () => {
  const app = express()
  app.use(cors(corsOptions({ NODE_ENV: 'production', PUBLIC_APP_URL: 'https://sellclin.com' })))
  app.use(express.json())
  installAuthLimits(app, { loginIp: 5, loginAccount: 2, emailIp: 5, emailAccount: 1, tokenIp: 1 })
  app.post('/api/{*path}', (_req, res) => res.json({ ok: true }))
  app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status || 500).json({ error: 'denied' }) })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const request = (path: string, email = 'alice@example.com', origin?: string) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ email }),
  })
  try {
    assert.equal((await request('/api/profissionais/login', ' Alice@Example.COM ')).status, 200)
    assert.equal((await request('/api/usuarios/login')).status, 200)
    const blocked = await request('/api/usuarios/login')
    assert.equal(blocked.status, 429)
    assert.ok(blocked.headers.get('retry-after'))
    assert.equal((await request('/api/profissionais/login', 'other@example.com')).status, 200)
    assert.equal((await request('/api/usuarios/login', 'third@example.com')).status, 200)
    assert.equal((await request('/api/profissionais/login', 'fourth@example.com')).status, 429)
    assert.equal((await request('/api/auth/forgot-password')).status, 200)
    assert.equal((await request('/api/auth/resend-verification')).status, 429)
    assert.equal((await request('/api/auth/reset-password')).status, 200)
    assert.equal((await request('/api/auth/reset-password')).status, 429)
    const allowed = await request('/api/example', '', 'https://sellclin.com')
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://sellclin.com')
    assert.equal((await request('/api/example', '', 'https://attacker.example')).status, 403)
    assert.equal((await request('/api/example', '', 'http://localhost:8080')).status, 403)
    assert.equal((await request('/api/example')).status, 200)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
