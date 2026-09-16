// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { loadAllPages } from '../lib/funnel';

// Execute the actual page loaders with simulated APIs; never connect to a database.
const cases = [
  ['Clients', 'loadClients', '  // Recarregar quando searchQuery', 'clientsApi', 'setClients'],
  ['Leads', 'loadLeads', '  const loadServices', 'leadsApi', 'setLeads'],
  ['Appointments', 'loadAppointments', '  const loadProfessionals', 'appointmentsApi', 'setAppointments'],
  ['Campaigns', 'loadCampaigns', '  const loadMessageCredits', 'campaignsApi', 'setCampaigns'],
] as const;

function setup([page, name, end, api, setter]: typeof cases[number], getAll: any) {
  const source = fs.readFileSync(new URL(`./${page}.tsx`, import.meta.url), 'utf8').replace(/\r/g, '');
  const start = source.indexOf(`  const ${name} =`);
  const finish = source.indexOf(end, start);
  if (start < 0 || finish < 0) throw new Error(`Loader not found: ${page}`);
  const state = { items: [] as any[], loading: false };
  const toast = vi.fn();
  const context = vm.createContext({
    loadAllPages, listRequest: { current: 0 }, professional: { id: 1 }, searchQuery: 'Teste', selectedProfFilter: '7',
    [api]: { getAll }, [setter]: (items: any[]) => { state.items = items; }, setIsLoading: (value: boolean) => { state.loading = value; },
    toast, console, useCallback: (fn: any) => fn, parseISO: (s: string) => new Date(s), format: () => '10:00',
  });
  vm.runInContext(stripTypeScriptTypes(source.slice(start, finish)) + `\nglobalThis.load = ${name};`, context);
  return { load: context.load as () => Promise<void>, state, toast, source };
}

describe.each(cases)('%s pagination', (...args) => {
  const entry = args as unknown as typeof cases[number];
  it('loads the final record beyond every previous cap and preserves query filters', async () => {
    const all = Array.from({ length: 1201 }, (_, i) => ({ id: i + 1, name: `Teste ${i + 1}`, createdAt: '2026-09-01', startTime: '2026-09-01T10:00Z', endTime: '2026-09-01T11:00Z' }));
    const getAll = vi.fn(async (params: any) => ({ success: true, data: all.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), pagination: { page: params.page, pageSize: params.pageSize, total: all.length } }));
    const page = setup(entry, getAll);
    await page.load();
    expect(page.state.items).toHaveLength(1201); expect(page.state.items.at(-1).id).toBe(1201);
    expect(getAll.mock.calls.map(([p]) => p.page)).toEqual([1, 2, 3]);
    for (const [params] of getAll.mock.calls) {
      if (entry[0] === 'Clients' || entry[0] === 'Leads') expect(params.search).toBe('Teste');
      if (entry[0] === 'Appointments') expect(params.professionalId).toBe(7);
    }
    if (entry[0] === 'Clients' || entry[0] === 'Leads') {
      const entity = entry[0];
      for (const itemsPerPage of [20, 50, 100]) {
        const context = vm.createContext({ [`filtered${entity}`]: page.state.items, itemsPerPage, currentPage: Math.ceil(1201 / itemsPerPage) });
        const a = page.source.indexOf('  const totalPages ='), b = page.source.indexOf('\n', page.source.indexOf(`  const paginated${entity} =`, a));
        vm.runInContext(page.source.slice(a, b) + `\nglobalThis.lastPage = paginated${entity};`, context);
        expect(context.lastPage.at(-1).id).toBe(1201);
      }
    }
  });
  it('reports failure instead of presenting a partial list as complete', async () => {
    const getAll = vi.fn().mockResolvedValueOnce({ success: true, data: [{ id: 1 }], pagination: { total: 2 } }).mockResolvedValueOnce({ success: false, error: { message: 'Page failed' } });
    const page = setup(entry, getAll);
    await page.load();
    expect(page.state.items).toEqual([]); expect(page.state.loading).toBe(false);
    expect(page.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
  it('ignores an older request that finishes after a newer one', async () => {
    let resolve!: (value: any) => void;
    const old = new Promise(done => { resolve = done; });
    const item = (id: number) => ({ id, createdAt: '2026-09-01', startTime: '2026-09-01T10:00Z', endTime: '2026-09-01T11:00Z' });
    const getAll = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce({ success: true, data: [item(2)], pagination: { total: 1 } });
    const page = setup(entry, getAll);
    const pending = page.load(); await page.load();
    resolve({ success: true, data: [item(1)], pagination: { total: 1 } }); await pending;
    expect(page.state.items[0].id).toBe(2);
  });
});
