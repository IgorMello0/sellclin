import { describe, expect, it, vi } from 'vitest';
import { loadAllPages } from './funnel';

describe('funnel pagination', () => {
  it('loads leads beyond the first thousand for filters and totals', async () => {
    const getPage = vi.fn(async ({ page, pageSize }) => ({ success: true, data: Array.from({ length: page === 3 ? 1 : pageSize }, (_, i) => ({ id: (page - 1) * pageSize + i + 1 })), pagination: { page, pageSize, total: 1001 } }));
    const leads = await loadAllPages(getPage);
    expect(leads).toHaveLength(1001); expect(leads.at(-1)?.id).toBe(1001); expect(getPage).toHaveBeenCalledTimes(3);
  });
  it('does not return a silently incomplete list when a later page fails', async () => {
    const getPage = vi.fn().mockResolvedValueOnce({ success: true, data: [{ id: 1 }], pagination: { total: 2 } }).mockResolvedValueOnce({ success: false });
    await expect(loadAllPages(getPage)).rejects.toThrow();
  });
});
