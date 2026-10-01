import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import { downloadPublicMedia, isPublicAddress, resolveDownloadTarget, requestPinned } from './public-download.js'

const lookup = async () => [{ address: '8.8.8.8', family: 4 }]

test('blocks private, loopback, metadata, reserved and mapped IPv6 addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '198.18.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address)
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2001:4860:4860::8888'), true)
})

test('resolves every DNS address before downloading and rejects unsafe URLs', async () => {
  for (const value of ['file:///etc/passwd', 'ftp://example.com/file', 'https://user:pass@example.com/file', 'https://example.com:8080/file', 'http://127.0.0.1/file']) await assert.rejects(resolveDownloadTarget(value, lookup))
  await assert.rejects(resolveDownloadTarget('https://example.com/file', async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]))
  await assert.rejects(resolveDownloadTarget('https://evilfacebook.com/file', lookup, ['facebook.com']))
  assert.equal((await resolveDownloadTarget('https://lookaside.fbsbx.com/file', lookup, ['fbsbx.com'])).address.address, '8.8.8.8')
})

test('pins the validated DNS address and strips credentials on redirects to other origins', async () => {
  const requests: any[] = []
  const result = await downloadPublicMedia('https://example.com/file', { maxBytes: 10, headers: { Authorization: 'Bearer secret' } }, {
    lookup,
    request: async (url, address, options) => {
      requests.push({ url: url.toString(), address, options })
      return requests.length === 1 ? { status: 302, headers: { location: 'https://cdn.example.com/file' }, buffer: Buffer.alloc(0) } : { status: 200, headers: {}, buffer: Buffer.from('media') }
    },
  })
  assert.equal(result.buffer.toString(), 'media')
  assert.equal(requests[0].address.address, '8.8.8.8')
  assert.equal(requests[0].options.headers.Authorization, 'Bearer secret')
  assert.equal(requests[1].options.headers, undefined)
})

test('checks redirect targets again and rejects metadata targets and HTTPS downgrade', async () => {
  for (const location of ['http://169.254.169.254/latest/meta-data', 'https://127.0.0.1/private', 'http://example.com/file']) {
    await assert.rejects(downloadPublicMedia('https://example.com/file', { maxBytes: 10 }, { lookup, request: async () => ({ status: 302, headers: { location }, buffer: Buffer.alloc(0) }) }))
  }
  await assert.rejects(downloadPublicMedia('http://example.com/file', { maxBytes: 10, httpsOnly: true }, { lookup, request: async () => { throw new Error('Não deve fazer requisição') } }), /HTTPS/)
})

test('native transport enforces byte limits and timeout while streaming', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/timeout') return
    if (req.url === '/declared') { res.writeHead(200, { 'Content-Length': '100' }); res.end('large'); return }
    if (req.url === '/stream') { res.write('12345678'); res.end('abcdefgh'); return }
    res.end('media')
  })
  server.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const fetchPath = (path: string, timeoutMs = 500) => requestPinned(new URL(`http://localhost:${address.port}${path}`), { address: '127.0.0.1', family: 4 }, { maxBytes: 10, timeoutMs })
  try {
    assert.equal((await fetchPath('/ok')).buffer.toString(), 'media')
    await assert.rejects(fetchPath('/declared'), /limite/)
    await assert.rejects(fetchPath('/stream'), /limite/)
    await assert.rejects(fetchPath('/timeout', 30), /Tempo limite/)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
