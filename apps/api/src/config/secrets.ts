// Secrets de l'API, chacun lu depuis `<NOM>_FILE` (fichier monté par Compose, ADR-0023). Chaque lot
// ajoute ici les siens avec leurs bornes : base au lot 1, poivres de session et des codes de secours
// aux lots 3-4, clé TOTP au lot 4 (la clé Resend est un secret du worker seul, lot 5).
import { DB_PASSWORD_MAX_LENGTH, DB_PASSWORD_MIN_LENGTH } from '@amg/api-db';
import type { SecretSpec } from './load-env.js';

export const API_SECRETS = [
  /** Mot de passe du rôle PostgreSQL de l'API (`amg_app`), jamais celui des migrations. */
  { name: 'DB_PASSWORD', minLength: DB_PASSWORD_MIN_LENGTH, maxLength: DB_PASSWORD_MAX_LENGTH },
] as const satisfies readonly SecretSpec[];

export type ApiSecrets = typeof API_SECRETS;
