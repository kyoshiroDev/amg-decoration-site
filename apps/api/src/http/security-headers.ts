// En-têtes de sécurité posés sur TOUTE réponse de l'API (succès, erreur, 404), juste avant l'envoi.
// L'API ne sert que du JSON : rien à exécuter, rien à encadrer, rien à mettre en cache.
// HSTS compris : aucun middleware du Traefik partagé ne pose d'en-tête pour AMG (ADR-0020), chaque
// conteneur AMG pose les siens. Même valeur que le site (apps/site/nginx/nginx.conf). Posé partout,
// y compris en développement local en HTTP : les navigateurs l'ignorent sur une réponse non HTTPS
// (RFC 6797, 8.1), et une seule liste d'en-têtes évite qu'un mode oublie HSTS.
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const satisfies Readonly<Record<string, string>>;

/** Corps unique des requêtes rejetées par le routeur : ne reprend jamais le chemin reçu. */
export const BAD_REQUEST_BODY = {
  statusCode: 400,
  error: 'Bad Request',
  message: 'Requête invalide',
} as const;

export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', (_request, reply, payload, done) => {
    void reply.headers(SECURITY_HEADERS);
    done(null, payload);
  });
}

/**
 * Gestionnaire `frameworkErrors` de Fastify : le routeur rejette une URL mal encodée
 * (FST_ERR_BAD_URL) ou un paramètre trop long (FST_ERR_MAX_PARAM_LENGTH) dans un contexte sans
 * aucun hook, donc sans `onSend` : les en-têtes sont posés ici. Réponse 400 générique, sans le
 * chemin (que le gestionnaire par défaut recopie dans le corps) ni le code d'erreur interne.
 */
export function handleFrameworkError(
  _error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  void reply.code(400).headers(SECURITY_HEADERS).send(BAD_REQUEST_BODY);
}
