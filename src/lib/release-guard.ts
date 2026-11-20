/**
 * Garde-fou de mise en production (ADR-0015) : repère les `TODO(contenu)` qui restent dans les
 * fichiers dont la publication incomplète serait illégale (pages légales). Fonctions PURES,
 * testées dans tests/unit/release-guard.test.ts ; la lecture des fichiers est dans
 * ./release-guard-files.ts. Sans alias d'import : chargé avant la configuration de Vite.
 */

/** Marqueur des informations manquantes (CLAUDE.md §11). */
export const CONTENT_TODO_MARKER = 'TODO(contenu)';

/**
 * Fichiers bloquants, chemins relatifs à la racine du projet : la loi exige leurs informations
 * (LCEN, RGPD, Code de la consommation). Les autres `TODO(contenu)` du projet ne bloquent pas
 * la mise en ligne (justification : ADR-0015).
 */
export const RELEASE_BLOCKING_FILES = [
  'src/content/pages/mentions-legales.md',
  'src/content/pages/conditions-generales.md',
  'src/content/pages/confidentialite.md',
] as const;

export interface ContentTodo {
  /** Numéro de ligne, à partir de 1. */
  readonly line: number;
  /** Texte de la ligne, sans le marqueur de commentaire ni les espaces de bord. */
  readonly text: string;
}

export interface FileContentTodo extends ContentTodo {
  readonly file: string;
}

/** `TODO(contenu)` d'un texte, dans l'ordre des lignes. */
export function findContentTodos(text: string): ContentTodo[] {
  return text
    .split(/\r?\n/)
    .flatMap((line, index) =>
      line.includes(CONTENT_TODO_MARKER)
        ? [{ line: index + 1, text: line.replace(/^\s*(?:#|\/\/|\*)\s*/, '').trim() }]
        : [],
    );
}

/** Variables d'environnement du processus (`process.env`). */
export type BuildEnv = Readonly<Record<string, string | undefined>>;

/**
 * Le contrôle ne s'applique qu'au build de production Vercel (`VERCEL_ENV`, variable système) :
 * les builds locaux, la CI et les previews restent possibles tant que le contenu est incomplet.
 */
export function isProductionBuild(env: BuildEnv): boolean {
  return env['VERCEL_ENV'] === 'production';
}

/** Message d'erreur listant chaque `TODO(contenu)` restant en `fichier:ligne`. */
export function formatReleaseBlockers(todos: readonly FileContentTodo[]): string {
  const lines = todos.map(({ file, line, text }) => `  - ${file}:${line}  ${text}`);
  return [
    `Mise en production bloquée : ${todos.length} ${CONTENT_TODO_MARKER} dans les pages légales (ADR-0015).`,
    ...lines,
    'Complétez ces informations (ou supprimez le TODO une fois traité), puis relancez le déploiement.',
  ].join('\n');
}
