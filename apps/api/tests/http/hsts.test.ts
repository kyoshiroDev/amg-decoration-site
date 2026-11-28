// HSTS sur toute réponse de l'API (ADR-0020, ADR-0023) : rien d'autre ne le pose devant elle.
// Valeur écrite en clair ici (pas reprise de SECURITY_HEADERS) : retirer l'en-tête de la liste
// partagée, ou en changer la valeur, fait échouer ce test. Même valeur que le site.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.js';
import { TestRoutesModule } from './test-routes.module.js';

const HSTS = 'max-age=63072000; includeSubDomains';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp(TestRoutesModule);
});

afterAll(async () => {
  await app.close();
});

describe('Strict-Transport-Security', () => {
  it.each([
    ['200', { method: 'GET', url: '/api/health' }, 200],
    ['404', { method: 'GET', url: '/api/inconnue' }, 404],
    ['400 (routeur, frameworkErrors)', { method: 'GET', url: '/api/%zz' }, 400],
    [
      '415',
      {
        method: 'POST',
        url: '/api/admin/test/echo',
        headers: { host: 'admin.example.test', 'content-type': 'text/plain' },
        payload: 'a',
      },
      415,
    ],
    [
      '413',
      {
        method: 'POST',
        url: '/api/admin/test/echo',
        headers: { host: 'admin.example.test', 'content-type': 'application/json' },
        payload: JSON.stringify({ data: 'x'.repeat(70 * 1024) }),
      },
      413,
    ],
  ] as const)('réponse %s', async (_label, request, status) => {
    const response = await app.inject(request);
    expect(response.statusCode).toBe(status);
    expect(response.headers['strict-transport-security']).toBe(HSTS);
  });

  it('même valeur que le site (nginx)', () => {
    const nginx = readFileSync(new URL('../../../site/nginx/nginx.conf', import.meta.url), 'utf8');
    expect(nginx).toContain(`add_header Strict-Transport-Security "${HSTS}" always;`);
  });
});
