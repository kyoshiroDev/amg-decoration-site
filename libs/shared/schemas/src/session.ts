// Sessions de l'atelier et de l'espace client (ADR-0023, « Magasin de sessions ») : réponses des
// routes `…/session` et `…/sessions`, paramètre de fermeture d'une session. Le jeton de session n'y
// figure jamais (cookie `HttpOnly` seulement) ; l'identifiant public est un aléa indépendant.
import { z } from 'zod';

export const SESSION_AUDIENCES = ['ADMIN', 'CLIENT'] as const;
export const sessionAudienceSchema = z.enum(SESSION_AUDIENCES);
export type SessionAudience = z.infer<typeof sessionAudienceSchema>;

/** Sessions simultanées au plus par compte (ADR-0023, ASVS 7.1.2). */
export const MAX_SESSIONS = { ADMIN: 3, CLIENT: 5 } as const satisfies Record<
  SessionAudience,
  number
>;

/** Identifiant public d'une session : 128 bits en base64url, sans remplissage. */
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

/** Jeton CSRF : HMAC-SHA-256 en base64url (43 caractères), à renvoyer dans `X-CSRF-Token`. */
export const csrfTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Paramètres de `DELETE …/sessions/:id`. */
export const sessionParamsSchema = z.strictObject({ id: sessionIdSchema });
export type SessionParams = z.infer<typeof sessionParamsSchema>;

const isoDate = z.iso.datetime({ offset: false });

/** `GET …/session` : session courante. */
export const currentSessionResponseSchema = z.strictObject({
  id: sessionIdSchema,
  audience: sessionAudienceSchema,
  createdAt: isoDate,
  lastSeenAt: isoDate,
  /** Échéance d'inactivité (prolongée à chaque requête), puis échéance absolue. */
  idleExpiresAt: isoDate,
  absoluteExpiresAt: isoDate,
  csrfToken: csrfTokenSchema,
});
export type CurrentSessionResponse = z.infer<typeof currentSessionResponseSchema>;

const sessionSummaryShape = {
  id: sessionIdSchema,
  current: z.boolean(),
  createdAt: isoDate,
  lastSeenAt: isoDate,
  /** Appareil approximatif (« Firefox sur Linux »), jamais l'en-tête brut. */
  device: z.string().min(1).max(64).nullable(),
};

/** Session listée côté espace client : sans aucune adresse IP. */
export const clientSessionSummarySchema = z.strictObject(sessionSummaryShape);

/** Session listée côté atelier : réseau tronqué (IPv4 /24, IPv6 /48), jamais l'IP complète. */
export const adminSessionSummarySchema = z.strictObject({
  ...sessionSummaryShape,
  network: z.string().min(1).max(64).nullable(),
});

export const clientSessionListResponseSchema = z.strictObject({
  sessions: z.array(clientSessionSummarySchema).max(MAX_SESSIONS.CLIENT),
});
export const adminSessionListResponseSchema = z.strictObject({
  sessions: z.array(adminSessionSummarySchema).max(MAX_SESSIONS.ADMIN),
});
export type ClientSessionSummary = z.infer<typeof clientSessionSummarySchema>;
export type AdminSessionSummary = z.infer<typeof adminSessionSummarySchema>;
export type ClientSessionListResponse = z.infer<typeof clientSessionListResponseSchema>;
export type AdminSessionListResponse = z.infer<typeof adminSessionListResponseSchema>;

/** Corps des réponses d'erreur de l'API : génériques, jamais le chemin ni le détail. */
export const errorResponseSchema = z.strictObject({
  statusCode: z.number().int().min(400).max(599),
  error: z.string().min(1).max(64),
  message: z.string().min(1).max(160),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
