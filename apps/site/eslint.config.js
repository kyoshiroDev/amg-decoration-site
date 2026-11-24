// Configuration ESLint du site (flat config) — TypeScript strict, Astro, accessibilité (jsx-a11y-x, ADR-0004).
// La base commune (TypeScript strict, interdits) vient de la racine du monorepo (ADR-0019).
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { sharedConfigs, sharedRules } from '../../eslint.config.js';

export default defineConfig(
  globalIgnores([
    'dist/',
    'dist-service/',
    'dist-visual/',
    '.astro/',
    '.vercel/',
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'coverage/',
    '.lighthouseci/',
  ]),
  ...sharedConfigs,
  astro.configs['flat/recommended'],
  astro.configs['flat/jsx-a11y-strict'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    ...sharedRules,
  },
  prettier,
);
