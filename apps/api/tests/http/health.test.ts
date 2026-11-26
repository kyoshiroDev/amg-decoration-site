import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { healthResponseSchema } from '@amg/shared-schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/http/security-headers.js';
import { createTestApp } from './app.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  // Amorçage complet d'AppModule : échoue si l'injection (métadonnées) est cassée.
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('répond 200 avec la seule réponse prévue, en JSON', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
  });

  it('pose les en-têtes de sécurité', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
  });

  it('ne révèle ni le serveur ni le framework', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers.server).toBeUndefined();
  });
});

describe('routes inconnues', () => {
  it.each([
    ['GET', '/health'],
    ['GET', '/api/inconnue'],
    ['POST', '/api/health'],
    ['DELETE', '/api/health'],
  ] as const)('%s %s répond 404 avec les en-têtes de sécurité', async (method, url) => {
    const response = await app.inject({ method, url });
    expect(response.statusCode).toBe(404);
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
  });

  it('refuse un corps JSON au-delà de la limite (413), en-têtes compris', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/health',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: 'x'.repeat(70 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
  });
});
