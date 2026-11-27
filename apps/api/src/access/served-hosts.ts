// Hôtes servis (ADR-0023) : l'audience d'une requête est celle de son en-tête `Host`, comparé
// exactement (casse ignorée) à l'hôte des origines configurées, jamais à `X-Forwarded-Host`.
import type { SessionAudience } from '@amg/shared-schemas';
import type { LoadedApiConfig } from '../config/config.module.js';
import { originHost } from '../config/origins.js';

/** Préfixes des routes de chaque audience (préfixe global `api` compris). */
export const AUDIENCE_PREFIXES: Readonly<Record<SessionAudience, string>> = Object.freeze({
  ADMIN: '/api/admin/',
  CLIENT: '/api/client/',
});

/** Audience d'une route d'après son modèle de chemin (`/api/admin/sessions/:id`). */
export function routeAudience(routeUrl: string | undefined): SessionAudience | undefined {
  if (routeUrl === undefined) return undefined;
  if (routeUrl.startsWith(AUDIENCE_PREFIXES.ADMIN)) return 'ADMIN';
  if (routeUrl.startsWith(AUDIENCE_PREFIXES.CLIENT)) return 'CLIENT';
  return undefined;
}

export class ServedHosts {
  readonly #origins: Readonly<Record<SessionAudience, string>>;
  readonly #hosts: ReadonlyMap<string, SessionAudience>;

  constructor(config: LoadedApiConfig) {
    this.#origins = { ADMIN: config.env.ADMIN_ORIGIN, CLIENT: config.env.CLIENT_ORIGIN };
    this.#hosts = new Map<string, SessionAudience>([
      [originHost(config.env.ADMIN_ORIGIN), 'ADMIN'],
      [originHost(config.env.CLIENT_ORIGIN), 'CLIENT'],
    ]);
  }

  /** Audience de l'hôte reçu ; `undefined` pour un hôte inconnu (absent, autre, ou multiple). */
  audienceOf(hostHeader: string | undefined): SessionAudience | undefined {
    if (hostHeader === undefined || hostHeader.length > 270) return undefined;
    return this.#hosts.get(hostHeader.toLowerCase());
  }

  /** Origine exacte attendue des requêtes qui modifient l'état sur cet hôte. */
  origin(audience: SessionAudience): string {
    return this.#origins[audience];
  }
}
