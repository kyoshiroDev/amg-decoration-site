// Modèle des sessions (ADR-0023, « Sessions : durées et ré-authentification » et « Magasin de
// sessions ») : politique par audience, enregistrement relu depuis le magasin, contrat du magasin.
import { MAX_SESSIONS, type SessionAudience } from '@amg/shared-schemas';
import { z } from 'zod';

export type { SessionAudience } from '@amg/shared-schemas';

/**
 * Étape d'authentification portée par la session. Le lot 3 ne connaît que `AUTHENTICATED` ; le lot 4
 * ajoute les étapes intermédiaires (mot de passe vérifié, TOTP attendu ou à enrôler), chacune
 * admise seulement sur les routes qui la déclarent.
 */
export const SESSION_STAGES = ['AUTHENTICATED'] as const;
export type SessionStage = (typeof SESSION_STAGES)[number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface SessionPolicy {
  readonly idleTimeoutMs: number;
  readonly absoluteLifetimeMs: number;
  readonly maxSessions: number;
}

/** Tableau de l'ADR : admin 30 min / 12 h / 3 sessions, client 24 h / 14 j / 5 sessions. */
export const SESSION_POLICIES: Readonly<Record<SessionAudience, SessionPolicy>> = Object.freeze({
  ADMIN: {
    idleTimeoutMs: 30 * MINUTE,
    absoluteLifetimeMs: 12 * HOUR,
    maxSessions: MAX_SESSIONS.ADMIN,
  },
  CLIENT: { idleTimeoutMs: DAY, absoluteLifetimeMs: 14 * DAY, maxSessions: MAX_SESSIONS.CLIENT },
});

/** Session telle que relue (dates en millisecondes depuis l'époque). */
export interface SessionRecord {
  readonly publicId: string;
  readonly userId: string;
  readonly audience: SessionAudience;
  readonly stage: SessionStage;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly absoluteExpiresAt: number;
  readonly idleTimeoutMs: number;
  /** Dernière authentification complète (ré-authentification récente, lot 4). */
  readonly authenticatedAt: number;
  readonly device: string | null;
  readonly network: string | null;
}

/** Échéance d'inactivité d'une session (prolongée à chaque requête), bornée par l'échéance absolue. */
export function idleExpiresAt(record: SessionRecord): number {
  return Math.min(record.lastSeenAt + record.idleTimeoutMs, record.absoluteExpiresAt);
}

export interface NewSession {
  readonly userId: string;
  readonly audience: SessionAudience;
  readonly stage: SessionStage;
  readonly device: string | null;
  readonly network: string | null;
}

export interface IssuedSession {
  /** Jeton en clair, à ne poser que dans le cookie : jamais journalisé ni stocké. */
  readonly token: string;
  readonly record: SessionRecord;
}

export interface CreatedSession extends IssuedSession {
  /** Identifiants publics des sessions révoquées au-delà de la limite (les plus anciennes). */
  readonly evicted: readonly string[];
}

/** Résultat de la validation d'un jeton présenté à une audience. */
export type SessionLookup =
  | { readonly status: 'valid'; readonly record: SessionRecord }
  | { readonly status: 'absent' }
  /** Session vivante d'une autre audience : refusée, sans être prolongée ni supprimée. */
  | { readonly status: 'audience'; readonly userId: string; readonly publicId: string };

export interface RotateOptions {
  /** Nouvelle étape (lot 4 : mot de passe → TOTP → authentifié). */
  readonly stage?: SessionStage;
  /** Authentification complète à l'instant : date de dernière authentification remise à jour. */
  readonly reauthenticated?: boolean;
}

/**
 * Contrat du magasin. Toute erreur (Redis indisponible, réponse illisible) est levée en
 * `SessionStoreUnavailableError` : jamais d'accès accordé par défaut.
 */
export interface SessionStore {
  create(session: NewSession): Promise<CreatedSession>;
  validate(token: string, audience: SessionAudience): Promise<SessionLookup>;
  /** Nouvelle session sous un nouveau jeton, l'ancienne supprimée ; `null` si invalide. */
  rotate(
    token: string,
    audience: SessionAudience,
    options?: RotateOptions,
  ): Promise<IssuedSession | null>;
  /** Révoque la session du jeton (de cette audience) ; rend l'enregistrement révoqué. */
  revoke(token: string, audience: SessionAudience): Promise<SessionRecord | null>;
  /** Révoque une session du compte par son identifiant public ; `false` si inconnue de ce compte. */
  revokeByPublicId(userId: string, audience: SessionAudience, publicId: string): Promise<boolean>;
  /** Révoque toutes les sessions du compte ; rend leur nombre. */
  revokeAll(userId: string, audience: SessionAudience): Promise<number>;
  /** Sessions vivantes du compte, de la plus ancienne à la plus récente. */
  list(userId: string, audience: SessionAudience): Promise<readonly SessionRecord[]>;
}

/** Anti-répétition (événements de journal) : `true` la première fois dans la fenêtre. */
export interface OnceStore {
  claim(key: string, windowMs: number): Promise<boolean>;
}

/** Magasin indisponible ou réponse inattendue : la requête reçoit 503, sans détail. */
export class SessionStoreUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Magasin de sessions indisponible', options);
    this.name = 'SessionStoreUnavailableError';
  }
}

/** Format d'un enregistrement relu (champs du hachage Redis), refusé en bloc s'il s'écarte. */
const millis = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number);
export const storedSessionSchema = z
  .strictObject({
    v: z.literal('1'),
    pid: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    uid: z.uuid(),
    aud: z.enum(['ADMIN', 'CLIENT']),
    stg: z.enum(SESSION_STAGES),
    ca: millis,
    ls: millis,
    ae: millis,
    it: millis,
    aa: millis,
    dev: z.string().max(64),
    net: z.string().max(64),
  })
  .transform((raw): SessionRecord => ({
    publicId: raw.pid,
    userId: raw.uid,
    audience: raw.aud,
    stage: raw.stg,
    createdAt: raw.ca,
    lastSeenAt: raw.ls,
    absoluteExpiresAt: raw.ae,
    idleTimeoutMs: raw.it,
    authenticatedAt: raw.aa,
    device: raw.dev === '' ? null : raw.dev,
    network: raw.net === '' ? null : raw.net,
  }));

/** Ordre des champs dans les réponses des scripts (HMGET). */
export const STORED_FIELDS = [
  'v',
  'pid',
  'uid',
  'aud',
  'stg',
  'ca',
  'ls',
  'ae',
  'it',
  'aa',
  'dev',
  'net',
] as const;
