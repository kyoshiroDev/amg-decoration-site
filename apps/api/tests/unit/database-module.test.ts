// Module d'accès à la base, sans base : client créé depuis la configuration, aucune connexion au
// démarrage (l'API démarre même si PostgreSQL est indisponible), pool fermé à l'arrêt.
import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PrismaClient } from '@amg/api-db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_DB_POOL_MAX,
  DatabaseShutdown,
  PRISMA_CLIENT,
} from '../../src/database/database.module.js';
import { createTestApp } from '../http/app.js';

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('DatabaseModule', () => {
  it('fournit un client Prisma sans ouvrir de connexion au démarrage', async () => {
    app = await createTestApp();
    const prisma = app.get<PrismaClient>(PRISMA_CLIENT);
    expect(typeof prisma.$queryRaw).toBe('function');
    expect(API_DB_POOL_MAX).toBe(5);
  });

  it('injecte le client dans la fermeture du pool (métadonnées de décorateurs)', async () => {
    app = await createTestApp();
    expect(app.get(DatabaseShutdown)).toBeInstanceOf(DatabaseShutdown);
  });

  it('ferme le pool à l’arrêt de l’application', async () => {
    const started = await createTestApp();
    const prisma = started.get<PrismaClient>(PRISMA_CLIENT);
    const disconnect = vi.spyOn(prisma, '$disconnect');
    await started.close();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
