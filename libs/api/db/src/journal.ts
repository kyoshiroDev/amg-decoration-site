// Écriture du journal de sécurité (ADR-0023, lot 3) : sur le pool dédié (`amg_journal`, client créé
// avec `scope: 'journal'`), un seul INSERT paramétré par événement, en autocommit, jamais dans une
// transaction qui toucherait d'autres tables (un déclencheur du propriétaire des tables pourrait la
// faire annuler, événement compris). Table et types qualifiés (`public.`) : aucun nom résolu par le
// chemin de recherche. Date et identifiant sont ceux de la base (déclencheur du journal).
//
// `details` est validé par un schéma strict propre à chaque type d'événement : un type sans schéma
// déclaré ici ne peut pas être écrit (chaque lot ajoute les siens). Aucune donnée de projet, aucun
// secret, aucun jeton : identifiants, motifs et compteurs seulement.
import { z } from 'zod';
import type { PrismaClient, SecurityEventType } from './generated/prisma/client.js';

/** Audience d'une session : atelier (`ADMIN`) ou espace client (`CLIENT`). */
export const journalAudienceSchema = z.enum(['ADMIN', 'CLIENT']);

/** Identifiant public d'une session : 128 bits en base64url (jamais le jeton ni son empreinte). */
export const journalSessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

/** Contrôles CSRF manquants (ADR-0023, « Exposition HTTP »). */
export const CSRF_CHECKS = ['token', 'fetch-site', 'origin'] as const;

/** Appareil approximatif (famille de navigateur et de système), jamais l'en-tête brut. */
export const DEVICE_LABEL_MAX_LENGTH = 64;

const common = {
  /** Compte concerné (absent si inconnu). */
  userId: z.uuid().nullable(),
  /** Auteur de l'action quand il diffère du compte concerné (révocation par l'admin, lot 4). */
  actorId: z.uuid().nullable(),
  ip: z.union([z.ipv4(), z.ipv6()]).nullable(),
  device: z.string().min(1).max(DEVICE_LABEL_MAX_LENGTH).nullable(),
};

/** Événements que l'API sait écrire, avec le contenu exact de `details`. */
export const securityEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('LOGOUT'),
    ...common,
    details: z.strictObject({ audience: journalAudienceSchema }),
  }),
  z.strictObject({
    type: z.literal('SESSION_REVOKED'),
    ...common,
    details: z.strictObject({
      audience: journalAudienceSchema,
      /** `self` : fermée par son titulaire ; `limit` : la plus ancienne, au-delà de la limite. */
      reason: z.enum(['self', 'limit']),
      sessionId: journalSessionIdSchema,
    }),
  }),
  z.strictObject({
    type: z.literal('ACCESS_DENIED'),
    ...common,
    details: z.strictObject({
      /** Audience de l'hôte servi. */
      audience: journalAudienceSchema,
      /** `audience` : session d'une autre audience présentée à cet hôte. */
      reason: z.enum(['audience']),
    }),
  }),
  z.strictObject({
    type: z.literal('CSRF_REJECTED'),
    ...common,
    details: z.strictObject({
      audience: journalAudienceSchema,
      failed: z.array(z.enum(CSRF_CHECKS)).min(1).max(CSRF_CHECKS.length),
    }),
  }),
]);

export type SecurityEventInput = z.input<typeof securityEventSchema>;

/** Types écrits par ce module : tous doivent exister dans l'énumération de la base. */
export type JournaledEventType = SecurityEventInput['type'];
export const JOURNALED_EVENT_TYPES = securityEventSchema.options.map(
  (option) => option.shape.type.value,
) satisfies readonly SecurityEventType[];

/** Ce dont l'écriture a besoin d'un client Prisma (le vrai, ou un double de test). */
export type JournalWriter = Pick<PrismaClient, '$executeRaw'>;

/**
 * Valide puis écrit un événement. Lève une `ZodError` (événement mal formé, rien n'est écrit) ou
 * l'erreur de la base ; l'appelant journalise l'échec sans donnée personnelle.
 */
export async function writeSecurityEvent(
  client: JournalWriter,
  event: SecurityEventInput,
): Promise<void> {
  const parsed = securityEventSchema.parse(event);
  const details = JSON.stringify(parsed.details);
  await client.$executeRaw`INSERT INTO public.security_events (type, user_id, actor_id, ip, device, details)
    VALUES (CAST(${parsed.type} AS public.security_event_type), CAST(${parsed.userId} AS uuid),
            CAST(${parsed.actorId} AS uuid), CAST(${parsed.ip} AS inet), ${parsed.device},
            CAST(${details} AS jsonb))`;
}
