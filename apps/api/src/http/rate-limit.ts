// Limitation de débit (ADR-0023, « Hôtes, gardes et limitation de débit ») : @fastify/rate-limit
// officiel, compteurs dans Redis (espace `amg:<env>:rl:`). Limite globale par IP appliquée par un
// crochet `onRequest` racine : elle vaut aussi pour les 404 (pas d'oracle entre une route qui existe
// et une route inconnue). Aucun en-tête `X-RateLimit-*` ; 429 générique avec `Retry-After`.
// Compteur indisponible (Redis en panne) : 503, jamais de passage sans limite.
//
// Aides du lot 4 (routes d'authentification) : `createKeyedLimiter` et `rateLimitKeys` (IP et compte
// visé, compte seul, IP seule ; l'email normalisé n'apparaît que haché dans Redis).
import { createHash } from 'node:crypto';
import rateLimit, { normalizeIP } from '@fastify/rate-limit';
import { emailSchema } from '@amg/shared-schemas';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { clientIp } from './client-info.js';
import { errorBody } from './error-bodies.js';

/** Limite globale : 300 requêtes par minute et par IP (IPv6 regroupées par /64). */
export const GLOBAL_RATE_LIMIT = Object.freeze({ max: 300, timeWindowMs: 60_000 });

/** Routes exemptées : la sonde de santé (locale, sans donnée, ne doit pas dépendre de Redis). */
export const RATE_LIMIT_EXEMPT_ROUTES: readonly string[] = ['/api/health'];

const IPV6_SUBNET = 64;

/** Aucun en-tête de compteur, ni avant ni après la limite (sauf `Retry-After` sur le 429). */
const NO_HEADERS = {
  'x-ratelimit-limit': false,
  'x-ratelimit-remaining': false,
  'x-ratelimit-reset': false,
} as const;

export interface RateLimitSetup {
  /** Client Redis ; `null` : mémoire du processus (tests seulement, refusé ailleurs par createApp). */
  readonly redis: Redis | null;
  /** Préfixe des clés de l'environnement (`amg:<env>:`). */
  readonly keyPrefix: string;
}

/** Clé d'IP du limiteur : IP retenue par le proxy de confiance, IPv6 regroupées par /64. */
export function ipKey(request: FastifyRequest): string {
  const ip = clientIp(request);
  return ip === null ? 'ip-inconnue' : normalizeIP(ip, IPV6_SUBNET);
}

function sendLimited(reply: FastifyReply, retryAfterSeconds: number): FastifyReply {
  return reply
    .code(429)
    .header('retry-after', String(Math.max(1, retryAfterSeconds)))
    .send(errorBody(429));
}

function sendUnavailable(reply: FastifyReply): FastifyReply {
  return reply.code(503).send(errorBody(503));
}

export async function registerRateLimit(
  fastify: FastifyInstance,
  setup: RateLimitSetup,
): Promise<void> {
  await fastify.register(rateLimit, {
    global: false,
    ...(setup.redis === null ? {} : { redis: setup.redis }),
    nameSpace: `${setup.keyPrefix}rl:`,
    skipOnError: false,
    ipv6Subnet: IPV6_SUBNET,
    addHeaders: { ...NO_HEADERS, 'retry-after': false },
    addHeadersOnExceeding: NO_HEADERS,
  });
  const limiter = fastify.createRateLimit({
    max: GLOBAL_RATE_LIMIT.max,
    timeWindow: GLOBAL_RATE_LIMIT.timeWindowMs,
    keyGenerator: (request) => `global:${ipKey(request)}`,
  });
  fastify.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url;
    if (route !== undefined && RATE_LIMIT_EXEMPT_ROUTES.includes(route)) return;
    let result: Awaited<ReturnType<typeof limiter>>;
    try {
      result = await limiter(request);
    } catch {
      return sendUnavailable(reply);
    }
    if (!result.isAllowed && result.isExceeded) return sendLimited(reply, result.ttlInSeconds);
    return undefined;
  });
}

/** Clés des limiteurs du lot 4 : l'email (normalisé) n'apparaît que haché. */
export const rateLimitKeys = Object.freeze({
  /** IP et compte visé. */
  ipAndAccount: (request: FastifyRequest, email: string): string =>
    `ip-account:${ipKey(request)}:${accountHash(email)}`,
  /** Compte visé seul (attaque répartie sur plusieurs IP). */
  account: (email: string): string => `account:${accountHash(email)}`,
  /** IP seule (une IP qui vise de nombreux comptes). */
  ip: (request: FastifyRequest): string => `ip:${ipKey(request)}`,
});

/** Empreinte SHA-256 de l'email normalisé (minuscules, espaces retirés), ou d'une valeur invalide. */
export function accountHash(email: string): string {
  const parsed = emailSchema.safeParse(email);
  const normalized = parsed.success ? parsed.data : email.trim().toLowerCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export interface KeyedLimiterSpec {
  /** Nom du limiteur, préfixe de ses clés (`login`, `activation`…). */
  readonly name: string;
  readonly max: number;
  readonly timeWindowMs: number;
}

/** `limited` : seuil dépassé ; erreur levée si le compteur est indisponible (à traduire en 503). */
export type KeyedLimiter = (request: FastifyRequest, key: string) => Promise<'allowed' | 'limited'>;

/** Limiteur à clé fournie par l'appelant (après lecture du corps), sur le même magasin. */
export function createKeyedLimiter(fastify: FastifyInstance, spec: KeyedLimiterSpec): KeyedLimiter {
  const keys = new WeakMap<FastifyRequest, string>();
  const limiter = fastify.createRateLimit({
    max: spec.max,
    timeWindow: spec.timeWindowMs,
    keyGenerator: (request) => `${spec.name}:${keys.get(request) ?? 'sans-cle'}`,
  });
  return async (request, key) => {
    keys.set(request, key);
    const result = await limiter(request);
    return !result.isAllowed && result.isExceeded ? 'limited' : 'allowed';
  };
}
