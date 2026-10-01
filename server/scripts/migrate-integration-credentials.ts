import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { credentialFields, credentialSchemaStatements, encryptionKey, encryptCredential, decryptCredential, isEncryptedCredential, apiKeyLookupHash } from '../services/integration-encryption.js'

// Use the raw client only for this controlled, compare-and-set migration.
const db = new PrismaClient({ log: [] })
const modes = process.argv.slice(2)
const apply = modes.includes('--apply')
const verify = modes.includes('--verify')

async function main() {
  if (modes.some(mode => !['--apply', '--verify', '--prepare'].includes(mode)) || modes.length > 1) throw new Error('Use uma opção: --prepare, --apply ou --verify. Sem opção: somente conferência.')
  if (modes.includes('--prepare')) {
    await db.$transaction(async tx => {
      for (const statement of credentialSchemaStatements) await tx.$executeRawUnsafe(statement)
    })
    console.log(JSON.stringify({ schema: 'OK' }))
    return
  }
  const key = encryptionKey()
  if (!key) throw new Error('Configure INTEGRATION_ENCRYPTION_KEY antes da migração')
  const totals = { rows: 0, encrypted: 0, plaintext: 0, invalid: 0, hashesMissing: 0, updated: 0, concurrentChanges: 0 }
  for (const [model, fields] of Object.entries(credentialFields)) {
    const table = model === 'Empresa' ? db.empresa : model === 'WhatsAppConnection' ? db.whatsAppConnection : db.googleCalendarConnection
    let lastId = 0
    while (true) {
      const rows: Record<string, any>[] = await (table as any).findMany({
        where: { id: { gt: lastId } }, orderBy: { id: 'asc' }, take: 100,
        select: { id: true, ...Object.fromEntries(fields.map(field => [field, true])), ...(model === 'Empresa' ? { apiKeyHash: true } : {}) },
      })
      if (!rows.length) break
      for (const row of rows) {
        totals.rows++
        const data: Record<string, unknown> = {}
        const where: Record<string, unknown> = { id: row.id }
        let unreadable = false
        for (const field of fields) {
          const stored = row[field]
          where[field] = stored
          if (!stored) continue
          let plaintext: string
          try { plaintext = decryptCredential(stored, field, key) } catch { totals.invalid++; unreadable = true; continue }
          if (isEncryptedCredential(stored)) totals.encrypted++
          else { totals.plaintext++; data[field] = encryptCredential(plaintext, field, key) }
          if (model === 'Empresa' && field === 'apiKey' && row.apiKeyHash !== apiKeyLookupHash(plaintext)) {
            totals.hashesMissing++
            data.apiKeyHash = apiKeyLookupHash(plaintext)
            where.apiKeyHash = row.apiKeyHash
          }
        }
        if (apply && !unreadable && Object.keys(data).length) {
          const result = await (table as any).updateMany({ where, data })
          if (result.count === 1) totals.updated++
          else totals.concurrentChanges++
        }
      }
      lastId = rows[rows.length - 1].id
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : verify ? 'verify' : 'dry-run', ...totals }, null, 2))
  if (totals.invalid || totals.concurrentChanges || (verify && (totals.plaintext || totals.hashesMissing))) process.exitCode = 1
}

main().catch(() => {
  // Never print database errors that may contain credentials or parameter values.
  console.error('Falha na migração. Confira a conexão, o patch e a chave de criptografia. Nenhum segredo será exibido.')
  process.exitCode = 1
}).finally(() => db.$disconnect())
