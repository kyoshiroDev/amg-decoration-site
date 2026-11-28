// Contrôle d'accès (ADR-0023) : garde d'hôte (404 unique, avant toute authentification), garde de
// session (refus par défaut, audience liée à l'hôte, expirations, révocation, rotation), magasin
// indisponible (503), en-têtes de sécurité sur chaque refus, aucun en-tête Access-Control-*.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { errorResponseSchema } from '@amg/shared-schemas';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE_NAMES } from '../../src/access/session-cookies.js';
import { errorBody } from '../../src/http/error-bodies.js';
import { SECURITY_HEADERS } from '../../src/http/security-headers.js';
import { generateSessionToken } from '../../src/session/session-token.js';
import { SESSION_POLICIES } from '../../src/session/session.types.js';
import type { MemoryInfrastructure } from '../support/memory-infrastructure.js';
import {
  HOSTS,
  PREFIXES,
  accessControlHeaders,
  cookie,
  createSession,
  readHeaders,
  startSessionApp,
} from './support.js';

let app: NestFastifyApplication;
let infra: MemoryInfrastructure;

beforeEach(async () => {
  ({ app, infra } = await startSessionApp());
});

afterEach(async () => {
  await app.close();
});

function inject(options: InjectOptions): Promise<LightMyRequestResponse> {
  return app.inject(options);
}

/** Réponse comparable d'un test à l'autre : code, en-têtes et corps exacts. */
function snapshot(response: LightMyRequestResponse): unknown {
  return { status: response.statusCode, headers: response.headers, body: response.body };
}

describe('garde d’hôte : un seul 404, avant toute authentification', () => {
  it('route inconnue, route de l’autre audience et hôte inconnu : réponses identiques', async () => {
    const admin = await createSession(infra, 'ADMIN');
    const reference = await inject({
      method: 'GET',
      url: '/api/inconnue',
      headers: { host: HOSTS.ADMIN },
    });
    expect(reference.statusCode).toBe(404);
    expect(reference.json()).toEqual(errorBody(404));
    const variants: InjectOptions[] = [
      // Route admin sur l'hôte espace, avec ou sans cookie (aucune authentification tentée).
      { method: 'GET', url: '/api/admin/session', headers: { host: HOSTS.CLIENT } },
      {
        method: 'GET',
        url: '/api/admin/sessions',
        headers: { host: HOSTS.CLIENT, cookie: cookie(admin.token, 'ADMIN') },
      },
      { method: 'POST', url: '/api/admin/session/logout', headers: { host: HOSTS.CLIENT } },
      // Route client sur l'hôte admin.
      { method: 'GET', url: '/api/client/session', headers: { host: HOSTS.ADMIN } },
      // Hôte inconnu, absent ou forgé par X-Forwarded-Host.
      { method: 'GET', url: '/api/admin/session', headers: { host: 'evil.example' } },
      {
        method: 'GET',
        url: '/api/admin/session',
        headers: { host: 'evil.example', 'x-forwarded-host': HOSTS.ADMIN },
      },
      { method: 'GET', url: '/api/client/session', headers: { host: `${HOSTS.CLIENT}:443` } },
      { method: 'GET', url: '/api/inconnue', headers: { host: HOSTS.CLIENT } },
      {
        method: 'DELETE',
        url: '/api/admin/sessions/AAAAAAAAAAAAAAAAAAAAAA',
        headers: { host: 'x' },
      },
    ];
    for (const variant of variants) {
      expect(snapshot(await inject(variant)), JSON.stringify(variant)).toEqual(snapshot(reference));
    }
  });

  it.each([
    ['text/xml', { 'content-type': 'text/xml' }, '<a/>'],
    ['JSON invalide', { 'content-type': 'application/json' }, '{"a":'],
    [
      'JSON de plus de 64 Kio',
      { 'content-type': 'application/json' },
      JSON.stringify({ d: 'x'.repeat(70 * 1024) }),
    ],
    ['JSON avec __proto__', { 'content-type': 'application/json' }, '{"__proto__":{"a":1}}'],
  ] as const)(
    'corps %s : même 404 qu’une route inconnue, avant toute analyse du corps',
    async (_label, bodyHeaders, payload) => {
      const reference = await inject({
        method: 'POST',
        url: '/api/admin/zzz',
        headers: { host: HOSTS.ADMIN, ...bodyHeaders },
        payload,
      });
      expect(reference.statusCode).toBe(404);
      expect(reference.json()).toEqual(errorBody(404));
      const variants: InjectOptions[] = [
        // Routes existantes de l'autre audience (415, 400 ou 413 si le corps était analysé).
        { method: 'POST', url: '/api/admin/session/logout', headers: { host: HOSTS.CLIENT } },
        { method: 'POST', url: '/api/client/session/logout', headers: { host: HOSTS.ADMIN } },
        {
          method: 'DELETE',
          url: '/api/client/sessions/AAAAAAAAAAAAAAAAAAAAAA',
          headers: { host: HOSTS.ADMIN },
        },
        // Hôte inconnu, sur une route existante et sur une route inconnue.
        { method: 'POST', url: '/api/admin/session/logout', headers: { host: 'evil.example' } },
        { method: 'POST', url: '/api/inconnue', headers: { host: 'evil.example' } },
        // Route inconnue sur l'hôte de l'autre audience.
        { method: 'POST', url: '/api/client/zzz', headers: { host: HOSTS.ADMIN } },
      ];
      for (const variant of variants) {
        const response = await inject({
          ...variant,
          headers: { ...variant.headers, ...bodyHeaders },
          payload,
        });
        expect(snapshot(response), JSON.stringify(variant)).toEqual(snapshot(reference));
      }
    },
  );

  it('sur le bon hôte, la même route analyse bien le corps (415) : le refus précédent vient de l’hôte', async () => {
    const response = await inject({
      method: 'POST',
      url: '/api/admin/session/logout',
      headers: { host: HOSTS.ADMIN, 'content-type': 'text/xml' },
      payload: '<a/>',
    });
    expect(response.statusCode).toBe(415);
  });

  it('le 404 ne recopie jamais le chemin', async () => {
    const response = await inject({
      method: 'GET',
      url: '/api/admin/chemin-secret-a-sonder',
      headers: { host: HOSTS.CLIENT },
    });
    expect(response.body).not.toContain('chemin-secret');
    expect(response.body).not.toContain('/api');
  });

  it('accepte l’hôte sans tenir compte de la casse', async () => {
    const { token } = await createSession(infra, 'ADMIN');
    const response = await inject({
      method: 'GET',
      url: '/api/admin/session',
      headers: { host: HOSTS.ADMIN.toUpperCase(), cookie: cookie(token, 'ADMIN') },
    });
    expect(response.statusCode).toBe(200);
  });

  it('sert la sonde de santé quel que soit l’hôte (sonde locale du conteneur)', async () => {
    for (const host of ['127.0.0.1:3000', HOSTS.ADMIN, HOSTS.CLIENT]) {
      const response = await inject({ method: 'GET', url: '/api/health', headers: { host } });
      expect(response.statusCode).toBe(200);
    }
  });
});

describe.each(['ADMIN', 'CLIENT'] as const)('garde de session : audience %s', (audience) => {
  const other = audience === 'ADMIN' ? 'CLIENT' : 'ADMIN';
  const url = `${PREFIXES[audience]}/session`;

  async function expectUnauthorized(headers: Record<string, string>): Promise<void> {
    const response = await inject({
      method: 'GET',
      url,
      headers: { host: HOSTS[audience], ...headers },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(errorBody(401));
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
    expect(accessControlHeaders(response)).toEqual([]);
  }

  it('refuse toute route sans session (refus par défaut)', async () => {
    await expectUnauthorized({});
    for (const path of ['/sessions']) {
      const response = await inject({
        method: 'GET',
        url: `${PREFIXES[audience]}${path}`,
        headers: { host: HOSTS[audience] },
      });
      expect(response.statusCode).toBe(401);
    }
  });

  it.each([
    ['vide', ''],
    ['mal formé', 'abc'],
    ['trop long', 'A'.repeat(200)],
    ['inconnu', generateSessionToken()],
  ])('refuse un cookie %s avec le même 401', async (_label, value) => {
    await expectUnauthorized({ cookie: `${SESSION_COOKIE_NAMES[audience]}=${value}` });
  });

  it(`refuse un jeton ${other} présenté dans le cookie ${audience}, et le journalise une fois`, async () => {
    const foreign = await createSession(infra, other);
    await expectUnauthorized({ cookie: cookie(foreign.token, audience) });
    await expectUnauthorized({ cookie: cookie(foreign.token, audience) });
    const denied = infra.journalEvents.events.filter((event) => event.type === 'ACCESS_DENIED');
    expect(denied).toEqual([
      {
        type: 'ACCESS_DENIED',
        userId: foreign.record.userId,
        actorId: null,
        ip: '127.0.0.1',
        device: null,
        details: { audience, reason: 'audience' },
      },
    ]);
    // La session étrangère reste intacte sur son propre hôte.
    const own = await inject({
      method: 'GET',
      url: `${PREFIXES[other]}/session`,
      headers: readHeaders(other, foreign.token),
    });
    expect(own.statusCode).toBe(200);
  });

  it(`ignore le cookie ${other} présenté à l’hôte ${audience}`, async () => {
    const foreign = await createSession(infra, other);
    await expectUnauthorized({ cookie: cookie(foreign.token, other) });
  });

  it('accepte une session valide de l’audience de l’hôte', async () => {
    const { token } = await createSession(infra, audience);
    const response = await inject({ method: 'GET', url, headers: readHeaders(audience, token) });
    expect(response.statusCode).toBe(200);
  });

  it('refuse une session expirée par inactivité', async () => {
    const { token } = await createSession(infra, audience);
    infra.clock.advance(SESSION_POLICIES[audience].idleTimeoutMs);
    await expectUnauthorized({ cookie: cookie(token, audience) });
  });

  it('refuse une session expirée par durée absolue, même active', async () => {
    const { token, record } = await createSession(infra, audience);
    const step = SESSION_POLICIES[audience].idleTimeoutMs - 60_000;
    while (infra.clock.now() + step < record.absoluteExpiresAt) {
      infra.clock.advance(step);
      const response = await inject({ method: 'GET', url, headers: readHeaders(audience, token) });
      expect(response.statusCode).toBe(200);
    }
    infra.clock.advance(record.absoluteExpiresAt - infra.clock.now());
    await expectUnauthorized({ cookie: cookie(token, audience) });
  });

  it('refuse une session révoquée', async () => {
    const { token } = await createSession(infra, audience);
    await infra.store.revoke(token, audience);
    await expectUnauthorized({ cookie: cookie(token, audience) });
  });

  it('rotation : l’ancien jeton ne sert plus, le nouveau oui', async () => {
    const { token } = await createSession(infra, audience);
    const rotated = await infra.store.rotate(token, audience);
    if (rotated === null) throw new Error('rotation attendue');
    await expectUnauthorized({ cookie: cookie(token, audience) });
    const response = await inject({
      method: 'GET',
      url,
      headers: readHeaders(audience, rotated.token),
    });
    expect(response.statusCode).toBe(200);
  });

  it('limite de sessions simultanées : la plus ancienne ne sert plus', async () => {
    const userId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    const first = await createSession(infra, audience, userId);
    for (let i = 0; i < SESSION_POLICIES[audience].maxSessions; i += 1) {
      infra.clock.advance(1_000);
      await createSession(infra, audience, userId);
    }
    await expectUnauthorized({ cookie: cookie(first.token, audience) });
  });

  it('magasin indisponible : 503 générique, jamais d’accès accordé', async () => {
    const { token } = await createSession(infra, audience);
    infra.store.unavailable = true;
    const response = await inject({ method: 'GET', url, headers: readHeaders(audience, token) });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual(errorBody(503));
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
    expect(accessControlHeaders(response)).toEqual([]);
    expect(response.body).not.toMatch(/redis|magasin/i);
  });
});

describe('corps d’erreur', () => {
  it.each([400, 401, 403, 404, 429, 503])(
    '%i : corps générique conforme au schéma partagé',
    (status) => {
      expect(errorResponseSchema.parse(errorBody(status))).toEqual(errorBody(status));
    },
  );
});
