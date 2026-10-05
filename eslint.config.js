import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-server/**",
      ".security-check/**",
      "skills/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "original_sales_funnel.tsx",
      "check*.ts",
      "dump*.ts",
      "fix*.ts",
      "query*.ts",
      "test*.ts",
      "assign_sdrs.ts",
      "count_unassigned.ts",
      "gerar_relatorio.ts",
      "grant_access.ts",
      "last_lead.ts",
      "patch*.ts",
      "sanitize-phones.ts",
      "trigger-cadence-fix.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
