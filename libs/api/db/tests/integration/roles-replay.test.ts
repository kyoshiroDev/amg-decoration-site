// Rejeu de sql/roles.sql par le superutilisateur, base migrée (ADR-0023, EXPLOITATION.md §11) :
// `amg_migrator` peut créer dans `public` des fonctions et opérateurs mieux assortis que ceux de
// pg_catalog (`public.format(text, name)` est préférée à `format(text, VARIADIC "any")`). Exécutés
// par le superutilisateur, ils pourraient faire RESET ROLE et accorder SUPERUSER. roles.sql épingle
// le chemin de recherche de sa session et qualifie ses appels : le rejeu, lancé ici depuis une
// session dont le chemin contient `public` (pire cas), n'exécute aucun piège. Le superutilisateur
// reçoit en outre un chemin par défaut sans `public`.
import { readFileSync } from 'node:fs';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  EXPECTED_ROLE_SETTINGS,
  JOURNAL_ROLE,
  MIGRATOR_ROLE,
  SQLSTATE,
  SUPERUSER_ROLE,
  connectAs,
} from './test-database.js';

const ROLES_SQL = readFileSync(new URL('../../sql/roles.sql', import.meta.url), 'utf8');

/** Pièges d'amg_migrator : chaque fonction lève une erreur si elle est appelée. */
const TRAPS: readonly (readonly [create: string, drop: string])[] = [
  ['FUNCTION public.format(text, name) RETURNS text', 'FUNCTION public.format(text, name)'],
  ['FUNCTION public.format(text, text) RETURNS text', 'FUNCTION public.format(text, text)'],
  ['FUNCTION public.format(text, regclass) RETURNS text', 'FUNCTION public.format(text, regclass)'],
  ['FUNCTION public.current_database() RETURNS name', 'FUNCTION public.current_database()'],
  ['FUNCTION public.to_regclass(text) RETURNS regclass', 'FUNCTION public.to_regclass(text)'],
  [
    'FUNCTION public.to_regprocedure(text) RETURNS regprocedure',
    'FUNCTION public.to_regprocedure(text)',
  ],
  [
    'FUNCTION public.pg_terminate_backend(integer) RETURNS boolean',
    'FUNCTION public.pg_terminate_backend(integer)',
  ],
  [
    'FUNCTION public.trap_ne(name, text) RETURNS boolean',
    'FUNCTION public.trap_ne(name, text) CASCADE',
  ],
  [
    'FUNCTION public.trap_eq(name, text) RETURNS boolean',
    'FUNCTION public.trap_eq(name, text) CASCADE',
  ],
];

let migrator: pg.Client;

async function rolsuper(client: pg.Client): Promise<boolean | undefined> {
  const { rows } = await client.query<{ rolsuper: boolean }>(
    `SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = 'amg_migrator'`,
  );
  return rows[0]?.rolsuper;
}

beforeAll(async () => {
  migrator = await connectAs(MIGRATOR_ROLE);
  for (const [create] of TRAPS) {
    await migrator.query(
      `CREATE ${create} LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'piège exécuté'; END $$`,
    );
  }
  await migrator.query(
    'CREATE OPERATOR public.<> (LEFTARG = name, RIGHTARG = text, FUNCTION = public.trap_ne)',
  );
  await migrator.query(
    'CREATE OPERATOR public.= (LEFTARG = name, RIGHTARG = text, FUNCTION = public.trap_eq)',
  );
});

afterAll(async () => {
  for (const [, drop] of TRAPS) await migrator.query(`DROP ${drop}`);
  await migrator.end();
});

describe('rejeu de roles.sql face aux pièges du rôle des migrations', () => {
  it('le piège serait appelé par une session dont le chemin contient public', async () => {
    const exposed = await connectAs(SUPERUSER_ROLE, { searchPath: 'public' });
    try {
      await expect(exposed.query(`SELECT format('%I', current_database())`)).rejects.toThrow(
        /piège exécuté/,
      );
    } finally {
      await exposed.end();
    }
  });

  it('roles.sql réussit sans exécuter aucun piège et laisse amg_migrator sans SUPERUSER', async () => {
    const exposed = await connectAs(SUPERUSER_ROLE, { searchPath: 'public' });
    try {
      await exposed.query(ROLES_SQL);
      expect(await rolsuper(exposed)).toBe(false);
    } finally {
      await exposed.end();
    }
  });
});

describe('rejeu de roles.sql face aux réglages qu’un rôle se donne lui-même', () => {
  it('purge les réglages communs et propres à la base, puis repose les délais', async () => {
    const app = await connectAs(APP_ROLE);
    const journal = await connectAs(JOURNAL_ROLE);
    const superuser = await connectAs(SUPERUSER_ROLE);
    try {
      const { rows } = await app.query<{ database: string }>(
        'SELECT pg_catalog.current_database() AS database',
      );
      const database = `"${(rows[0]?.database ?? '').replaceAll('"', '""')}"`;
      // Chacun peut modifier ses propres réglages : plus aucun délai côté serveur.
      await migrator.query(
        `ALTER ROLE amg_migrator IN DATABASE ${database} SET idle_in_transaction_session_timeout = 0`,
      );
      await migrator.query('ALTER ROLE amg_migrator SET lock_timeout = 0');
      await app.query(`ALTER ROLE amg_app IN DATABASE ${database} SET statement_timeout = 0`);
      await app.query('ALTER ROLE amg_app RESET ALL');
      await journal.query(`ALTER ROLE amg_journal IN DATABASE ${database} SET lock_timeout = 0`);
      await journal.query('ALTER ROLE amg_journal SET statement_timeout = 0');
      await superuser.query(ROLES_SQL);
      const settings = await superuser.query<{
        role: string;
        per_database: boolean;
        config: string[];
      }>(
        `SELECT r.rolname AS role, s.setdatabase OPERATOR(pg_catalog.<>) 0 AS per_database,
                s.setconfig AS config
           FROM pg_catalog.pg_db_role_setting s JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
          WHERE r.rolname OPERATOR(pg_catalog.=) ANY (ARRAY['amg_app', 'amg_journal', 'amg_migrator']::name[])
          ORDER BY 1, 2`,
      );
      expect(settings.rows).toEqual(EXPECTED_ROLE_SETTINGS);
    } finally {
      await app.end();
      await journal.end();
      await superuser.end();
    }
  });
});

describe('sessions du superutilisateur', () => {
  let superuser: pg.Client;

  beforeAll(async () => {
    superuser = await connectAs(SUPERUSER_ROLE);
  });

  afterAll(async () => {
    await superuser.end();
  });

  it('ont par défaut un chemin de recherche sans public', async () => {
    const { rows } = await superuser.query<{ search_path: string }>('SHOW search_path');
    expect(rows).toEqual([{ search_path: 'pg_catalog, pg_temp' }]);
  });

  it('ferment une fenêtre de migration sans appeler la fonction homonyme de public', async () => {
    // PID factice : aucune session n'est interrompue ; seule compte la fonction résolue.
    const { rows } = await superuser.query<{ terminated: boolean }>(
      'SELECT pg_terminate_backend(pid) AS terminated FROM (SELECT 2147483647 AS pid) AS s',
    );
    expect(rows).toEqual([{ terminated: false }]);
  });

  it('ne trouvent pas une table de public citée sans schéma', async () => {
    const error: unknown = await superuser
      .query('SELECT count(*) FROM _prisma_migrations')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: SQLSTATE.undefinedTable });
    expect(await rolsuper(superuser)).toBe(false);
  });
});

describe('cliquet du rôle du journal (migration 20261127120000_journal_role)', () => {
  let superuser: pg.Client;

  beforeAll(async () => {
    superuser = await connectAs(SUPERUSER_ROLE);
  });

  afterAll(async () => {
    await superuser.end();
  });

  async function settled(): Promise<string | null> {
    const { rows } = await superuser.query<{ violation: string | null }>(
      'SELECT amg_guard.security_events_settled_violation() AS violation',
    );
    return rows[0]?.violation ?? null;
  }

  it('base migrée et rejouée : état stabilisé conforme', async () => {
    expect(await settled()).toBeNull();
  });

  it('cliquet effacé, état final : signalé, puis reposé par le rejeu', async () => {
    await superuser.query('BEGIN');
    try {
      await superuser.query('DELETE FROM amg_guard.journal_writer_split');
      expect(await settled()).toBe('cliquet du rôle du journal non posé (rejouer roles.sql)');
    } finally {
      await superuser.query('ROLLBACK');
    }
  });

  it('migration fautive (INSERT rendu à amg_app avant le cliquet) : le rejeu échoue', async () => {
    // Fenêtre où une migration fautive aurait refait `GRANT INSERT … TO amg_app` alors que le
    // cliquet n'est pas encore posé : security_events_violation() l'admet (état de transition),
    // la vérification finale de roles.sql le refuse. Hors transaction : roles.sql a ses propres
    // BEGIN … COMMIT ; l'état est restauré dans `finally`.
    await superuser.query('DELETE FROM amg_guard.journal_writer_split');
    await superuser.query('GRANT INSERT ON public.security_events TO amg_app');
    try {
      const { rows } = await superuser.query<{ violation: string | null }>(
        'SELECT amg_guard.security_events_violation() AS violation',
      );
      expect(rows).toEqual([{ violation: null }]);
      expect(await settled()).toBe(
        'rôle du journal partiellement appliqué : amg_app écrit encore le journal',
      );
      await expect(superuser.query(ROLES_SQL)).rejects.toThrow(
        /journal de sécurité non conforme : rôle du journal partiellement appliqué/,
      );
      const marker = await superuser.query('SELECT 1 FROM amg_guard.journal_writer_split');
      expect(marker.rows).toEqual([]);
    } finally {
      await superuser.query('REVOKE INSERT ON public.security_events FROM amg_app');
      await superuser.query(ROLES_SQL);
    }
    expect(await settled()).toBeNull();
    const marker = await superuser.query<{ split: boolean }>(
      'SELECT split FROM amg_guard.journal_writer_split',
    );
    expect(marker.rows).toEqual([{ split: true }]);
  });

  it('le contrôle stabilisé n’est exécutable par aucun rôle de l’application', async () => {
    const { rows } = await superuser.query<Record<string, boolean>>(
      `SELECT pg_catalog.has_function_privilege(r.rolname, 'amg_guard.security_events_settled_violation()', 'EXECUTE') AS can
         FROM pg_catalog.pg_roles r
        WHERE r.rolname OPERATOR(pg_catalog.=) ANY (ARRAY['amg_app', 'amg_journal', 'amg_migrator']::name[])`,
    );
    expect(rows).toEqual([{ can: false }, { can: false }, { can: false }]);
  });
});
