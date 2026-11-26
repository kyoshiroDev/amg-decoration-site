// Consommation atomique d'un lien d'activation (ADR-0023) : un seul UPDATE conditionnel, dont la
// condition est réévaluée par PostgreSQL après le verrou de ligne. Deux requêtes simultanées avec le
// même jeton : une seule réussit. C'est le motif que le service d'activation (lot 4) devra employer.
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { APP_ROLE, connectAs, digest32, insertUser } from './test-database.js';

/** Consommation : non consommé, non révoqué, non expiré ; renvoie le compte et l'usage. */
const CONSUME = `UPDATE activation_tokens SET consumed_at = now()
  WHERE token_hash = $1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING user_id, purpose`;

let first: pg.Client;
let second: pg.Client;
const createdUsers: string[] = [];

beforeAll(async () => {
  first = await connectAs(APP_ROLE);
  second = await connectAs(APP_ROLE);
});

afterEach(async () => {
  // Données validées (nécessaires à la concurrence entre connexions) : supprimées après chaque test.
  await first.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUsers.splice(0)]);
});

afterAll(async () => {
  await first.end();
  await second.end();
});

async function committedToken(lifetime = '72 hours', revoked = false): Promise<Buffer> {
  const userId = await insertUser(first);
  createdUsers.push(userId);
  const hash = digest32();
  await first.query(
    `INSERT INTO activation_tokens (user_id, purpose, token_hash, expires_at, revoked_at)
     VALUES ($1, 'PASSWORD_RESET', $2, now() + $3::interval, $4)`,
    [userId, hash, lifetime, revoked ? new Date() : null],
  );
  return hash;
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
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect((await first.query(CONSUME, [hash])).rowCount).toBe(0);
  });

  it('refuse un jeton inconnu', async () => {
    await committedToken();
    expect((await first.query(CONSUME, [digest32()])).rowCount).toBe(0);
  });
});
