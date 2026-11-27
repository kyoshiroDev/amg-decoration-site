// Client Redis de l'API (ADR-0023, « Magasin de sessions ») : ioredis, réglé pour échouer vite et
// fermé par défaut. Aucune commande n'est mise en attente pendant une coupure (elle échoue aussitôt
// et la requête reçoit 503), aucune ne patiente plus d'une seconde ; la reconnexion continue en
// arrière-plan. Aucune connexion n'est exigée au démarrage : l'API démarre et répond 503 tant que
// Redis manque. Utilisateur ACL dédié, mot de passe en secret ; jamais de cluster (les scripts Lua
// lisent des clés dérivées de l'index d'un compte).
import { Redis } from 'ioredis';
import type { AmgEnv } from '../config/env.schema.js';
import type { LoadedApiConfig } from '../config/config.module.js';

/** Préfixe de toutes les clés de l'API, fixé par l'environnement (ACL `~amg:<env>:*`). */
export function redisKeyPrefix(env: AmgEnv): string {
  return `amg:${env}:`;
}

export const REDIS_TIMEOUTS = Object.freeze({
  /** Établissement de la connexion TCP et authentification. */
  connectTimeoutMs: 2_000,
  /** Réponse à une commande. */
  commandTimeoutMs: 1_000,
  /** Attente maximale entre deux tentatives de reconnexion. */
  maxReconnectDelayMs: 2_000,
});

export function createRedisClient(config: LoadedApiConfig, onError: (error: Error) => void): Redis {
  const client = new Redis({
    host: config.env.REDIS_HOST,
    port: config.env.REDIS_PORT,
    username: config.env.REDIS_USER,
    password: config.secrets.REDIS_PASSWORD.reveal(),
    db: 0,
    // RESP2 : un seul AUTH à la connexion (pas de HELLO), ni CLIENT SETINFO ni INFO : l'utilisateur
    // ACL n'a besoin que des commandes de données (liste dans l'ADR-0023, « Magasin de sessions »).
    protocol: 2,
    disableClientInfo: true,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: REDIS_TIMEOUTS.connectTimeoutMs,
    commandTimeout: REDIS_TIMEOUTS.commandTimeoutMs,
    retryStrategy: (times) => Math.min(times * 200, REDIS_TIMEOUTS.maxReconnectDelayMs),
    lazyConnect: true,
  });
  client.on('error', onError);
  return client;
}
