// Secrets de l'API, chacun lu depuis `<NOM>_FILE` (fichier monté par Compose, ADR-0023).
// Vide au lot 0 : chaque lot ajoute ici les siens (base au lot 1, poivres de session et des codes de
// secours au lot 3-4, clé TOTP au lot 4, clé Resend au lot 5 côté worker), avec leurs bornes.
import type { SecretSpec } from './load-env.js';

export const API_SECRETS = [] as const satisfies readonly SecretSpec[];
