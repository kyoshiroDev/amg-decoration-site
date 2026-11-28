// Variables d'environnement non secrètes de l'API, validées au démarrage (ADR-0023). Liste blanche :
// seules ces clés sont lues dans l'environnement, toute valeur invalide empêche le démarrage.
import { databaseEnvShape, tcpPortSchema } from '@amg/api-db';
import { z } from 'zod';
import { MIN_TRUSTED_PREFIX, parseTrustedProxy } from '../http/trust-proxy.js';
import { isLocalOrigin, originHost, originSchema } from './origins.js';

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

/** Utilisateur ACL Redis : jamais `default` (tous les droits), toujours l'utilisateur dédié à l'API. */
const redisUserSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/, 'identifiant attendu')
  .refine((user) => user !== 'default', 'utilisateur ACL dédié attendu, jamais default');

/** Adresse ou CIDR du proxy de confiance (Traefik), lu par `parseTrustedProxy`. */
const trustedProxySchema = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    const proxy = parseTrustedProxy(value);
    if (proxy === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `adresse ou CIDR invalide, ou plus large que /${String(MIN_TRUSTED_PREFIX.ipv4)} (IPv4) ou /${String(MIN_TRUSTED_PREFIX.ipv6)} (IPv6)`,
      });
      return z.NEVER;
    }
    return proxy;
  });

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
    /** Rôle du pool du journal de sécurité (`amg_journal`) ; secret `DB_JOURNAL_PASSWORD_FILE`. */
    DB_JOURNAL_USER: databaseEnvShape.DB_USER.default('amg_journal'),
    /** Origines servies : `https://admin.…` (atelier) et `https://espace.…` (espace client). */
    ADMIN_ORIGIN: originSchema,
    CLIENT_ORIGIN: originSchema,
    /** Proxy de confiance (Traefik) : obligatoire en production, absent ailleurs (aucun en-tête cru). */
    TRUSTED_PROXY: trustedProxySchema.optional(),
    /** Redis (sessions, limitation de débit) : utilisateur ACL dédié, secret `REDIS_PASSWORD_FILE`. */
    REDIS_HOST: z.hostname(),
    REDIS_PORT: tcpPortSchema.default(6379),
    REDIS_USER: redisUserSchema,
  })
  .superRefine((env, ctx) => {
    if (RESERVED_DB_USERS.includes(env.DB_JOURNAL_USER) || env.DB_JOURNAL_USER === env.DB_USER) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_JOURNAL_USER'],
        message: 'rôle dédié au journal attendu (amg_journal), distinct de DB_USER',
      });
    }
    for (const name of ['ADMIN_ORIGIN', 'CLIENT_ORIGIN'] as const) {
      if (env.NODE_ENV === 'production' && isLocalOrigin(env[name])) {
        ctx.addIssue({ code: 'custom', path: [name], message: 'https:// exigé en production' });
      }
    }
    // Les refinements s'exécutent aussi quand un champ est invalide (Zod 4) : rien n'est supposé.
    const adminHost = originHost(env.ADMIN_ORIGIN);
    if (adminHost !== '' && adminHost === originHost(env.CLIENT_ORIGIN)) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLIENT_ORIGIN'],
        message: 'hôte identique à ADMIN_ORIGIN (deux hôtes distincts exigés)',
      });
    }
    if (env.NODE_ENV === 'production' && env.TRUSTED_PROXY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUSTED_PROXY'],
        message: 'obligatoire en production (adresse ou CIDR du réseau où Traefik se connecte)',
      });
    }
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
