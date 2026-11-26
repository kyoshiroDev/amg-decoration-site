// Liens d'activation et codes d'enrôlement (ADR-0023) : dates fixées par la base (impossible
// d'antidater, de post-dater ou de modifier `created_at` et `expires_at`), un seul lien et un seul
// code vivants par compte, consommation et révocation définitives. Éprouvé sous le rôle de l'API et
// sous le propriétaire des tables (le déclencheur s'applique à tous les rôles). Chaque test est annulé.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  MIGRATOR_ROLE,
  SQLSTATE,
  connectAs,
  digest32,
  expectSqlError,
  inRolledBackTransaction,
  insertUser,
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

/** Lien vivant d'une heure ; renvoie son identifiant. */
async function insertToken(client: pg.Client, userId: string, issuedBy?: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO activation_tokens (user_id, purpose, token_hash, expires_at, issued_by_id)
     VALUES ($1, 'PASSWORD_RESET', $2, now() + interval '1 hour', $3) RETURNING id`,
    [userId, digest32(), issuedBy ?? null],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('insertion du lien impossible');
  return row.id;
}

/** Motif d'émission (lot 4) : révoquer tous les liens non consommés du compte, expirés compris. */
const REVOKE_LIVE_TOKENS = `UPDATE activation_tokens SET revoked_at = now()
  WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`;

describe('activation_tokens : dates de la base', () => {
  it('ignore une date de création antidatée', async () => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      const { rows } = await app.query<{ forced: boolean }>(
        `INSERT INTO activation_tokens (user_id, purpose, token_hash, expires_at, created_at)
         VALUES ($1, 'INVITATION', $2, now() + interval '1 hour', '2000-01-01T00:00:00Z')
         RETURNING created_at = now() AS forced`,
        [userId, digest32()],
      );
      expect(rows).toEqual([{ forced: true }]);
    });
  });

  it('refuse une date de création post-datée pour allonger la durée de vie', async () => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      await expectSqlError(
        app,
        `INSERT INTO activation_tokens (user_id, purpose, token_hash, expires_at, created_at)
         VALUES ($1, 'INVITATION', $2, now() + interval '400 days', now() + interval '399 days')`,
        [userId, digest32()],
        SQLSTATE.checkViolation,
        /activation_tokens_lifetime_check/,
      );
    });
  });

  it.each([
    ['la date de création', `created_at = now() - interval '1 day'`],
    ['l’échéance', `expires_at = now() + interval '2 hours'`],
    ['l’usage', `purpose = 'INVITATION'`],
    ['l’empreinte', `token_hash = decode(repeat('ab', 32), 'hex')`],
    ['le compte', `user_id = gen_random_uuid()`],
  ])('le rôle de l’API ne peut pas modifier %s', async (_label, assignment) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertToken(app, await insertUser(app));
      await expectSqlError(
        app,
        `UPDATE activation_tokens SET ${assignment} WHERE id = $1`,
        [id],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });

  it.each([
    ['la date de création', `created_at = now() - interval '1 day'`],
    ['l’échéance', `expires_at = now() + interval '2 hours'`],
  ])(
    'le propriétaire des tables ne peut pas modifier %s (déclencheur)',
    async (_label, assignment) => {
      await inRolledBackTransaction(migrator, async () => {
        const id = await insertToken(migrator, await insertUser(migrator));
        await expectSqlError(
          migrator,
          `UPDATE activation_tokens SET ${assignment} WHERE id = $1`,
          [id],
          SQLSTATE.insufficientPrivilege,
          /seules la consommation et la révocation/,
        );
      });
    },
  );

  it.each(['consumed_at', 'revoked_at'])('fixe %s à l’heure de la base', async (column) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertToken(app, await insertUser(app));
      const { rows } = await app.query<{ forced: boolean }>(
        `UPDATE activation_tokens SET ${column} = '2000-01-01T00:00:00Z' WHERE id = $1
         RETURNING ${column} = now() AS forced`,
        [id],
      );
      expect(rows).toEqual([{ forced: true }]);
    });
  });
});

describe('activation_tokens : consommation et révocation définitives', () => {
  it.each([
    ['ressusciter un lien révoqué', 'revoked_at = now()', 'revoked_at = NULL'],
    ['ressusciter un lien consommé', 'consumed_at = now()', 'consumed_at = NULL'],
    [
      'changer la date de consommation',
      'consumed_at = now()',
      `consumed_at = now() + interval '1 minute'`,
    ],
  ])('refuse de %s', async (_label, first, second) => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertToken(app, await insertUser(app));
      await app.query(`UPDATE activation_tokens SET ${first} WHERE id = $1`, [id]);
      await expectSqlError(
        app,
        `UPDATE activation_tokens SET ${second} WHERE id = $1`,
        [id],
        SQLSTATE.insufficientPrivilege,
        /définitives/,
      );
    });
  });

  it('refuse de révoquer un lien déjà consommé', async () => {
    await inRolledBackTransaction(app, async () => {
      const id = await insertToken(app, await insertUser(app));
      await app.query('UPDATE activation_tokens SET consumed_at = now() WHERE id = $1', [id]);
      await expectSqlError(
        app,
        'UPDATE activation_tokens SET revoked_at = now() WHERE id = $1',
        [id],
        SQLSTATE.checkViolation,
        /activation_tokens_single_outcome_check/,
      );
    });
  });

  it('met issued_by_id à NULL quand l’admin émetteur est supprimé', async () => {
    await inRolledBackTransaction(app, async () => {
      const admin = await insertUser(app, { role: 'ADMIN' });
      const client = await insertUser(app);
      const id = await insertToken(app, client, admin);
      await app.query('DELETE FROM users WHERE id = $1', [admin]);
      const { rows } = await app.query<{ issued_by_id: string | null }>(
        'SELECT issued_by_id FROM activation_tokens WHERE id = $1',
        [id],
      );
      expect(rows).toEqual([{ issued_by_id: null }]);
    });
  });

  it('refuse de réattribuer un lien à un autre émetteur (propriétaire des tables)', async () => {
    await inRolledBackTransaction(migrator, async () => {
      const admin = await insertUser(migrator, { role: 'ADMIN' });
      const id = await insertToken(migrator, await insertUser(migrator));
      await expectSqlError(
        migrator,
        'UPDATE activation_tokens SET issued_by_id = $2 WHERE id = $1',
        [id, admin],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });
});

describe('un seul lien vivant par compte', () => {
  it('refuse un second lien vivant pour le même compte', async () => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      await insertToken(app, userId);
      await expectSqlError(
        app,
        `INSERT INTO activation_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'INVITATION', $2, now() + interval '1 hour')`,
        [userId, digest32()],
        SQLSTATE.uniqueViolation,
        /activation_tokens_one_live_per_user_key/,
      );
    });
  });

  it.each([
    ['révoqué (émission)', REVOKE_LIVE_TOKENS],
    ['consommé', 'UPDATE activation_tokens SET consumed_at = now() WHERE user_id = $1'],
  ])('accepte un nouveau lien une fois le précédent %s', async (_label, sql) => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      await insertToken(app, userId);
      await app.query(sql, [userId]);
      await insertToken(app, userId);
    });
  });

  it('ne concerne que le compte : deux comptes ont chacun leur lien', async () => {
    await inRolledBackTransaction(app, async () => {
      await insertToken(app, await insertUser(app));
      await insertToken(app, await insertUser(app));
    });
  });
});

describe('enrollment_codes', () => {
  const INSERT_CODE = `INSERT INTO enrollment_codes (user_id, code_hmac, expires_at, created_at)
    VALUES ($1, $2, now() + interval '30 minutes', $3) RETURNING id, created_at = now() AS forced`;

  it('ignore une date de création antidatée', async () => {
    await inRolledBackTransaction(app, async () => {
      const { rows } = await app.query<{ forced: boolean }>(INSERT_CODE, [
        await insertUser(app),
        digest32(),
        '2000-01-01T00:00:00Z',
      ]);
      expect(rows[0]?.forced).toBe(true);
    });
  });

  it('refuse une date de création post-datée', async () => {
    await inRolledBackTransaction(app, async () => {
      await expectSqlError(
        app,
        `INSERT INTO enrollment_codes (user_id, code_hmac, expires_at, created_at)
         VALUES ($1, $2, now() + interval '2 days', now() + interval '2 days' - interval '20 minutes')`,
        [await insertUser(app), digest32()],
        SQLSTATE.checkViolation,
        /enrollment_codes_lifetime_check/,
      );
    });
  });

  it.each([
    ['l’échéance', `expires_at = now() + interval '20 minutes'`],
    ['la date de création', `created_at = now() - interval '1 day'`],
    ['l’empreinte', `code_hmac = decode(repeat('ab', 32), 'hex')`],
  ])('le rôle de l’API ne peut pas modifier %s', async (_label, assignment) => {
    await inRolledBackTransaction(app, async () => {
      const { rows } = await app.query<{ id: string }>(INSERT_CODE, [
        await insertUser(app),
        digest32(),
        null,
      ]);
      await expectSqlError(
        app,
        `UPDATE enrollment_codes SET ${assignment} WHERE id = $1`,
        [rows[0]?.id],
        SQLSTATE.insufficientPrivilege,
      );
    });
  });

  it('le propriétaire des tables ne peut pas prolonger un code (déclencheur)', async () => {
    await inRolledBackTransaction(migrator, async () => {
      const { rows } = await migrator.query<{ id: string }>(INSERT_CODE, [
        await insertUser(migrator),
        digest32(),
        null,
      ]);
      await expectSqlError(
        migrator,
        // Échéance réellement repoussée : `now()` est figé dans la transaction, `now() + 30 min`
        // serait la valeur déjà enregistrée (mise à jour sans changement, donc sans refus).
        `UPDATE enrollment_codes SET expires_at = expires_at + interval '30 seconds' WHERE id = $1`,
        [rows[0]?.id],
        SQLSTATE.insufficientPrivilege,
        /seules la consommation et la révocation/,
      );
    });
  });

  it('refuse un second code vivant pour le même compte', async () => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      await app.query(INSERT_CODE, [userId, digest32(), null]);
      await expectSqlError(
        app,
        INSERT_CODE,
        [userId, digest32(), null],
        SQLSTATE.uniqueViolation,
        /enrollment_codes_one_live_per_user_key/,
      );
    });
  });

  it('accepte un nouveau code une fois le précédent révoqué', async () => {
    await inRolledBackTransaction(app, async () => {
      const userId = await insertUser(app);
      await app.query(INSERT_CODE, [userId, digest32(), null]);
      await app.query(
        `UPDATE enrollment_codes SET revoked_at = now()
          WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [userId],
      );
      await app.query(INSERT_CODE, [userId, digest32(), null]);
    });
  });
});
