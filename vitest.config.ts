import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/pages/Dashboard.test.tsx', 'src/lib/dashboard.test.ts', 'src/lib/funnel.test.ts', 'src/pages/SalesFunnel.test.tsx', 'src/components/funnel/ProposalDialog.test.tsx', 'server/routes/leads.test.ts', 'src/pages/list-pagination.test.ts'],
  },
});
