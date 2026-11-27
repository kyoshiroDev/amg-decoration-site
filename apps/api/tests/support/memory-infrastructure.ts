// Infrastructure en mémoire des tests HTTP (`npm run test`, sans Redis ni base) : magasin de sessions
// aux mêmes règles que les scripts Lua (session-scripts.ts ; contrat commun éprouvé contre Redis
// par tests/integration/session-store.test.ts), journal qui retient les événements, limitation de
// débit en mémoire du processus. Interrupteur `unavailable` : toute opération échoue comme un Redis
// en panne. Jamais utilisable hors de NODE_ENV=test (createApp le refuse).
import type { JournalWriter, SecurityEventInput } from '@amg/api-db';
import type { Infrastructure } from '../../src/infrastructure/infrastructure.js';
import {
  generatePublicId,
  generateSessionToken,
  sessionTokenHash,
} from '../../src/session/session-token.js';
import {
  SESSION_POLICIES,
  SessionStoreUnavailableError,
  type CreatedSession,
  type IssuedSession,
  type NewSession,
  type OnceStore,
  type RotateOptions,
  type SessionAudience,
  type SessionLookup,
  type SessionRecord,
  type SessionStore,
} from '../../src/session/session.types.js';

/** Horloge des tests : avance à la main. */
export class TestClock {
  #now: number;

  constructor(start = Date.UTC(2026, 10, 27, 9, 0, 0)) {
    this.#now = start;
  }

  readonly now = (): number => this.#now;

  advance(ms: number): void {
    this.#now += ms;
  }
}

function alive(record: SessionRecord, now: number): boolean {
  return now - record.lastSeenAt < record.idleTimeoutMs && now < record.absoluteExpiresAt;
}

export class MemorySessionStore implements SessionStore, OnceStore {
  /** Panne simulée : chaque opération lève l'erreur du vrai magasin. */
  unavailable = false;
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #claims = new Map<string, number>();
  readonly #clock: TestClock;

  constructor(clock: TestClock) {
    this.#clock = clock;
  }

  #check(): void {
    if (this.unavailable) throw new SessionStoreUnavailableError();
  }

  #owned(userId: string, audience: SessionAudience): [string, SessionRecord][] {
    const now = this.#clock.now();
    const owned: [string, SessionRecord][] = [];
    for (const [hash, record] of this.#sessions) {
      if (record.userId !== userId || record.audience !== audience) continue;
      if (alive(record, now)) owned.push([hash, record]);
      else this.#sessions.delete(hash);
    }
    return owned.sort(([, a], [, b]) => a.createdAt - b.createdAt);
  }

  create(session: NewSession): Promise<CreatedSession> {
    this.#check();
    const policy = SESSION_POLICIES[session.audience];
    const now = this.#clock.now();
    const token = generateSessionToken();
    const record: SessionRecord = {
      publicId: generatePublicId(),
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
    };
    const owned = this.#owned(session.userId, session.audience);
    this.#sessions.set(sessionTokenHash(token), record);
    const evicted: string[] = [];
    for (const [hash, old] of owned.slice(0, Math.max(0, owned.length + 1 - policy.maxSessions))) {
      this.#sessions.delete(hash);
      evicted.push(old.publicId);
    }
    return Promise.resolve({ token, record, evicted });
  }

  validate(token: string, audience: SessionAudience): Promise<SessionLookup> {
    this.#check();
    const hash = sessionTokenHash(token);
    const record = this.#sessions.get(hash);
    const now = this.#clock.now();
    if (record === undefined) return Promise.resolve({ status: 'absent' });
    if (!alive(record, now)) {
      this.#sessions.delete(hash);
      return Promise.resolve({ status: 'absent' });
    }
    if (record.audience !== audience) {
      return Promise.resolve({
        status: 'audience',
        userId: record.userId,
        publicId: record.publicId,
      });
    }
    const touched = { ...record, lastSeenAt: now };
    this.#sessions.set(hash, touched);
    return Promise.resolve({ status: 'valid', record: touched });
  }

  async rotate(
    token: string,
    audience: SessionAudience,
    options: RotateOptions = {},
  ): Promise<IssuedSession | null> {
    const lookup = await this.validate(token, audience);
    if (lookup.status !== 'valid') return null;
    const now = this.#clock.now();
    const newToken = generateSessionToken();
    const record: SessionRecord = {
      ...lookup.record,
      publicId: generatePublicId(),
      stage: options.stage ?? lookup.record.stage,
      lastSeenAt: now,
      authenticatedAt: options.reauthenticated === true ? now : lookup.record.authenticatedAt,
    };
    this.#sessions.delete(sessionTokenHash(token));
    this.#sessions.set(sessionTokenHash(newToken), record);
    return { token: newToken, record };
  }

  revoke(token: string, audience: SessionAudience): Promise<SessionRecord | null> {
    this.#check();
    const hash = sessionTokenHash(token);
    const record = this.#sessions.get(hash);
    if (record?.audience !== audience) return Promise.resolve(null);
    this.#sessions.delete(hash);
    return Promise.resolve(record);
  }

  revokeByPublicId(userId: string, audience: SessionAudience, publicId: string): Promise<boolean> {
    this.#check();
    for (const [hash, record] of this.#owned(userId, audience)) {
      if (record.publicId === publicId) {
        this.#sessions.delete(hash);
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  revokeAll(userId: string, audience: SessionAudience): Promise<number> {
    this.#check();
    const owned = this.#owned(userId, audience);
    for (const [hash] of owned) this.#sessions.delete(hash);
    return Promise.resolve(owned.length);
  }

  list(userId: string, audience: SessionAudience): Promise<readonly SessionRecord[]> {
    this.#check();
    return Promise.resolve(this.#owned(userId, audience).map(([, record]) => record));
  }

  release(key: string): Promise<void> {
    this.#check();
    this.#claims.delete(key);
    return Promise.resolve();
  }

  claim(key: string, windowMs: number): Promise<boolean> {
    this.#check();
    const now = this.#clock.now();
    const until = this.#claims.get(key);
    if (until !== undefined && until > now) return Promise.resolve(false);
    this.#claims.set(key, now + windowMs);
    return Promise.resolve(true);
  }
}

/** Journal des tests : événements décodés depuis les valeurs de l'INSERT paramétré. */
export class MemoryJournal {
  readonly events: SecurityEventInput[] = [];
  /** Panne simulée de la base du journal. */
  failing = false;

  readonly writer: JournalWriter = {
    $executeRaw: ((_strings: TemplateStringsArray, ...values: unknown[]) => {
      if (this.failing) return Promise.reject(new Error('journal indisponible'));
      const [type, userId, actorId, ip, device, details] = values;
      this.events.push({
        type,
        userId,
        actorId,
        ip,
        device,
        details: typeof details === 'string' ? (JSON.parse(details) as unknown) : details,
      } as SecurityEventInput);
      return Promise.resolve(1);
    }) as unknown as JournalWriter['$executeRaw'],
  };
}

export interface MemoryInfrastructure extends Infrastructure {
  readonly clock: TestClock;
  readonly store: MemorySessionStore;
  readonly journalEvents: MemoryJournal;
}

export function memoryInfrastructure(clock = new TestClock()): MemoryInfrastructure {
  const store = new MemorySessionStore(clock);
  const journal = new MemoryJournal();
  return {
    clock,
    store,
    journalEvents: journal,
    sessionStore: store,
    onceStore: store,
    journal: journal.writer,
    rateLimitRedis: null,
    start: () => undefined,
    close: () => Promise.resolve(),
  };
}
