// L'API complète sur Redis et PostgreSQL réels (job CI « API (intégration) ») : sessions dans Redis,
// déconnexion écrite au journal par le pool `amg_journal`, limitation de débit dans Redis, refus
// (503) quand Redis manque ou refuse l'authentification, sonde de santé indépendante de Redis.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PrismaClient } from '@amg/api-db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorBody } from '../../src/http/error-bodies.js';
import { GLOBAL_RATE_LIMIT } from '../../src/http/rate-limit.js';
import { SECURITY_HEADERS } from '../../src/http/security-headers.js';
import { JOURNAL_WRITER, SESSION_STORE } from '../../src/infrastructure/tokens.js';
import type { SessionStore } from '../../src/session/session.types.js';
import { createTestApp } from '../http/app.js';
import { HOSTS, PREFIXES, readHeaders, writeHeaders } from '../http/support.js';
import { integrationConfig } from '../support/integration-env.js';

describe('API sur Redis et PostgreSQL réels', () => {
  let app: NestFastifyApplication;
  let store: SessionStore;

  beforeAll(async () => {
    app = await createTestApp(undefined, integrationConfig(), 'real');
    store = app.get<SessionStore>(SESSION_STORE);
    // Connexion lancée en arrière-plan au démarrage : attendre qu'elle serve.
    for (let i = 0; i < 50; i += 1) {
      const probe = await app.inject({
        method: 'GET',
        url: '/api/inconnue',
        headers: { host: HOSTS.ADMIN },
      });
      if (probe.statusCode === 404) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['ADMIN', 'CLIENT'] as const)(
    'session %s : lecture, puis déconnexion journalisée par le pool du journal',
    async (audience) => {
      const userId = randomUUID();
      const { token } = await store.create({
        userId,
        audience,
        stage: 'AUTHENTICATED',
        device: null,
        network: null,
      });
      const current = await app.inject({
        method: 'GET',
        url: `${PREFIXES[audience]}/session`,
        headers: readHeaders(audience, token),
      });
      expect(current.statusCode).toBe(200);
      const logout = await app.inject({
        method: 'POST',
        url: `${PREFIXES[audience]}/session/logout`,
        remoteAddress: '198.51.100.23',
        headers: writeHeaders(audience, token),
      });
      expect(logout.statusCode).toBe(204);
      const replay = await app.inject({
        method: 'GET',
        url: `${PREFIXES[audience]}/session`,
        headers: readHeaders(audience, token),
      });
      expect(replay.statusCode).toBe(401);
      const journal = app.get<PrismaClient>(JOURNAL_WRITER);
      const events = await journal.securityEvent.findMany({ where: { userId } });
      expect(events.map((event) => [event.type, event.ip, event.details])).toEqual([
        ['LOGOUT', '198.51.100.23', { audience }],
      ]);
    },
  );

  it('cookie client sur l’hôte admin : refusé et journalisé', async () => {
    const userId = randomUUID();
    const { token } = await store.create({
      userId,
      audience: 'CLIENT',
      stage: 'AUTHENTICATED',
      device: null,
      network: null,
    });
    const response = await app.inject({
      method: 'GET',
      url: `${PREFIXES.ADMIN}/session`,
      headers: readHeaders('ADMIN', token),
    });
    expect(response.statusCode).toBe(401);
    const journal = app.get<PrismaClient>(JOURNAL_WRITER);
    const events = await journal.securityEvent.findMany({ where: { userId } });
    expect(events.map((event) => event.type)).toEqual(['ACCESS_DENIED']);
  });

  it('limite de débit dans Redis : 429 au-delà de la limite', async () => {
    const options = {
      method: 'GET',
      url: '/api/inconnue',
      remoteAddress: '198.51.100.99',
      headers: { host: HOSTS.ADMIN },
    } as const;
    for (let i = 0; i < GLOBAL_RATE_LIMIT.max; i += 1) {
      expect((await app.inject(options)).statusCode).toBe(404);
    }
    const limited = await app.inject(options);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual(errorBody(429));
  });
});

describe.each([
  ['injoignable', { REDIS_PORT: '1' }],
  [
    'qui refuse le mot de passe',
    { REDIS_PASSWORD: 'mauvais-mot-de-passe-redis-de-test-0123456789' },
  ],
] as const)('Redis %s : refus, jamais d’accès accordé', (_label, overrides) => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp(undefined, integrationConfig(overrides), 'real');
  });

  afterAll(async () => {
    await app.close();
  });

  it('routes limitées et protégées : 503 générique, en-têtes de sécurité', async () => {
    for (const options of [
      {
        method: 'GET',
        url: `${PREFIXES.ADMIN}/session`,
        headers: { host: HOSTS.ADMIN, cookie: `__Host-amg_admin_sid=${'A'.repeat(43)}` },
      },
      { method: 'GET', url: '/api/inconnue', headers: { host: HOSTS.CLIENT } },
      { method: 'POST', url: `${PREFIXES.CLIENT}/session/logout`, headers: { host: HOSTS.CLIENT } },
    ] as const) {
      const response = await app.inject(options);
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual(errorBody(503));
      expect(response.headers).toMatchObject(SECURITY_HEADERS);
    }
  });

  it('la sonde de santé répond toujours (vivacité seulement)', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
  });
});
