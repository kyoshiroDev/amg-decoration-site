// Client Prisma réel (driver adapter pg) sous le rôle de l'API : lecture, écriture, identifiants
// UUID v7 générés par la base, journal non modifiable, fermeture du pool ; refus de servir sous un
// rôle trop privilégié (propriétaire des tables, superutilisateur, attribut système, membre d'un
// autre rôle).
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  API_CONNECTION_OPTIONS,
  API_SEARCH_PATH,
  DatabaseRoleError,
  assertLeastPrivilegedSession,
  createPrismaClient,
} from '../../src/prisma-client.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  APP_ROLE,
  MIGRATOR_ROLE,
  SUPERUSER_ROLE,
  connectAs,
  testDatabaseEnv,
  testPassword,
  uniqueEmail,
  type Role,
} from './test-database.js';

let prisma: PrismaClient;
const poolErrors: Error[] = [];

beforeAll(() => {
  const env = testDatabaseEnv();
  prisma = createPrismaClient({
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: APP_ROLE,
      password: { reveal: () => env.TEST_DB_APP_PASSWORD },
    },
    maxConnections: 2,
    applicationName: 'amg-api-db-tests',
    onPoolError: (error) => poolErrors.push(error),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  expect(poolErrors).toEqual([]);
});

const uuidV7 = z.uuidv7();

describe('client Prisma', () => {
  it('crée, relit et supprime un compte, identifiant UUID v7 généré par la base', async () => {
    const email = uniqueEmail();
    const created = await prisma.user.create({
      data: { email, role: 'CLIENT', displayName: 'Cliente de test' },
    });
    try {
      expect(uuidV7.safeParse(created.id).success).toBe(true);
      expect(created.status).toBe('INVITED');
      expect(created.passwordHash).toBeNull();
      const found = await prisma.user.findUnique({ where: { email } });
      expect(found?.id).toBe(created.id);
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it('enregistre un lien d’activation avec son empreinte binaire', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), role: 'CLIENT', displayName: 'Cliente de test' },
    });
    try {
      const tokenHash = randomBytes(32);
      await prisma.activationToken.create({
        data: {
          userId: user.id,
          purpose: 'INVITATION',
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        },
      });
      const token = await prisma.activationToken.findUnique({ where: { tokenHash } });
      expect(token && Buffer.from(token.tokenHash).equals(tokenHash)).toBe(true);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('écrit dans le journal mais ne peut ni le modifier ni le supprimer', async () => {
    const event = await prisma.securityEvent.create({
      data: { type: 'LOGIN_FAILED', ip: '198.51.100.4', details: { reason: 'test' } },
    });
    expect(uuidV7.safeParse(event.id).success).toBe(true);
    await expect(
      prisma.securityEvent.update({ where: { id: event.id }, data: { type: 'LOGIN_SUCCEEDED' } }),
    ).rejects.toThrow();
    await expect(prisma.securityEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    const unchanged = await prisma.securityEvent.findUnique({ where: { id: event.id } });
    expect(unchanged?.type).toBe('LOGIN_FAILED');
  });
});

describe('chemin de recherche des sessions de l’API', () => {
  it('les requêtes Prisma s’exécutent sous le chemin épinglé, sans public', async () => {
    const rows = await prisma.$queryRaw<{ path: string }[]>`
      SELECT pg_catalog.current_setting('search_path') AS path`;
    expect(rows).toEqual([{ path: API_SEARCH_PATH }]);
  });

  it('le paramètre de connexion l’impose même à un rôle dont le défaut contient public', async () => {
    // amg_migrator garde `"$user", public` par défaut : seul le paramètre `options` change son chemin.
    const env = testDatabaseEnv();
    const client = new pg.Client({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: MIGRATOR_ROLE,
      password: testPassword(MIGRATOR_ROLE),
      options: API_CONNECTION_OPTIONS,
    });
    await client.connect();
    try {
      const { rows } = await client.query<{ path: string }>(
        `SELECT pg_catalog.current_setting('search_path') AS path`,
      );
      expect(rows).toEqual([{ path: API_SEARCH_PATH }]);
    } finally {
      await client.end();
    }
  });

  it('une session sous un autre chemin est refusée', async () => {
    const client = await connectAs(APP_ROLE, { searchPath: 'public' });
    try {
      const error: unknown = await assertLeastPrivilegedSession(client).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DatabaseRoleError);
      expect(error instanceof DatabaseRoleError ? error.reasons : []).toEqual([
        'chemin de recherche',
      ]);
    } finally {
      await client.end();
    }
  });
});

describe('contrôle du rôle à chaque nouvelle connexion', () => {
  it('accepte le rôle de l’API', async () => {
    const client = await connectAs(APP_ROLE);
    try {
      await expect(assertLeastPrivilegedSession(client)).resolves.toBeUndefined();
    } finally {
      await client.end();
    }
  });

  it.each([
    [MIGRATOR_ROLE, 'propriétaire des tables'],
    [SUPERUSER_ROLE, 'superutilisateur'],
  ] as const)('refuse %s (%s)', async (role, reason) => {
    const client = await connectAs(role);
    try {
      const error: unknown = await assertLeastPrivilegedSession(client).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DatabaseRoleError);
      expect(error instanceof DatabaseRoleError ? error.reasons : []).toContain(reason);
    } finally {
      await client.end();
    }
  });

  it.each([
    [
      'membre de pg_read_all_data',
      'GRANT pg_read_all_data TO amg_probe_role',
      'membre d’un autre rôle',
    ],
    [
      'membre de pg_execute_server_program',
      'GRANT pg_execute_server_program TO amg_probe_role',
      'membre d’un autre rôle',
    ],
    [
      'membre de pg_write_server_files',
      'GRANT pg_write_server_files TO amg_probe_role',
      'membre d’un autre rôle',
    ],
    ['membre du rôle de l’API', 'GRANT amg_app TO amg_probe_role', 'membre d’un autre rôle'],
    ['CREATEROLE', 'ALTER ROLE amg_probe_role CREATEROLE', 'création de rôles'],
    ['CREATEDB', 'ALTER ROLE amg_probe_role CREATEDB', 'création de bases'],
    ['REPLICATION', 'ALTER ROLE amg_probe_role REPLICATION', 'réplication'],
  ] as const)('refuse un rôle %s', async (_label, sql, reason) => {
    // Rôle jetable, créé et pris (SET LOCAL ROLE) dans une transaction annulée du superutilisateur :
    // le contrôle lit les attributs de current_user.
    const client = await connectAs(SUPERUSER_ROLE);
    try {
      await client.query('BEGIN');
      await client.query('CREATE ROLE amg_probe_role NOLOGIN NOINHERIT');
      await client.query(sql);
      await client.query('SET LOCAL ROLE amg_probe_role');
      const error: unknown = await assertLeastPrivilegedSession(client).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DatabaseRoleError);
      expect(error instanceof DatabaseRoleError ? error.reasons : []).toEqual([reason]);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });

  it.each([MIGRATOR_ROLE, SUPERUSER_ROLE] as const)(
    'un client Prisma sous %s ne sert aucune donnée',
    async (role: Role) => {
      const env = testDatabaseEnv();
      const errors: Error[] = [];
      const privileged = createPrismaClient({
        connection: {
          host: env.DB_HOST,
          port: env.DB_PORT,
          database: env.DB_NAME,
          user: role,
          password: { reveal: () => testPassword(role) },
        },
        maxConnections: 1,
        applicationName: 'amg-api-db-tests',
        onPoolError: (error) => errors.push(error),
      });
      try {
        await expect(privileged.user.count()).rejects.toThrow();
        await expect(privileged.$queryRaw`SELECT 1`).rejects.toThrow();
      } finally {
        await privileged.$disconnect();
      }
    },
  );
});
