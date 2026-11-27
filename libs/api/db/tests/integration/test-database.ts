// Accès à la base des tests d'intégration (job CI « API (intégration) », ou compose.dev.yaml en
// local). Variables exigées : DB_HOST, DB_PORT, DB_NAME, TEST_DB_APP_PASSWORD,
// TEST_DB_MIGRATOR_PASSWORD (mots de passe publics de sql/dev/passwords.sql) et
// TEST_DB_SUPERUSER_PASSWORD (superutilisateur `amg` de la base jetable : ci.yml ou compose.dev.yaml,
// pour les seuls tests qui éprouvent ce que lui seul peut faire). Absentes : échec immédiat et
// explicite, jamais une suite qui passe à vide.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { expect } from 'vitest';
import { z } from 'zod';
import { databaseEnvShape } from '../../src/database-config.js';

export const APP_ROLE = 'amg_app';
export const MIGRATOR_ROLE = 'amg_migrator';
export const SUPERUSER_ROLE = 'amg';
export type Role = typeof APP_ROLE | typeof MIGRATOR_ROLE | typeof SUPERUSER_ROLE;

const testEnvSchema = z.strictObject({
  DB_HOST: databaseEnvShape.DB_HOST,
  DB_PORT: databaseEnvShape.DB_PORT,
  DB_NAME: databaseEnvShape.DB_NAME,
  TEST_DB_APP_PASSWORD: z.string().min(1),
  TEST_DB_MIGRATOR_PASSWORD: z.string().min(1),
  TEST_DB_SUPERUSER_PASSWORD: z.string().min(1),
});

export type TestDatabaseEnv = z.output<typeof testEnvSchema>;

export function testDatabaseEnv(): TestDatabaseEnv {
  const picked: Record<string, string> = {};
  for (const key of Object.keys(testEnvSchema.shape)) {
    const value = process.env[key];
    if (value !== undefined) picked[key] = value;
  }
  const parsed = testEnvSchema.safeParse(picked);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Tests d'intégration : base de test non fournie (${names})`);
  }
  return parsed.data;
}

/** Mot de passe de test d'un rôle. */
export function testPassword(role: Role): string {
  const env = testDatabaseEnv();
  switch (role) {
    case APP_ROLE:
      return env.TEST_DB_APP_PASSWORD;
    case MIGRATOR_ROLE:
      return env.TEST_DB_MIGRATOR_PASSWORD;
    case SUPERUSER_ROLE:
      return env.TEST_DB_SUPERUSER_PASSWORD;
  }
}

/** Réglages facultatifs d'une connexion de test. */
export interface ConnectionSettings {
  /** Autre base que celle des tests. */
  readonly database?: string;
  /**
   * Chemin de recherche imposé à l'ouverture de la session (`-c search_path=…`, prioritaire sur
   * `ALTER ROLE … SET`) : un seul schéma, sans espace.
   */
  readonly searchPath?: 'public';
}

/** Connexion directe (pg) sous un rôle donné. */
export async function connectAs(role: Role, settings: ConnectionSettings = {}): Promise<pg.Client> {
  const env = testDatabaseEnv();
  const client = new pg.Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: settings.database ?? env.DB_NAME,
    user: role,
    password: testPassword(role),
    connectionTimeoutMillis: 5_000,
    ...(settings.searchPath === undefined
      ? {}
      : { options: `-c search_path=${settings.searchPath}` }),
  });
  await client.connect();
  return client;
}

/** Contenu exact de pg_db_role_setting pour les deux rôles après roles.sql (ordre : rôle). */
export const EXPECTED_ROLE_SETTINGS = [
  {
    role: 'amg_app',
    per_database: false,
    config: [
      'search_path=pg_catalog, pg_temp',
      'statement_timeout=15s',
      'lock_timeout=5s',
      'idle_in_transaction_session_timeout=15s',
    ],
  },
  {
    role: 'amg_migrator',
    per_database: false,
    config: [
      'lock_timeout=5s',
      'statement_timeout=5min',
      'idle_in_transaction_session_timeout=1min',
    ],
  },
] as const;

/** Exécute `run` dans une transaction toujours annulée : aucun test ne laisse de données. */
export async function inRolledBackTransaction(
  client: pg.Client,
  run: () => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');
  try {
    await run();
  } finally {
    await client.query('ROLLBACK');
  }
}

/** Code SQLSTATE d'une erreur PostgreSQL, ou `undefined`. */
function sqlState(error: unknown): string | undefined {
  return error instanceof pg.DatabaseError ? error.code : undefined;
}

/**
 * Vérifie qu'une requête échoue avec le code SQLSTATE attendu, dans un point de sauvegarde : la
 * transaction englobante reste utilisable pour la suite du test.
 */
export async function expectSqlError(
  client: pg.Client,
  sql: string,
  params: readonly unknown[],
  expectedCode: string,
  expectedMessage?: RegExp,
): Promise<void> {
  await client.query('SAVEPOINT expect_sql_error');
  let caught: unknown;
  try {
    await client.query(sql, [...params]);
  } catch (error: unknown) {
    caught = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT expect_sql_error');
  expect(caught, `la requête aurait dû échouer : ${sql}`).toBeInstanceOf(pg.DatabaseError);
  expect(sqlState(caught)).toBe(expectedCode);
  if (expectedMessage !== undefined && caught instanceof Error) {
    expect(caught.message).toMatch(expectedMessage);
  }
}

/** Codes SQLSTATE utilisés par les tests. */
export const SQLSTATE = Object.freeze({
  insufficientPrivilege: '42501',
  uniqueViolation: '23505',
  checkViolation: '23514',
  foreignKeyViolation: '23503',
  stringTooLong: '22001',
  raiseException: 'P0001',
  undefinedTable: '42P01',
});

export function uniqueEmail(): string {
  return `test-${randomBytes(8).toString('hex')}@exemple.test`;
}

/** Empreinte factice de 32 octets (SHA-256 ou HMAC-SHA-256). */
export function digest32(): Buffer {
  return randomBytes(32);
}

/** Crée un compte client invité et renvoie son identifiant. */
export async function insertUser(
  client: pg.Client,
  values: { readonly email?: string; readonly role?: 'ADMIN' | 'CLIENT' } = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO public.users (email, role, display_name, updated_at)
     VALUES ($1, $2, 'Client de test', now()) RETURNING id`,
    [values.email ?? uniqueEmail(), values.role ?? 'CLIENT'],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('insertion du compte de test impossible');
  return row.id;
}
