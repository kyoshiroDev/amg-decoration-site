// Cookies de session (ADR-0023, « Exposition HTTP ») : un par hôte, préfixe `__Host-` (Secure, sans
// Domain, Path=/), HttpOnly, SameSite=Strict, sans Max-Age ni Expires (cookie de session : la
// durée réelle est contrôlée côté serveur).
import type { SessionAudience } from '@amg/shared-schemas';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';

export const SESSION_COOKIE_NAMES: Readonly<Record<SessionAudience, string>> = Object.freeze({
  ADMIN: '__Host-amg_admin_sid',
  CLIENT: '__Host-amg_client_sid',
});

export const SESSION_COOKIE_OPTIONS = Object.freeze({
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'strict',
}) satisfies CookieSerializeOptions;

/** Pose le cookie de session (connexion et rotation, lot 4). */
export function setSessionCookie(
  reply: FastifyReply,
  audience: SessionAudience,
  token: string,
): void {
  void reply.setCookie(SESSION_COOKIE_NAMES[audience], token, { ...SESSION_COOKIE_OPTIONS });
}

/** Efface le cookie de session (déconnexion, session courante fermée). */
export function clearSessionCookie(reply: FastifyReply, audience: SessionAudience): void {
  void reply.clearCookie(SESSION_COOKIE_NAMES[audience], { ...SESSION_COOKIE_OPTIONS });
}
