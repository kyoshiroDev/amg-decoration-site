// L'API complète contre un PostgreSQL réel (job CI « API (intégration) ») : connexion sous le rôle
// `amg_app` construite depuis DB_* et le secret, requêtes Prisma, fermeture propre du pool.
// Variables exigées : celles de tests/support/integration-env.ts.
import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PrismaClient } from '@amg/api-db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRISMA_CLIENT } from '../../src/database/database.module.js';
import { createTestApp } from '../http/app.js';
import { integrationConfig } from '../support/integration-env.js';

let app: NestFastifyApplication;
let prisma: PrismaClient;

beforeAll(async () => {
  // Base réelle, Redis et journal en mémoire : ce fichier n'éprouve que le pool principal.
  app = await createTestApp(undefined, integrationConfig());
  prisma = app.get<PrismaClient>(PRISMA_CLIENT);
});

afterAll(async () => {
  await app.close();
});

describe('accès à la base depuis l’API', () => {
  it('se connecte sous le rôle de l’API, avec son nom d’application', async () => {
    const rows = await prisma.$queryRaw<{ role: string; application: string }[]>`
      SELECT current_user AS role, current_setting('application_name') AS application`;
    expect(rows).toEqual([{ role: 'amg_app', application: 'amg-api' }]);
  });

  it('lit les tables du schéma migré', async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });

  it('applique le délai maximal de requête côté serveur', async () => {
    const rows = await prisma.$queryRaw<{ timeout: string }[]>`
      SELECT current_setting('statement_timeout') AS timeout`;
    expect(rows).toEqual([{ timeout: '15s' }]);
  });

  it('continue de répondre sur /api/health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
  });
});
