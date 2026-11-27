// Moindre privilège (ADR-0023) : attributs des rôles, droits exacts des rôles de l'API et du journal
// table par table et colonne par colonne, aucune fonction exécutable sans droit déclaré, et refus
// de tout DDL.
// Une nouvelle table sans droits déclarés, ou avec des droits en trop, fait échouer
// `EXPECTED_APP_PRIVILEGES` ; une fonction exécutable par l'API sans être déclarée fait échouer
// `EXPECTED_APP_FUNCTIONS`.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  EXPECTED_ROLE_SETTINGS,
  JOURNAL_ROLE,
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
  security_events: ['SELECT'],
  totp_factors: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  users: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
};

/** Droits attendus du rôle du journal : `security_events` seulement (lot 3). */
const EXPECTED_JOURNAL_PRIVILEGES: Readonly<Record<string, readonly string[]>> = {
  _prisma_migrations: [],
  activation_tokens: [],
  enrollment_codes: [],
  recovery_codes: [],
  security_events: ['INSERT', 'SELECT'],
  totp_factors: [],
  users: [],
};

/** Droits d'un rôle sur chaque relation du schéma public (catalogues seulement). */
const RELATION_PRIVILEGES_SQL = `SELECT c.relname,
       coalesce(array_agg(p.privilege ORDER BY p.privilege)
         FILTER (WHERE pg_catalog.has_table_privilege($1::name, c.oid, p.privilege)), '{}') AS privileges
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) AS p(privilege)
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
 GROUP BY c.relname ORDER BY c.relname`;

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
let journal: pg.Client;
let migrator: pg.Client;

beforeAll(async () => {
  app = await connectAs(APP_ROLE);
  journal = await connectAs(JOURNAL_ROLE);
  migrator = await connectAs(MIGRATOR_ROLE);
});

afterAll(async () => {
  await app.end();
  await journal.end();
  await migrator.end();
});

describe('attributs des rôles', () => {
  // rolcanlogin : amg_migrator est créé NOLOGIN par roles.sql ; sql/dev/passwords.sql (développement
  // et CI) ouvre la connexion comme le ferait une fenêtre de migration.
  it.each([APP_ROLE, JOURNAL_ROLE, MIGRATOR_ROLE])(
    '%s ne dispose d’aucun privilège système',
    async (role) => {
      const client = role === APP_ROLE ? app : role === JOURNAL_ROLE ? journal : migrator;
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
    },
  );

  it('les rôles de l’API et du journal ne sont membres d’aucun autre rôle', async () => {
    const { rows } = await app.query(
      `SELECT 1 FROM pg_catalog.pg_auth_members
        WHERE member IN ('amg_app'::regrole, 'amg_journal'::regrole)`,
    );
    expect(rows).toEqual([]);
  });

  it('applique les délais côté serveur au rôle du journal', async () => {
    const { rows } = await journal.query<{ name: string; setting: string }>(
      `SELECT name, setting FROM pg_catalog.pg_settings
        WHERE name IN ('statement_timeout', 'lock_timeout', 'idle_in_transaction_session_timeout', 'search_path')
        ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'idle_in_transaction_session_timeout', setting: '15000' },
      { name: 'lock_timeout', setting: '5000' },
      { name: 'search_path', setting: 'pg_catalog, pg_temp' },
      { name: 'statement_timeout', setting: '5000' },
    ]);
  });

  it('limite les connexions de chaque rôle', async () => {
    const { rows } = await app.query<{ rolname: string; rolconnlimit: number }>(
      `SELECT rolname, rolconnlimit FROM pg_catalog.pg_roles
        WHERE rolname IN ('amg_app', 'amg_journal', 'amg_migrator') ORDER BY rolname`,
    );
    expect(rows).toEqual([
      { rolname: 'amg_app', rolconnlimit: 20 },
      { rolname: 'amg_journal', rolconnlimit: 8 },
      { rolname: 'amg_migrator', rolconnlimit: 3 },
    ]);
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
        WHERE name IN ('statement_timeout', 'lock_timeout', 'idle_in_transaction_session_timeout')
        ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'idle_in_transaction_session_timeout', setting: '60000' },
      { name: 'lock_timeout', setting: '5000' },
      { name: 'statement_timeout', setting: '300000' },
    ]);
  });

  it('une transaction abandonnée du rôle des migrations est fermée par le serveur', async () => {
    // Délai raccourci pour cette seule session : le mécanisme est celui du réglage d'une minute.
    const client = await connectAs(MIGRATOR_ROLE);
    const closed = new Promise<void>((resolve) => {
      client.on('error', () => {
        resolve();
      });
      client.on('end', () => {
        resolve();
      });
    });
    try {
      await client.query(`SET idle_in_transaction_session_timeout = '200ms'`);
      await client.query('BEGIN');
      await closed;
      await expect(client.query('SELECT 1')).rejects.toThrow();
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it('le superutilisateur n’a pas le schéma public dans son chemin par défaut', async () => {
    const { rows } = await migrator.query<{ config: string[] | null }>(
      `SELECT s.setconfig AS config FROM pg_catalog.pg_db_role_setting s
        WHERE s.setrole = 'amg'::regrole AND s.setdatabase = 0`,
    );
    expect(rows).toEqual([{ config: ['search_path=pg_catalog, pg_temp'] }]);
  });

  it('les rôles n’ont que leurs réglages par défaut, communs à toutes les bases', async () => {
    // roles.sql purge puis repose ces réglages : aucun `ALTER ROLE <soi> [IN DATABASE …] SET` ne
    // survit au rejeu (tests/integration/roles-replay.test.ts).
    const { rows } = await app.query<{ role: string; per_database: boolean; config: string[] }>(
      `SELECT r.rolname AS role, s.setdatabase <> 0 AS per_database, s.setconfig AS config
         FROM pg_catalog.pg_db_role_setting s JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
        WHERE r.rolname IN ('amg_app', 'amg_journal', 'amg_migrator') ORDER BY 1, 2`,
    );
    expect(rows).toEqual(EXPECTED_ROLE_SETTINGS);
  });

  it('le schéma amg_guard est en lecture seule pour le rôle des migrations, fermé à l’API', async () => {
    const { rows } = await app.query<Record<string, boolean>>(
      `SELECT pg_catalog.has_schema_privilege('amg_migrator', 'amg_guard', 'USAGE') AS migrator_usage,
              pg_catalog.has_schema_privilege('amg_migrator', 'amg_guard', 'CREATE') AS migrator_create,
              pg_catalog.has_schema_privilege('amg_app', 'amg_guard', 'USAGE') AS app_usage,
              pg_catalog.has_schema_privilege('amg_journal', 'amg_guard', 'USAGE') AS journal_usage`,
    );
    expect(rows).toEqual([
      { migrator_usage: true, migrator_create: false, app_usage: false, journal_usage: false },
    ]);
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

  it.each([
    [APP_ROLE, EXPECTED_APP_PRIVILEGES],
    [JOURNAL_ROLE, EXPECTED_JOURNAL_PRIVILEGES],
  ] as const)('%s a exactement les droits déclarés, table par table', async (role, expected) => {
    const { rows } = await app.query<{ relname: string; privileges: string[] }>(
      RELATION_PRIVILEGES_SQL,
      [role],
    );
    expect(Object.fromEntries(rows.map((row) => [row.relname, row.privileges]))).toEqual(expected);
  });

  it('le rôle du journal n’a aucun droit de colonne ni aucune fonction exécutable', async () => {
    const { rows } = await journal.query<{ columns: number; functions: number }>(
      `SELECT (SELECT count(*)::int FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                 JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
                WHERE n.nspname = 'public' AND c.relname <> 'security_events'
                  AND pg_catalog.has_column_privilege('amg_journal', c.oid, a.attnum, 'SELECT, INSERT, UPDATE, REFERENCES')) AS columns,
              (SELECT count(*)::int FROM pg_catalog.pg_proc p
                 JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                  AND pg_catalog.has_function_privilege('amg_journal', p.oid, 'EXECUTE')) AS functions`,
    );
    expect(rows).toEqual([{ columns: 0, functions: 0 }]);
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

  it('aucune conversion, aucun opérateur ni aucune fonction sur les types du journal', async () => {
    // Types du journal : security_event_type, le type ligne de security_events et leurs tableaux.
    // Une conversion s'appliquerait à toutes les sessions ; un opérateur ou une fonction de public
    // l'emporterait sur pg_catalog dans les sessions de l'API (roles.sql, contrôle du journal). Même
    // chose pour un opérateur ou une fonction polymorphe d'un rôle non superutilisateur.
    const { rows } = await app.query<Record<string, number>>(
      `WITH journal AS (
         SELECT ARRAY[et.oid, et.typarray, rt.oid, rt.typarray] AS types
           FROM pg_catalog.pg_type et, pg_catalog.pg_class c
           JOIN pg_catalog.pg_type rt ON rt.oid = c.reltype
          WHERE et.oid = 'public.security_event_type'::pg_catalog.regtype
            AND c.oid = 'public.security_events'::pg_catalog.regclass),
       polymorphic AS (
         SELECT array_agg(t.oid) AS types FROM pg_catalog.pg_type t
          WHERE t.typtype = 'p' AND t.typname IN ('any', 'anyelement', 'anyarray', 'anynonarray',
                'anyenum', 'anyrange', 'anymultirange', 'anycompatible', 'anycompatiblearray',
                'anycompatiblenonarray', 'anycompatiblerange', 'anycompatiblemultirange', 'record',
                '_record', 'unknown'))
       SELECT (SELECT count(*)::int FROM pg_catalog.pg_cast k
                WHERE k.castsource = ANY (j.types) OR k.casttarget = ANY (j.types)) AS casts,
              (SELECT count(*)::int FROM pg_catalog.pg_operator o
                WHERE o.oprleft = ANY (j.types) OR o.oprright = ANY (j.types)
                   OR o.oprresult = ANY (j.types)) AS operators,
              (SELECT count(*)::int FROM pg_catalog.pg_proc p
                WHERE p.prorettype = ANY (j.types) OR p.proargtypes::oid[] && j.types
                   OR coalesce(p.proallargtypes, '{}') && j.types) AS functions,
              (SELECT count(*)::int FROM pg_catalog.pg_type t WHERE t.typbasetype = ANY (j.types)) AS domains,
              (SELECT count(*)::int FROM pg_catalog.pg_operator o
                 JOIN pg_catalog.pg_roles r ON r.oid = o.oprowner
                WHERE NOT r.rolsuper
                  AND (o.oprleft = ANY (y.types) OR o.oprright = ANY (y.types))) AS polymorphic_operators,
              (SELECT count(*)::int FROM pg_catalog.pg_proc p
                 JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
                WHERE NOT r.rolsuper AND p.proargtypes::oid[] && y.types) AS polymorphic_functions
         FROM journal j, polymorphic y`,
    );
    expect(rows).toEqual([
      {
        casts: 0,
        operators: 0,
        functions: 0,
        domains: 0,
        polymorphic_operators: 0,
        polymorphic_functions: 0,
      },
    ]);
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

  it('la fonction du déclencheur du journal appartient au superutilisateur, hors du schéma public', async () => {
    // Requête du rôle des migrations : seul à avoir l'usage du schéma amg_guard.
    const { rows } = await migrator.query<{
      superuser_owner: boolean;
      security_definer: boolean;
      config: string[] | null;
      app_execute: boolean;
      migrator_execute: boolean;
      in_public: boolean;
    }>(
      `SELECT r.rolsuper AS superuser_owner, p.prosecdef AS security_definer, p.proconfig AS config,
              pg_catalog.has_function_privilege('amg_app', p.oid, 'EXECUTE') AS app_execute,
              pg_catalog.has_function_privilege('amg_migrator', p.oid, 'EXECUTE') AS migrator_execute,
              pg_catalog.to_regprocedure('public.security_events_append_only()') IS NOT NULL AS in_public
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
        WHERE p.oid = 'amg_guard.security_events_append_only()'::regprocedure`,
    );
    expect(rows).toEqual([
      {
        superuser_owner: true,
        security_definer: false,
        config: ['search_path=pg_catalog, pg_temp'],
        app_execute: false,
        migrator_execute: true,
        in_public: false,
      },
    ]);
  });

  it.each(['amg_guard.journal_sealed', 'amg_guard.journal_writer_split'])(
    'le marqueur %s est en lecture seule pour le rôle des migrations',
    async (marker) => {
      const { rows } = await migrator.query<Record<string, boolean>>(
        `SELECT pg_catalog.has_table_privilege('amg_migrator', $1, 'SELECT') AS migrator_select,
                pg_catalog.has_table_privilege('amg_migrator', $1, 'INSERT, UPDATE, DELETE, TRUNCATE') AS migrator_write,
                pg_catalog.has_table_privilege('amg_app', $1, 'SELECT') AS app_select,
                pg_catalog.has_table_privilege('amg_journal', $1, 'SELECT') AS journal_select`,
        [marker],
      );
      expect(rows).toEqual([
        { migrator_select: true, migrator_write: false, app_select: false, journal_select: false },
      ]);
    },
  );
});

describe('le rôle du journal ne fait rien d’autre qu’écrire et lire le journal', () => {
  it.each([
    ['lire les comptes', 'SELECT id FROM public.users LIMIT 1'],
    ['créer une table', 'CREATE TABLE public.intrusion (id int)'],
    ['créer une table temporaire', 'CREATE TEMP TABLE intrusion (id int)'],
    ['modifier un événement', `UPDATE public.security_events SET device = 'falsifié'`],
    ['supprimer un événement', 'DELETE FROM public.security_events'],
    ['vider le journal', 'TRUNCATE public.security_events'],
    ['lire l’historique des migrations', 'SELECT * FROM public._prisma_migrations'],
  ])('refuse de %s', async (_label, sql) => {
    await inRolledBackTransaction(journal, async () => {
      await expectSqlError(journal, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each(['postgres', 'template1'])(
    'ne peut pas se connecter à la base « %s » de l’image',
    async (database) => {
      await expect(connectAs(JOURNAL_ROLE, { database })).rejects.toMatchObject({
        code: SQLSTATE.insufficientPrivilege,
      });
    },
  );
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
    ['modifier une table', 'ALTER TABLE public.users ADD COLUMN intrusion int'],
    [
      'désactiver le déclencheur du journal',
      'ALTER TABLE public.security_events DISABLE TRIGGER ALL',
    ],
    ['supprimer une table', 'DROP TABLE public.recovery_codes'],
    ['vider une table', 'TRUNCATE public.users'],
    ['lire l’historique des migrations', 'SELECT * FROM public._prisma_migrations'],
    ['écrire l’historique des migrations', 'DELETE FROM public._prisma_migrations'],
    [
      'écrire dans le journal (réservé au rôle du journal)',
      `INSERT INTO public.security_events (type) VALUES ('LOGIN_FAILED')`,
    ],
  ])('refuse de %s', async (_label, sql) => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(app, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each(['postgres', 'template1'])(
    'ne peut pas se connecter à la base « %s » de l’image',
    async (database) => {
      await expect(connectAs(APP_ROLE, { database })).rejects.toMatchObject({
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
      await expect(connectAs(MIGRATOR_ROLE, { database })).rejects.toMatchObject({
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
