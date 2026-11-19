// Configuration ESLint (flat config) — TypeScript strict, Astro, accessibilité (jsx-a11y-x, ADR-0004).
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  globalIgnores([
    'dist/',
    'dist-service/',
    '.astro/',
    '.vercel/',
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'coverage/',
    '.lighthouseci/',
    '.playwright-mcp/',
    '.claude/worktrees/',
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs['flat/recommended'],
  astro.configs['flat/jsx-a11y-strict'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  prettier,
);
