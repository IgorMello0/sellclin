import { defineConfig } from 'vitest/config'
import path from 'node:path'
export default defineConfig({ resolve: { alias: { '@': path.resolve(__dirname, './src') } }, esbuild: { jsx: 'automatic' }, test: { environment: 'node', include: ['server/services/bot*.test.ts', 'server/routes/agentes-ia.test.ts', 'src/pages/AtendimentoBots.test.tsx', 'src/pages/N8nSettings.test.tsx'], testTimeout: 15000 } })
