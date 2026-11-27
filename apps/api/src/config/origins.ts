// Origines des deux CRM (ADR-0023) : l'hôte servi et l'origine attendue des requêtes qui modifient
// l'état viennent de la configuration, jamais d'un en-tête `X-Forwarded-*`. Forme exacte
// `https://hôte` (sans chemin, port, barre finale ni identifiants) ; `http://localhost:<port>` ou
// `http://127.0.0.1:<port>` admis en développement et en test seulement.
import { z } from 'zod';

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HTTPS_ORIGIN = new RegExp(`^https://(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):[1-9]\d{0,4}$/;

export const originSchema = z
  .string()
  .max(270)
  .refine(
    (value) => (HTTPS_ORIGIN.test(value) || LOCAL_ORIGIN.test(value)) && URL.canParse(value),
    'origine invalide',
  );

/** Origine locale en HTTP (développement et test seulement). */
export function isLocalOrigin(origin: string): boolean {
  return LOCAL_ORIGIN.test(origin);
}

/** Hôte d'une origine, tel qu'il figure dans l'en-tête `Host` (port compris s'il y en a). */
export function originHost(origin: string): string {
  return URL.canParse(origin) ? new URL(origin).host : '';
}
