// Contrôle des rôles PostgreSQL au démarrage (ADR-0023, « Journal de sécurité : rôle et pool
// dédiés ») : une connexion de chaque pool (principal sous DB_USER, journal sous DB_JOURNAL_USER)
// passe par `assertLeastPrivilegedSession` avant l'écoute. Rôle non conforme (le rôle principal
// peut écrire le journal, celui du journal a d'autres droits, superutilisateur, propriétaire des
// tables…) : l'API refuse de démarrer, le conteneur ne devient pas sain et deploy.sh ne bascule
// pas. Base injoignable : démarrage normal (aucune dépendance de démarrage à la base), routes qui
// en ont besoin en 503 ; chaque connexion ouverte ensuite par un pool est contrôlée de même.
import { DatabaseRoleError, verifyDatabaseRole } from '@amg/api-db';
import type { LoadedApiConfig } from '../config/config.module.js';
import { JOURNAL_APPLICATION_NAME } from '../infrastructure/infrastructure.js';
import { API_DB_APPLICATION_NAME } from './database.module.js';

export type PoolName = 'principal' | 'journal';

export type RoleCheckResult =
  | { readonly admitted: true; readonly unreachable: readonly PoolName[] }
  /** Raisons de `DatabaseRoleError` : sans hôte ni rôle. */
  | { readonly admitted: false; readonly pool: PoolName; readonly reasons: readonly string[] };

export type RoleVerifier = typeof verifyDatabaseRole;

export async function checkDatabaseRoles(
  config: LoadedApiConfig,
  verify: RoleVerifier = verifyDatabaseRole,
): Promise<RoleCheckResult> {
  const pools: readonly (readonly [PoolName, Parameters<RoleVerifier>[0]])[] = [
    [
      'principal',
      {
        connection: {
          host: config.env.DB_HOST,
          port: config.env.DB_PORT,
          database: config.env.DB_NAME,
          user: config.env.DB_USER,
          password: config.secrets.DB_PASSWORD,
        },
        scope: 'app',
        applicationName: API_DB_APPLICATION_NAME,
      },
    ],
    [
      'journal',
      {
        connection: {
          host: config.env.DB_HOST,
          port: config.env.DB_PORT,
          database: config.env.DB_NAME,
          user: config.env.DB_JOURNAL_USER,
          password: config.secrets.DB_JOURNAL_PASSWORD,
        },
        scope: 'journal',
        applicationName: JOURNAL_APPLICATION_NAME,
      },
    ],
  ];
  const outcomes = await Promise.allSettled(pools.map(([, options]) => verify(options)));
  const unreachable: PoolName[] = [];
  for (const [index, outcome] of outcomes.entries()) {
    const pool = pools[index]?.[0] ?? 'principal';
    if (outcome.status === 'rejected') {
      const error: unknown = outcome.reason;
      if (error instanceof DatabaseRoleError) {
        return { admitted: false, pool, reasons: error.reasons };
      }
      unreachable.push(pool);
    } else if (outcome.value === 'unreachable') {
      unreachable.push(pool);
    }
  }
  return { admitted: true, unreachable };
}
