// Requêtes rejetées avant tout contrôleur : URL mal encodée (routeur Fastify), type de corps
// non JSON, délais du serveur. Chaque rejet garde les en-têtes de sécurité (ADR-0023).
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONNECTION_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '../../src/app.factory.js';
import { BAD_REQUEST_BODY, SECURITY_HEADERS } from '../../src/http/security-headers.js';
import { createTestApp } from './app.js';
import { TestRoutesModule } from './test-routes.module.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp(TestRoutesModule);
});

afterAll(async () => {
  await app.close();
});

describe('URL mal encodée (frameworkErrors)', () => {
  it.each(['/api/%zz', '/api/%E0%A4%A', '/api/health%'])(
    'GET %s : 400 générique, en-têtes de sécurité, chemin non recopié',
    async (url) => {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(400);
      expect(response.headers).toMatchObject(SECURITY_HEADERS);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.json()).toEqual(BAD_REQUEST_BODY);
      expect(response.body).not.toContain('%');
      expect(response.body).not.toContain('FST_');
    },
  );
});

describe('types de corps', () => {
  it.each([
    ['text/plain', 'a=1'],
    ['text/plain; charset=utf-8', 'a=1'],
    ['application/x-www-form-urlencoded', 'a=1'],
    ['multipart/form-data; boundary=x', '--x--'],
    ['application/xml', '<a/>'],
  ])('POST %s : 415 avec les en-têtes de sécurité', async (contentType, payload) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { 'content-type': contentType },
      payload,
    });
    expect(response.statusCode).toBe(415);
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
  });

  it.each(['application/json', 'application/json; charset=utf-8'])(
    'POST %s : accepté et analysé',
    async (contentType) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/test/echo',
        headers: { 'content-type': contentType },
        payload: '{"a":1}',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: { a: 1 } });
    },
  );

  it('JSON avec __proto__ refusé (400)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"__proto__":{"admin":true}}',
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers).toMatchObject(SECURITY_HEADERS);
  });
});

describe('délais du serveur HTTP', () => {
  it('borne la réception d’une requête et l’inactivité d’une connexion', () => {
    const server: Server = app.getHttpServer();
    expect(server.requestTimeout).toBe(REQUEST_TIMEOUT_MS);
    expect(server.timeout).toBe(CONNECTION_TIMEOUT_MS);
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});
