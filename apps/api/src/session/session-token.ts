// Jetons de session (ADR-0023, « Magasin de sessions ») : 256 bits aléatoires en base64url, seul
// contenu du cookie. Redis ne voit que l'empreinte SHA-256 des 32 octets ; le jeton CSRF en est
// dérivé par HMAC (rien n'est stocké) ; l'identifiant public est un aléa indépendant.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_TOKEN_BYTES = 32;
export const SESSION_PUBLIC_ID_BYTES = 16;

/** Jeton de session : base64url strict de 32 octets (43 caractères, sans remplissage). */
const SESSION_TOKEN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

/** Étiquette de dérivation du jeton CSRF (versionnée : un changement invalide tous les jetons). */
const CSRF_LABEL = 'amg-csrf-v1';

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function generatePublicId(): string {
  return randomBytes(SESSION_PUBLIC_ID_BYTES).toString('base64url');
}

/** Valeur de cookie acceptable comme jeton, avant tout calcul. */
export function isSessionToken(value: unknown): value is string {
  return typeof value === 'string' && SESSION_TOKEN.test(value);
}

/** Empreinte stockée (clé Redis) : SHA-256 des 32 octets du jeton, en hexadécimal. */
export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
}

/** Jeton CSRF de la session : HMAC-SHA-256 (clé : octets du jeton) en base64url. */
export function deriveCsrfToken(token: string): string {
  return createHmac('sha256', Buffer.from(token, 'base64url'))
    .update(CSRF_LABEL)
    .digest('base64url');
}

/** Compare le jeton CSRF reçu à celui de la session, en temps constant. */
export function csrfTokenMatches(token: string, received: unknown): boolean {
  if (typeof received !== 'string') return false;
  const expected = Buffer.from(deriveCsrfToken(token), 'utf8');
  const actual = Buffer.from(received, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
