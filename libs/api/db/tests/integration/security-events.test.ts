// Journal de sécurité en ajout seul (ADR-0023) : le rôle du journal (`amg_journal`, lot 3) insère et
// lit, rien d'autre ; le rôle de l'API ne fait plus que lire ; le propriétaire
// des tables (`amg_migrator`) ne peut ni modifier, ni vider, ni supprimer un événement de moins de
// 12 mois (déclencheur de la migration), ni désactiver, remplacer ou supprimer ce déclencheur, ni
// bâillonner l'API (droits), censurer des événements (index) ou réécrire l'historique (valeurs du
// type) : déclencheur d'événement du superutilisateur, sql/roles.sql, et fonction du déclencheur
// possédée par lui. Seul le superutilisateur passe outre, et le rejeu de roles.sql
// (amg_guard.security_events_violation) le révèle. Le superutilisateur n'a pas `public` dans son
// chemin de recherche (roles.sql) : ses requêtes nomment `public.` explicitement.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  JOURNAL_ROLE,
  MIGRATOR_ROLE,
  SQLSTATE,
  SUPERUSER_ROLE,
  connectAs,
  expectSqlError,
  inRolledBackTransaction,
} from './test-database.js';

let app: pg.Client;
let journal: pg.Client;
let migrator: pg.Client;
let superuser: pg.Client;

beforeAll(async () => {
  app = await connectAs(APP_ROLE);
  journal = await connectAs(JOURNAL_ROLE);
  migrator = await connectAs(MIGRATOR_ROLE);
  superuser = await connectAs(SUPERUSER_ROLE);
});

afterAll(async () => {
  await app.end();
  await journal.end();
  await migrator.end();
  await superuser.end();
});

async function insertEvent(client: pg.Client, occurredAt?: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    occurredAt === undefined
      ? `INSERT INTO public.security_events (type, ip, device) VALUES ('LOGIN_FAILED', '203.0.113.7', 'Firefox, Linux') RETURNING id`
      : `INSERT INTO public.security_events (type, occurred_at) VALUES ('LOGIN_FAILED', $1) RETURNING id`,
    occurredAt === undefined ? [] : [occurredAt],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('insertion de l’événement impossible');
  return row.id;
}

describe('rôle de l’API', () => {
  it('lit le journal mais n’y écrit plus (rôle du journal seul écrivain)', async () => {
    await inRolledBackTransaction(app, async () => {
      await app.query('SELECT count(*) FROM public.security_events');
      await expectSqlError(
        app,
        `INSERT INTO public.security_events (type) VALUES ('LOGIN_FAILED')`,
        [],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });
});

describe('rôle du journal', () => {
  it('insère et relit un événement', async () => {
    await inRolledBackTransaction(journal, async () => {
      const id = await insertEvent(journal);
      const { rows } = await journal.query<{ type: string; ip: string; version: number }>(
        `SELECT type, host(ip) AS ip, uuid_extract_version(id) AS version FROM public.security_events WHERE id = $1`,
        [id],
      );
      expect(rows).toEqual([{ type: 'LOGIN_FAILED', ip: '203.0.113.7', version: 7 }]);
    });
  });

  it('ne peut pas antidater un événement : la date est celle de la base', async () => {
    await inRolledBackTransaction(journal, async () => {
      const id = await insertEvent(journal, '2000-01-01T00:00:00Z');
      const { rows } = await journal.query<{ recent: boolean }>(
        `SELECT occurred_at > now() - interval '1 minute' AS recent FROM public.security_events WHERE id = $1`,
        [id],
      );
      expect(rows).toEqual([{ recent: true }]);
    });
  });

  it('ne choisit pas l’identifiant : UUID v7 généré par la base', async () => {
    await inRolledBackTransaction(journal, async () => {
      const forged = '00000000-0000-4000-8000-000000000000';
      const { rows } = await journal.query<{ id: string; version: number }>(
        `INSERT INTO public.security_events (id, type) VALUES ($1, 'LOGIN_FAILED')
         RETURNING id, uuid_extract_version(id) AS version`,
        [forged],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).not.toBe(forged);
      expect(rows[0]?.version).toBe(7);
    });
  });

  it.each([
    ['modifier', `UPDATE public.security_events SET type = 'LOGIN_SUCCEEDED'`],
    ['supprimer', 'DELETE FROM public.security_events'],
    ['vider', 'TRUNCATE public.security_events'],
  ])('ne peut pas %s le journal', async (_label, sql) => {
    await inRolledBackTransaction(journal, async () => {
      await insertEvent(journal);
      await expectSqlError(journal, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each([
    ['des détails qui ne sont pas un objet', `'["liste"]'`],
    ['des détails de plus de 2 Kio', `jsonb_build_object('x', repeat('a', 2100))`],
  ])('refuse %s', async (_label, details) => {
    await inRolledBackTransaction(journal, async () => {
      await expectSqlError(
        journal,
        `INSERT INTO public.security_events (type, details) VALUES ('LOGIN_FAILED', ${details}::jsonb)`,
        [],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('refuse une adresse IP invalide', async () => {
    await inRolledBackTransaction(journal, async () => {
      await expectSqlError(
        journal,
        `INSERT INTO public.security_events (type, ip) VALUES ('LOGIN_FAILED', $1)`,
        ['999.0.0.1'],
        '22P02',
      );
    });
  });
});

describe('propriétaire des tables (rôle des migrations)', () => {
  it.each([
    [
      'modifier',
      `UPDATE public.security_events SET type = 'LOGIN_SUCCEEDED'`,
      /modification|UPDATE interdit/,
    ],
    [
      'supprimer un événement récent',
      'DELETE FROM public.security_events',
      /suppression interdite/,
    ],
    ['vider', 'TRUNCATE public.security_events', /TRUNCATE interdit/],
  ])('ne peut pas %s le journal (déclencheur)', async (_label, sql, message) => {
    await inRolledBackTransaction(migrator, async () => {
      await insertEvent(migrator);
      await expectSqlError(migrator, sql, [], SQLSTATE.raiseException, message);
    });
  });

  it('peut supprimer un événement plus ancien que la rétention de 12 mois (purge)', async () => {
    await inRolledBackTransaction(superuser, async () => {
      // Seul moyen de créer un événement ancien : le superutilisateur insère en mode réplique (les
      // déclencheurs ordinaires ne s'exécutent pas), puis la suppression est faite sous le rôle des
      // migrations, déclencheur actif. Le tout dans cette transaction annulée.
      await superuser.query(`SET LOCAL session_replication_role = 'replica'`);
      const id = await insertEvent(
        superuser,
        new Date(Date.now() - 400 * 86_400_000).toISOString(),
      );
      await superuser.query(`SET LOCAL session_replication_role = 'origin'`);
      await superuser.query(`SET LOCAL ROLE ${MIGRATOR_ROLE}`);
      const result = await superuser.query('DELETE FROM public.security_events WHERE id = $1', [
        id,
      ]);
      expect(result.rowCount).toBe(1);
    });
  });
});

describe('propriétaire des tables : protection du déclencheur (déclencheur d’événement)', () => {
  it('les déclencheurs d’événement appartiennent au superutilisateur et sont actifs', async () => {
    const { rows } = await migrator.query<{
      name: string;
      event: string;
      enabled: string;
      superuser: boolean;
    }>(
      `SELECT e.evtname AS name, e.evtevent AS event, e.evtenabled AS enabled, r.rolsuper AS superuser
         FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_roles r ON r.oid = e.evtowner
        WHERE e.evtname LIKE 'amg\\_guard\\_%' ORDER BY e.evtname`,
    );
    expect(rows).toEqual([
      {
        name: 'amg_guard_security_events',
        event: 'ddl_command_end',
        enabled: 'O',
        superuser: true,
      },
      {
        name: 'amg_guard_security_events_concurrently',
        event: 'ddl_command_start',
        enabled: 'O',
        superuser: true,
      },
      { name: 'amg_guard_security_events_drop', event: 'sql_drop', enabled: 'O', superuser: true },
    ]);
  });

  it.each([
    [
      'désactiver le déclencheur de ligne',
      'ALTER TABLE public.security_events DISABLE TRIGGER security_events_append_only_row',
    ],
    ['désactiver tous les déclencheurs', 'ALTER TABLE public.security_events DISABLE TRIGGER ALL'],
    [
      'réserver le déclencheur au mode réplique',
      'ALTER TABLE public.security_events ENABLE REPLICA TRIGGER security_events_append_only_row',
    ],
    [
      'supprimer le déclencheur de ligne',
      'DROP TRIGGER security_events_append_only_row ON public.security_events',
    ],
    [
      'supprimer le déclencheur TRUNCATE',
      'DROP TRIGGER security_events_append_only_truncate ON public.security_events',
    ],
    [
      'renommer le déclencheur',
      'ALTER TRIGGER security_events_append_only_row ON public.security_events RENAME TO renamed',
    ],
    [
      'conditionner le déclencheur (WHEN)',
      'CREATE OR REPLACE TRIGGER security_events_append_only_row BEFORE INSERT OR UPDATE OR DELETE ON public.security_events FOR EACH ROW WHEN (false) EXECUTE FUNCTION amg_guard.security_events_append_only()',
    ],
    [
      'ajouter un déclencheur qui réécrit la date',
      `CREATE FUNCTION public.forge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.occurred_at := '2000-01-01'; RETURN NEW; END $$;
       CREATE TRIGGER zz_forge BEFORE INSERT ON public.security_events FOR EACH ROW EXECUTE FUNCTION public.forge()`,
    ],
    ['renommer la table', 'ALTER TABLE public.security_events RENAME TO old_events'],
    [
      'réécrire une colonne',
      `ALTER TABLE public.security_events ALTER COLUMN device TYPE text USING 'falsifié'`,
    ],
    ['supprimer une colonne', 'ALTER TABLE public.security_events DROP COLUMN details'],
    ['activer la RLS', 'ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY'],
    [
      'ajouter une contrainte CHECK non validée',
      `ALTER TABLE public.security_events ADD CONSTRAINT hush CHECK (type <> 'CSRF_REJECTED') NOT VALID`,
    ],
    [
      'rendre une colonne facultative obligatoire',
      'ALTER TABLE public.security_events ALTER COLUMN user_id SET NOT NULL',
    ],
    [
      'ajouter une règle',
      'CREATE RULE swallow AS ON INSERT TO public.security_events DO INSTEAD NOTHING',
    ],
    ['hériter de la table', 'CREATE TABLE child_events () INHERITS (public.security_events)'],
    ['supprimer la table', 'DROP TABLE public.security_events'],
    ['supprimer tous ses objets', 'DROP OWNED BY amg_migrator'],
  ])('ne peut pas %s', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(
        migrator,
        sql,
        [],
        SQLSTATE.insufficientPrivilege,
        /journal de sécurité/,
      );
    });
  });

  it.each([
    // Droits : bâillonner le journal (plus aucun événement écrit), le faire écrire hors du pool
    // dédié (cliquet du lot 3) ou élargir les droits.
    [
      'retirer l’INSERT au rôle du journal',
      'REVOKE INSERT ON public.security_events FROM amg_journal',
    ],
    [
      'retirer tous les droits au rôle du journal',
      'REVOKE ALL ON public.security_events FROM amg_journal',
    ],
    ['retirer la lecture au rôle de l’API', 'REVOKE ALL ON public.security_events FROM amg_app'],
    [
      'rendre l’INSERT au rôle de l’API (cliquet)',
      'GRANT INSERT ON public.security_events TO amg_app',
    ],
    [
      'revenir à l’état d’origine (cliquet)',
      `GRANT INSERT ON public.security_events TO amg_app;
       REVOKE ALL ON public.security_events FROM amg_journal`,
    ],
    ['donner l’UPDATE au rôle de l’API', 'GRANT UPDATE ON public.security_events TO amg_app'],
    ['donner l’UPDATE au rôle du journal', 'GRANT UPDATE ON public.security_events TO amg_journal'],
    ['donner un droit de colonne', 'GRANT UPDATE (device) ON public.security_events TO amg_app'],
    ['ouvrir le journal à PUBLIC', 'GRANT INSERT ON public.security_events TO PUBLIC'],
    [
      'donner l’option de transmission',
      'GRANT INSERT ON public.security_events TO amg_journal WITH GRANT OPTION',
    ],
    // Index : censurer des événements choisis (doublon refusé, ou fonction qui lève une erreur).
    // Valeur visée jamais insérée par les tests : l'index se crée, puis le contrôle le refuse.
    [
      'créer un index unique partiel de censure',
      `CREATE UNIQUE INDEX censor ON public.security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
    ],
    ['créer un index unique', 'CREATE UNIQUE INDEX censor ON public.security_events (id, device)'],
    [
      'créer un index sur une fonction qui lève une erreur',
      `CREATE FUNCTION public.censor(t public.security_event_type) RETURNS int LANGUAGE plpgsql IMMUTABLE
         AS $$ BEGIN IF t = 'CSRF_REJECTED' THEN RAISE EXCEPTION 'censuré'; END IF; RETURN 1; END $$;
       CREATE INDEX censor ON public.security_events (public.censor(type))`,
    ],
    [
      'créer un index partiel',
      'CREATE INDEX censor ON public.security_events (device) WHERE device IS NOT NULL',
    ],
    // Type : réécrire l'historique sans toucher aux lignes.
    [
      'renommer une valeur du type d’événement',
      `ALTER TYPE public.security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'LOGIN_FAILED_OLD'`,
    ],
    [
      'échanger deux valeurs du type par trois renommages',
      `ALTER TYPE public.security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'swap_tmp';
       ALTER TYPE public.security_event_type RENAME VALUE 'LOGIN_SUCCEEDED' TO 'LOGIN_FAILED';
       ALTER TYPE public.security_event_type RENAME VALUE 'swap_tmp' TO 'LOGIN_SUCCEEDED'`,
    ],
    ['renommer le type d’événement', 'ALTER TYPE public.security_event_type RENAME TO other_type'],
    ['ajouter une politique RLS', 'CREATE POLICY hide ON public.security_events USING (false)'],
    // Clé étrangère vers le journal : ses déclencheurs internes bloqueraient la purge.
    [
      'référencer le journal par une clé étrangère',
      'CREATE TABLE public.pinned_events (event_id uuid REFERENCES public.security_events (id))',
    ],
    // Conversions : appliquées dans toutes les sessions, quel que soit le chemin de recherche.
    // Prisma insère par `CAST($2::text AS "public"."security_event_type")` et lit `"type"::text`.
    [
      'convertir text en type d’événement (CREATE CAST)',
      'CREATE CAST (text AS public.security_event_type) WITH INOUT AS ASSIGNMENT',
    ],
    [
      'convertir le type d’événement en text (CREATE CAST)',
      'CREATE CAST (public.security_event_type AS text) WITH INOUT',
    ],
    [
      'convertir le type ligne du journal en text (CREATE CAST)',
      'CREATE CAST (public.security_events AS text) WITH INOUT',
    ],
    [
      'convertir un tableau du type d’événement (CREATE CAST)',
      'CREATE CAST (public.security_event_type[] AS text) WITH INOUT',
    ],
    [
      'créer la fonction d’une conversion qui réécrit les événements',
      `CREATE FUNCTION public.rewrite(t text) RETURNS public.security_event_type LANGUAGE sql IMMUTABLE
         AS $$ SELECT (CASE WHEN t = 'LOGIN_FAILED' THEN 'LOGOUT' ELSE t END)::public.security_event_type $$`,
    ],
    // Résolution de noms dans les sessions de l'API (chemin `"$user", public`).
    [
      'redéfinir = sur le type d’événement (CREATE OPERATOR)',
      `CREATE FUNCTION public.always_true(public.security_event_type, public.security_event_type)
         RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;
       CREATE OPERATOR public.= (LEFTARG = public.security_event_type,
         RIGHTARG = public.security_event_type, FUNCTION = public.always_true)`,
    ],
    [
      'redéfinir = sur anyenum par une fonction du système (CREATE OPERATOR)',
      'CREATE OPERATOR public.= (LEFTARG = anyenum, RIGHTARG = anyenum, FUNCTION = pg_catalog.enum_ne)',
    ],
    [
      'créer une fonction polymorphe',
      'CREATE FUNCTION public.shadow(anyelement) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$',
    ],
    [
      'créer une surcharge de text() sur le type d’événement',
      `CREATE FUNCTION public.text(public.security_event_type) RETURNS text LANGUAGE sql
         AS $$ SELECT 'falsifié' $$`,
    ],
    [
      'créer un domaine sur le type d’événement',
      'CREATE DOMAIN public.hush AS public.security_event_type',
    ],
    [
      'créer des statistiques étendues sur expression',
      'CREATE STATISTICS public.probe_stats ON (lower(device)) FROM public.security_events',
    ],
  ])('ne peut pas %s (état contrôlé après toute commande DDL)', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(
        migrator,
        sql,
        [],
        SQLSTATE.insufficientPrivilege,
        /journal de sécurité/,
      );
    });
  });

  it.each([
    [
      'remplacer une fonction de contrôle',
      `CREATE OR REPLACE FUNCTION amg_guard.security_events_violation() RETURNS text
         LANGUAGE sql AS $$ SELECT NULL::text $$`,
    ],
    [
      'désactiver le déclencheur d’événement',
      'ALTER EVENT TRIGGER amg_guard_security_events DISABLE',
    ],
    [
      'remplacer la fonction du déclencheur du journal',
      'CREATE OR REPLACE FUNCTION amg_guard.security_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$',
    ],
    [
      'renommer la fonction du déclencheur du journal',
      'ALTER FUNCTION amg_guard.security_events_append_only() RENAME TO renamed',
    ],
    [
      'supprimer la fonction du déclencheur du journal',
      'DROP FUNCTION amg_guard.security_events_append_only() CASCADE',
    ],
    ['effacer le marqueur du journal scellé', 'DELETE FROM amg_guard.journal_sealed'],
  ])('ne peut pas %s (objets du superutilisateur)', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(migrator, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each([
    [
      'ajouter une valeur au type d’événement',
      `ALTER TYPE public.security_event_type ADD VALUE 'TEST_ONLY_VALUE'`,
    ],
    [
      'insérer une valeur avant une valeur existante',
      `ALTER TYPE public.security_event_type ADD VALUE 'TEST_ONLY_VALUE' BEFORE 'LOGIN_FAILED'`,
    ],
    ['créer un index sur le journal', 'CREATE INDEX probe_idx ON public.security_events (device)'],
    [
      'créer un index composé sur le journal',
      'CREATE INDEX probe_idx ON public.security_events (type, user_id) INCLUDE (ip)',
    ],
    [
      'réaccorder les mêmes droits',
      `GRANT SELECT ON public.security_events TO amg_app;
       GRANT SELECT, INSERT ON public.security_events TO amg_journal`,
    ],
    ['créer une autre table', 'CREATE TABLE public.probe_table (id int)'],
    ['reconstruire un index du journal', 'REINDEX INDEX public.security_events_pkey'],
    [
      'créer des statistiques étendues sur des colonnes',
      'CREATE STATISTICS public.probe_stats ON device, ip FROM public.security_events',
    ],
    [
      'créer une fonction et un opérateur sur d’autres types',
      `CREATE FUNCTION public.probe_eq(int, text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
       CREATE OPERATOR public.=== (LEFTARG = int, RIGHTARG = text, FUNCTION = public.probe_eq)`,
    ],
  ])('peut encore %s (migrations futures)', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await migrator.query(sql);
    });
  });

  // CONCURRENTLY : refusé avant exécution (ddl_command_start). Hors transaction, un refus après
  // coup laisserait un index invalide mais maintenu (censeur). Dans une transaction, le refus
  // précède l'erreur « cannot run inside a transaction block » : testable sans rien laisser.
  it.each([
    [
      'créer un index unique partiel CONCURRENTLY',
      `CREATE UNIQUE INDEX CONCURRENTLY censor ON public.security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
    ],
    [
      'créer un index simple CONCURRENTLY',
      'CREATE INDEX CONCURRENTLY probe_idx ON public.security_events (device)',
    ],
    [
      'masquer CONCURRENTLY derrière un commentaire et la casse',
      'CREATE INDEX/**/ConCurrently probe_idx ON public.security_events (device)',
    ],
    [
      'créer un index CONCURRENTLY sur une autre table',
      'CREATE INDEX CONCURRENTLY probe_idx ON public.users (status)',
    ],
    ['reconstruire CONCURRENTLY', 'REINDEX INDEX CONCURRENTLY public.security_events_pkey'],
    [
      'supprimer un index CONCURRENTLY (effacer les traces)',
      'DROP INDEX CONCURRENTLY public.security_events_type_occurred_at_idx',
    ],
  ])('ne peut pas %s', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(
        migrator,
        sql,
        [],
        SQLSTATE.insufficientPrivilege,
        /journal de sécurité : CONCURRENTLY/,
      );
    });
  });

  it('CREATE INDEX CONCURRENTLY hors transaction est refusé sans laisser d’index', async () => {
    const error: unknown = await migrator
      .query(
        `CREATE UNIQUE INDEX CONCURRENTLY concurrent_censor ON public.security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
      )
      .catch((caught: unknown) => caught);
    try {
      expect(error).toMatchObject({ code: SQLSTATE.insufficientPrivilege });
      const { rows } = await migrator.query<{ indexes: number }>(
        `SELECT count(*)::int AS indexes FROM pg_catalog.pg_class WHERE relname = 'concurrent_censor'`,
      );
      expect(rows).toEqual([{ indexes: 0 }]);
    } finally {
      // Seulement si le refus a échoué : ne jamais laisser l'index aux suites suivantes.
      await migrator.query('DROP INDEX IF EXISTS public.concurrent_censor');
    }
  });

  it('le superutilisateur passe outre (incident documenté)', async () => {
    await inRolledBackTransaction(superuser, async () => {
      await superuser.query(
        'ALTER TABLE public.security_events DISABLE TRIGGER security_events_append_only_row',
      );
    });
  });
});

/** Déclencheurs d'événement de roles.sql. */
const EVENT_TRIGGERS = [
  'amg_guard_security_events',
  'amg_guard_security_events_drop',
  'amg_guard_security_events_concurrently',
] as const;

/** Écart signalé par la vérification que rejoue roles.sql (NULL : journal conforme). */
async function violation(client: pg.Client): Promise<string | null> {
  const { rows } = await client.query<{ violation: string | null }>(
    'SELECT amg_guard.security_events_violation() AS violation',
  );
  return rows[0]?.violation ?? null;
}

describe('vérification de l’état du journal (rejeu de roles.sql)', () => {
  it('le journal migré est conforme et marqué scellé', async () => {
    expect(await violation(superuser)).toBeNull();
    const { rows } = await superuser.query<{ sealed: boolean }>(
      'SELECT sealed FROM amg_guard.journal_sealed',
    );
    expect(rows).toEqual([{ sealed: true }]);
    // Cliquet posé par le rejeu de roles.sql qui a suivi la migration du rôle du journal.
    const split = await superuser.query<{ split: boolean }>(
      'SELECT split FROM amg_guard.journal_writer_split',
    );
    expect(split.rows).toEqual([{ split: true }]);
  });

  it('avant le cliquet : états d’origine et de transition admis, jamais un journal sans écrivain', async () => {
    // Base qui n'a pas encore reçu la migration 20261127120000_journal_role : simulée dans une
    // transaction annulée du superutilisateur (marqueur du cliquet effacé, droits d'origine).
    await inRolledBackTransaction(superuser, async () => {
      await superuser.query('DELETE FROM amg_guard.journal_writer_split');
      await superuser.query('GRANT INSERT ON public.security_events TO amg_app');
      // Transition : deux écrivains.
      expect(await violation(superuser)).toBeNull();
      await superuser.query('REVOKE ALL ON public.security_events FROM amg_journal');
      // Origine : amg_app seul écrivain.
      expect(await violation(superuser)).toBeNull();
      await superuser.query('REVOKE INSERT ON public.security_events FROM amg_app');
      // Plus aucun écrivain.
      expect(await violation(superuser)).toBe('droits modifiés');
    });
  });

  it('le journal migré n’a ni déclencheur interne ni contrainte en dehors de celles attendues', async () => {
    const { rows } = await superuser.query<{ internal: number; triggers: number; others: number }>(
      `SELECT (SELECT count(*)::int FROM pg_catalog.pg_trigger t
                WHERE t.tgrelid = 'public.security_events'::regclass AND t.tgisinternal) AS internal,
              (SELECT count(*)::int FROM pg_catalog.pg_trigger t
                WHERE t.tgrelid = 'public.security_events'::regclass) AS triggers,
              (SELECT count(*)::int FROM pg_catalog.pg_constraint k
                WHERE k.conrelid = 'public.security_events'::regclass AND k.contype NOT IN ('p', 'c', 'n')) AS others`,
    );
    expect(rows).toEqual([{ internal: 0, triggers: 2, others: 0 }]);
  });

  it.each([
    ['droits modifiés', 'REVOKE INSERT ON public.security_events FROM amg_journal'],
    ['droits modifiés', 'GRANT INSERT ON public.security_events TO amg_app'],
    [
      'déclencheurs modifiés',
      'ALTER TABLE public.security_events DISABLE TRIGGER security_events_append_only_row',
    ],
    [
      'index unique, partiel',
      `CREATE UNIQUE INDEX censor ON public.security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
    ],
    [
      'valeurs de security_event_type renommées',
      `ALTER TYPE public.security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'LOGIN_FAILED_OLD'`,
    ],
    [
      'contraintes modifiées',
      `ALTER TABLE public.security_events ADD CONSTRAINT hush CHECK (type <> 'CSRF_REJECTED') NOT VALID`,
    ],
    [
      'contraintes modifiées',
      'ALTER TABLE public.security_events DROP CONSTRAINT security_events_details_check',
    ],
    [
      'contraintes modifiées',
      'ALTER TABLE public.security_events ALTER COLUMN user_id SET NOT NULL',
    ],
    [
      'clé étrangère vers le journal',
      'CREATE TABLE public.pinned_events (event_id uuid REFERENCES public.security_events (id))',
    ],
    [
      // Clé étrangère depuis le journal : déclencheurs internes sur la table.
      'déclencheurs modifiés',
      `CREATE TABLE public.probe_users (id uuid PRIMARY KEY);
       ALTER TABLE public.security_events ADD FOREIGN KEY (user_id) REFERENCES public.probe_users (id)`,
    ],
    [
      // Scellé une fois, scellé toujours : un journal descellé ou supprimé est un écart.
      'journal supprimé, remplacé ou descellé',
      `DROP TRIGGER security_events_append_only_row ON public.security_events;
       DROP TRIGGER security_events_append_only_truncate ON public.security_events`,
    ],
    ['journal supprimé, remplacé ou descellé', 'DROP TABLE public.security_events'],
    // Conversion et opérateur : appliqués aux sessions de l'API sans toucher à la table.
    [
      'conversion sur un type du journal',
      `CREATE FUNCTION public.rewrite(t text) RETURNS public.security_event_type LANGUAGE sql
         IMMUTABLE AS $$ SELECT 'LOGOUT'::public.security_event_type $$;
       CREATE CAST (text AS public.security_event_type) WITH FUNCTION public.rewrite(text)`,
    ],
    [
      'opérateur sur un type du journal ou polymorphe',
      `CREATE FUNCTION public.always_true(public.security_event_type, public.security_event_type)
         RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;
       CREATE OPERATOR public.= (LEFTARG = public.security_event_type,
         RIGHTARG = public.security_event_type, FUNCTION = public.always_true)`,
    ],
    [
      "classe d'opérateurs",
      `CREATE OPERATOR CLASS public.probe_ops FOR TYPE public.security_event_type USING hash AS
         OPERATOR 1 pg_catalog.= (anyenum, anyenum), FUNCTION 1 pg_catalog.hashenum(anyenum)`,
    ],
    [
      // Reste d'un CREATE INDEX CONCURRENTLY interrompu (simulé dans le catalogue).
      'index invalide ou inachevé',
      `CREATE INDEX probe_idx ON public.security_events (device);
       UPDATE pg_catalog.pg_index SET indisvalid = false
        WHERE indexrelid = 'public.probe_idx'::pg_catalog.regclass`,
    ],
    [
      "déclencheurs d'événement absents, désactivés ou altérés",
      'ALTER EVENT TRIGGER amg_guard_security_events_concurrently DISABLE',
    ],
    [
      "déclencheurs d'événement absents, désactivés ou altérés",
      'DROP EVENT TRIGGER amg_guard_security_events_drop',
    ],
  ])('révèle ce que le superutilisateur a changé : %s', async (expected, sql) => {
    await inRolledBackTransaction(superuser, async () => {
      await superuser.query(sql);
      expect(await violation(superuser)).toContain(expected);
    });
  });

  it('fenêtre de migration du journal : déclencheurs d’événement désactivés, état final vérifié', async () => {
    // Simulation dans une transaction annulée : en exploitation, la fenêtre est validée par le
    // superutilisateur et la migration appliquée par une connexion propre d'amg_migrator (jamais
    // sous SET ROLE depuis le superutilisateur, voir le test suivant).
    await inRolledBackTransaction(superuser, async () => {
      for (const trigger of EVENT_TRIGGERS) {
        await superuser.query(`ALTER EVENT TRIGGER ${trigger} DISABLE`);
      }
      await superuser.query(`SET LOCAL ROLE ${MIGRATOR_ROLE}`);
      await superuser.query('ALTER TABLE public.security_events ADD COLUMN probe_column int');
      // Fenêtre ouverte : signalée (watch.sh, contrôle après chaque fenêtre de deploy.sh).
      expect(await violation(superuser)).toBe(
        "déclencheurs d'événement absents, désactivés ou altérés",
      );
      // Réactivation (rejeu de roles.sql) : la nouvelle colonne est admise…
      await superuser.query('RESET ROLE');
      for (const trigger of EVENT_TRIGGERS) {
        await superuser.query(`ALTER EVENT TRIGGER ${trigger} ENABLE`);
      }
      expect(await violation(superuser)).toBeNull();
      // … un déclencheur du journal désactivé pendant la fenêtre ne l'est pas.
      await superuser.query(
        'ALTER TABLE public.security_events DISABLE TRIGGER security_events_append_only_row',
      );
      expect(await violation(superuser)).toBe('déclencheurs modifiés');
    });
  });

  it('SET ROLE n’est pas une frontière : le code du rôle des migrations peut redevenir superutilisateur', async () => {
    // Raison pour laquelle le superutilisateur n'exécute jamais de DML ni de DDL sur les objets
    // d'amg_migrator (EXPLOITATION.md §11) : RESET ROLE est permis à tout code de la session.
    await inRolledBackTransaction(superuser, async () => {
      await superuser.query(`SET LOCAL ROLE ${MIGRATOR_ROLE}`);
      await superuser.query(
        `CREATE FUNCTION public.escape_probe() RETURNS name LANGUAGE plpgsql
           AS $$ BEGIN RESET ROLE; RETURN current_user; END $$`,
      );
      const { rows } = await superuser.query<{ role: string }>(
        'SELECT public.escape_probe() AS role',
      );
      expect(rows).toEqual([{ role: SUPERUSER_ROLE }]);
    });
  });
});
