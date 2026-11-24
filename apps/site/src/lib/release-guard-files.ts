/**
 * Lecture des fichiers bloquants du garde-fou de mise en production (Node uniquement, ADR-0015) :
 * partagée par l'intégration `amg:garde-fou-production` (astro.config.mjs) et le script
 * `npm run check:prod` (scripts/check-prod.ts). Sans alias d'import, extensions `.ts`
 * explicites : chargé par Node avant la configuration de Vite.
 */
import { readFileSync } from 'node:fs';
import { findContentTodos, RELEASE_BLOCKING_FILES, type FileContentTodo } from './release-guard.ts';

const PROJECT_ROOT = new URL('../../', import.meta.url);

/** Tous les `TODO(contenu)` restants des fichiers bloquants, fichier par fichier. */
export function readReleaseBlockers(): FileContentTodo[] {
  return RELEASE_BLOCKING_FILES.flatMap((file) =>
    findContentTodos(readFileSync(new URL(file, PROJECT_ROOT), 'utf8')).map((todo) => ({
      file,
      ...todo,
    })),
  );
}
