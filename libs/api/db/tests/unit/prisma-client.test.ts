// Fabrique du client, sans base : aucune connexion n'est ouverte avant la première requête.
import { describe, expect, it } from 'vitest';
import type { DatabaseConnection } from '../../src/database-config.js';
import {
  POOL_TIMEOUTS,
  buildPoolConfig,
  createPrismaClient,
  type CreatePrismaClientOptions,
} from '../../src/prisma-client.js';

const PASSWORD = 'mot-de-passe-du-role-amg-app-0123456789';

const connection: DatabaseConnection = {
  host: '127.0.0.1',
  port: 1,
  database: 'amg',
  user: 'amg_app',
  password: { reveal: () => PASSWORD },
};

const options: CreatePrismaClientOptions = {
  connection,
  maxConnections: 5,
  applicationName: 'amg-api',
  onPoolError: () => undefined,
};

describe('buildPoolConfig', () => {
  it('configure le pool champ par champ, avec les délais côté serveur', () => {
    expect(buildPoolConfig(options)).toMatchObject({
      host: '127.0.0.1',
      port: 1,
      database: 'amg',
      user: 'amg_app',
      max: 5,
      application_name: 'amg-api',
      connectionTimeoutMillis: POOL_TIMEOUTS.connectionTimeoutMillis,
      idleTimeoutMillis: POOL_TIMEOUTS.idleTimeoutMillis,
      statement_timeout: POOL_TIMEOUTS.statementTimeoutMillis,
      lock_timeout: POOL_TIMEOUTS.lockTimeoutMillis,
      idle_in_transaction_session_timeout: POOL_TIMEOUTS.idleInTransactionTimeoutMillis,
    });
  });

  it('ne garde pas le mot de passe en clair dans la configuration', () => {
    const config = buildPoolConfig(options);
    expect(typeof config.password).toBe('function');
    expect(JSON.stringify(config)).not.toContain(PASSWORD);
    expect(config).not.toHaveProperty('connectionString');
  });

  it('ne révèle le mot de passe qu’au moment de la connexion', () => {
    const config = buildPoolConfig(options);
    expect(typeof config.password === 'function' ? config.password() : undefined).toBe(PASSWORD);
  });
});

describe('createPrismaClient', () => {
  it('crée le client sans se connecter, puis se ferme proprement', async () => {
    const client = createPrismaClient(options);
    await expect(client.$disconnect()).resolves.toBeUndefined();
  });

  it.each([0, -1, 1.5, Number.NaN])('refuse maxConnections=%s', (maxConnections) => {
    expect(() => createPrismaClient({ ...options, maxConnections })).toThrow(RangeError);
  });
});
