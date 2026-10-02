import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import { isValidNewPassword, matchesLoginPassword } from './password-policy.js'

test('new passwords respect bcrypt byte boundaries without coercing objects or numbers', () => {
  for (const value of [undefined, null, 123456, {}, '12345', 'a'.repeat(73), 'á'.repeat(37)]) assert.equal(isValidNewPassword(value), false)
  for (const value of ['123456', 'a'.repeat(72), 'á'.repeat(36)]) assert.equal(isValidNewPassword(value), true)
})
test('password verification cannot authenticate missing accounts or oversized malformed input', async () => {
  const hash = await bcrypt.hash('Working-pass', 4)
  assert.equal(await matchesLoginPassword('Working-pass', hash), true)
  assert.equal(await matchesLoginPassword('wrong', hash), false)
  assert.equal(await matchesLoginPassword('sellclin-dummy-login-password', null), false)
  for (const value of [{}, 123456, 'a'.repeat(1025)]) assert.equal(await matchesLoginPassword(value, hash), false)
})
