// Consommation atomique d'un lien d'activation (ADR-0023) : un seul UPDATE conditionnel, dont la
// condition est réévaluée par PostgreSQL après le verrou de ligne. Deux requêtes simultanées avec le
// même jeton : une seule réussit. Émission : révocation de tous les liens non consommés du compte
// (expirés compris), puis insertion ; deux émissions simultanées : une seule réussit. Ce sont les
// motifs que le service d'activation (lot 4) devra employer.
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { APP_ROLE, SQLSTATE, connectAs, digest32, insertUser } from './test-database.js';

/**
 * Consommation : non consommé, non révoqué, non expiré ; renvoie le compte et l'usage. Échéance
 * comparée à l'heure de l'instruction (`statement_timestamp()`), pas au début de la transaction
 * (`now()`), comme le fait le déclencheur.
 */
const CONSUME = `UPDATE public.activation_tokens SET consumed_at = now()
  WHERE token_hash = $1 AND consumed_at IS NULL AND revoked_at IS NULL
    AND expires_at > statement_timestamp()
  RETURNING user_id, purpose`;

let first: pg.Client;
let second: pg.Client;
/** Hors des transactions des tests : pg_stat_activity est figé pour la durée d'une transaction. */
let observer: pg.Client;
const createdUsers: string[] = [];

beforeAll(async () => {
  first = await connectAs(APP_ROLE);
  second = await connectAs(APP_ROLE);
  observer = await connectAs(APP_ROLE);
});

afterEach(async () => {
  // Données validées (nécessaires à la concurrence entre connexions) : supprimées après chaque test.
  await first.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [
    createdUsers.splice(0),
  ]);
});

afterAll(async () => {
  await first.end();
  await second.end();
  await observer.end();
});

/** Révocation des liens non consommés du compte, expirés compris (première étape de l'émission). */
const REVOKE_LIVE_TOKENS = `UPDATE public.activation_tokens SET revoked_at = now()
  WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`;

const INSERT_TOKEN = `INSERT INTO public.activation_tokens (user_id, purpose, token_hash, expires_at)
  VALUES ($1, 'PASSWORD_RESET', $2, now() + $3::interval)`;

async function committedUser(): Promise<string> {
  const userId = await insertUser(first);
  createdUsers.push(userId);
  return userId;
}

async function committedToken(
  lifetime = '72 hours',
  revoked = false,
  userId?: string,
): Promise<Buffer> {
  const owner = userId ?? (await committedUser());
  const hash = digest32();
  await first.query(INSERT_TOKEN, [owner, hash, lifetime]);
  if (revoked) await first.query(REVOKE_LIVE_TOKENS, [owner]);
  return hash;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function backendPid(client: pg.Client): Promise<number> {
  const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  const row = rows[0];
  if (row === undefined) throw new Error('pid de la connexion introuvable');
  return row.pid;
}

/** Attend (5 s au plus) que la connexion `pid` soit bloquée sur un verrou ; observée par `observer`. */
async function waitUntilWaitingForLock(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await observer.query<{ waiting: boolean }>(
      `SELECT wait_event_type = 'Lock' AS waiting FROM pg_catalog.pg_stat_activity WHERE pid = $1`,
      [pid],
    );
    if (rows[0]?.waiting === true) return;
    await sleep(50);
  }
  throw new Error('la seconde transaction n’a jamais attendu de verrou');
}

/** Code SQLSTATE d'un rejet, pour les requêtes lancées hors de `expectSqlError`. */
async function rejectionCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error: unknown) {
    return error instanceof pg.DatabaseError ? error.code : 'erreur inattendue';
  }
}

describe('consommation d’un lien d’activation', () => {
  it('ne réussit qu’une fois, même pour deux requêtes simultanées', async () => {
    const hash = await committedToken();
    const results = await Promise.all([
      first.query(CONSUME, [hash]),
      second.query(CONSUME, [hash]),
    ]);
    expect(results.map((result) => result.rowCount).sort()).toEqual([0, 1]);
  });

  it('la seconde transaction attend la première puis ne trouve plus rien', async () => {
    const hash = await committedToken();
    await first.query('BEGIN');
    const consumed = await first.query(CONSUME, [hash]);
    expect(consumed.rowCount).toBe(1);
    const concurrent = second.query(CONSUME, [hash]);
    await first.query('COMMIT');
    expect((await concurrent).rowCount).toBe(0);
  });

  it('redevient consommable si la première transaction est annulée', async () => {
    const hash = await committedToken();
    await first.query('BEGIN');
    await first.query(CONSUME, [hash]);
    const concurrent = second.query(CONSUME, [hash]);
    await first.query('ROLLBACK');
    expect((await concurrent).rowCount).toBe(1);
  });

  it('refuse un lien révoqué', async () => {
    const hash = await committedToken('72 hours', true);
    expect((await first.query(CONSUME, [hash])).rowCount).toBe(0);
  });

  it('refuse un lien expiré', async () => {
    const hash = await committedToken('1 second');
    await sleep(1_200);
    expect((await first.query(CONSUME, [hash])).rowCount).toBe(0);
  });

  it('la base refuse elle-même de consommer un lien expiré, même sans condition d’échéance', async () => {
    const hash = await committedToken('1 second');
    await sleep(1_200);
    expect(
      await rejectionCode(
        first.query(
          'UPDATE public.activation_tokens SET consumed_at = now() WHERE token_hash = $1',
          [hash],
        ),
      ),
    ).toBe(SQLSTATE.checkViolation);
  });

  it('refuse un lien expiré depuis le début de la transaction', async () => {
    const hash = await committedToken('1 second');
    await first.query('BEGIN');
    try {
      // now() est figé au début de la transaction, avant l'échéance ; pas statement_timestamp().
      await first.query('SELECT now()');
      await sleep(1_200);
      expect((await first.query(CONSUME, [hash])).rowCount).toBe(0);
      expect(
        await rejectionCode(
          first.query(
            'UPDATE public.activation_tokens SET consumed_at = now() WHERE token_hash = $1',
            [hash],
          ),
        ),
      ).toBe(SQLSTATE.checkViolation);
    } finally {
      await first.query('ROLLBACK');
    }
  });

  it('refuse un jeton inconnu', async () => {
    await committedToken();
    expect((await first.query(CONSUME, [digest32()])).rowCount).toBe(0);
  });
});

describe('émission d’un lien', () => {
  it('un lien expiré mais non révoqué empêche l’émission tant qu’il n’est pas révoqué', async () => {
    const userId = await committedUser();
    await committedToken('1 second', false, userId);
    await sleep(1_200);
    expect(await rejectionCode(first.query(INSERT_TOKEN, [userId, digest32(), '72 hours']))).toBe(
      SQLSTATE.uniqueViolation,
    );
    const revoked = await first.query(REVOKE_LIVE_TOKENS, [userId]);
    expect(revoked.rowCount).toBe(1);
    await first.query(INSERT_TOKEN, [userId, digest32(), '72 hours']);
  });

  it('deux émissions simultanées pour le même compte : une seule réussit', async () => {
    const userId = await committedUser();
    await committedToken('72 hours', false, userId);
    const secondPid = await backendPid(second);
    await first.query('BEGIN');
    await first.query(REVOKE_LIVE_TOKENS, [userId]);
    await first.query(INSERT_TOKEN, [userId, digest32(), '72 hours']);
    await second.query('BEGIN');
    // La seconde émission bloque sur le lien que la première vient de révoquer…
    const concurrent = (async (): Promise<void> => {
      try {
        await second.query(REVOKE_LIVE_TOKENS, [userId]);
        await second.query(INSERT_TOKEN, [userId, digest32(), '72 hours']);
        await second.query('COMMIT');
      } catch (error: unknown) {
        await second.query('ROLLBACK');
        throw error;
      }
    })();
    await waitUntilWaitingForLock(secondPid);
    await first.query('COMMIT');
    // … puis ne voit pas le nouveau lien (instantané de sa requête) et se heurte à l'index unique.
    expect(await rejectionCode(concurrent)).toBe(SQLSTATE.uniqueViolation);
    const { rows } = await first.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.activation_tokens
        WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
      [userId],
    );
    expect(rows).toEqual([{ n: '1' }]);
  });
});
