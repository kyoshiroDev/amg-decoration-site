// Fabrique du client, sans base : aucune connexion n'est ouverte avant la première requête ; chaque
// nouvelle connexion passe par le contrôle des privilèges de la session.
import { describe, expect, it } from 'vitest';
import type { DatabaseConnection } from '../../src/database-config.js';
import {
  DatabaseRoleError,
  POOL_TIMEOUTS,
  SESSION_PRIVILEGES_SQL,
  assertLeastPrivilegedSession,
  buildPoolConfig,
  createPrismaClient,
  type CreatePrismaClientOptions,
  type SessionQueryable,
} from '../../src/prisma-client.js';

const PASSWORD = 'mot-de-passe-du-role-amg-app-0123456789';

const connection: DatabaseConnection = {
  host: '127.0.0.1',
  port: 1,
  database: 'amg',
  user: 'amg_app',
  password: { reveal: () => PASSWORD },
};

const options: CreatePrismaClientOptions = {
  connection,
  maxConnections: 5,
  applicationName: 'amg-api',
  onPoolError: () => undefined,
};

describe('buildPoolConfig', () => {
  it('configure le pool champ par champ, avec les délais côté serveur', () => {
    expect(buildPoolConfig(options)).toMatchObject({
      host: '127.0.0.1',
      port: 1,
      database: 'amg',
      user: 'amg_app',
      max: 5,
      application_name: 'amg-api',
      connectionTimeoutMillis: POOL_TIMEOUTS.connectionTimeoutMillis,
      idleTimeoutMillis: POOL_TIMEOUTS.idleTimeoutMillis,
      statement_timeout: POOL_TIMEOUTS.statementTimeoutMillis,
      lock_timeout: POOL_TIMEOUTS.lockTimeoutMillis,
      idle_in_transaction_session_timeout: POOL_TIMEOUTS.idleInTransactionTimeoutMillis,
    });
  });

  it('ne garde pas le mot de passe en clair dans la configuration', () => {
    const config = buildPoolConfig(options);
    expect(typeof config.password).toBe('function');
    expect(JSON.stringify(config)).not.toContain(PASSWORD);
    expect(config).not.toHaveProperty('connectionString');
  });

  it('contrôle chaque nouvelle connexion avant de la confier au client', async () => {
    const config = buildPoolConfig(options);
    const session = fakeSession([{ ...LEAST_PRIVILEGED, owns_objects: true }]);
    await expect(config.onConnect(session)).rejects.toThrow(DatabaseRoleError);
    expect(session.queries).toEqual([SESSION_PRIVILEGES_SQL]);
  });

  it('ne révèle le mot de passe qu’au moment de la connexion', () => {
    const config = buildPoolConfig(options);
    expect(typeof config.password === 'function' ? config.password() : undefined).toBe(PASSWORD);
  });
});

const LEAST_PRIVILEGED = {
  superuser: false,
  bypass_rls: false,
  create_role: false,
  create_db: false,
  replication: false,
  member_of_roles: false,
  owns_objects: false,
  can_create: false,
};

/** Double d'une connexion : renvoie les lignes données et retient les requêtes reçues. */
function fakeSession(rows: readonly unknown[]): SessionQueryable & { readonly queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    query: (text) => {
      queries.push(text);
      return Promise.resolve({ rows });
    },
  };
}

describe('assertLeastPrivilegedSession', () => {
  it('lit chaque attribut contrôlé dans la requête sur les catalogues', () => {
    for (const column of Object.keys(LEAST_PRIVILEGED)) {
      expect(SESSION_PRIVILEGES_SQL).toContain(` AS ${column}`);
    }
    expect(SESSION_PRIVILEGES_SQL).toContain('pg_catalog.pg_auth_members');
  });

  it('accepte un rôle sans privilège, après une seule requête sur les catalogues', async () => {
    const session = fakeSession([LEAST_PRIVILEGED]);
    await expect(assertLeastPrivilegedSession(session)).resolves.toBeUndefined();
    expect(session.queries).toEqual([SESSION_PRIVILEGES_SQL]);
  });

  it.each([
    [
      'un superutilisateur',
      { superuser: true, owns_objects: true, can_create: true },
      'superutilisateur',
    ],
    [
      'le propriétaire des tables',
      { owns_objects: true, can_create: true },
      'propriétaire des tables',
    ],
    ['un rôle qui crée dans public', { can_create: true }, 'création dans le schéma public'],
    ['un rôle qui contourne la RLS', { bypass_rls: true }, 'contournement de la RLS'],
    ['un rôle qui crée des rôles', { create_role: true }, 'création de rôles'],
    ['un rôle qui crée des bases', { create_db: true }, 'création de bases'],
    ['un rôle de réplication', { replication: true }, 'réplication'],
    [
      'un membre d’un autre rôle (pg_read_all_data…)',
      { member_of_roles: true },
      'membre d’un autre rôle',
    ],
  ])('refuse %s', async (_label, overrides, reason) => {
    const session = fakeSession([{ ...LEAST_PRIVILEGED, ...overrides }]);
    const error: unknown = await assertLeastPrivilegedSession(session).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseRoleError);
    expect(error instanceof DatabaseRoleError ? error.reasons : []).toContain(reason);
  });

  it.each([
    ['aucune ligne', []],
    ['deux lignes', [LEAST_PRIVILEGED, LEAST_PRIVILEGED]],
    ['un champ inattendu', [{ ...LEAST_PRIVILEGED, extra: true }]],
    ['un booléen absent', [{ ...LEAST_PRIVILEGED, member_of_roles: undefined }]],
    [
      'l’ancien format sans attributs système',
      [{ superuser: false, bypass_rls: false, owns_objects: false, can_create: false }],
    ],
    ['une valeur non booléenne', [{ ...LEAST_PRIVILEGED, superuser: 'f' }]],
  ])('refuse une réponse inattendue : %s', async (_label, rows) => {
    await expect(assertLeastPrivilegedSession(fakeSession(rows))).rejects.toThrow(
      DatabaseRoleError,
    );
  });

  it('ne cite ni hôte ni rôle dans son message', () => {
    const error = new DatabaseRoleError(['superutilisateur']);
    expect(error.message).not.toMatch(/amg|127\.0\.0\.1/);
  });
});

describe('createPrismaClient', () => {
  it('crée le client sans se connecter, puis se ferme proprement', async () => {
    const client = createPrismaClient(options);
    await expect(client.$disconnect()).resolves.toBeUndefined();
  });

  it.each([0, -1, 1.5, Number.NaN])('refuse maxConnections=%s', (maxConnections) => {
    expect(() => createPrismaClient({ ...options, maxConnections })).toThrow(RangeError);
  });
});
