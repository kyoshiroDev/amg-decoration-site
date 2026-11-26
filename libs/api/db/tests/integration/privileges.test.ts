// Moindre privilège (ADR-0023) : attributs des rôles, droits exacts du rôle de l'API table par
// table et colonne par colonne, aucune fonction exécutable sans droit déclaré, et refus de tout DDL.
// Une nouvelle table sans droits déclarés, ou avec des droits en trop, fait échouer
// `EXPECTED_APP_PRIVILEGES` ; une fonction exécutable par l'API sans être déclarée fait échouer
// `EXPECTED_APP_FUNCTIONS`.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  MIGRATOR_ROLE,
  SQLSTATE,
  connectAs,
  expectSqlError,
  inRolledBackTransaction,
} from './test-database.js';

/** Droits attendus du rôle de l'API sur chaque relation du schéma public (ordre alphabétique). */
const EXPECTED_APP_PRIVILEGES: Readonly<Record<string, readonly string[]>> = {
  _prisma_migrations: [],
  activation_tokens: ['DELETE', 'INSERT', 'SELECT'],
  enrollment_codes: ['DELETE', 'INSERT', 'SELECT'],
  recovery_codes: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  security_events: ['INSERT', 'SELECT'],
  totp_factors: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  users: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
};

/** UPDATE limité à des colonnes : `table.colonne` (ordre alphabétique). */
const EXPECTED_APP_COLUMN_UPDATES: readonly string[] = [
  'activation_tokens.consumed_at',
  'activation_tokens.revoked_at',
  'enrollment_codes.consumed_at',
  'enrollment_codes.revoked_at',
];

/** Fonctions du schéma public exécutables par le rôle de l'API (aucune à ce jour). */
const EXPECTED_APP_FUNCTIONS: readonly string[] = [];

let app: pg.Client;
let migrator: pg.Client;

beforeAll(async () => {
  app = await connectAs(APP_ROLE);
  migrator = await connectAs(MIGRATOR_ROLE);
});

afterAll(async () => {
  await app.end();
  await migrator.end();
});

describe('attributs des rôles', () => {
  // rolcanlogin : amg_migrator est créé NOLOGIN par roles.sql ; sql/dev/passwords.sql (développement
  // et CI) ouvre la connexion comme le ferait une fenêtre de migration.
  it.each([APP_ROLE, MIGRATOR_ROLE])('%s ne dispose d’aucun privilège système', async (role) => {
    const client = role === APP_ROLE ? app : migrator;
    const { rows } = await client.query<Record<string, boolean>>(
      `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolinherit, rolcanlogin
         FROM pg_catalog.pg_roles WHERE rolname = current_user`,
    );
    expect(rows).toEqual([
      {
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolreplication: false,
        rolbypassrls: false,
        rolinherit: false,
        rolcanlogin: true,
      },
    ]);
  });

  it('le rôle de l’API n’est membre d’aucun autre rôle', async () => {
    const { rows } = await app.query(
      `SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = 'amg_app'::regrole`,
    );
    expect(rows).toEqual([]);
  });

  it('applique les délais côté serveur au rôle de l’API', async () => {
    const { rows } = await app.query<{ name: string; setting: string }>(
      `SELECT name, setting FROM pg_catalog.pg_settings
        WHERE name IN ('statement_timeout', 'lock_timeout', 'idle_in_transaction_session_timeout')
        ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'idle_in_transaction_session_timeout', setting: '15000' },
      { name: 'lock_timeout', setting: '5000' },
      { name: 'statement_timeout', setting: '15000' },
    ]);
  });

  it('applique les délais côté serveur au rôle des migrations', async () => {
    const { rows } = await migrator.query<{ name: string; setting: string }>(
      `SELECT name, setting FROM pg_catalog.pg_settings
        WHERE name IN ('statement_timeout', 'lock_timeout') ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'lock_timeout', setting: '5000' },
      { name: 'statement_timeout', setting: '300000' },
    ]);
  });

  it('le schéma amg_guard est en lecture seule pour le rôle des migrations, fermé à l’API', async () => {
    const { rows } = await app.query<Record<string, boolean>>(
      `SELECT pg_catalog.has_schema_privilege('amg_migrator', 'amg_guard', 'USAGE') AS migrator_usage,
              pg_catalog.has_schema_privilege('amg_migrator', 'amg_guard', 'CREATE') AS migrator_create,
              pg_catalog.has_schema_privilege('amg_app', 'amg_guard', 'USAGE') AS app_usage`,
    );
    expect(rows).toEqual([{ migrator_usage: true, migrator_create: false, app_usage: false }]);
  });
});

describe('propriété et droits sur les objets', () => {
  it('tous les objets du schéma public appartiennent au rôle des migrations', async () => {
    const { rows } = await migrator.query<{ relname: string; owner: string }>(
      `SELECT c.relname, pg_catalog.pg_get_userbyid(c.relowner) AS owner
         FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND pg_catalog.pg_get_userbyid(c.relowner) <> $1`,
      [MIGRATOR_ROLE],
    );
    expect(rows).toEqual([]);
  });

  it('le rôle de l’API a exactement les droits déclarés, table par table', async () => {
    const { rows } = await app.query<{ relname: string; privileges: string[] }>(
      `SELECT c.relname,
              coalesce(array_agg(p.privilege ORDER BY p.privilege)
                FILTER (WHERE pg_catalog.has_table_privilege('amg_app', c.oid, p.privilege)), '{}') AS privileges
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) AS p(privilege)
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        GROUP BY c.relname ORDER BY c.relname`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.relname, row.privileges]))).toEqual(
      EXPECTED_APP_PRIVILEGES,
    );
  });

  it('n’accorde l’UPDATE des liens et codes que sur les colonnes de fin de vie', async () => {
    const { rows } = await app.query<{ column: string }>(
      `SELECT c.relname || '.' || a.attname AS column
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND pg_catalog.has_column_privilege('amg_app', c.oid, a.attnum, 'UPDATE')
          AND NOT pg_catalog.has_table_privilege('amg_app', c.oid, 'UPDATE')
        ORDER BY 1`,
    );
    expect(rows.map((row) => row.column)).toEqual(EXPECTED_APP_COLUMN_UPDATES);
  });

  it('aucune fonction du schéma public n’est exécutable par l’API sans droit déclaré', async () => {
    const { rows } = await app.query<{ signature: string }>(
      `SELECT p.oid::regprocedure::text AS signature
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND pg_catalog.has_function_privilege('amg_app', p.oid, 'EXECUTE')
        ORDER BY 1`,
    );
    expect(rows.map((row) => row.signature)).toEqual(EXPECTED_APP_FUNCTIONS);
  });

  it('une fonction créée par le rôle des migrations n’est pas exécutable par PUBLIC', async () => {
    await inRolledBackTransaction(migrator, async () => {
      await migrator.query(
        'CREATE FUNCTION public.default_privileges_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$',
      );
      const { rows } = await migrator.query<{ app: boolean; acl: string | null }>(
        `SELECT pg_catalog.has_function_privilege('amg_app', 'public.default_privileges_probe()', 'EXECUTE') AS app,
                p.proacl::text AS acl
           FROM pg_catalog.pg_proc p WHERE p.oid = 'public.default_privileges_probe()'::regprocedure`,
      );
      expect(rows).toEqual([{ app: false, acl: '{amg_migrator=X/amg_migrator}' }]);
    });
  });

  it('aucun droit sur une colonne isolée ne contourne les droits de table', async () => {
    const { rows } = await app.query<{ update_journal: boolean; read_migrations: boolean }>(
      `SELECT pg_catalog.has_any_column_privilege('amg_app', 'public.security_events', 'UPDATE') AS update_journal,
              pg_catalog.has_any_column_privilege('amg_app', 'public._prisma_migrations', 'SELECT') AS read_migrations`,
    );
    expect(rows).toEqual([{ update_journal: false, read_migrations: false }]);
  });

  it('le rôle de l’API ne peut pas appeler la fonction du déclencheur', async () => {
    const { rows } = await app.query<{ allowed: boolean }>(
      `SELECT pg_catalog.has_function_privilege('amg_app', 'public.security_events_append_only()', 'EXECUTE') AS allowed`,
    );
    expect(rows).toEqual([{ allowed: false }]);
  });
});

describe('le rôle de l’API ne fait aucun DDL', () => {
  it.each([
    ['créer une table', 'CREATE TABLE public.intrusion (id int)'],
    ['créer une table temporaire', 'CREATE TEMP TABLE intrusion (id int)'],
    ['créer un schéma', 'CREATE SCHEMA intrusion'],
    [
      'créer une fonction',
      'CREATE FUNCTION public.intrusion() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$',
    ],
    ['modifier une table', 'ALTER TABLE users ADD COLUMN intrusion int'],
    ['désactiver le déclencheur du journal', 'ALTER TABLE security_events DISABLE TRIGGER ALL'],
    ['supprimer une table', 'DROP TABLE recovery_codes'],
    ['vider une table', 'TRUNCATE users'],
    ['lire l’historique des migrations', 'SELECT * FROM _prisma_migrations'],
    ['écrire l’historique des migrations', 'DELETE FROM _prisma_migrations'],
  ])('refuse de %s', async (_label, sql) => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(app, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each(['postgres', 'template1'])(
    'ne peut pas se connecter à la base « %s » de l’image',
    async (database) => {
      await expect(connectAs(APP_ROLE, database)).rejects.toMatchObject({
        code: SQLSTATE.insufficientPrivilege,
      });
    },
  );
});

describe('le rôle des migrations reste confiné à sa base', () => {
  it.each([
    ['créer un schéma', 'CREATE SCHEMA intrusion'],
    ['créer un rôle', 'CREATE ROLE intrusion'],
    ['se donner le rôle de l’API', 'GRANT amg_app TO amg_migrator'],
  ])('refuse de %s', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(migrator, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each(['postgres', 'template1'])(
    'ne peut pas se connecter à la base « %s » de l’image',
    async (database) => {
      await expect(connectAs(MIGRATOR_ROLE, database)).rejects.toMatchObject({
        code: SQLSTATE.insufficientPrivilege,
      });
    },
  );

  it('n’ouvre aucune table temporaire', async () => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(
        migrator,
        'CREATE TEMP TABLE intrusion (id int)',
        [],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });
});
