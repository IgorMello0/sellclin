import assert from 'node:assert/strict'
import { test } from 'node:test'
import { credentialQuery, encryptCredential, decryptCredential, protectCredentialData, readCredentialData, apiKeyLookupHash, encryptionKey } from './integration-encryption.js'

const key = Buffer.alloc(32, 9)

test('credentials encrypt with fresh nonces, decrypt correctly and reject tampering', () => {
  const encrypted = encryptCredential('provider-secret', 'accessToken', key)
  assert.equal(encrypted.includes('provider-secret'), false)
  assert.notEqual(encrypted, encryptCredential('provider-secret', 'accessToken', key))
  assert.equal(decryptCredential(encrypted, 'accessToken', key), 'provider-secret')
  assert.throws(() => decryptCredential(encrypted, 'refreshToken', key))
  assert.throws(() => decryptCredential(encrypted, 'accessToken', Buffer.alloc(32, 1)))
  const tampered = encrypted.slice(0, -3) + 'AAA'
  assert.throws(() => decryptCredential(tampered, 'accessToken', key))
  assert.equal(decryptCredential('legacy-token', 'accessToken', key), 'legacy-token')
})

test('company writes protect tokens and retain hashed lookup for existing lead webhook URLs', () => {
  const original = { name: 'Clinic', apiKey: 'evolution-key', metaToken: 'meta-secret', uazapiToken: null }
  const stored = protectCredentialData('Empresa', original, key) as any
  assert.notEqual(stored.apiKey, original.apiKey)
  assert.equal(stored.apiKeyHash, apiKeyLookupHash(original.apiKey))
  assert.deepEqual(readCredentialData(stored, key), { ...original, apiKeyHash: stored.apiKeyHash })
  assert.equal(original.apiKey, 'evolution-key')
  assert.deepEqual(protectCredentialData('Empresa', { apiKey: null }, key), { apiKey: null, apiKeyHash: null })
})

test('batch, set and nested relation writes protect credentials and preserve unrelated values', () => {
  const rows = protectCredentialData('GoogleCalendarConnection', [{ accessToken: 'a', refreshToken: { set: 'b' } }], key) as any[]
  assert.equal(decryptCredential(rows[0].refreshToken.set, 'refreshToken', key), 'b')
  const nested = protectCredentialData('Empresa', { whatsappConnection: { upsert: { create: { accessToken: 'a' }, update: { accessToken: 'b' } } } }, key) as any
  assert.equal(decryptCredential(nested.whatsappConnection.upsert.create.accessToken, 'accessToken', key), 'a')
  assert.equal(decryptCredential(nested.whatsappConnection.upsert.update.accessToken, 'accessToken', key), 'b')
  const date = new Date()
  assert.equal((readCredentialData({ createdAt: date }, key) as any).createdAt, date)
})

test('invalid encryption keys are rejected', () => {
  assert.throws(() => encryptionKey('short'))
  assert.throws(() => encryptionKey('z'.repeat(64)))
  assert.equal(encryptionKey('a'.repeat(64))?.length, 32)
})

test('query boundary stores ciphertext and returns plaintext without mutating caller data', async () => {
  const args = { where: { id: 1 }, data: { metaToken: 'meta-secret' } }
  const result = await credentialQuery('Empresa', 'update', args, async input => {
    assert.notEqual((input.data as any).metaToken, 'meta-secret')
    return { id: 1, ...(input.data as any) }
  }, key)
  assert.equal(result.metaToken, 'meta-secret')
  assert.equal(args.data.metaToken, 'meta-secret')
  const encrypted = encryptCredential('calendar-secret', 'accessToken', key)
  const read = await credentialQuery('GoogleCalendarConnection', 'findMany', {}, async () => [{ accessToken: encrypted }], key)
  assert.equal(read[0].accessToken, 'calendar-secret')
})

test('provider JSON is not interpreted as encrypted credential columns', () => {
  const payload = { rawJson: { accessToken: 'sellclin.enc.v1:untrusted-message-text' }, company: { metaToken: encryptCredential('secret', 'metaToken', key) } }
  const result = readCredentialData(payload, key) as any
  assert.equal(result.rawJson, payload.rawJson)
  assert.equal(result.company.metaToken, 'secret')
})
