export const ORIGINAL_FUNNEL_CODES = ['prospecting', 'commercial', 'sales'] as const
export type OriginalFunnelCode = typeof ORIGINAL_FUNNEL_CODES[number]

export const COPIED_FUNNEL_PREFIX = 'sellclin_copy__'
const operationPattern = '([a-z0-9]+(?:-[a-z0-9]+)*)'
const templatePattern = '(prospecting|commercial|sales)'
const copiedFunnelPattern = new RegExp(`^${COPIED_FUNNEL_PREFIX}${operationPattern}__${templatePattern}$`)
const copiedStagePattern = new RegExp(`^${COPIED_FUNNEL_PREFIX}${operationPattern}__${templatePattern}__(.+)$`)

export const closingStages = ['comercial_closed', 'sales_payment', 'sales_contract', 'sales_post']
export const prospectingStages = ['prospect_lead', 'prospect_qualified', 'prospect_scheduled', 'prospect_attended']

export function isOriginalFunnel(code: string): code is OriginalFunnelCode {
  return ORIGINAL_FUNNEL_CODES.some(original => original === code)
}

export function isReservedFunnelCode(code: unknown): boolean {
  return typeof code === 'string' && code.startsWith(COPIED_FUNNEL_PREFIX)
}

export function operationKey(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function copiedFunnelCode(operation: string, template: OriginalFunnelCode) {
  return `${COPIED_FUNNEL_PREFIX}${operation}__${template}`
}

export function copiedStageCode(operation: string, template: OriginalFunnelCode, stage: string) {
  return `${copiedFunnelCode(operation, template)}__${stage}`
}

export function parseCopiedFunnel(code: unknown) {
  const match = typeof code === 'string' ? copiedFunnelPattern.exec(code) : null
  return match ? { operation: match[1], template: match[2] as OriginalFunnelCode } : null
}

export function parseCopiedStage(code: unknown) {
  const match = typeof code === 'string' ? copiedStagePattern.exec(code) : null
  return match ? { operation: match[1], template: match[2] as OriginalFunnelCode, stage: match[3] } : null
}

export function stageBehavior(code: string): string {
  return parseCopiedStage(code)?.stage ?? code
}

export function isClosingStage(code: unknown): boolean {
  return typeof code === 'string' && closingStages.includes(stageBehavior(code))
}
