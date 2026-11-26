// Variables d'environnement non secrètes de l'API, validées au démarrage (ADR-0023). Liste blanche :
// seules ces clés sont lues dans l'environnement, toute valeur invalide empêche le démarrage.
import { databaseEnvShape, tcpPortSchema } from '@amg/api-db';
import { z } from 'zod';

export const NODE_ENVS = ['production', 'development', 'test'] as const;
export const AMG_ENVS = ['prod', 'staging', 'dev', 'test'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];
export type AmgEnv = (typeof AMG_ENVS)[number];

/** Couples admis : un conteneur de production ne tourne jamais en mode développement, et inversement. */
const AMG_ENVS_BY_NODE_ENV: Readonly<Record<NodeEnv, readonly AmgEnv[]>> = {
  production: ['prod', 'staging'],
  development: ['dev'],
  test: ['test'],
};

/**
 * Rôles que l'API ne doit jamais utiliser : superutilisateurs (`amg` de l'image, `postgres`) et
 * propriétaire des tables (`amg_migrator`), qui contournerait les droits réduits de `amg_app`.
 */
const RESERVED_DB_USERS: readonly string[] = ['amg', 'amg_migrator', 'postgres'];

export const envSchema = z
  .strictObject({
    NODE_ENV: z.enum(NODE_ENVS),
    AMG_ENV: z.enum(AMG_ENVS),
    /** Adresse d'écoute : 0.0.0.0 dans le conteneur (réseau interne), 127.0.0.1 par défaut en local. */
    HOST: z.ipv4().default('127.0.0.1'),
    PORT: tcpPortSchema.default(3000),
    /**
     * Connexion à PostgreSQL (rôle `amg_app`) : DB_HOST, DB_PORT (5432 par défaut), DB_NAME, DB_USER.
     * Le mot de passe est un secret (`DB_PASSWORD_FILE`, secrets.ts) ; aucune URL dans l'environnement.
     */
    ...databaseEnvShape,
  })
  .superRefine((env, ctx) => {
    if (RESERVED_DB_USERS.includes(env.DB_USER)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_USER'],
        message: `rôle réservé à l'administration ou aux migrations (${RESERVED_DB_USERS.join(', ')}), utiliser amg_app`,
      });
    }
    if (!AMG_ENVS_BY_NODE_ENV[env.NODE_ENV].includes(env.AMG_ENV)) {
      ctx.addIssue({
        code: 'custom',
        path: ['AMG_ENV'],
        message: `incompatible avec NODE_ENV (${env.NODE_ENV} admet : ${AMG_ENVS_BY_NODE_ENV[env.NODE_ENV].join(', ')})`,
      });
    }
  });

export type ApiEnv = z.output<typeof envSchema>;

/** Noms des variables lues (liste blanche, dérivée du schéma). */
export const ENV_KEYS = Object.keys(envSchema.shape) as readonly (keyof typeof envSchema.shape)[];
