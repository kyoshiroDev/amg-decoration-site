// Paramètres de connexion à PostgreSQL (ADR-0023) : quatre variables non secrètes validées par Zod et
// un mot de passe lu depuis un fichier (`DB_PASSWORD_FILE`). Aucune URL contenant un mot de passe
// dans l'environnement : quand une URL est nécessaire (CLI Prisma, migrations), elle est construite
// ici, en mémoire, avec chaque composant encodé.
import { z } from 'zod';
import { stripFinalNewline, type SecretFileReader } from './secret-file.js';

/** Bornes du mot de passe d'un rôle PostgreSQL (généré par `openssl rand -base64 32` : 44 caractères). */
export const DB_PASSWORD_MIN_LENGTH = 32;
export const DB_PASSWORD_MAX_LENGTH = 256;

/** Port TCP en décimal strict (pas de `3e3`, `0x10`, espaces ni zéro initial). */
export const tcpPortSchema = z
  .string()
  .regex(/^[1-9]\d{0,4}$/, 'entier décimal attendu')
  .transform(Number)
  .pipe(z.number().int().max(65_535));

/** Nom de base ou de rôle : identifiant PostgreSQL non cité, en minuscules (63 octets au plus). */
const pgIdentifierSchema = z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/, 'identifiant attendu');

/** Variables non secrètes de connexion, partagées par l'API (`loadEnv`) et prisma.config.ts. */
export const databaseEnvShape = {
  /** Nom d'hôte (service Docker `postgres`) ou IPv4 ; ni schéma, ni port, ni identifiants. */
  DB_HOST: z.hostname(),
  DB_PORT: tcpPortSchema.default(5432),
  DB_NAME: pgIdentifierSchema,
  DB_USER: pgIdentifierSchema,
};

const databaseEnvSchema = z.strictObject(databaseEnvShape);

/** Mot de passe tenu hors de toute chaîne journalisable : il ne sort que par `reveal()`. */
export interface RevealableSecret {
  reveal(): string;
}

export interface DatabaseConnection {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: RevealableSecret;
}

/**
 * URL de connexion pour le CLI Prisma (migrations). Chaque composant est encodé par
 * `encodeURIComponent` (le `%` compris, que l'API URL laisserait passer) : un mot de passe contenant
 * `@`, `:`, `/` ou `%` ne peut ni changer d'hôte ni être mal décodé. À ne jamais journaliser.
 */
export function buildDatabaseUrl(connection: DatabaseConnection): string {
  const user = encodeURIComponent(connection.user);
  const password = encodeURIComponent(connection.password.reveal());
  const database = encodeURIComponent(connection.database);
  return `postgresql://${user}:${password}@${connection.host}:${String(connection.port)}/${database}`;
}

/** Configuration de connexion invalide : les messages ne citent que des noms de variables. */
export class DatabaseConfigError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Configuration de la base invalide : ${errors.join(' ; ')}`);
    this.name = 'DatabaseConfigError';
    this.errors = errors;
  }
}

const CONTROL_CHARACTER = /\p{Cc}/u;

const DATABASE_VARIABLES = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD_FILE',
] as const;

class FileSecret implements RevealableSecret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return '[secret]';
  }

  toJSON(): string {
    return '[secret]';
  }
}

function readPasswordFile(
  source: Readonly<Record<string, string | undefined>>,
  readFile: SecretFileReader,
): RevealableSecret | string {
  if (source['DB_PASSWORD'] !== undefined) {
    return 'DB_PASSWORD : interdit ici, utiliser DB_PASSWORD_FILE';
  }
  const path = source['DB_PASSWORD_FILE'];
  if (path === undefined) return 'DB_PASSWORD_FILE : manquant';
  if (!path.startsWith('/')) return 'DB_PASSWORD_FILE : chemin absolu attendu';
  let raw: string;
  try {
    raw = stripFinalNewline(readFile(path));
  } catch {
    return 'DB_PASSWORD_FILE : fichier illisible';
  }
  if (raw.length < DB_PASSWORD_MIN_LENGTH || raw.length > DB_PASSWORD_MAX_LENGTH) {
    return `DB_PASSWORD : longueur hors bornes (${String(DB_PASSWORD_MIN_LENGTH)} à ${String(DB_PASSWORD_MAX_LENGTH)} caractères)`;
  }
  if (CONTROL_CHARACTER.test(raw)) return 'DB_PASSWORD : caractère de contrôle interdit';
  return new FileSecret(raw);
}

/**
 * Connexion du CLI Prisma (prisma.config.ts), toujours par fichier secret, y compris en
 * développement. Renvoie `undefined` si aucune variable de base n'est définie (`prisma generate`
 * n'a pas besoin de base) ; lève `DatabaseConfigError` si elles sont incomplètes ou invalides.
 */
export function loadCliDatabaseConnection(
  source: Readonly<Record<string, string | undefined>>,
  readFile: SecretFileReader,
): DatabaseConnection | undefined {
  if (DATABASE_VARIABLES.every((name) => source[name] === undefined)) return undefined;

  const errors: string[] = [];
  const picked: Record<string, string> = {};
  for (const name of Object.keys(databaseEnvShape)) {
    const value = source[name];
    if (value !== undefined) picked[name] = value;
  }
  const parsed = databaseEnvSchema.safeParse(picked);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.map(String).join('.')} : absente ou invalide (${issue.code})`);
    }
  }
  const password = readPasswordFile(source, readFile);
  if (typeof password === 'string') errors.push(password);

  if (!parsed.success || typeof password === 'string') throw new DatabaseConfigError(errors);
  return {
    host: parsed.data.DB_HOST,
    port: parsed.data.DB_PORT,
    database: parsed.data.DB_NAME,
    user: parsed.data.DB_USER,
    password,
  };
}
