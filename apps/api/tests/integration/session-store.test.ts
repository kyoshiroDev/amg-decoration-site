// Magasin de sessions Redis et ses scripts Lua contre un vrai Redis (même digest que la production),
// sous l'utilisateur ACL de l'API (commandes et préfixe de clés limités) : même contrat que le
// magasin en mémoire des tests HTTP, plus ce que seul Redis montre (empreinte comme clé, expiration
// Redis posée, ACL).
import { randomBytes, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRedisClient } from '../../src/redis/redis-client.js';
import { RedisSessionStore } from '../../src/session/redis-session-store.js';
import { sessionTokenHash } from '../../src/session/session-token.js';
import { SESSION_POLICIES, SessionStoreUnavailableError } from '../../src/session/session.types.js';
import { integrationConfig } from '../support/integration-env.js';
import { TestClock } from '../support/memory-infrastructure.js';
import { describeSessionStoreContract } from '../support/session-store-contract.js';

let redis: Redis;
const errors: Error[] = [];

beforeAll(async () => {
  redis = createRedisClient(integrationConfig(), (error) => errors.push(error));
  await redis.connect();
});

afterAll(() => {
  redis.disconnect(false);
});

/** Préfixe propre à chaque magasin du test, sous le préfixe autorisé par l'ACL (`amg:test:`). */
function isolatedPrefix(): string {
  return `amg:test:it-${randomBytes(6).toString('hex')}:`;
}

describeSessionStoreContract('Redis (scripts Lua)', () => {
  // Horloge réelle au départ : les expirations Redis (PEXPIREAT) restent dans le futur.
  const clock = new TestClock(Date.now());
  return Promise.resolve({
    store: new RedisSessionStore({ redis, keyPrefix: isolatedPrefix(), now: clock.now }),
    clock,
    cleanup: () => Promise.resolve(),
  });
});

describe('stockage dans Redis', () => {
  it('la clé est l’empreinte du jeton ; ni le jeton ni un dérivé en clair dans les champs', async () => {
    const prefix = isolatedPrefix();
    const store = new RedisSessionStore({ redis, keyPrefix: prefix });
    const { token } = await store.create({
      userId: randomUUID(),
      audience: 'CLIENT',
      stage: 'AUTHENTICATED',
      device: null,
      network: null,
    });
    expect(await redis.exists(`${prefix}sess:${token}`)).toBe(0);
    const key = `${prefix}sess:${sessionTokenHash(token)}`;
    expect(await redis.exists(key)).toBe(1);
    const fields = await redis.hmget(
      key,
      'v',
      'pid',
      'uid',
      'aud',
      'stg',
      'ca',
      'ls',
      'ae',
      'it',
      'aa',
      'dev',
      'net',
    );
    expect(fields.join('|')).not.toContain(token);
    // Expiration Redis posée à l'échéance d'inactivité (ramasse-miettes).
    const ttl = await redis.pttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(SESSION_POLICIES.CLIENT.idleTimeoutMs);
  });

  it('l’utilisateur ACL de l’API n’atteint aucune clé hors de son préfixe ni aucune commande d’administration', async () => {
    await expect(redis.set('autre-projet:cle', '1')).rejects.toThrow(/NOPERM/);
    await expect(redis.get('amg:prod:sess:x')).rejects.toThrow(/NOPERM/);
    await expect(redis.keys('amg:test:*')).rejects.toThrow(/NOPERM/);
    await expect(redis.call('FLUSHALL')).rejects.toThrow(/NOPERM/);
    await expect(redis.call('CONFIG', 'GET', 'requirepass')).rejects.toThrow(/NOPERM/);
    // Un script ne contourne pas l'ACL : une clé hors préfixe y est refusée aussi.
    await expect(redis.eval("return redis.call('GET', 'autre-projet:cle')", 0)).rejects.toThrow(
      /NOPERM|permission/i,
    );
  });

  it('Redis injoignable : le magasin lève l’erreur d’indisponibilité, sans attendre', async () => {
    const down = createRedisClient(integrationConfig({ REDIS_PORT: '1' }), () => undefined);
    down.connect().catch(() => undefined);
    const store = new RedisSessionStore({ redis: down, keyPrefix: isolatedPrefix() });
    try {
      const started = Date.now();
      await expect(store.validate('A'.repeat(43), 'ADMIN')).rejects.toBeInstanceOf(
        SessionStoreUnavailableError,
      );
      expect(Date.now() - started).toBeLessThan(3_000);
    } finally {
      down.disconnect(false);
    }
  });

  it('aucune erreur de connexion pendant la suite', () => {
    expect(errors).toEqual([]);
  });
});
