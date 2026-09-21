import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    // Security regression suites run with mocked persistence, never the shared database.
    environment: 'jsdom',
    include: ['server/routes/conversas.access.test.ts', 'server/services/conversation-access.test.ts', 'server/middleware/action-permissions.test.ts', 'server/services/change-password.test.ts', 'src/pages/settings-navigation.test.tsx', 'src/pages/settings/CadenceSettingsView.test.tsx', 'server/routes/metas.test.ts', 'src/pages/Dashboard.test.tsx', 'src/lib/dashboard.test.ts', 'src/lib/funnel.test.ts', 'src/pages/SalesFunnel.test.tsx', 'src/components/funnel/ProposalDialog.test.tsx', 'server/routes/leads.test.ts', 'src/pages/list-pagination.test.ts'],
  },
});
