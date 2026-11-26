// En-têtes de sécurité posés sur TOUTE réponse de l'API (succès, erreur, 404), juste avant l'envoi.
// L'API ne sert que du JSON : rien à exécuter, rien à encadrer, rien à mettre en cache.
// HSTS est posé par le middleware Traefik des hôtes admin./espace. (même origine que les CRM).
import type { FastifyInstance } from 'fastify';

export const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const satisfies Readonly<Record<string, string>>;

export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', (_request, reply, payload, done) => {
    void reply.headers(SECURITY_HEADERS);
    done(null, payload);
  });
}
