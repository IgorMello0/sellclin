import { describe, expect, it, vi } from 'vitest';
import { isValidDashboardRange, loadDashboardTeam } from './dashboard';

describe('dashboard team and date input', () => {
  it('loads all pages, deduplicates and resolves roles in the active clinic', async () => {
    const first = { id: 1, name: 'Primeiro', companyId: 2, role: { isSDR: true } };
    const last = { id: 30, name: 'Último', companyId: 1, role: { isSDR: true }, companyAccess: [{ companyId: 2, role: { isCloser: true } }] };
    const getPage = vi.fn()
      .mockResolvedValueOnce({ success: true, data: [first], pagination: { total: 3 } })
      .mockResolvedValueOnce({ success: true, data: [first, last], pagination: { total: 3 } });
    const result = await loadDashboardTeam(2, getPage);
    expect(getPage).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(result.sdrs.map(user => user.id)).toEqual([1]);
    expect(result.closers.map(user => user.id)).toEqual([30]);
  });
  it('does not expose a partial team after a later page fails', async () => {
    const getPage = vi.fn()
      .mockResolvedValueOnce({ success: true, data: [{ id: 1 }], pagination: { total: 2 } })
      .mockResolvedValueOnce({ success: false });
    await expect(loadDashboardTeam(2, getPage)).rejects.toThrow();
  });
  it('rejects blank, impossible and reversed dates but accepts a single day', () => {
    expect(isValidDashboardRange('', '2026-09-01')).toBe(false);
    expect(isValidDashboardRange('2026-02-30', '2026-09-01')).toBe(false);
    expect(isValidDashboardRange('2026-09-14', '2026-09-01')).toBe(false);
    expect(isValidDashboardRange('2026-09-14', '2026-09-14')).toBe(true);
  });
});
