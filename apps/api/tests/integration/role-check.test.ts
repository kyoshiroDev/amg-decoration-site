// Contrôle des rôles au démarrage contre un PostgreSQL réel : rôles conformes admis ; rôle qui
// écrit le journal sur le pool principal (amg_journal à la place d'amg_app) refusé ; rôle jetable
// `amg_ci_rogue`, membre d'amg_app (configuration valide, mais l'appartenance à un autre rôle est
// refusée par assertLeastPrivilegedSession), refusé sur chacun des deux pools. Le rôle jetable est
// créé par le superutilisateur de la base de test (TEST_DB_SUPERUSER_PASSWORD) et supprimé à la fin ;
// il ne touche ni l'ACL du journal ni aucun objet (aucun déclencheur d'événement sollicité).
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkDatabaseRoles } from '../../src/database/role-check.js';
import { integrationConfig, integrationEnv } from '../support/integration-env.js';

const ROGUE = 'amg_ci_rogue';
/** Mot de passe PUBLIC du rôle jetable, valable seulement dans la base jetable de la CI. */
const ROGUE_PASSWORD = 'ci-only-rogue-password-public-0123456789';

function superuserClient(): pg.Client {
  const env = integrationEnv();
  const password = process.env['TEST_DB_SUPERUSER_PASSWORD'];
  if (password === undefined || password === '') {
    throw new Error("Tests d'intégration : TEST_DB_SUPERUSER_PASSWORD manquante");
  }
  return new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: 'amg',
    password,
    options: '-c search_path=pg_catalog,pg_temp',
  });
}

describe('contrôle des rôles au démarrage', () => {
  let superuser: pg.Client;

  beforeAll(async () => {
    superuser = superuserClient();
    await superuser.connect();
    await superuser.query(`DROP ROLE IF EXISTS ${ROGUE}`);
    await superuser.query(
      `CREATE ROLE ${ROGUE} LOGIN INHERIT PASSWORD '${ROGUE_PASSWORD}' IN ROLE amg_app`,
    );
  });

  afterAll(async () => {
    await superuser.query(`DROP ROLE IF EXISTS ${ROGUE}`);
    await superuser.end();
  });

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

  it('refuse le pool principal sous un rôle membre d’amg_app (configuration pourtant valide)', async () => {
    const result = await checkDatabaseRoles(
      integrationConfig({ DB_USER: ROGUE, DB_PASSWORD: ROGUE_PASSWORD }),
    );
    expect(result).toMatchObject({ admitted: false, pool: 'principal' });
    expect(result.admitted ? [] : result.reasons).toContain('membre d’un autre rôle');
  });

  it('refuse le pool du journal sous ce même rôle', async () => {
    const result = await checkDatabaseRoles(
      integrationConfig({ DB_JOURNAL_USER: ROGUE, DB_JOURNAL_PASSWORD: ROGUE_PASSWORD }),
    );
    expect(result).toMatchObject({ admitted: false, pool: 'journal' });
    expect(result.admitted ? [] : result.reasons).toEqual(
      expect.arrayContaining(['membre d’un autre rôle', 'écriture du journal impossible']),
    );
  });
});
