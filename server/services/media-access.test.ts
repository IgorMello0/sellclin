import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import { signMediaUrl, verifyMediaLink, localMediaPath, MEDIA_LINK_SECONDS } from './media-access.js'
import { protectStoredMedia, signResponseMedia } from '../middleware/media-access.js'
import { safeIntegrationOutput } from '../middleware/integration-output.js'

const secret = 'test-media-secret'
const path = '/uploads/media/5/image.jpg'
const now = Date.now()

test('media signatures expire and cannot be reused for another file or clinic', () => {
  const url = new URL(signMediaUrl(path, 5, secret, now), 'https://sellclin.com')
  const expires = url.searchParams.get('expires')
  const signature = url.searchParams.get('mediaSignature')
  assert.equal(verifyMediaLink(path, expires, signature, secret, now), true)
  assert.equal(verifyMediaLink(path.replace('/5/', '/6/'), expires, signature, secret, now), false)
  assert.equal(verifyMediaLink(path.replace('image', 'other'), expires, signature, secret, now), false)
  assert.equal(verifyMediaLink(path, expires, signature, secret, now + MEDIA_LINK_SECONDS * 1000), false)
  assert.equal(verifyMediaLink(path, expires, signature, 'other-secret', now), false)
  assert.equal(verifyMediaLink(path, undefined, undefined, secret, now), false)
  assert.throws(() => signMediaUrl(path, 6, secret, now), /clínica/)
})

test('only recognized local media paths can access files on disk', () => {
  assert.equal(localMediaPath('https://attacker.example' + path), null)
  assert.equal(localMediaPath('/uploads/media/5/../6/image.jpg'), null)
  assert.equal(localMediaPath('/uploads/media/5/image.source.mp4'), null)
  assert.equal(localMediaPath('/uploads/media/5/.env'), null)
  assert.equal(localMediaPath('/uploads/media/5/image.jpg?expires=123')?.companyId, 5)
})

test('history signs only media belonging to the active clinic and preserves dates and text', () => {
  const date = new Date()
  const result = signResponseMedia({ createdAt: date, content: path, rawJson: { mediaUrl: path }, other: { mediaUrl: path.replace('/5/', '/6/') } }, 5) as any
  assert.equal(result.createdAt, date)
  assert.equal(result.content, path)
  assert.match(result.rawJson.mediaUrl, /mediaSignature=/)
  assert.equal(result.other.mediaUrl, path.replace('/5/', '/6/'))
})

test('response protection preserves monetary values with a custom JSON serializer', () => {
  class DecimalValue { toJSON() { return '125.50' } }
  const payload = { value: new DecimalValue() }
  assert.equal(JSON.stringify(signResponseMedia(safeIntegrationOutput(payload, false), 5)), '{"value":"125.50"}')
})

test('staff status cannot expose webhook credentials; API credentials remain hidden from owners', () => {
  const data = { status: 'connected', accessToken: 'secret', nested: { webhookVerifyToken: 'verify', webhookUrl: 'secret-url', passwordHash: 'hash' } }
  assert.deepEqual(safeIntegrationOutput(data, false), { status: 'connected', nested: {} })
  assert.deepEqual(safeIntegrationOutput(data, true), { status: 'connected', nested: { webhookVerifyToken: 'verify', webhookUrl: 'secret-url' } })
})

test('HTTP media gate rejects unsigned, expired and converter-source URLs', async () => {
  const app = express()
  app.use('/uploads', protectStoredMedia, (_req, res) => res.send('media'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const fetchPath = (value: string) => fetch(`http://127.0.0.1:${address.port}${value}`)
  try {
    assert.equal((await fetchPath(path)).status, 403)
    const signed = signMediaUrl(path, 5)
    const allowed = await fetchPath(signed)
    assert.equal(allowed.status, 200)
    assert.equal(allowed.headers.get('cache-control'), 'private, no-store')
    assert.equal((await fetchPath(signed.replace('/5/', '/6/'))).status, 403)
    assert.equal((await fetchPath(signMediaUrl(path, 5, undefined, Date.now() - 2 * MEDIA_LINK_SECONDS * 1000))).status, 403)
    assert.equal((await fetchPath('/uploads/media/5/image.source.mp4')).status, 404)
    assert.equal((await fetchPath('/uploads/profile-logo.png')).status, 200)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
