// Journal de sécurité en ajout seul (ADR-0023) : l'API insère et lit, rien d'autre ; le propriétaire
// des tables (`amg_migrator`) ne peut ni modifier, ni vider, ni supprimer un événement de moins de
// 12 mois (déclencheur de la migration), ni désactiver, remplacer ou supprimer ce déclencheur, ni
// bâillonner l'API (droits), censurer des événements (index) ou réécrire l'historique (valeurs du
// type) : déclencheur d'événement du superutilisateur, sql/roles.sql. Seul le superutilisateur passe
// outre, et le rejeu de roles.sql (amg_guard.security_events_violation) le révèle.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  MIGRATOR_ROLE,
  SQLSTATE,
  SUPERUSER_ROLE,
  connectAs,
  expectSqlError,
  inRolledBackTransaction,
} from './test-database.js';

let app: pg.Client;
let migrator: pg.Client;
let superuser: pg.Client;

beforeAll(async () => {
  app = await connectAs(APP_ROLE);
  migrator = await connectAs(MIGRATOR_ROLE);
  superuser = await connectAs(SUPERUSER_ROLE);
});

afterAll(async () => {
  await app.end();
  await migrator.end();
  await superuser.end();
});

async function insertEvent(client: pg.Client, occurredAt?: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    occurredAt === undefined
      ? `INSERT INTO security_events (type, ip, device) VALUES ('LOGIN_FAILED', '203.0.113.7', 'Firefox, Linux') RETURNING id`
      : `INSERT INTO security_events (type, occurred_at) VALUES ('LOGIN_FAILED', $1) RETURNING id`,
    occurredAt === undefined ? [] : [occurredAt],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('insertion de l’événement impossible');
  return row.id;
}

describe('rôle de l’API', () => {
  it('insère et relit un événement', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertEvent(app);
      const { rows } = await app.query<{ type: string; ip: string; version: number }>(
        `SELECT type, host(ip) AS ip, uuid_extract_version(id) AS version FROM security_events WHERE id = $1`,
        [id],
      );
      expect(rows).toEqual([{ type: 'LOGIN_FAILED', ip: '203.0.113.7', version: 7 }]);
    });
  });

  it('ne peut pas antidater un événement : la date est celle de la base', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertEvent(app, '2000-01-01T00:00:00Z');
      const { rows } = await app.query<{ recent: boolean }>(
        `SELECT occurred_at > now() - interval '1 minute' AS recent FROM security_events WHERE id = $1`,
        [id],
      );
      expect(rows).toEqual([{ recent: true }]);
    });
  });

  it('ne choisit pas l’identifiant : UUID v7 généré par la base', async () => {
    await inRolledBackTransaction(app, async () => {
      const forged = '00000000-0000-4000-8000-000000000000';
      const { rows } = await app.query<{ id: string; version: number }>(
        `INSERT INTO security_events (id, type) VALUES ($1, 'LOGIN_FAILED')
         RETURNING id, uuid_extract_version(id) AS version`,
        [forged],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).not.toBe(forged);
      expect(rows[0]?.version).toBe(7);
    });
  });

  it.each([
    ['modifier', `UPDATE security_events SET type = 'LOGIN_SUCCEEDED'`],
    ['supprimer', 'DELETE FROM security_events'],
    ['vider', 'TRUNCATE security_events'],
  ])('ne peut pas %s le journal', async (_label, sql) => {
    await inRolledBackTransaction(app, async () => {
      await insertEvent(app);
      await expectSqlError(app, sql, [], SQLSTATE.insufficientPrivilege);
    });
  });

  it.each([
    ['des détails qui ne sont pas un objet', `'["liste"]'`],
    ['des détails de plus de 2 Kio', `jsonb_build_object('x', repeat('a', 2100))`],
  ])('refuse %s', async (_label, details) => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        `INSERT INTO security_events (type, details) VALUES ('LOGIN_FAILED', ${details}::jsonb)`,
        [],
        SQLSTATE.checkViolation,
      );
    });
  });

  it('refuse une adresse IP invalide', async () => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        `INSERT INTO security_events (type, ip) VALUES ('LOGIN_FAILED', $1)`,
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
      `UPDATE security_events SET type = 'LOGIN_SUCCEEDED'`,
      /modification|UPDATE interdit/,
    ],
    ['supprimer un événement récent', 'DELETE FROM security_events', /suppression interdite/],
    ['vider', 'TRUNCATE security_events', /TRUNCATE interdit/],
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
      const result = await superuser.query('DELETE FROM security_events WHERE id = $1', [id]);
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
      { name: 'amg_guard_security_events_drop', event: 'sql_drop', enabled: 'O', superuser: true },
    ]);
  });

  it.each([
    [
      'désactiver le déclencheur de ligne',
      'ALTER TABLE security_events DISABLE TRIGGER security_events_append_only_row',
    ],
    ['désactiver tous les déclencheurs', 'ALTER TABLE security_events DISABLE TRIGGER ALL'],
    [
      'réserver le déclencheur au mode réplique',
      'ALTER TABLE security_events ENABLE REPLICA TRIGGER security_events_append_only_row',
    ],
    [
      'supprimer le déclencheur de ligne',
      'DROP TRIGGER security_events_append_only_row ON security_events',
    ],
    [
      'supprimer le déclencheur TRUNCATE',
      'DROP TRIGGER security_events_append_only_truncate ON security_events',
    ],
    [
      'renommer le déclencheur',
      'ALTER TRIGGER security_events_append_only_row ON security_events RENAME TO renamed',
    ],
    [
      'remplacer la fonction du déclencheur',
      'CREATE OR REPLACE FUNCTION security_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$',
    ],
    [
      'renommer la fonction du déclencheur',
      'ALTER FUNCTION security_events_append_only() RENAME TO renamed',
    ],
    ['supprimer la fonction du déclencheur', 'DROP FUNCTION security_events_append_only() CASCADE'],
    [
      'conditionner le déclencheur (WHEN)',
      'CREATE OR REPLACE TRIGGER security_events_append_only_row BEFORE INSERT OR UPDATE OR DELETE ON security_events FOR EACH ROW WHEN (false) EXECUTE FUNCTION security_events_append_only()',
    ],
    [
      'ajouter un déclencheur qui réécrit la date',
      `CREATE FUNCTION public.forge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.occurred_at := '2000-01-01'; RETURN NEW; END $$;
       CREATE TRIGGER zz_forge BEFORE INSERT ON security_events FOR EACH ROW EXECUTE FUNCTION public.forge()`,
    ],
    ['renommer la table', 'ALTER TABLE security_events RENAME TO old_events'],
    [
      'réécrire une colonne',
      `ALTER TABLE security_events ALTER COLUMN device TYPE text USING 'falsifié'`,
    ],
    ['supprimer une colonne', 'ALTER TABLE security_events DROP COLUMN details'],
    ['activer la RLS', 'ALTER TABLE security_events ENABLE ROW LEVEL SECURITY'],
    ['ajouter une règle', 'CREATE RULE swallow AS ON INSERT TO security_events DO INSTEAD NOTHING'],
    ['hériter de la table', 'CREATE TABLE child_events () INHERITS (security_events)'],
    ['supprimer la table', 'DROP TABLE security_events'],
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
    // Droits : bâillonner l'API (plus aucun événement écrit) ou élargir ses droits.
    ['retirer l’INSERT au rôle de l’API', 'REVOKE INSERT ON security_events FROM amg_app'],
    ['retirer tous les droits au rôle de l’API', 'REVOKE ALL ON security_events FROM amg_app'],
    ['donner l’UPDATE au rôle de l’API', 'GRANT UPDATE ON security_events TO amg_app'],
    ['donner un droit de colonne', 'GRANT UPDATE (device) ON security_events TO amg_app'],
    ['ouvrir le journal à PUBLIC', 'GRANT INSERT ON security_events TO PUBLIC'],
    [
      'donner l’option de transmission',
      'GRANT INSERT ON security_events TO amg_app WITH GRANT OPTION',
    ],
    // Index : censurer des événements choisis (doublon refusé, ou fonction qui lève une erreur).
    // Valeur visée jamais insérée par les tests : l'index se crée, puis le contrôle le refuse.
    [
      'créer un index unique partiel de censure',
      `CREATE UNIQUE INDEX censor ON security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
    ],
    ['créer un index unique', 'CREATE UNIQUE INDEX censor ON security_events (id, device)'],
    [
      'créer un index sur une fonction qui lève une erreur',
      `CREATE FUNCTION public.censor(t security_event_type) RETURNS int LANGUAGE plpgsql IMMUTABLE
         AS $$ BEGIN IF t = 'CSRF_REJECTED' THEN RAISE EXCEPTION 'censuré'; END IF; RETURN 1; END $$;
       CREATE INDEX censor ON security_events (public.censor(type))`,
    ],
    [
      'créer un index partiel',
      'CREATE INDEX censor ON security_events (device) WHERE device IS NOT NULL',
    ],
    // Type : réécrire l'historique sans toucher aux lignes.
    [
      'renommer une valeur du type d’événement',
      `ALTER TYPE security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'LOGIN_FAILED_OLD'`,
    ],
    [
      'échanger deux valeurs du type par trois renommages',
      `ALTER TYPE security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'swap_tmp';
       ALTER TYPE security_event_type RENAME VALUE 'LOGIN_SUCCEEDED' TO 'LOGIN_FAILED';
       ALTER TYPE security_event_type RENAME VALUE 'swap_tmp' TO 'LOGIN_SUCCEEDED'`,
    ],
    ['renommer le type d’événement', 'ALTER TYPE security_event_type RENAME TO other_type'],
    ['ajouter une politique RLS', 'CREATE POLICY hide ON security_events USING (false)'],
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

  it('ne peut ni modifier ni remplacer les fonctions de contrôle du superutilisateur', async () => {
    await inRolledBackTransaction(migrator, async () => {
      await expectSqlError(
        migrator,
        `CREATE OR REPLACE FUNCTION amg_guard.security_events_violation() RETURNS text
           LANGUAGE sql AS $$ SELECT NULL::text $$`,
        [],
        SQLSTATE.insufficientPrivilege,
      );
      await expectSqlError(
        migrator,
        'ALTER EVENT TRIGGER amg_guard_security_events DISABLE',
        [],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });

  it.each([
    [
      'ajouter une valeur au type d’événement',
      `ALTER TYPE security_event_type ADD VALUE 'TEST_ONLY_VALUE'`,
    ],
    [
      'insérer une valeur avant une valeur existante',
      `ALTER TYPE security_event_type ADD VALUE 'TEST_ONLY_VALUE' BEFORE 'LOGIN_FAILED'`,
    ],
    ['créer un index sur le journal', 'CREATE INDEX probe_idx ON security_events (device)'],
    [
      'créer un index composé sur le journal',
      'CREATE INDEX probe_idx ON security_events (type, user_id) INCLUDE (ip)',
    ],
    ['réaccorder les mêmes droits', 'GRANT SELECT, INSERT ON security_events TO amg_app'],
    ['créer une autre table', 'CREATE TABLE public.probe_table (id int)'],
  ])('peut encore %s (migrations futures)', async (_label, sql) => {
    await inRolledBackTransaction(migrator, async () => {
      await migrator.query(sql);
    });
  });

  it('le superutilisateur passe outre (incident documenté)', async () => {
    await inRolledBackTransaction(superuser, async () => {
      await superuser.query(
        'ALTER TABLE security_events DISABLE TRIGGER security_events_append_only_row',
      );
    });
  });
});

/** Écart signalé par la vérification que rejoue roles.sql (NULL : journal conforme). */
async function violation(client: pg.Client): Promise<string | null> {
  const { rows } = await client.query<{ violation: string | null }>(
    'SELECT amg_guard.security_events_violation() AS violation',
  );
  return rows[0]?.violation ?? null;
}

describe('vérification de l’état du journal (rejeu de roles.sql)', () => {
  it('le journal migré est conforme', async () => {
    expect(await violation(superuser)).toBeNull();
  });

  it.each([
    ['droits modifiés', 'REVOKE INSERT ON security_events FROM amg_app'],
    [
      'déclencheurs modifiés',
      'ALTER TABLE security_events DISABLE TRIGGER security_events_append_only_row',
    ],
    [
      'index unique, partiel',
      `CREATE UNIQUE INDEX censor ON security_events ((true)) WHERE type = 'CSRF_REJECTED'`,
    ],
    [
      'valeurs de security_event_type renommées',
      `ALTER TYPE security_event_type RENAME VALUE 'LOGIN_FAILED' TO 'LOGIN_FAILED_OLD'`,
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
      await superuser.query('ALTER EVENT TRIGGER amg_guard_security_events DISABLE');
      await superuser.query('ALTER EVENT TRIGGER amg_guard_security_events_drop DISABLE');
      await superuser.query(`SET LOCAL ROLE ${MIGRATOR_ROLE}`);
      await superuser.query('ALTER TABLE security_events ADD COLUMN probe_column int');
      expect(await violation(superuser)).toBeNull();
      await superuser.query(
        'ALTER TABLE security_events DISABLE TRIGGER security_events_append_only_row',
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
