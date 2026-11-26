// Configuration des tests unitaires et HTTP, chargée par le vrai `loadEnv` (mode test : secrets
// admis directement). La base désignée n'existe pas (port 1) : aucune connexion n'est ouverte tant
// qu'aucune requête n'est faite, ce que vérifie tests/unit/database-module.test.ts.
import type { LoadedApiConfig } from '../../src/config/config.module.js';
import { loadEnv, type EnvSource } from '../../src/config/load-env.js';
import { API_SECRETS } from '../../src/config/secrets.js';

export const TEST_ENV: EnvSource = Object.freeze({
  NODE_ENV: 'test',
  AMG_ENV: 'test',
  DB_HOST: '127.0.0.1',
  DB_PORT: '1',
  DB_NAME: 'amg_test',
  DB_USER: 'amg_app',
  DB_PASSWORD: 'mot-de-passe-de-test-sans-base-0123456789',
});

export function loadTestConfig(source: EnvSource = TEST_ENV): LoadedApiConfig {
  const loaded = loadEnv(
    source,
    () => {
      throw new Error('aucun fichier secret en test');
    },
    API_SECRETS,
  );
  if (!loaded.ok) throw new Error(`configuration de test invalide : ${loaded.errors.join(' ; ')}`);
  return loaded.config;
}
