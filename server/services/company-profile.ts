import { prisma } from '../prisma.js'

// Explicit allowlist: ordinary clinic screens must never decrypt credentials.
export const companyProfileSelect = {
  id: true, ownerId: true, name: true, logoUrl: true, domain: true, whatsapp: true,
  whatsappProvider: true, evolutionApiUrl: true, evolutionInstance: true, evolutionMode: true,
  metaPhoneNumberId: true, metaWabaId: true, metaBusinessId: true, metaPhoneDisplayNumber: true,
  metaConnectedAt: true, metaConnectionStatus: true, uazapiInstanceId: true,
  uazapiInstanceName: true, uazapiConnectionStatus: true, uazapiConnectedAt: true,
  webhookToken: true, plan: true, maxDiscountPercentage: true, leadRoutingMode: true,
  openHour: true, closeHour: true, contactCadence: true, chargeConsultation: true,
  isActive: true, createdAt: true, updatedAt: true,
} as const

export async function getCompanyProfile(id: number) {
  const company = await prisma.empresa.findUnique({ where: { id }, select: companyProfileSelect })
  if (!company) return null
  // Only presence leaves PostgreSQL. Neither plaintext nor ciphertext is read.
  const flags = await prisma.$queryRaw<Array<{
    hasApiKey: boolean; hasMetaToken: boolean; hasMetaWebhookVerifyToken: boolean;
    hasMetaTwoStepPin: boolean; hasUazapiToken: boolean;
  }>>`SELECT
    COALESCE(api_key <> '', false) AS "hasApiKey",
    COALESCE(meta_token <> '', false) AS "hasMetaToken",
    COALESCE(meta_webhook_verify_token <> '', false) AS "hasMetaWebhookVerifyToken",
    COALESCE(meta_two_step_pin <> '', false) AS "hasMetaTwoStepPin",
    COALESCE(uazapi_token <> '', false) AS "hasUazapiToken"
    FROM empresas WHERE id = ${id}`
  return { ...company, ...flags[0] }
}
