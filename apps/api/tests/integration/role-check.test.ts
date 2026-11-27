// Contrôle des rôles au démarrage contre un PostgreSQL réel : rôles conformes admis ; rôle qui
// écrit le journal sur le pool principal (amg_journal à la place d'amg_app) ou rôle de l'API sur le
// pool du journal : démarrage refusé (main.ts sort en erreur, le conteneur ne devient pas sain).
import { describe, expect, it } from 'vitest';
import { checkDatabaseRoles } from '../../src/database/role-check.js';
import { integrationConfig, integrationEnv } from '../support/integration-env.js';

describe('contrôle des rôles au démarrage', () => {
  it('admet les rôles conformes', async () => {
    await expect(checkDatabaseRoles(integrationConfig())).resolves.toEqual({
      admitted: true,
      unreachable: [],
    });
  });

  it('refuse un pool principal sous un rôle qui a INSERT sur le journal', async () => {
    const env = integrationEnv();
    const result = await checkDatabaseRoles(
      integrationConfig({
        DB_USER: 'amg_journal',
        DB_PASSWORD: env.TEST_DB_JOURNAL_PASSWORD,
        DB_JOURNAL_USER: 'amg_app',
        DB_JOURNAL_PASSWORD: env.TEST_DB_APP_PASSWORD,
      }),
    );
    expect(result.admitted).toBe(false);
    expect(result.admitted ? [] : result.reasons).toContain('écriture du journal hors de son pool');
  });

  it('refuse le pool du journal sous le rôle de l’API (aucun écrivain)', async () => {
    const env = integrationEnv();
    const result = await checkDatabaseRoles(
      integrationConfig({
        DB_JOURNAL_USER: 'amg_app',
        DB_JOURNAL_PASSWORD: env.TEST_DB_APP_PASSWORD,
      }),
    );
    expect(result).toMatchObject({ admitted: false, pool: 'journal' });
  });
});
