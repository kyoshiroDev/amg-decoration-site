// Client Prisma réel (driver adapter pg) sous le rôle de l'API : lecture, écriture, identifiants
// UUID v7 générés par la base, journal non modifiable, fermeture du pool.
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPrismaClient } from '../../src/prisma-client.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { APP_ROLE, testDatabaseEnv, uniqueEmail } from './test-database.js';

let prisma: PrismaClient;
const poolErrors: Error[] = [];

beforeAll(() => {
  const env = testDatabaseEnv();
  prisma = createPrismaClient({
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: APP_ROLE,
      password: { reveal: () => env.TEST_DB_APP_PASSWORD },
    },
    maxConnections: 2,
    applicationName: 'amg-api-db-tests',
    onPoolError: (error) => poolErrors.push(error),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  expect(poolErrors).toEqual([]);
});

const uuidV7 = z.uuidv7();

describe('client Prisma', () => {
  it('crée, relit et supprime un compte, identifiant UUID v7 généré par la base', async () => {
    const email = uniqueEmail();
    const created = await prisma.user.create({
      data: { email, role: 'CLIENT', displayName: 'Cliente de test' },
    });
    try {
      expect(uuidV7.safeParse(created.id).success).toBe(true);
      expect(created.status).toBe('INVITED');
      expect(created.passwordHash).toBeNull();
      const found = await prisma.user.findUnique({ where: { email } });
      expect(found?.id).toBe(created.id);
    } finally {
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it('enregistre un lien d’activation avec son empreinte binaire', async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(), role: 'CLIENT', displayName: 'Cliente de test' },
    });
    try {
      const tokenHash = randomBytes(32);
      await prisma.activationToken.create({
        data: {
          userId: user.id,
          purpose: 'INVITATION',
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        },
      });
      const token = await prisma.activationToken.findUnique({ where: { tokenHash } });
      expect(token && Buffer.from(token.tokenHash).equals(tokenHash)).toBe(true);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('écrit dans le journal mais ne peut ni le modifier ni le supprimer', async () => {
    const event = await prisma.securityEvent.create({
      data: { type: 'LOGIN_FAILED', ip: '198.51.100.4', details: { reason: 'test' } },
    });
    expect(uuidV7.safeParse(event.id).success).toBe(true);
    await expect(
      prisma.securityEvent.update({ where: { id: event.id }, data: { type: 'LOGIN_SUCCEEDED' } }),
    ).rejects.toThrow();
    await expect(prisma.securityEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    const unchanged = await prisma.securityEvent.findUnique({ where: { id: event.id } });
    expect(unchanged?.type).toBe('LOGIN_FAILED');
  });
});
