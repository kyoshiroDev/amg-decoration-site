// Secrets de l'API, chacun lu depuis `<NOM>_FILE` (fichier monté par Compose, ADR-0023). Chaque lot
// ajoute ici les siens avec leurs bornes : base au lot 1, journal et Redis au lot 3, poivre des
// codes de secours et clé TOTP au lot 4 (la clé Resend est un secret du worker seul, lot 5). Aucun
// poivre de session : le jeton est un aléa de 256 bits, stocké sous son empreinte SHA-256.
import { DB_PASSWORD_MAX_LENGTH, DB_PASSWORD_MIN_LENGTH } from '@amg/api-db';
import type { SecretSpec } from './load-env.js';

export const API_SECRETS = [
  /** Mot de passe du rôle PostgreSQL de l'API (`amg_app`), jamais celui des migrations. */
  { name: 'DB_PASSWORD', minLength: DB_PASSWORD_MIN_LENGTH, maxLength: DB_PASSWORD_MAX_LENGTH },
  /** Mot de passe du rôle du journal de sécurité (`amg_journal`), propre à chaque environnement. */
  {
    name: 'DB_JOURNAL_PASSWORD',
    minLength: DB_PASSWORD_MIN_LENGTH,
    maxLength: DB_PASSWORD_MAX_LENGTH,
  },
  /** Mot de passe de l'utilisateur ACL Redis de l'API (`openssl rand -base64 32`). */
  { name: 'REDIS_PASSWORD', minLength: 32, maxLength: 256 },
] as const satisfies readonly SecretSpec[];

export type ApiSecrets = typeof API_SECRETS;
