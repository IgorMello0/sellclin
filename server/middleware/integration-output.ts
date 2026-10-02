import type { RequestHandler } from 'express'

const privateKeys = new Set(['apiKeyHash', 'passwordHash', 'apiKey', 'apikey', 'metaToken', 'metaTwoStepPin', 'uazapiToken', 'accessToken', 'refreshToken', 'access_token', 'refresh_token'])
const ownerKeys = new Set(['webhookToken', 'metaWebhookVerifyToken', 'webhookVerifyToken', 'webhookUrl', 'webhookCallbackUrl', 'callbackUrl', 'reportedCallbackUrl'])
const normalizedPrivateKeys = new Set([...privateKeys, 'password', 'passwordStamp', 'clientSecret', 'appSecret', 'adminToken', 'authorization'].map(key => key.replace(/_/g, '').toLowerCase()))
const normalizedOwnerKeys = new Set([...ownerKeys, 'diagnostics', 'qrcode', 'pairingCode'].map(key => key.replace(/_/g, '').toLowerCase()))

export function safeIntegrationOutput(value: unknown, owner: boolean): unknown {
  if (Array.isArray(value)) return value.map(item => safeIntegrationOutput(item, owner))
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return value
  const record = value as Record<string, unknown>
  // Provider diagnostics can echo credentials inside strings. Return only the
  // useful outcome, never their raw response bodies or exception text.
  const diagnostic = 'label' in record && 'method' in record && 'ok' in record
  return Object.fromEntries(Object.entries(value).filter(([key]) => !normalizedPrivateKeys.has(key.replace(/_/g, '').toLowerCase()) && (owner || !normalizedOwnerKeys.has(key.replace(/_/g, '').toLowerCase())) && (!diagnostic || !['response', 'error', 'url'].includes(key))).map(([key, child]) => [key, safeIntegrationOutput(child, owner)]))
}

export const protectIntegrationOutput: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res)
  res.json = (body) => {
    // Login responses are not authenticated yet and include the new session token.
    if (!req.user) return json(body)
    return json(safeIntegrationOutput(body, req.user.isCompanyOwner === true))
  }
  next()
}
