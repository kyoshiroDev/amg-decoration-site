// Point d'entrée HTTP de l'API (`node dist/main.js`). Configuration invalide : journal d'erreur
// (noms de variables seulement) et arrêt immédiat, le conteneur refuse de démarrer (ADR-0023). De
// même pour un rôle PostgreSQL non conforme (database/role-check.ts).
import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { readSecretFile } from '@amg/api-db';
import { createApp } from './app.factory.js';
import { loadEnv } from './config/load-env.js';
import { API_SECRETS } from './config/secrets.js';
import { checkDatabaseRoles } from './database/role-check.js';
import type { LoadedApiConfig } from './config/config.module.js';

const logger = new ConsoleLogger({ json: true });

const loaded = loadEnv(process.env, readSecretFile, API_SECRETS);
if (!loaded.ok) {
  logger.error(
    { message: 'Configuration invalide, démarrage refusé', errors: loaded.errors },
    'Config',
  );
  process.exit(1);
}

async function start(config: LoadedApiConfig): Promise<void> {
  try {
    const app = await createApp({ logger, config });
    app.enableShutdownHooks();
    await app.listen(config.env.PORT, config.env.HOST);
  } catch (error: unknown) {
    logger.error(
      { message: 'Échec du démarrage', error: error instanceof Error ? error.name : 'inconnue' },
      'Bootstrap',
    );
    process.exit(1);
  }
}

// Rôles PostgreSQL contrôlés avant l'écoute : non conformes, démarrage refusé (base injoignable :
// démarrage normal, src/database/role-check.ts). Refus : code de sortie 1 sans `process.exit`, le
// processus se termine de lui-même une fois le journal écrit (aucune connexion ni écoute ouverte).
const roles = await checkDatabaseRoles(loaded.config);
if (roles.admitted) {
  if (roles.unreachable.length > 0) {
    logger.warn(
      {
        message: 'Base injoignable au démarrage : rôles contrôlés à la connexion',
        pools: roles.unreachable,
      },
      'Database',
    );
  }
  await start(loaded.config);
} else {
  logger.error(
    {
      message: 'Rôle de base de données non conforme, démarrage refusé',
      pool: roles.pool,
      reasons: roles.reasons,
    },
    'Database',
  );
  process.exitCode = 1;
}
