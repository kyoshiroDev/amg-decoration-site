// Fabrique du client Prisma 7 sur le driver adapter `pg` (ADR-0023). Le pool est configuré champ par
// champ (pas d'URL) et le mot de passe n'y figure que sous forme de fonction : il n'apparaît dans
// aucun objet de configuration susceptible d'être sérialisé ou journalisé.
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import type { DatabaseConnection } from './database-config.js';
import { PrismaClient } from './generated/prisma/client.js';

/** Délais côté PostgreSQL : aucune requête ni transaction ouverte ne peut bloquer indéfiniment. */
export const POOL_TIMEOUTS = Object.freeze({
  /** Établissement d'une connexion. */
  connectionTimeoutMillis: 5_000,
  /** Connexion inactive rendue au serveur. */
  idleTimeoutMillis: 30_000,
  /** Requête la plus longue admise. */
  statementTimeoutMillis: 15_000,
  /** Attente d'un verrou. */
  lockTimeoutMillis: 5_000,
  /** Transaction ouverte sans activité (connexion tenue par un client lent ou planté). */
  idleInTransactionTimeoutMillis: 15_000,
});

export interface CreatePrismaClientOptions {
  readonly connection: DatabaseConnection;
  /** Connexions simultanées au plus (budget : 5 pour l'API, 2 pour le worker). */
  readonly maxConnections: number;
  /** Nom visible dans `pg_stat_activity` (diagnostic), sans donnée personnelle. */
  readonly applicationName: string;
  /** Erreur d'une connexion inactive du pool : sans gestionnaire, elle arrêterait le processus. */
  readonly onPoolError: (error: Error) => void;
}

/** Configuration du pool `pg`, exposée pour être testée sans base. */
export function buildPoolConfig(options: CreatePrismaClientOptions): PoolConfig {
  const { connection } = options;
  return {
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: () => connection.password.reveal(),
    max: options.maxConnections,
    application_name: options.applicationName,
    connectionTimeoutMillis: POOL_TIMEOUTS.connectionTimeoutMillis,
    idleTimeoutMillis: POOL_TIMEOUTS.idleTimeoutMillis,
    statement_timeout: POOL_TIMEOUTS.statementTimeoutMillis,
    lock_timeout: POOL_TIMEOUTS.lockTimeoutMillis,
    idle_in_transaction_session_timeout: POOL_TIMEOUTS.idleInTransactionTimeoutMillis,
  };
}

/**
 * Crée le client. Aucune connexion n'est ouverte avant la première requête : l'API démarre même si
 * la base est momentanément indisponible. `$disconnect()` ferme le pool (arrêt propre).
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  if (!Number.isInteger(options.maxConnections) || options.maxConnections < 1) {
    throw new RangeError('maxConnections : entier ≥ 1 attendu');
  }
  const adapter = new PrismaPg(buildPoolConfig(options), { onPoolError: options.onPoolError });
  return new PrismaClient({ adapter });
}
