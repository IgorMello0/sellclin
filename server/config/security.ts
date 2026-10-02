import { encryptionKey } from '../services/integration-encryption.js'
import { trustedIntegrationOrigins } from '../services/integration-http.js'
const DEVELOPMENT_JWT_SECRET = 'dev-secret'

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim()
  const isProduction = process.env.NODE_ENV === 'production'

  if (!secret) {
    if (isProduction) throw new Error('JWT_SECRET obrigatorio em producao.')
    return DEVELOPMENT_JWT_SECRET
  }

  if (isProduction && (secret === DEVELOPMENT_JWT_SECRET || secret.length < 32)) {
    throw new Error('JWT_SECRET inseguro. Use pelo menos 32 caracteres em producao.')
  }

  return secret
}

export function assertProductionSecurityConfig() {
  getJwtSecret()
  encryptionKey()
  trustedIntegrationOrigins()

  if (process.env.NODE_ENV === 'production') {
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET?.trim()
    if (!webhookSecret || webhookSecret.length < 32) {
      throw new Error('ABACATEPAY_WEBHOOK_SECRET deve ter pelo menos 32 caracteres em producao.')
    }
  }
}
