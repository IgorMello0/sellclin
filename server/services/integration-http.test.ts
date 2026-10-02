import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import { gzipSync } from 'node:zlib'
import { fetchIntegration, resolveIntegrationTarget, trustedIntegrationOrigins } from './integration-http.js'
import { requestPinned } from './public-download.js'

const lookup = async () => [{ address: '8.8.8.8', family: 4 }]
test('integration targets reject private DNS, unsafe schemes, credentials and unapproved ports', async () => {
  for (const url of ['file:///etc/passwd', 'http://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com:8443', 'https://127.0.0.1', 'https://[::ffff:127.0.0.1]', 'https://2130706433']) {
    await assert.rejects(resolveIntegrationTarget(url, lookup, []))
  }
  await assert.rejects(resolveIntegrationTarget('https://api.example.com', async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }], []))
  assert.equal((await resolveIntegrationTarget('https://api.example.com', lookup, [])).address.address, '8.8.8.8')
})

test('private service exceptions match only the exact operator configured origin', async () => {
  const trusted = trustedIntegrationOrigins({ TRUSTED_INTEGRATION_ORIGINS: 'http://evolution:8080' })
  const privateLookup = async () => [{ address: '10.0.0.4', family: 4 }]
  assert.equal((await resolveIntegrationTarget('http://evolution:8080/api', privateLookup, trusted)).address.address, '10.0.0.4')
  for (const url of ['http://evolution:8081', 'http://evil.evolution:8080', 'http://evolution:8080.evil.test']) await assert.rejects(resolveIntegrationTarget(url, privateLookup, trusted))
  for (const entry of ['*', 'http://evolution:8080/path', 'http://user:pass@evolution:8080', 'file://evolution']) assert.throws(() => trustedIntegrationOrigins({ TRUSTED_INTEGRATION_ORIGINS: entry }))
})

test('authenticated write requests never follow redirects or leak credentials to a second target', async () => {
  let calls = 0
  await assert.rejects(fetchIntegration('https://api.example.com/send', { method: 'POST', headers: { apikey: 'test-secret' }, body: JSON.stringify({ text: 'hello' }) }, {
    lookup, request: async (url, address, options) => {
      calls++
      assert.equal(url.hostname, 'api.example.com')
      assert.equal(address.address, '8.8.8.8')
      assert.equal(options.headers?.apikey, 'test-secret')
      assert.equal(options.method, 'POST')
      assert.equal(options.body?.toString(), '{"text":"hello"}')
      return { status: 302, headers: { location: 'https://evil.example.com' }, buffer: Buffer.alloc(0) }
    },
  }), /Redirecionamento/)
  assert.equal(calls, 1)
})

test('the bounded client preserves error responses, empty responses and compressed JSON', async () => {
  const response = await fetchIntegration('https://api.example.com', {}, { lookup, request: async () => ({ status: 401, headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, buffer: gzipSync('{"error":"denied"}') }) })
  assert.equal(response.status, 401)
  assert.equal(response.ok, false)
  assert.deepEqual(await response.json(), { error: 'denied' })
  const empty = await fetchIntegration('https://api.example.com', { method: 'DELETE' }, { lookup, request: async () => ({ status: 204, headers: {}, buffer: Buffer.alloc(0) }) })
  assert.equal(await empty.text(), '')
  await assert.rejects(fetchIntegration('https://api.example.com', {}, { lookup, request: async () => ({ status: 200, headers: { 'content-encoding': 'gzip' }, buffer: gzipSync(Buffer.alloc(8 * 1024 * 1024 + 1)) }) }))
})

test('DNS resolution respects cancellation before opening a connection', async () => {
  let connected = false
  await assert.rejects(fetchIntegration('https://api.example.com', { signal: AbortSignal.timeout(20) }, {
    lookup: async () => { await new Promise(resolve => setTimeout(resolve, 50)); return [{ address: '8.8.8.8', family: 4 }] },
    request: async () => { connected = true; throw new Error('must not connect') },
  }), { name: 'TimeoutError' })
  assert.equal(connected, false)
})

test('native pinned transport sends multipart uploads and cancels a stalled provider', async () => {
  const previous = process.env.TRUSTED_INTEGRATION_ORIGINS
  let upload = ''
  const server = http.createServer(async (req, res) => {
    if (req.url === '/stall') return
    for await (const chunk of req) upload += chunk.toString()
    res.setHeader('content-type', 'application/json')
    res.end('{"id":"uploaded"}')
  })
  server.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const origin = `http://integration.test:${address.port}`
  process.env.TRUSTED_INTEGRATION_ORIGINS = origin
  const deps = { lookup: async () => [{ address: '127.0.0.1', family: 4 }], request: requestPinned }
  try {
    const form = new FormData()
    form.append('file', new Blob(['media-test']), 'file.txt')
    const response = await fetchIntegration(`${origin}/upload`, { method: 'POST', body: form }, deps)
    assert.deepEqual(await response.json(), { id: 'uploaded' })
    assert.match(upload, /media-test/)
    assert.match(upload, /filename="file.txt"/)
    await assert.rejects(fetchIntegration(`${origin}/stall`, { signal: AbortSignal.timeout(30) }, deps), { name: 'TimeoutError' })
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_INTEGRATION_ORIGINS
    else process.env.TRUSTED_INTEGRATION_ORIGINS = previous
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
