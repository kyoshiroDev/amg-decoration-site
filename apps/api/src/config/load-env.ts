// Chargement de la configuration au démarrage (ADR-0023) : fonction pure, lecteur de fichier injecté
// (testée sans disque). Aucun message d'erreur ne contient de valeur : seulement des noms de variables.
//
// Secrets : chaque secret `X` est lu depuis le fichier désigné par `X_FILE` (secret Docker monté en
// lecture seule), jamais depuis l'environnement en production (visible par `docker inspect` et dans
// /proc). La forme directe `X` n'est admise qu'en développement et en test.
import { posix } from 'node:path';
import { stripFinalNewline, type SecretFileReader } from '@amg/api-db';
import { ENV_KEYS, envSchema, type ApiEnv } from './env.schema.js';
import { SecretValue } from './secret-value.js';

export type { SecretFileReader } from '@amg/api-db';

export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface SecretSpec {
  /** Nom de la variable, en majuscules (`SESSION_PEPPER` → lu depuis `SESSION_PEPPER_FILE`). */
  readonly name: string;
  readonly minLength: number;
  readonly maxLength: number;
}

export type Secrets<S extends readonly SecretSpec[]> = Readonly<
  Record<S[number]['name'], SecretValue>
>;

export interface ApiConfig<S extends readonly SecretSpec[]> {
  readonly env: ApiEnv;
  readonly secrets: Secrets<S>;
}

export type LoadEnvResult<S extends readonly SecretSpec[]> =
  | { readonly ok: true; readonly config: ApiConfig<S> }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Modes où un secret peut être passé directement dans l'environnement (jamais en production). */
const DIRECT_SECRET_NODE_ENVS: readonly string[] = ['development', 'test'];

const CONTROL_CHARACTER = /\p{Cc}/u;

function readSecret(
  spec: SecretSpec,
  source: EnvSource,
  readFile: SecretFileReader,
): { value: SecretValue } | { error: string } {
  const fileVariable = `${spec.name}_FILE`;
  const direct = source[spec.name];
  const filePath = source[fileVariable];

  if (direct !== undefined && filePath !== undefined) {
    return { error: `${spec.name} : ${spec.name} et ${fileVariable} définis ensemble` };
  }
  let raw: string;
  if (filePath !== undefined) {
    if (!posix.isAbsolute(filePath)) {
      return { error: `${fileVariable} : chemin absolu attendu` };
    }
    try {
      raw = stripFinalNewline(readFile(filePath));
    } catch {
      return { error: `${fileVariable} : fichier illisible` };
    }
  } else if (direct !== undefined) {
    if (!DIRECT_SECRET_NODE_ENVS.includes(source['NODE_ENV'] ?? '')) {
      return {
        error: `${spec.name} : interdit hors développement et test, utiliser ${fileVariable}`,
      };
    }
    raw = direct;
  } else {
    return { error: `${spec.name} : manquant (${fileVariable} attendu)` };
  }

  if (raw.length < spec.minLength || raw.length > spec.maxLength) {
    return {
      error: `${spec.name} : longueur hors bornes (${String(spec.minLength)} à ${String(spec.maxLength)} caractères)`,
    };
  }
  if (CONTROL_CHARACTER.test(raw)) {
    return { error: `${spec.name} : caractère de contrôle interdit` };
  }
  return { value: new SecretValue(raw) };
}

/**
 * Valide l'environnement et charge les secrets déclarés. Renvoie toutes les erreurs d'un coup
 * (le démarrage échoue avec la liste complète, sans aucune valeur).
 */
export function loadEnv<const S extends readonly SecretSpec[]>(
  source: EnvSource,
  readFile: SecretFileReader,
  secretSpecs: S,
): LoadEnvResult<S> {
  const errors: string[] = [];

  const picked: Record<string, string> = {};
  for (const key of ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  }
  const parsed = envSchema.safeParse(picked);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = issue.path.map(String).join('.') || '(environnement)';
      // Seuls nos messages (custom) sont repris : ceux de Zod pourraient évoluer et citer la valeur.
      const detail =
        issue.code === 'custom' ? issue.message : `absente ou invalide (${issue.code})`;
      errors.push(`${name} : ${detail}`);
    }
  }

  const secrets: Record<string, SecretValue> = {};
  const seen = new Set<string>();
  for (const spec of secretSpecs) {
    if (seen.has(spec.name)) {
      errors.push(`${spec.name} : secret déclaré deux fois`);
      continue;
    }
    seen.add(spec.name);
    const result = readSecret(spec, source, readFile);
    if ('error' in result) errors.push(result.error);
    else secrets[spec.name] = result.value;
  }

  if (!parsed.success || errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: Object.freeze({
      env: Object.freeze(parsed.data),
      secrets: Object.freeze(secrets) as Secrets<S>,
    }),
  };
}
