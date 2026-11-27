// Variables des tests d'intégration de l'API (job CI « API (intégration) ») : PostgreSQL migré
// (rôles amg_app et amg_journal) et Redis avec l'utilisateur ACL de l'API. Absentes : échec immédiat
// et explicite, jamais une suite qui passe à vide.
import { z } from 'zod';
import type { LoadedApiConfig } from '../../src/config/config.module.js';
import { TEST_ENV, loadTestConfig } from './test-config.js';

const integrationEnvSchema = z.strictObject({
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().min(1),
  DB_NAME: z.string().min(1),
  TEST_DB_APP_PASSWORD: z.string().min(1),
  TEST_DB_JOURNAL_PASSWORD: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().min(1),
  TEST_REDIS_USER: z.string().min(1),
  TEST_REDIS_PASSWORD: z.string().min(1),
});

export type IntegrationEnv = z.output<typeof integrationEnvSchema>;

export function integrationEnv(): IntegrationEnv {
  const picked: Record<string, string> = {};
  for (const key of Object.keys(integrationEnvSchema.shape)) {
    const value = process.env[key];
    if (value !== undefined && value !== '') picked[key] = value;
  }
  const parsed = integrationEnvSchema.safeParse(picked);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Tests d'intégration : environnement incomplet (${names})`);
  }
  return parsed.data;
}

/** Configuration de l'API sur la base et le Redis réels ; `overrides` pour éprouver les pannes. */
export function integrationConfig(
  overrides: Readonly<Record<string, string>> = {},
): LoadedApiConfig {
  const env = integrationEnv();
  return loadTestConfig({
    ...TEST_ENV,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_NAME: env.DB_NAME,
    DB_USER: 'amg_app',
    DB_PASSWORD: env.TEST_DB_APP_PASSWORD,
    DB_JOURNAL_USER: 'amg_journal',
    DB_JOURNAL_PASSWORD: env.TEST_DB_JOURNAL_PASSWORD,
    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
    REDIS_USER: env.TEST_REDIS_USER,
    REDIS_PASSWORD: env.TEST_REDIS_PASSWORD,
    ...overrides,
  });
}
