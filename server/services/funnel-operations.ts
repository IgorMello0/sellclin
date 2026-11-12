import type { Prisma } from '@prisma/client'
import {
  copiedFunnelCode, copiedStageCode, isReservedFunnelCode, parseCopiedStage,
  type OriginalFunnelCode,
} from '../utils/funnel-stages.js'

type StageStore = Pick<Prisma.TransactionClient, 'funnelStage'>

export async function findCopiedStage(db: StageStore, companyId: number | null, code: string) {
  const copy = parseCopiedStage(code)
  if (!companyId || !copy) return null
  return db.funnelStage.findFirst({
    where: {
      code, isActive: true,
      funnel: { companyId, code: copiedFunnelCode(copy.operation, copy.template), isActive: true },
    },
    select: { code: true, label: true, funnel: { select: { label: true } } },
  })
}

export async function isValidLeadStage(db: StageStore, companyId: number | null, status: unknown) {
  if (!isReservedFunnelCode(status)) return true
  return !!await findCopiedStage(db, companyId, status as string)
}

/** Legacy leads retain their system transition. A copied lead advances only inside its operation. */
export async function resolveOperationStage(
  db: StageStore, companyId: number | null, currentStatus: string,
  template: OriginalFunnelCode, targetStatus: string,
) {
  const copy = parseCopiedStage(currentStatus)
  if (!copy) return targetStatus
  const target = await findCopiedStage(db, companyId, copiedStageCode(copy.operation, template, targetStatus))
  return target?.code ?? null
}
