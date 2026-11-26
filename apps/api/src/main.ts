// Point d'entrée HTTP de l'API (`node dist/main.js`). Configuration invalide : journal d'erreur
// (noms de variables seulement) et arrêt immédiat, le conteneur refuse de démarrer (ADR-0023).
import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { createApp } from './app.factory.js';
import { loadEnv } from './config/load-env.js';
import { readSecretFile } from './config/read-secret-file.js';
import { API_SECRETS } from './config/secrets.js';

const logger = new ConsoleLogger({ json: true });

const loaded = loadEnv(process.env, readSecretFile, API_SECRETS);
if (!loaded.ok) {
  logger.error(
    { message: 'Configuration invalide, démarrage refusé', errors: loaded.errors },
    'Config',
  );
  process.exit(1);
}

try {
  const app = await createApp({ logger });
  app.enableShutdownHooks();
  await app.listen(loaded.config.env.PORT, loaded.config.env.HOST);
} catch (error: unknown) {
  logger.error(
    { message: 'Échec du démarrage', error: error instanceof Error ? error.name : 'inconnue' },
    'Bootstrap',
  );
  process.exit(1);
}
