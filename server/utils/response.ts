export type Pagination = {
  page: number
  pageSize: number
  total: number
}

export function createSuccessResponse<T>(data: T, pagination?: Pagination) {
  return { success: true, data, pagination }
}

export function createErrorResponse(message: string, code?: number, details?: Record<string, unknown>) {
  if (code && code >= 500) return { success: false, error: { message: 'Não foi possível concluir a solicitação. Tente novamente mais tarde.', code } }
  return { success: false, error: { message, code, ...(details || {}) } }
}

export function parsePagination(query: any) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(5000, Math.max(1, Number(query.pageSize) || 20))
  const skip = (page - 1) * pageSize
  const take = pageSize
  return { page, pageSize, skip, take }
}

