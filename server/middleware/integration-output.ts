import type { RequestHandler } from 'express'

const privateKeys = new Set(['passwordHash', 'apiKey', 'apikey', 'metaToken', 'metaTwoStepPin', 'uazapiToken', 'accessToken', 'refreshToken', 'access_token', 'refresh_token'])
const ownerKeys = new Set(['webhookToken', 'metaWebhookVerifyToken', 'webhookVerifyToken', 'webhookUrl', 'webhookCallbackUrl', 'callbackUrl', 'reportedCallbackUrl'])

export function safeIntegrationOutput(value: unknown, owner: boolean): unknown {
  if (Array.isArray(value)) return value.map(item => safeIntegrationOutput(item, owner))
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateKeys.has(key) && (owner || !ownerKeys.has(key))).map(([key, child]) => [key, safeIntegrationOutput(child, owner)]))
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
