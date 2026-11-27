// Contrôle d'hôte au niveau de Fastify (ADR-0023, « Hôtes, gardes et limitation de débit ») : crochet
// `onRequest` racine, exécuté AVANT l'analyse du corps (type, taille, JSON) et avant Nest. Une route
// inconnue, une route de l'autre audience, un hôte inconnu reçoivent le même 404 générique, quel
// que soit le corps envoyé : un corps `text/xml`, un JSON invalide ou de plus de 64 Kio ne permet
// pas de distinguer une route qui existe sur l'autre hôte (415, 400, 413) d'une route inconnue.
// La garde Nest `HostGuard` refait le même contrôle (défense en profondeur) et pose l'audience.
// Ordre : après la limitation de débit (rate-limit.ts), qui compte donc toutes les requêtes, routes
// inconnues et hôtes inconnus compris : aucune différence de comptage entre ces cas.
import type { FastifyInstance } from 'fastify';
import { errorBody } from '../http/error-bodies.js';
import { routeAudience, type ServedHosts } from './served-hosts.js';

/** Routes servies quel que soit l'hôte (déclarées aussi `@AnyHost()` côté Nest). */
export const HOST_AGNOSTIC_ROUTES: readonly string[] = ['/api/health'];

export function registerHostGate(fastify: FastifyInstance, hosts: ServedHosts): void {
  fastify.addHook('onRequest', async (request, reply) => {
    const route = request.is404 ? undefined : request.routeOptions.url;
    if (route !== undefined && HOST_AGNOSTIC_ROUTES.includes(route)) return undefined;
    const hostAudience = hosts.audienceOf(request.headers.host);
    if (hostAudience !== undefined && routeAudience(route) === hostAudience) return undefined;
    return reply.code(404).send(errorBody(404));
  });
}
