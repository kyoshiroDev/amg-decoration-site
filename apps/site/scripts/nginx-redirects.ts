/**
 * Génère la table de redirections nginx à partir de
 * `vercel.json`, seule source de vérité des redirections (ADR-0008). Exécuté par Node (types effacés)
 * dans l'étape de build de l'image du site : `node apps/site/scripts/nginx-redirects.ts vercel.json`.
 *
 * Sortie (stdout) : un bloc `map $uri $amg_redirect { … }` à inclure dans le contexte `http`.
 *
 * Sémantique reproduite (vérifiée par tests/unit/nginx-redirects.test.ts et tests/conformance/) :
 * - chaque source devient une expression régulière ancrée, SENSIBLE À LA CASSE, dans l'ordre de
 *   `vercel.json` : nginx teste les expressions d'un `map` dans l'ordre et garde la première, comme
 *   Vercel (les clés exactes d'un `map` seraient insensibles à la casse et prioritaires sur l'ordre) ;
 * - une seule réponse possible : 308 (`permanent: true` chez Vercel), codée dans nginx.conf ;
 * - la règle générique « barre finale » (`/:path(…)`) est codée dans nginx.conf, APRÈS la table :
 *   elle doit donc être la dernière règle sans condition de `vercel.json` ;
 * - les règles `has` (hôte `www.`) ne sont pas traduites une à une : nginx préfixe la même
 *   destination par `$amg_origin`. On vérifie qu'elles sont exactement la déclinaison absolue des
 *   règles du domaine nu, suivie du renvoi générique `/:path(.*)`, sinon le build échoue.
 */
import { readFileSync } from 'node:fs';

export interface VercelHas {
  type: string;
  key?: string;
  value?: string;
}

export interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
  has?: VercelHas[];
}

/** Code de toutes les redirections servies par nginx (`return 308` dans nginx.conf). */
export const REDIRECT_STATUS = 308;

/** Règle « barre finale » de vercel.json, reproduite par nginx.conf (après la table). */
export const TRAILING_SLASH_SOURCE = '/:path((?!(?:\\.well-known|_vercel)/)(?:[^/]+/)*[^/.]+)';
const TRAILING_SLASH_DESTINATION = '/:path/';

/** Renvoi générique de l'hôte `www.` vers le même chemin du domaine nu. */
export const WWW_CATCH_ALL_SOURCE = '/:path(.*)';

/** Caractères impossibles à écrire sans risque dans une chaîne nginx entre guillemets. */
const UNSAFE_NGINX = /["\\$\s\p{Cc}]/u;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Code HTTP renvoyé par Vercel pour cette règle. */
export function vercelStatus(rule: VercelRedirect): number {
  return rule.statusCode ?? (rule.permanent === true ? 308 : 307);
}

/** Chemin littéral de vercel.json → texte comparé à `$uri` (décodé par nginx). */
function literalPath(text: string, source: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    throw new Error(`Source Vercel mal encodée : ${source}`);
  }
  if (UNSAFE_NGINX.test(decoded) || /[:()?#*+]/.test(decoded)) {
    throw new Error(`Source Vercel non traduite pour nginx : ${source}`);
  }
  return decoded;
}

/**
 * Traduit une source Vercel en clé de `map` nginx : expression régulière ancrée, entre
 * guillemets. Seuls les chemins littéraux et le suffixe `/:rest+` (ou `/:rest+/`) sont acceptés.
 */
export function toMapKey(source: string): string {
  if (!source.startsWith('/')) throw new Error(`Source Vercel non traduite pour nginx : ${source}`);
  const rest = /^(.*)\/:rest\+(\/?)$/.exec(source);
  if (rest) {
    const prefix = escapeRegex(literalPath(rest[1] ?? '', source));
    // Même expression que path-to-regexp (mode strict) : un ou plusieurs segments non vides.
    return `"~^${prefix}/[^/]+(?:/[^/]+)*${rest[2] ?? ''}$"`;
  }
  return `"~^${escapeRegex(literalPath(source, source))}$"`;
}

/** Destination relative sûre (pas de variable nginx, de guillemet, de requête ni de paramètre). */
function toMapValue(rule: VercelRedirect): string {
  const { destination } = rule;
  if (!destination.startsWith('/') || destination.startsWith('//')) {
    throw new Error(`Destination non relative pour ${rule.source} : ${destination}`);
  }
  if (UNSAFE_NGINX.test(destination) || /[:?#]/.test(destination)) {
    throw new Error(`Destination non traduite pour nginx (${rule.source}) : ${destination}`);
  }
  return `"${destination}"`;
}

function assertStatus(rule: VercelRedirect): void {
  const status = vercelStatus(rule);
  if (status !== REDIRECT_STATUS) {
    throw new Error(
      `Redirection ${rule.source} en ${String(status)} : nginx.conf ne renvoie que ${String(REDIRECT_STATUS)}`,
    );
  }
}

/**
 * Les règles `has` doivent être, dans l'ordre, la déclinaison absolue (`origin` + destination) de
 * chaque règle du domaine nu pour un seul et même hôte, puis le renvoi générique `/:path(.*)`.
 * C'est ce que nginx fait avec `$amg_origin` (nginx.conf) : tout autre cas serait perdu.
 */
export function assertWwwMirror(
  hostRules: readonly VercelRedirect[],
  canonical: readonly VercelRedirect[],
): void {
  if (hostRules.length === 0) return;
  const catchAll = hostRules.at(-1);
  const origin = catchAll?.destination.replace(/\/:path$/, '') ?? '';
  if (catchAll?.source !== WWW_CATCH_ALL_SOURCE || !/^https:\/\/[^/]+$/.test(origin)) {
    throw new Error('Règles www : le renvoi générique /:path(.*) doit être la dernière règle www');
  }
  const conditions = new Set(hostRules.map((rule) => JSON.stringify(rule.has)));
  const [condition] = hostRules[0]?.has ?? [];
  if (conditions.size !== 1 || hostRules[0]?.has?.length !== 1 || condition?.type !== 'host') {
    throw new Error('Règles www : une seule condition `host`, identique pour toutes les règles');
  }
  const expected = [
    ...canonical.map((rule) => [rule.source, `${origin}${rule.destination}`]),
    [WWW_CATCH_ALL_SOURCE, `${origin}/:path`],
  ];
  const actual = hostRules.map((rule) => [rule.source, rule.destination]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Règles www : elles ne reprennent pas exactement les règles du domaine nu');
  }
  hostRules.forEach(assertStatus);
}

/** Table `map $uri $amg_redirect` équivalente aux `redirects` de vercel.json. */
export function buildRedirectMap(redirects: readonly VercelRedirect[]): string {
  const canonical = redirects.filter((rule) => rule.has === undefined);
  assertWwwMirror(
    redirects.filter((rule) => rule.has !== undefined),
    canonical,
  );

  const trailingIndex = canonical.findIndex((rule) => rule.source === TRAILING_SLASH_SOURCE);
  const trailing = canonical[trailingIndex];
  if (trailing?.destination !== TRAILING_SLASH_DESTINATION) {
    throw new Error(
      'Règle « barre finale » absente de vercel.json : nginx.conf l’applique toujours',
    );
  }
  if (trailingIndex !== canonical.length - 1) {
    throw new Error(
      'La règle « barre finale » doit être la dernière : nginx l’applique après la table',
    );
  }
  assertStatus(trailing);

  const lines = new Map<string, string>();
  for (const rule of canonical.slice(0, trailingIndex)) {
    assertStatus(rule);
    const key = toMapKey(rule.source);
    const value = toMapValue(rule);
    // Même source deux fois : la première l'emporte, chez Vercel comme dans un `map` nginx.
    if (!lines.has(key)) lines.set(key, value);
  }
  const body = [...lines].map(([key, value]) => `  ${key} ${value};`).join('\n');
  return [
    '# Généré depuis vercel.json par apps/site/scripts/nginx-redirects.ts : ne pas modifier.',
    '# Expressions testées dans l’ordre, la première gagne (comme les `redirects` de Vercel).',
    'map $uri $amg_redirect {',
    '  default "";',
    ...(body === '' ? [] : [body]),
    '}',
    '',
  ].join('\n');
}

if (import.meta.main) {
  const file = process.argv[2] ?? 'vercel.json';
  const config = JSON.parse(readFileSync(file, 'utf8')) as { redirects?: VercelRedirect[] };
  process.stdout.write(buildRedirectMap(config.redirects ?? []));
}
