// Configuration ESLint racine (flat config) : base partagée par les projets du monorepo (ADR-0019)
// et lint des fichiers hors projets (.claude/hooks, configs racine). Chaque projet a la sienne
// (apps/site/eslint.config.js), qui importe `sharedConfigs` et `sharedRules`.
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Règles communes à tous les projets : TypeScript strict. */
export const sharedConfigs = [js.configs.recommended, tseslint.configs.strict];

/** Interdits communs (CLAUDE.md §11). */
export const sharedRules = {
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
  },
};

export default defineConfig(
  globalIgnores([
    'apps/',
    'libs/',
    'node_modules/',
    '.nx/',
    '.vercel/',
    'coverage/',
    '.playwright-mcp/',
    '.claude/worktrees/',
  ]),
  ...sharedConfigs,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    ...sharedRules,
  },
  prettier,
);
