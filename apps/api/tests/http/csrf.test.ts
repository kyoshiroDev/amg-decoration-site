// Garde CSRF (ADR-0023, « Exposition HTTP ») : sur toute méthode autre que GET et HEAD, trois
// contrôles cumulés. Matrice : chaque contrôle manquant seul suffit au refus (403 générique), la
// session n'est pas fermée, le refus est journalisé une fois par session et par fenêtre.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { errorBody } from '../../src/http/error-bodies.js';
import { SECURITY_HEADERS } from '../../src/http/security-headers.js';
import { deriveCsrfToken, generateSessionToken } from '../../src/session/session-token.js';
import type { MemoryInfrastructure } from '../support/memory-infrastructure.js';
import {
  HOSTS,
  ORIGINS,
  PREFIXES,
  accessControlHeaders,
  createSession,
  readHeaders,
  startSessionApp,
  writeHeaders,
} from './support.js';

let app: NestFastifyApplication;
let infra: MemoryInfrastructure;

beforeEach(async () => {
  ({ app, infra } = await startSessionApp());
});

afterEach(async () => {
  await app.close();
});

type Mutation = (headers: Record<string, string>, token: string) => Record<string, string>;

function without(name: string): Mutation {
  return (headers) => {
    return Object.fromEntries(Object.entries(headers).filter(([key]) => key !== name));
  };
}

function replaced(name: string, value: string): Mutation {
  return (headers) => ({ ...headers, [name]: value });
}

describe.each(['ADMIN', 'CLIENT'] as const)('CSRF sur l’hôte %s', (audience) => {
  const other = audience === 'ADMIN' ? 'CLIENT' : 'ADMIN';
  const logout = `${PREFIXES[audience]}/session/logout`;

  const refusals: readonly (readonly [string, string, Mutation])[] = [
    ['token', 'jeton absent', without('x-csrf-token')],
    [
      'token',
      'jeton d’une autre session',
      replaced('x-csrf-token', deriveCsrfToken(generateSessionToken())),
    ],
    [
      'token',
      'jeton tronqué',
      (headers, token) => ({ ...headers, 'x-csrf-token': deriveCsrfToken(token).slice(1) }),
    ],
    ['token', 'jeton égal au cookie', (headers, token) => ({ ...headers, 'x-csrf-token': token })],
    ['fetch-site', 'Sec-Fetch-Site absent', without('sec-fetch-site')],
    ['fetch-site', 'Sec-Fetch-Site: same-site', replaced('sec-fetch-site', 'same-site')],
    ['fetch-site', 'Sec-Fetch-Site: cross-site', replaced('sec-fetch-site', 'cross-site')],
    ['fetch-site', 'Sec-Fetch-Site: none', replaced('sec-fetch-site', 'none')],
    ['fetch-site', 'Sec-Fetch-Site en majuscules', replaced('sec-fetch-site', 'Same-Origin')],
    ['origin', 'Origin absent', without('origin')],
    ['origin', 'Origin: null', replaced('origin', 'null')],
    ['origin', 'Origin de l’autre hôte', replaced('origin', ORIGINS[other])],
    ['origin', 'Origin du site public', replaced('origin', 'https://example.test')],
    ['origin', 'Origin en http', replaced('origin', ORIGINS[audience].replace('https:', 'http:'))],
    ['origin', 'Origin avec barre finale', replaced('origin', `${ORIGINS[audience]}/`)],
    ['origin', 'Origin avec port', replaced('origin', `${ORIGINS[audience]}:443`)],
  ];

  it.each(refusals)('refuse (%s) : %s', async (check, _label, mutate) => {
    const { token, record } = await createSession(infra, audience);
    const response = await app.inject({
      method: 'POST',
      url: logout,
      headers: mutate(writeHeaders(audience, token), token),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(errorBody(403));
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(accessControlHeaders(response)).toEqual([]);
    // La session n'a pas été fermée.
    const current = await app.inject({
      method: 'GET',
      url: `${PREFIXES[audience]}/session`,
      headers: readHeaders(audience, token),
    });
    expect(current.statusCode).toBe(200);
    expect(infra.journalEvents.events).toEqual([
      {
        type: 'CSRF_REJECTED',
        userId: record.userId,
        actorId: null,
        ip: '127.0.0.1',
        device: null,
        details: { audience, failed: [check] },
      },
    ]);
  });

  it('accepte la requête quand les trois contrôles passent', async () => {
    const { token } = await createSession(infra, audience);
    const response = await app.inject({
      method: 'POST',
      url: logout,
      headers: writeHeaders(audience, token),
    });
    expect(response.statusCode).toBe(204);
  });

  it('applique les mêmes contrôles à DELETE', async () => {
    const { token, record } = await createSession(infra, audience);
    const url = `${PREFIXES[audience]}/sessions/${record.publicId}`;
    const refused = await app.inject({
      method: 'DELETE',
      url,
      headers: without('x-csrf-token')(writeHeaders(audience, token), token),
    });
    expect(refused.statusCode).toBe(403);
    const accepted = await app.inject({
      method: 'DELETE',
      url,
      headers: writeHeaders(audience, token),
    });
    expect(accepted.statusCode).toBe(204);
  });

  it('liste tous les contrôles manquants, et ne journalise qu’une fois par fenêtre', async () => {
    const { token } = await createSession(infra, audience);
    for (let i = 0; i < 3; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: logout,
        headers: readHeaders(audience, token),
      });
      expect(response.statusCode).toBe(403);
    }
    expect(infra.journalEvents.events.map((event) => event.details)).toEqual([
      { audience, failed: ['token', 'fetch-site', 'origin'] },
    ]);
  });

  it('journal indisponible : la clé d’anti-répétition est libérée, le refus suivant est journalisé', async () => {
    const { token } = await createSession(infra, audience);
    infra.journalEvents.failing = true;
    const first = await app.inject({
      method: 'POST',
      url: logout,
      headers: readHeaders(audience, token),
    });
    expect(first.statusCode).toBe(403);
    expect(infra.journalEvents.events).toEqual([]);
    infra.journalEvents.failing = false;
    const second = await app.inject({
      method: 'POST',
      url: logout,
      headers: readHeaders(audience, token),
    });
    expect(second.statusCode).toBe(403);
    expect(infra.journalEvents.events.map((event) => event.type)).toEqual(['CSRF_REJECTED']);
  });

  it('une requête sans session est refusée par la garde de session avant le CSRF (401)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: logout,
      headers: { host: HOSTS[audience] },
    });
    expect(response.statusCode).toBe(401);
    expect(infra.journalEvents.events).toEqual([]);
  });
});
