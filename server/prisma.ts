import { PrismaClient } from '@prisma/client'
import { credentialQuery, encryptionKey } from './services/integration-encryption.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createProtectedClient() {
  const key = encryptionKey()
  const client = new PrismaClient({ log: ['error', 'warn'] })
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // All integration writes go through this boundary, including transaction clients.
          return credentialQuery(model, operation, args as Record<string, unknown>, input => query(input as typeof args), key)
        },
      },
    },
  }) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createProtectedClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
