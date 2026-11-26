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

/**
 * Base des projets TypeScript compilés par tsc (API NestJS et libs, ADR-0023) : lint typé
 * `strictTypeChecked` (promesses non attendues, mauvais usages d'async : vital sur du code
 * d'authentification), en plus de `sharedConfigs` et `sharedRules`.
 *
 * Décorateurs : avec `experimentalDecorators` et `emitDecoratorMetadata` (tsconfig.base.json, lus par
 * le lint typé et repris ici explicitement), `consistent-type-imports` ne signale rien dans les
 * fichiers qui contiennent des décorateurs. Il ne peut donc pas transformer en `import type` une
 * classe injectée par Nest (ce qui effacerait sa métadonnée `design:paramtypes` et casserait
 * l'injection) ; il reste appliqué partout ailleurs. Le test d'amorçage de l'API attrape toute régression.
 * Les fichiers JavaScript (configs) sont lintés sans types.
 * @param {string} tsconfigRootDir dossier du projet (import.meta.dirname)
 */
export function typedTsConfigs(tsconfigRootDir) {
  return [
    ...sharedConfigs,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
      ...sharedRules,
    },
    {
      // Modules Nest : classes vides porteuses d'un décorateur (`@Module({ … }) class AppModule {}`).
      rules: {
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      },
    },
    {
      files: ['**/*.js'],
      ...tseslint.configs.disableTypeChecked,
    },
    prettier,
  ];
}

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
