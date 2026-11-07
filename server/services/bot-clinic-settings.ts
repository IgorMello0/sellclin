import { z } from 'zod'
import { prisma } from '../prisma.js'

export const clinicBotSchema = z.object({
  provider: z.enum(['openai', 'anthropic']).default('openai'), model: z.string().trim().max(150).default(''),
  instructions: z.string().max(20000).default(''), knowledge: z.string().max(40000).default(''),
  maxResponses: z.number().int().min(1).max(100).default(10), dailyLimit: z.number().int().min(1).max(10000).default(200),
  qualificationFields: z.array(z.string().trim().min(1).max(60)).max(12).default(['nome', 'email', 'interesse']),
  handoffTerms: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  qualifyEnabled: z.boolean().default(true), bookingEnabled: z.boolean().default(true),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: v }); return true } catch { return false } }).default('America/Sao_Paulo'),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
})
export async function effectiveBotConfig(companyId: number, config: any, db: any = prisma) {
  if (!config) return config
  const shared = await db.botClinicSettings.findUnique({ where: { companyId } })
  if (!shared) return config // Preserve existing clinics until they save shared settings.
  return { ...config, ...clinicBotSchema.parse(shared.settings), apiKey: shared.apiKey, sharedSettings: true }
}
