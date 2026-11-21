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
 * Build de production Vercel (`VERCEL_ENV`, variable système) : les builds locaux, la CI et les
 * previews restent possibles tant que le contenu est incomplet.
 */
export function isProductionBuild(env: BuildEnv): boolean {
  return env['VERCEL_ENV'] === 'production';
}

/** Nom d'hôte sans protocole, chemin ni `www.`, en minuscules. */
function bareHost(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      ?.replace(/^www\./, '') ?? ''
  );
}

/**
 * Le garde-fou bloque le build de production qui servirait le vrai domaine (`siteUrl`), et lui
 * seul (ADR-0015 révisée) : tant que la production n'a que son adresse `*.vercel.app` (en
 * `noindex` via `vercel.json`), elle peut être déployée avec des pages légales incomplètes.
 * `VERCEL_PROJECT_PRODUCTION_URL` (variable système, sans protocole) donne le domaine de
 * production le plus court, ou l'adresse `vercel.app` sans domaine personnalisé. Absente alors
 * que `VERCEL_ENV` est fourni : on bloque par prudence.
 */
export function isReleaseGuarded(env: BuildEnv, siteUrl: string): boolean {
  if (!isProductionBuild(env)) return false;
  const productionHost = env['VERCEL_PROJECT_PRODUCTION_URL'];
  if (!productionHost) return true;
  return bareHost(productionHost) === bareHost(siteUrl);
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
