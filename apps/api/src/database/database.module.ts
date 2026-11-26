// Accès à PostgreSQL par Prisma (ADR-0023) : un client par processus, sous le rôle `amg_app`, pool
// de 5 connexions (budget mémoire, EXPLOITATION §10.2). Aucune connexion n'est ouverte au démarrage :
// la première requête l'établit. Le pool est fermé à l'arrêt de l'application (SIGTERM, app.close()).
import { Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@amg/api-db';
import { API_CONFIG, type LoadedApiConfig } from '../config/config.module.js';

/** Jeton d'injection du client Prisma (`@Inject(PRISMA_CLIENT)`). */
export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

/** Connexions simultanées de l'API à PostgreSQL. */
export const API_DB_POOL_MAX = 5;

/** Nom de l'application dans `pg_stat_activity`. */
export const API_DB_APPLICATION_NAME = 'amg-api';

const logger = new Logger('Database');

/** Erreur d'une connexion inactive : journalisée sans message (qui pourrait citer l'hôte ou le rôle). */
function logPoolError(error: Error): void {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  logger.error({ message: 'Erreur d’une connexion inactive à la base', error: error.name, code });
}

export function prismaClientFromConfig(config: LoadedApiConfig): PrismaClient {
  return createPrismaClient({
    connection: {
      host: config.env.DB_HOST,
      port: config.env.DB_PORT,
      database: config.env.DB_NAME,
      user: config.env.DB_USER,
      password: config.secrets.DB_PASSWORD,
    },
    maxConnections: API_DB_POOL_MAX,
    applicationName: API_DB_APPLICATION_NAME,
    onPoolError: logPoolError,
  });
}

/** Ferme le pool à l'arrêt : les connexions sont rendues proprement au serveur. */
@Injectable()
export class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Module({
  providers: [
    { provide: PRISMA_CLIENT, useFactory: prismaClientFromConfig, inject: [API_CONFIG] },
    DatabaseShutdown,
  ],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule {}
