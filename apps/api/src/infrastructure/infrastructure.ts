// Infrastructure de l'API hors base principale (ADR-0023) : client Redis (sessions, anti-répétition,
// limitation de débit) et pool du journal de sécurité (`amg_journal`). Créée par createApp depuis
// la configuration ; les tests HTTP passent une infrastructure en mémoire (tests/support), refusée
// hors de NODE_ENV=test.
import { Logger } from '@nestjs/common';
import { createPrismaClient, type JournalWriter } from '@amg/api-db';
import type { Redis } from 'ioredis';
import type { LoadedApiConfig } from '../config/config.module.js';
import { createRedisClient, redisKeyPrefix } from '../redis/redis-client.js';
import { RedisSessionStore } from '../session/redis-session-store.js';
import type { OnceStore, SessionStore } from '../session/session.types.js';

/** Connexions du pool du journal (un INSERT bref par événement). */
export const JOURNAL_POOL_MAX = 2;

/** Nom du pool du journal dans `pg_stat_activity`. */
export const JOURNAL_APPLICATION_NAME = 'amg-api-journal';

export interface Infrastructure {
  readonly sessionStore: SessionStore;
  readonly onceStore: OnceStore;
  readonly journal: JournalWriter;
  /** Magasin de la limitation de débit ; `null` : mémoire du processus (tests seulement). */
  readonly rateLimitRedis: Redis | null;
  /** Lance les connexions en arrière-plan (aucune n'est exigée pour démarrer). */
  readonly start: () => void;
  readonly close: () => Promise<void>;
}

const logger = new Logger('Infrastructure');

/** Erreur réseau ou de base : nom et code seulement (le message pourrait citer un hôte). */
function describe(error: Error): { error: string; code: string | undefined } {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return { error: error.name, code };
}

/** Une erreur de connexion à Redis journalisée au plus par minute (reconnexion toutes les 2 s). */
export const REDIS_ERROR_LOG_INTERVAL_MS = 60_000;

export function createInfrastructure(config: LoadedApiConfig): Infrastructure {
  let lastRedisErrorLog = Number.NEGATIVE_INFINITY;
  let suppressed = 0;
  const redis = createRedisClient(config, (error) => {
    const now = Date.now();
    if (now - lastRedisErrorLog < REDIS_ERROR_LOG_INTERVAL_MS) {
      suppressed += 1;
      return;
    }
    logger.error({ message: 'Erreur de la connexion à Redis', ...describe(error), suppressed });
    lastRedisErrorLog = now;
    suppressed = 0;
  });
  const store = new RedisSessionStore({ redis, keyPrefix: redisKeyPrefix(config.env.AMG_ENV) });
  const journal = createPrismaClient({
    connection: {
      host: config.env.DB_HOST,
      port: config.env.DB_PORT,
      database: config.env.DB_NAME,
      user: config.env.DB_JOURNAL_USER,
      password: config.secrets.DB_JOURNAL_PASSWORD,
    },
    scope: 'journal',
    maxConnections: JOURNAL_POOL_MAX,
    applicationName: JOURNAL_APPLICATION_NAME,
    onPoolError: (error) => {
      logger.error({ message: 'Erreur d’une connexion inactive du journal', ...describe(error) });
    },
  });
  return {
    sessionStore: store,
    onceStore: store,
    journal,
    rateLimitRedis: redis,
    start: () => {
      redis.connect().catch(() => {
        // Déjà journalisée par l'écouteur `error` ; la reconnexion continue (retryStrategy).
      });
    },
    close: async () => {
      redis.disconnect(false);
      await journal.$disconnect();
    },
  };
}
