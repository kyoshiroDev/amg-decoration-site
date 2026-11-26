// Variables d'environnement non secrètes de l'API, validées au démarrage (ADR-0023). Liste blanche :
// seules ces clés sont lues dans l'environnement, toute valeur invalide empêche le démarrage.
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

/** Port TCP en décimal strict (pas de `3e3`, `0x10`, espaces ni zéro initial). */
const portSchema = z
  .string()
  .regex(/^[1-9]\d{0,4}$/, 'entier décimal attendu')
  .transform(Number)
  .pipe(z.number().int().max(65_535));

export const envSchema = z
  .strictObject({
    NODE_ENV: z.enum(NODE_ENVS),
    AMG_ENV: z.enum(AMG_ENVS),
    /** Adresse d'écoute : 0.0.0.0 dans le conteneur (réseau interne), 127.0.0.1 par défaut en local. */
    HOST: z.ipv4().default('127.0.0.1'),
    PORT: portSchema.default(3000),
  })
  .superRefine((env, ctx) => {
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
