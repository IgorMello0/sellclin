import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { migrateSecurityIsolation } from '../services/security-migration.js'

// Raw client: this migration never needs to read or decrypt integration credentials.
const db = new PrismaClient()
try {
  if (!process.argv.includes('--apply')) {
    const counts = await db.$queryRaw`SELECT
      (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM catalog_items) AS services,
      (SELECT count(*)::int FROM ficha_templates) AS templates,
      (SELECT count(*)::int FROM roles) AS roles`
    console.log({ mode: 'read-only', counts, instruction: 'Restaure o backup em homologação, interrompa escritas e use --apply para executar a transação.' })
  } else {
    console.log(await db.$transaction(migrateSecurityIsolation, { timeout: 600_000, maxWait: 10_000, isolationLevel: 'Serializable' }))
  }
} finally {
  await db.$disconnect()
}
