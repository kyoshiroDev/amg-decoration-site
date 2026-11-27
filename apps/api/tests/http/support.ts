// Aides des tests HTTP des sessions : application sur infrastructure en mémoire, sessions créées
// directement dans le magasin (la connexion n'existe qu'au lot 4), en-têtes de même origine.
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { SESSION_COOKIE_NAMES } from '../../src/access/session-cookies.js';
import type { LoadedApiConfig } from '../../src/config/config.module.js';
import { deriveCsrfToken } from '../../src/session/session-token.js';
import type { CreatedSession, SessionAudience } from '../../src/session/session.types.js';
import {
  memoryInfrastructure,
  type MemoryInfrastructure,
} from '../support/memory-infrastructure.js';
import {
  ADMIN_HOST,
  ADMIN_ORIGIN,
  CLIENT_HOST,
  CLIENT_ORIGIN,
  loadTestConfig,
} from '../support/test-config.js';
import { createTestApp } from './app.js';

export interface SessionTestApp {
  readonly app: NestFastifyApplication;
  readonly infra: MemoryInfrastructure;
}

export async function startSessionApp(
  config: LoadedApiConfig = loadTestConfig(),
): Promise<SessionTestApp> {
  const infra = memoryInfrastructure();
  const app = await createTestApp(undefined, config, infra);
  return { app, infra };
}

export const HOSTS: Readonly<Record<SessionAudience, string>> = {
  ADMIN: ADMIN_HOST,
  CLIENT: CLIENT_HOST,
};
export const ORIGINS: Readonly<Record<SessionAudience, string>> = {
  ADMIN: ADMIN_ORIGIN,
  CLIENT: CLIENT_ORIGIN,
};
export const PREFIXES: Readonly<Record<SessionAudience, string>> = {
  ADMIN: '/api/admin',
  CLIENT: '/api/client',
};

export function createSession(
  infra: MemoryInfrastructure,
  audience: SessionAudience,
  userId: string = randomUUID(),
): Promise<CreatedSession> {
  return infra.store.create({
    userId,
    audience,
    stage: 'AUTHENTICATED',
    device: 'Firefox sur Linux',
    network: '203.0.113.0/24',
  });
}

/** Cookie de la session sous le nom attendu par l'hôte de `audience` (ou un autre nom). */
export function cookie(token: string, audience: SessionAudience): string {
  return `${SESSION_COOKIE_NAMES[audience]}=${token}`;
}

/** En-têtes d'une lecture authentifiée sur l'hôte de l'audience. */
export function readHeaders(audience: SessionAudience, token: string): Record<string, string> {
  return { host: HOSTS[audience], cookie: cookie(token, audience) };
}

/** En-têtes d'une écriture légitime : cookie, jeton CSRF, Sec-Fetch-Site et Origin exacts. */
export function writeHeaders(audience: SessionAudience, token: string): Record<string, string> {
  return {
    ...readHeaders(audience, token),
    'x-csrf-token': deriveCsrfToken(token),
    'sec-fetch-site': 'same-origin',
    origin: ORIGINS[audience],
  };
}

export function accessControlHeaders(response: LightMyRequestResponse): string[] {
  return Object.keys(response.headers).filter((name) =>
    name.toLowerCase().startsWith('access-control-'),
  );
}
