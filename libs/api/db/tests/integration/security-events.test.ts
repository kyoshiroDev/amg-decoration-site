// Journal de sécurité en ajout seul (ADR-0023) : l'API insère et lit, rien d'autre ; même le
// propriétaire des tables ne peut ni modifier, ni vider, ni supprimer un événement de moins de 12 mois.
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
    await inRolledBackTransaction(migrator, async () => {
      // Seul moyen de créer un événement ancien : suspendre le déclencheur, dans cette transaction annulée.
      await migrator.query(
        'ALTER TABLE security_events DISABLE TRIGGER security_events_append_only_row',
      );
      const id = await insertEvent(migrator, new Date(Date.now() - 400 * 86_400_000).toISOString());
      await migrator.query(
        'ALTER TABLE security_events ENABLE TRIGGER security_events_append_only_row',
      );
      const result = await migrator.query('DELETE FROM security_events WHERE id = $1', [id]);
      expect(result.rowCount).toBe(1);
    });
  });
});
