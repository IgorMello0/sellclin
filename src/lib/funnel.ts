import type { ApiResponse } from './api';

export async function loadAllPages<T extends { id: number | string }>(
  getPage: (params: { page: number; pageSize: number }) => Promise<ApiResponse<T[]>>,
) {
  const items = new Map<T['id'], T>();
  let received = 0;
  for (let page = 1; ; page++) {
    const response = await getPage({ page, pageSize: 500 });
    if (!response.success || !response.data) throw new Error(response.error?.message || 'Não foi possível carregar os dados.');
    const previousSize = items.size;
    response.data.forEach(item => items.set(item.id, item));
    received += response.data.length;
    if (!response.pagination || received >= response.pagination.total) return [...items.values()];
    if (items.size === previousSize) throw new Error('A lista mudou durante o carregamento. Tente novamente.');
  }
}

export function requireApiSuccess<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data == null) throw new Error(response.error?.message || 'A alteração não foi salva.');
  return response.data;
}
