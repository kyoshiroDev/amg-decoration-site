// Routes de session des deux audiences (ADR-0023) : session courante et jeton CSRF, liste (sans IP
// côté client), fermeture d'une session (les siennes seulement : accès croisé sans effet),
// déconnexion (révocation côté serveur, cookie effacé, journal), paramètres validés.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  adminSessionListResponseSchema,
  clientSessionListResponseSchema,
  currentSessionResponseSchema,
} from '@amg/shared-schemas';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE_NAMES } from '../../src/access/session-cookies.js';
import { errorBody } from '../../src/http/error-bodies.js';
import { deriveCsrfToken } from '../../src/session/session-token.js';
import type { MemoryInfrastructure } from '../support/memory-infrastructure.js';
import { PREFIXES, createSession, readHeaders, startSessionApp, writeHeaders } from './support.js';

let app: NestFastifyApplication;
let infra: MemoryInfrastructure;

beforeEach(async () => {
  ({ app, infra } = await startSessionApp());
});

afterEach(async () => {
  await app.close();
});

const USER = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

/** Attributs du cookie effacé : mêmes que ceux de la pose, date passée. */
function expectClearedCookie(setCookie: string | string[] | undefined, name: string): void {
  const value = Array.isArray(setCookie) ? setCookie.join('\n') : (setCookie ?? '');
  expect(value).toMatch(new RegExp(`^${name}=;`));
  for (const attribute of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict']) {
    expect(value).toContain(attribute);
  }
  expect(value).not.toMatch(/Domain=/i);
  expect(value).toMatch(/Expires=Thu, 01 Jan 1970/);
}

describe.each(['ADMIN', 'CLIENT'] as const)('routes de session %s', (audience) => {
  const prefix = PREFIXES[audience];

  it('GET …/session : session courante et jeton CSRF dérivé, sans le jeton de session', async () => {
    const { token, record } = await createSession(infra, audience);
    infra.clock.advance(60_000);
    const response = await app.inject({
      method: 'GET',
      url: `${prefix}/session`,
      headers: readHeaders(audience, token),
    });
    expect(response.statusCode).toBe(200);
    const body = currentSessionResponseSchema.parse(response.json());
    expect(body).toMatchObject({
      id: record.publicId,
      audience,
      csrfToken: deriveCsrfToken(token),
      createdAt: new Date(record.createdAt).toISOString(),
      lastSeenAt: new Date(record.createdAt + 60_000).toISOString(),
      absoluteExpiresAt: new Date(record.absoluteExpiresAt).toISOString(),
    });
    expect(response.body).not.toContain(token);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('GET …/sessions : ses sessions seulement, la courante signalée', async () => {
    const first = await createSession(infra, audience, USER);
    infra.clock.advance(1_000);
    const second = await createSession(infra, audience, USER);
    await createSession(infra, audience);
    const response = await app.inject({
      method: 'GET',
      url: `${prefix}/sessions`,
      headers: readHeaders(audience, second.token),
    });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    const schema =
      audience === 'ADMIN' ? adminSessionListResponseSchema : clientSessionListResponseSchema;
    const { sessions } = schema.parse(body);
    expect(sessions.map((session) => [session.id, session.current])).toEqual([
      [first.record.publicId, false],
      [second.record.publicId, true],
    ]);
    if (audience === 'CLIENT') {
      expect(response.body).not.toContain('203.0.113');
      expect(response.body).not.toContain('network');
    } else {
      expect(sessions[0]).toMatchObject({ network: '203.0.113.0/24' });
    }
  });

  it('DELETE …/sessions/:id : ferme une autre de ses sessions et la journalise', async () => {
    const current = await createSession(infra, audience, USER);
    const other = await createSession(infra, audience, USER);
    const response = await app.inject({
      method: 'DELETE',
      url: `${prefix}/sessions/${other.record.publicId}`,
      headers: writeHeaders(audience, current.token),
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await infra.store.validate(other.token, audience)).toEqual({ status: 'absent' });
    expect((await infra.store.validate(current.token, audience)).status).toBe('valid');
    expect(infra.journalEvents.events).toEqual([
      {
        type: 'SESSION_REVOKED',
        userId: USER,
        actorId: null,
        ip: '127.0.0.1',
        device: null,
        details: { audience, reason: 'self', sessionId: other.record.publicId },
      },
    ]);
  });

  it('DELETE …/sessions/:id d’un autre compte : sans effet, même réponse (accès croisé)', async () => {
    const mine = await createSession(infra, audience, USER);
    const victim = await createSession(infra, audience);
    const response = await app.inject({
      method: 'DELETE',
      url: `${prefix}/sessions/${victim.record.publicId}`,
      headers: writeHeaders(audience, mine.token),
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect((await infra.store.validate(victim.token, audience)).status).toBe('valid');
    expect(infra.journalEvents.events).toEqual([]);
  });

  it('DELETE …/sessions/:id de la session courante : cookie effacé', async () => {
    const { token, record } = await createSession(infra, audience);
    const response = await app.inject({
      method: 'DELETE',
      url: `${prefix}/sessions/${record.publicId}`,
      headers: writeHeaders(audience, token),
    });
    expect(response.statusCode).toBe(204);
    expectClearedCookie(response.headers['set-cookie'], SESSION_COOKIE_NAMES[audience]);
  });

  it.each(['abc', 'A'.repeat(23), `${'A'.repeat(21)}%2F`, `${'A'.repeat(21)}.`])(
    'DELETE …/sessions/%s : identifiant invalide refusé (400 générique)',
    async (id) => {
      const { token } = await createSession(infra, audience);
      const response = await app.inject({
        method: 'DELETE',
        url: `${prefix}/sessions/${id}`,
        headers: writeHeaders(audience, token),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(errorBody(400));
    },
  );

  it('POST …/session/logout : révoque côté serveur, efface le cookie, journalise', async () => {
    const { token, record } = await createSession(infra, audience);
    const response = await app.inject({
      method: 'POST',
      url: `${prefix}/session/logout`,
      headers: {
        ...writeHeaders(audience, token),
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0',
      },
    });
    expect(response.statusCode).toBe(204);
    expectClearedCookie(response.headers['set-cookie'], SESSION_COOKIE_NAMES[audience]);
    expect(await infra.store.validate(token, audience)).toEqual({ status: 'absent' });
    const replay = await app.inject({
      method: 'GET',
      url: `${prefix}/session`,
      headers: readHeaders(audience, token),
    });
    expect(replay.statusCode).toBe(401);
    expect(infra.journalEvents.events).toEqual([
      {
        type: 'LOGOUT',
        userId: record.userId,
        actorId: null,
        ip: '127.0.0.1',
        device: 'Firefox sur Linux',
        details: { audience },
      },
    ]);
  });

  it('POST …/session/logout : la révocation a lieu même si le journal est indisponible', async () => {
    const { token } = await createSession(infra, audience);
    infra.journalEvents.failing = true;
    const response = await app.inject({
      method: 'POST',
      url: `${prefix}/session/logout`,
      headers: writeHeaders(audience, token),
    });
    expect(response.statusCode).toBe(204);
    expect(await infra.store.validate(token, audience)).toEqual({ status: 'absent' });
  });

  it('refuse un corps non JSON sur la déconnexion (415)', async () => {
    const { token } = await createSession(infra, audience);
    const response = await app.inject({
      method: 'POST',
      url: `${prefix}/session/logout`,
      headers: { ...writeHeaders(audience, token), 'content-type': 'text/plain' },
      payload: 'x',
    });
    expect(response.statusCode).toBe(415);
  });
});
