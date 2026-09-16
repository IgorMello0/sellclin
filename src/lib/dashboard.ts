import type { ApiResponse } from './api';

export type DashboardFilter = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export function isValidDashboardRange(start: string, end: string) {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return validDate(start) && validDate(end) && start <= end;
}

interface TeamRole {
  isSDR?: boolean;
  isCloser?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
}

export interface DashboardTeamMember {
  id: number;
  name: string;
  companyId?: number;
  role?: TeamRole;
  companyAccess?: Array<{ companyId: number; isActive?: boolean; role?: TeamRole }>;
}

export async function loadDashboardTeam(
  companyId: number,
  getPage: (params: { page: number; pageSize: number }) => Promise<ApiResponse<DashboardTeamMember[]>>,
  signal?: AbortSignal,
) {
  const users = new Map<number, DashboardTeamMember>();
  let received = 0;
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const response = await getPage({ page, pageSize: 100 });
    signal?.throwIfAborted();
    if (!response.success || !response.data) throw new Error('Não foi possível carregar os filtros de equipe.');
    response.data.forEach(user => users.set(user.id, user));
    received += response.data.length;
    if (!response.pagination || received >= response.pagination.total) break;
    if (response.data.length === 0) throw new Error('A lista da equipe mudou. Tente novamente.');
  }
  const sdrs: DashboardTeamMember[] = [];
  const closers: DashboardTeamMember[] = [];
  for (const user of users.values()) {
    const access = user.companyAccess?.find(item => item.companyId === companyId);
    if (access?.isActive === false || (!access && user.companyId !== companyId)) continue;
    const role = access?.role || user.role;
    if (role?.isSDR || role?.isManager || role?.isAdmin) sdrs.push(user);
    if (role?.isCloser || role?.isManager || role?.isAdmin) closers.push(user);
  }
  return { sdrs, closers };
}
