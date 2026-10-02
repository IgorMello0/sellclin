import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeIntegrationOutput } from './integration-output.js'

test('authenticated output strips credential aliases recursively without removing normal business fields', () => {
  const date = new Date()
  assert.deepEqual(safeIntegrationOutput({ name: 'Alice', date, nested: [{ API_KEY: 'secret', password_stamp: 'stamp', client_secret: 'secret', adminToken: 'secret', authorization: 'Bearer secret', title: 'Consulta' }], webhookToken: 'owner-only', webhook_token: 'owner-only', qrcode: 'qr-secret', pairing_code: 'pair-secret' }, false), {
    name: 'Alice', date, nested: [{ title: 'Consulta' }],
  })
  assert.deepEqual(safeIntegrationOutput({ webhookToken: 'owner-only', apiKey: 'secret', qrcode: 'qr-secret' }, true), { webhookToken: 'owner-only', qrcode: 'qr-secret' })
})
test('provider diagnostic responses cannot echo raw keys, errors or sensitive URLs even to an owner', () => {
  const attempts = [{ label: 'probe', method: 'GET', ok: false, status: 401, response: '{"apikey":"secret"}', error: 'token=secret', url: 'https://provider.test?token=secret' }]
  assert.deepEqual(safeIntegrationOutput({ attempts }, true), { attempts: [{ label: 'probe', method: 'GET', ok: false, status: 401 }] })
})
