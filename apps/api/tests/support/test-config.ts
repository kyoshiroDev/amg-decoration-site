// Configuration des tests unitaires et HTTP, chargée par le vrai `loadEnv` (mode test : secrets
// admis directement). La base et Redis désignés n'existent pas (port 1) : aucune connexion n'est
// ouverte tant qu'aucune requête n'est faite (tests/unit/database-module.test.ts), et les tests HTTP
// remplacent Redis et le pool du journal par l'infrastructure en mémoire (memory-infrastructure.ts).
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
  DB_JOURNAL_PASSWORD: 'mot-de-passe-du-journal-sans-base-0123456789',
  ADMIN_ORIGIN: 'https://admin.example.test',
  CLIENT_ORIGIN: 'https://espace.example.test',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '1',
  REDIS_USER: 'amg_api',
  REDIS_PASSWORD: 'mot-de-passe-redis-de-test-sans-serveur-0123',
});

/** Hôtes servis par la configuration de test (en-tête `Host`). */
export const ADMIN_HOST = 'admin.example.test';
export const CLIENT_HOST = 'espace.example.test';
export const ADMIN_ORIGIN = 'https://admin.example.test';
export const CLIENT_ORIGIN = 'https://espace.example.test';

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
