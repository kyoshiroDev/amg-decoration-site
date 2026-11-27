// Magasin de sessions sur Redis (ADR-0023, « Magasin de sessions ») : un script Lua par opération
// (session-scripts.ts), réponses relues par des schémas stricts. Toute erreur de Redis ou réponse
// inattendue devient `SessionStoreUnavailableError` (503) : jamais d'accès accordé par défaut.
import type { Redis } from 'ioredis';
import { z } from 'zod';
import {
  CREATE_SCRIPT,
  LIST_SCRIPT,
  REVOKE_ALL_SCRIPT,
  REVOKE_PUBLIC_ID_SCRIPT,
  REVOKE_SCRIPT,
  ROTATE_SCRIPT,
  VALIDATE_SCRIPT,
} from './session-scripts.js';
import { generatePublicId, generateSessionToken, sessionTokenHash } from './session-token.js';
import {
  SESSION_POLICIES,
  STORED_FIELDS,
  SessionStoreUnavailableError,
  storedSessionSchema,
  type CreatedSession,
  type IssuedSession,
  type NewSession,
  type OnceStore,
  type RotateOptions,
  type SessionAudience,
  type SessionLookup,
  type SessionPolicy,
  type SessionRecord,
  type SessionStore,
} from './session.types.js';

/** Ce dont le magasin a besoin d'un client Redis. */
export type SessionRedis = Pick<Redis, 'eval' | 'set'>;

export interface RedisSessionStoreOptions {
  readonly redis: SessionRedis;
  /** Préfixe des clés de l'environnement (`amg:<env>:`). */
  readonly keyPrefix: string;
  /** Horloge en millisecondes (injectée par les tests). */
  readonly now?: () => number;
  readonly policies?: Readonly<Record<SessionAudience, SessionPolicy>>;
}

const fieldsSchema = z.array(z.string()).length(STORED_FIELDS.length);
const evictedSchema = z.array(z.string().regex(/^[A-Za-z0-9_-]{22}$/)).max(16);
const lookupSchema = z.union([
  z.null(),
  z.tuple([z.literal('audience'), z.uuid(), z.string().regex(/^[A-Za-z0-9_-]{22}$/)]),
  z.tuple([z.literal('valid')], z.string()),
]);
const countSchema = z.number().int().min(0);
const listSchema = z.array(fieldsSchema).max(16);

function toRecord(fields: readonly string[]): SessionRecord {
  const entries = STORED_FIELDS.map((name, index) => [name, fields[index]] as const);
  return storedSessionSchema.parse(Object.fromEntries(entries));
}

export class RedisSessionStore implements SessionStore, OnceStore {
  readonly #redis: SessionRedis;
  readonly #sessionPrefix: string;
  readonly #indexPrefix: string;
  readonly #oncePrefix: string;
  readonly #now: () => number;
  readonly #policies: Readonly<Record<SessionAudience, SessionPolicy>>;

  constructor(options: RedisSessionStoreOptions) {
    this.#redis = options.redis;
    this.#sessionPrefix = `${options.keyPrefix}sess:`;
    this.#indexPrefix = `${options.keyPrefix}sess-idx:`;
    this.#oncePrefix = `${options.keyPrefix}once:`;
    this.#now = options.now ?? Date.now;
    this.#policies = options.policies ?? SESSION_POLICIES;
  }

  #indexKey(audience: SessionAudience, userId: string): string {
    return `${this.#indexPrefix}${audience}:${userId}`;
  }

  /** Exécute un script ; toute erreur, y compris de lecture de la réponse, devient 503. */
  async #run<T>(
    parse: (reply: unknown) => T,
    script: string,
    keys: readonly string[],
    args: readonly string[],
  ): Promise<T> {
    try {
      const reply: unknown = await this.#redis.eval(script, keys.length, ...keys, ...args);
      return parse(reply);
    } catch (error: unknown) {
      throw new SessionStoreUnavailableError({ cause: error });
    }
  }

  async create(session: NewSession): Promise<CreatedSession> {
    const policy = this.#policies[session.audience];
    const token = generateSessionToken();
    const member = sessionTokenHash(token);
    const publicId = generatePublicId();
    const now = Math.trunc(this.#now());
    const evicted = await this.#run(
      (reply) => evictedSchema.parse(reply),
      CREATE_SCRIPT,
      [`${this.#sessionPrefix}${member}`, this.#indexKey(session.audience, session.userId)],
      [
        String(now),
        publicId,
        session.userId,
        session.audience,
        session.stage,
        String(policy.absoluteLifetimeMs),
        String(policy.idleTimeoutMs),
        String(policy.maxSessions),
        session.device ?? '',
        session.network ?? '',
        member,
        this.#sessionPrefix,
      ],
    );
    return {
      token,
      evicted,
      record: {
        publicId,
        userId: session.userId,
        audience: session.audience,
        stage: session.stage,
        createdAt: now,
        lastSeenAt: now,
        absoluteExpiresAt: now + policy.absoluteLifetimeMs,
        idleTimeoutMs: policy.idleTimeoutMs,
        authenticatedAt: now,
        device: session.device,
        network: session.network,
      },
    };
  }

  async validate(token: string, audience: SessionAudience): Promise<SessionLookup> {
    const member = sessionTokenHash(token);
    return this.#run(
      (reply): SessionLookup => {
        const parsed = lookupSchema.parse(reply);
        if (parsed === null) return { status: 'absent' };
        if (parsed[0] === 'audience') {
          return { status: 'audience', userId: parsed[1], publicId: parsed[2] };
        }
        return { status: 'valid', record: toRecord(parsed.slice(1)) };
      },
      VALIDATE_SCRIPT,
      [`${this.#sessionPrefix}${member}`],
      [String(Math.trunc(this.#now())), audience, member, this.#sessionPrefix, this.#indexPrefix],
    );
  }

  async rotate(
    token: string,
    audience: SessionAudience,
    options: RotateOptions = {},
  ): Promise<IssuedSession | null> {
    const oldMember = sessionTokenHash(token);
    const newToken = generateSessionToken();
    const newMember = sessionTokenHash(newToken);
    const record = await this.#run(
      (reply) => {
        const parsed = lookupSchema.parse(reply);
        if (parsed?.[0] !== 'valid') return null;
        return toRecord(parsed.slice(1));
      },
      ROTATE_SCRIPT,
      [`${this.#sessionPrefix}${oldMember}`, `${this.#sessionPrefix}${newMember}`],
      [
        String(Math.trunc(this.#now())),
        audience,
        oldMember,
        newMember,
        generatePublicId(),
        options.stage ?? '',
        options.reauthenticated === true ? '1' : '0',
        this.#sessionPrefix,
        this.#indexPrefix,
      ],
    );
    return record === null ? null : { token: newToken, record };
  }

  async revoke(token: string, audience: SessionAudience): Promise<SessionRecord | null> {
    const member = sessionTokenHash(token);
    return this.#run(
      (reply) => (reply === null ? null : toRecord(fieldsSchema.parse(reply))),
      REVOKE_SCRIPT,
      [`${this.#sessionPrefix}${member}`],
      [audience, member, this.#sessionPrefix, this.#indexPrefix],
    );
  }

  async revokeByPublicId(
    userId: string,
    audience: SessionAudience,
    publicId: string,
  ): Promise<boolean> {
    const revoked = await this.#run(
      (reply) => countSchema.parse(reply),
      REVOKE_PUBLIC_ID_SCRIPT,
      [this.#indexKey(audience, userId)],
      [publicId, this.#sessionPrefix],
    );
    return revoked === 1;
  }

  async revokeAll(userId: string, audience: SessionAudience): Promise<number> {
    return this.#run(
      (reply) => countSchema.parse(reply),
      REVOKE_ALL_SCRIPT,
      [this.#indexKey(audience, userId)],
      [this.#sessionPrefix],
    );
  }

  async list(userId: string, audience: SessionAudience): Promise<readonly SessionRecord[]> {
    return this.#run(
      (reply) => listSchema.parse(reply).map(toRecord),
      LIST_SCRIPT,
      [this.#indexKey(audience, userId)],
      [String(Math.trunc(this.#now())), this.#sessionPrefix],
    );
  }

  /** Anti-répétition : `SET NX PX`, vrai si la clé n'existait pas. */
  async claim(key: string, windowMs: number): Promise<boolean> {
    try {
      const reply = await this.#redis.set(`${this.#oncePrefix}${key}`, '1', 'PX', windowMs, 'NX');
      return reply === 'OK';
    } catch (error: unknown) {
      throw new SessionStoreUnavailableError({ cause: error });
    }
  }
}
