// L'API est servie sous la même origine que chaque CRM (admin.…/api/, espace.…/api/) : aucun CORS.
// Aucune réponse ne doit porter d'en-tête Access-Control-*, même à une origine étrangère ou à une
// requête de pré-vérification (ADR-0023).
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

function accessControlHeaders(response: LightMyRequestResponse): string[] {
  return Object.keys(response.headers).filter((name) =>
    name.toLowerCase().startsWith('access-control-'),
  );
}

describe('absence de CORS', () => {
  it.each(['https://attaquant.example', 'https://admin.amgdecorationdinterieur.com', 'null'])(
    'GET avec Origin: %s',
    async (origin) => {
      const response = await app.inject({ method: 'GET', url: '/api/health', headers: { origin } });
      expect(response.statusCode).toBe(200);
      expect(accessControlHeaders(response)).toEqual([]);
    },
  );

  it('pré-vérification OPTIONS refusée, sans en-tête Access-Control-*', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'https://attaquant.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, x-csrf-token',
      },
    });
    expect(response.statusCode).toBe(404);
    expect(accessControlHeaders(response)).toEqual([]);
  });

  it('erreur 404 sans en-tête Access-Control-*', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/inconnue',
      headers: { origin: 'https://attaquant.example' },
    });
    expect(accessControlHeaders(response)).toEqual([]);
  });
});
