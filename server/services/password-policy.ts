import bcrypt from 'bcryptjs'

export const PASSWORD_POLICY_MESSAGE = 'A senha deve ter pelo menos 6 caracteres e no máximo 72 bytes.'
export function isValidNewPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 6 && Buffer.byteLength(value, 'utf8') <= 72
}

// Match the normal bcrypt cost even when the account does not exist.
const dummyHash = bcrypt.hashSync('sellclin-dummy-login-password', 10)
export async function matchesLoginPassword(password: unknown, hash?: string | null) {
  if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 1024) return false
  const matched = await bcrypt.compare(password, hash || dummyHash)
  return Boolean(hash) && matched
}
