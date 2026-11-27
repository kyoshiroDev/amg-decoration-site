// Limitation de débit et proxy de confiance (ADR-0023) : limite globale par IP, aussi sur les 404
// (aucun oracle), 429 générique avec Retry-After et sans en-tête X-RateLimit-*, sonde de santé
// exemptée ; IP retenue : socket, ou dernière entrée de X-Forwarded-For si la socket est le proxy
// de confiance ; un X-Forwarded-For forgé hors du proxy est ignoré.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { InjectOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { errorBody } from '../../src/http/error-bodies.js';
import { GLOBAL_RATE_LIMIT, accountHash, rateLimitKeys } from '../../src/http/rate-limit.js';
import { SECURITY_HEADERS } from '../../src/http/security-headers.js';
import type { MemoryInfrastructure } from '../support/memory-infrastructure.js';
import { TEST_ENV, loadTestConfig } from '../support/test-config.js';
import {
  HOSTS,
  PREFIXES,
  accessControlHeaders,
  createSession,
  startSessionApp,
  writeHeaders,
} from './support.js';

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(trustedProxy?: string): Promise<MemoryInfrastructure> {
  const config = loadTestConfig(
    trustedProxy === undefined ? TEST_ENV : { ...TEST_ENV, TRUSTED_PROXY: trustedProxy },
  );
  const started = await startSessionApp(config);
  app = started.app;
  return started.infra;
}

/** Consomme le reste de la limite (`already` requêtes déjà faites depuis cette IP). */
async function exhaust(options: InjectOptions, already = 0): Promise<void> {
  for (let i = already; i < GLOBAL_RATE_LIMIT.max; i += 1) {
    const response = await app?.inject(options);
    expect(response?.statusCode).not.toBe(429);
  }
}

describe('limite globale par IP', () => {
  it('au-delà de la limite : 429 générique, Retry-After, aucun compteur exposé', async () => {
    await start();
    const options: InjectOptions = {
      method: 'GET',
      url: '/api/admin/session',
      headers: { host: HOSTS.ADMIN },
    };
    const first = await app?.inject(options);
    expect(
      Object.keys(first?.headers ?? {}).filter((name) => name.startsWith('x-ratelimit')),
    ).toEqual([]);
    await exhaust(options, 1);
    const limited = await app?.inject(options);
    expect(limited?.statusCode).toBe(429);
    expect(limited?.json()).toEqual(errorBody(429));
    expect(Number(limited?.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited?.headers).toMatchObject(SECURITY_HEADERS);
    expect(
      Object.keys(limited?.headers ?? {}).filter((name) => name.startsWith('x-ratelimit')),
    ).toEqual([]);
    expect(limited === undefined ? [] : accessControlHeaders(limited)).toEqual([]);
  });

  it('compte aussi les routes inconnues et celles de l’autre audience (aucun oracle)', async () => {
    await start();
    await exhaust({ method: 'GET', url: '/api/inconnue', headers: { host: HOSTS.ADMIN } });
    for (const options of [
      { method: 'GET', url: '/api/inconnue', headers: { host: HOSTS.ADMIN } },
      { method: 'GET', url: '/api/admin/session', headers: { host: HOSTS.CLIENT } },
    ] as const) {
      expect((await app?.inject(options))?.statusCode).toBe(429);
    }
  });

  it('exempte la sonde de santé', async () => {
    await start();
    await exhaust({ method: 'GET', url: '/api/inconnue', headers: { host: HOSTS.ADMIN } });
    const health = await app?.inject({ method: 'GET', url: '/api/health' });
    expect(health?.statusCode).toBe(200);
  });

  it('compte chaque IP à part', async () => {
    await start();
    const options = {
      method: 'GET',
      url: '/api/inconnue',
      headers: { host: HOSTS.ADMIN },
    } as const;
    await exhaust({ ...options, remoteAddress: '198.51.100.1' });
    expect((await app?.inject({ ...options, remoteAddress: '198.51.100.1' }))?.statusCode).toBe(
      429,
    );
    expect((await app?.inject({ ...options, remoteAddress: '198.51.100.2' }))?.statusCode).toBe(
      404,
    );
  });
});

describe('proxy de confiance (X-Forwarded-For)', () => {
  const PROXY = '172.30.0.0/24';

  it('sans proxy configuré, un X-Forwarded-For est ignoré', async () => {
    await start();
    const options = {
      method: 'GET',
      url: '/api/inconnue',
      headers: { host: HOSTS.ADMIN },
    } as const;
    for (let i = 0; i < GLOBAL_RATE_LIMIT.max; i += 1) {
      await app?.inject({
        ...options,
        remoteAddress: '198.51.100.7',
        headers: { ...options.headers, 'x-forwarded-for': `203.0.113.${String(i % 250)}` },
      });
    }
    expect((await app?.inject({ ...options, remoteAddress: '198.51.100.7' }))?.statusCode).toBe(
      429,
    );
  });

  it('un X-Forwarded-For forgé par un client hors du proxy est ignoré (journal et limite)', async () => {
    const infra = await start(PROXY);
    const { token } = await createSession(infra, 'ADMIN');
    const response = await app?.inject({
      method: 'POST',
      url: `${PREFIXES.ADMIN}/session/logout`,
      remoteAddress: '198.51.100.7',
      headers: { ...writeHeaders('ADMIN', token), 'x-forwarded-for': '203.0.113.200' },
    });
    expect(response?.statusCode).toBe(204);
    expect(infra.journalEvents.events.map((event) => event.ip)).toEqual(['198.51.100.7']);
  });

  it('derrière le proxy : seule la dernière entrée (ajoutée par Traefik) est retenue', async () => {
    const infra = await start(PROXY);
    const { token } = await createSession(infra, 'ADMIN');
    const response = await app?.inject({
      method: 'POST',
      url: `${PREFIXES.ADMIN}/session/logout`,
      remoteAddress: '172.30.0.2',
      headers: {
        ...writeHeaders('ADMIN', token),
        // Entrées forgées par le client, puis celle de Traefik (adresse réelle du client).
        'x-forwarded-for': '10.0.0.1, 172.30.0.3, 203.0.113.9',
      },
    });
    expect(response?.statusCode).toBe(204);
    expect(infra.journalEvents.events.map((event) => event.ip)).toEqual(['203.0.113.9']);
  });

  it('derrière le proxy : la limite compte l’IP du client, pas celle de Traefik', async () => {
    await start(PROXY);
    const options = {
      method: 'GET',
      url: '/api/inconnue',
      remoteAddress: '172.30.0.2',
      headers: { host: HOSTS.ADMIN, 'x-forwarded-for': '203.0.113.9' },
    } as const;
    await exhaust(options);
    expect((await app?.inject(options))?.statusCode).toBe(429);
    const otherClient = await app?.inject({
      ...options,
      headers: { ...options.headers, 'x-forwarded-for': '203.0.113.10' },
    });
    expect(otherClient?.statusCode).toBe(404);
  });

  it('l’hôte servi ne vient jamais de X-Forwarded-Host, même derrière le proxy', async () => {
    await start(PROXY);
    const response = await app?.inject({
      method: 'GET',
      url: '/api/admin/session',
      remoteAddress: '172.30.0.2',
      headers: { host: HOSTS.CLIENT, 'x-forwarded-host': HOSTS.ADMIN },
    });
    expect(response?.statusCode).toBe(404);
  });
});

describe('clés des limiteurs du lot 4', () => {
  it('hachent l’email normalisé : aucune adresse dans Redis', () => {
    expect(accountHash('  Amandine@Example.TEST ')).toBe(accountHash('amandine@example.test'));
    expect(rateLimitKeys.account('amandine@example.test')).toMatch(/^account:[0-9a-f]{64}$/);
    expect(rateLimitKeys.account('amandine@example.test')).not.toContain('amandine');
  });
});
