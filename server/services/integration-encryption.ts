import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'sellclin.enc.v1:'
export const credentialSchemaStatements = [
  'ALTER TABLE empresas ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64)',
  'ALTER TABLE empresas ALTER COLUMN api_key TYPE TEXT, ALTER COLUMN meta_token TYPE TEXT, ALTER COLUMN meta_two_step_pin TYPE TEXT, ALTER COLUMN meta_webhook_verify_token TYPE TEXT, ALTER COLUMN uazapi_token TYPE TEXT',
  'ALTER TABLE whatsapp_connections ALTER COLUMN access_token TYPE TEXT, ALTER COLUMN webhook_verify_token TYPE TEXT',
  'ALTER TABLE google_calendar_connections ALTER COLUMN access_token TYPE TEXT, ALTER COLUMN refresh_token TYPE TEXT',
  'CREATE INDEX IF NOT EXISTS empresas_api_key_hash_idx ON empresas(api_key_hash)',
] as const
export const credentialFields: Record<string, readonly string[]> = {
  Empresa: ['apiKey', 'metaToken', 'metaTwoStepPin', 'metaWebhookVerifyToken', 'uazapiToken'],
  WhatsAppConnection: ['accessToken', 'webhookVerifyToken'],
  GoogleCalendarConnection: ['accessToken', 'refreshToken'],
}
const allFields = new Set(Object.values(credentialFields).flat())
// These are application/provider JSON values, not related credential records.
const opaqueJsonFields = new Set(['onboardingData', 'remarketingProposals', 'fields', 'content', 'preferences', 'metadata', 'components', 'payload', 'rawJson', 'rawData', 'subPermissions', 'steps', 'audienceFilter', 'variations', 'templateSnapshot', 'variables'])
export function isEncryptedCredential(value: string) { return value.startsWith(PREFIX) }

export function encryptionKey(value = process.env.INTEGRATION_ENCRYPTION_KEY): Buffer | undefined {
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('INTEGRATION_ENCRYPTION_KEY obrigatória em produção')
    return undefined
  }
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('INTEGRATION_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais')
  return Buffer.from(value, 'hex')
}

export function encryptCredential(value: string, field: string, key = encryptionKey()) {
  if (!value) return value
  if (!key) throw new Error('Configure a chave de criptografia antes de salvar credenciais')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(`sellclin-credential-v1:${field}`))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return PREFIX + [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}

export function decryptCredential(value: string, field: string, key = encryptionKey()) {
  if (!value.startsWith(PREFIX)) return value // Existing rows are migrated separately.
  if (!key) throw new Error('Chave de criptografia indisponível')
  try {
    const parts = value.slice(PREFIX.length).split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Formato inválido')
    const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'))
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Formato inválido')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(`sellclin-credential-v1:${field}`))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch { throw new Error('Não foi possível ler uma credencial criptografada') }
}

export function apiKeyLookupHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function protectCredentialData(model: string, data: unknown, key = encryptionKey()): unknown {
  if (Array.isArray(data)) return data.map(item => protectCredentialData(model, item, key))
  if (!data || typeof data !== 'object') return data
  const result = { ...data } as Record<string, unknown>
  for (const field of credentialFields[model] || []) {
    const value = result[field]
    const raw = value && typeof value === 'object' && 'set' in value ? value.set : value
    if (typeof raw !== 'string' && raw !== null) continue
    if (model === 'Empresa' && field === 'apiKey') result.apiKeyHash = typeof raw === 'string' && raw ? apiKeyLookupHash(raw) : null
    const protectedValue = typeof raw === 'string' ? encryptCredential(raw, field, key) : null
    result[field] = value && typeof value === 'object' ? { set: protectedValue } : protectedValue
  }
  const relations: Record<string, string> = { company: 'Empresa', ownedCompanies: 'Empresa', whatsappConnection: 'WhatsAppConnection', googleCalendarConnection: 'GoogleCalendarConnection' }
  for (const [name, relatedModel] of Object.entries(relations)) {
    const relation = result[name]
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue
    const operations = { ...relation } as Record<string, unknown>
    for (const operation of ['create', 'update', 'upsert', 'createMany', 'updateMany', 'connectOrCreate']) {
      if (!operations[operation]) continue
      const entries = Array.isArray(operations[operation]) ? operations[operation] as unknown[] : [operations[operation]]
      const protectedEntries = entries.map(entry => {
        if (!entry || typeof entry !== 'object') return entry
        if (operation === 'create') return protectCredentialData(relatedModel, entry, key)
        const item = { ...entry } as Record<string, unknown>
        for (const slot of ['data', 'create', 'update']) if (item[slot]) item[slot] = protectCredentialData(relatedModel, item[slot], key)
        // A one-to-one nested update may use the data directly.
        return operation === 'update' && !item.data ? protectCredentialData(relatedModel, item, key) : item
      })
      operations[operation] = Array.isArray(operations[operation]) ? protectedEntries : protectedEntries[0]
    }
    result[name] = operations
  }
  return result
}

export function readCredentialData(value: unknown, key = encryptionKey()): unknown {
  if (Array.isArray(value)) return value.map(item => readCredentialData(item, key))
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return value
  return Object.fromEntries(Object.entries(value).map(([field, child]) => [field,
    opaqueJsonFields.has(field) ? child : allFields.has(field) && typeof child === 'string' ? decryptCredential(child, field, key) : readCredentialData(child, key),
  ]))
}

export async function credentialQuery<T>(model: string, operation: string, args: Record<string, unknown>, query: (input: Record<string, unknown>) => Promise<T>, key = encryptionKey()): Promise<T> {
  const input = { ...args }
  if (['create', 'update', 'updateMany', 'createMany', 'createManyAndReturn', 'updateManyAndReturn'].includes(operation) && input.data) {
    input.data = protectCredentialData(model, input.data, key)
  } else if (operation === 'upsert') {
    input.create = protectCredentialData(model, input.create, key)
    input.update = protectCredentialData(model, input.update, key)
  }
  return readCredentialData(await query(input), key) as T
}
