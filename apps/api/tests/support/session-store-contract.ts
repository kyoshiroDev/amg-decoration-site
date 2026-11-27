// Contrat du magasin de sessions (ADR-0023, « Magasin de sessions »), éprouvé à l'identique sur le
// magasin en mémoire des tests HTTP (tests/unit) et sur le vrai magasin Redis et ses scripts Lua
// (tests/integration) : expiration d'inactivité et absolue, audience, rotation, révocations, limite
// de sessions simultanées, liste, anti-répétition.
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SESSION_POLICIES,
  type SessionStore,
  type OnceStore,
} from '../../src/session/session.types.js';
import { generateSessionToken } from '../../src/session/session-token.js';
import type { TestClock } from './memory-infrastructure.js';

export interface ContractSubject {
  readonly store: SessionStore & OnceStore;
  readonly clock: TestClock;
  readonly cleanup: () => Promise<void>;
}

const MINUTE = 60_000;

export function describeSessionStoreContract(
  name: string,
  makeSubject: () => Promise<ContractSubject>,
): void {
  describe(`contrat du magasin de sessions : ${name}`, () => {
    let subject: ContractSubject | undefined;

    afterEach(async () => {
      await subject?.cleanup();
      subject = undefined;
    });

    async function setup(): Promise<ContractSubject> {
      subject = await makeSubject();
      return subject;
    }

    const newSession = (audience: 'ADMIN' | 'CLIENT', userId = randomUUID()) => ({
      userId,
      audience,
      stage: 'AUTHENTICATED' as const,
      device: 'Firefox sur Linux',
      network: '203.0.113.0/24',
    });

    it('crée une session relue à l’identique, sans jamais rendre le jeton dans l’enregistrement', async () => {
      const { store } = await setup();
      const created = await store.create(newSession('CLIENT'));
      expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(created.evicted).toEqual([]);
      const lookup = await store.validate(created.token, 'CLIENT');
      expect(lookup).toEqual({ status: 'valid', record: created.record });
      expect(JSON.stringify(created.record)).not.toContain(created.token);
    });

    it('prolonge la session à chaque validation (dernière activité)', async () => {
      const { store, clock } = await setup();
      const { token, record } = await store.create(newSession('ADMIN'));
      clock.advance(10 * MINUTE);
      const lookup = await store.validate(token, 'ADMIN');
      expect(lookup.status === 'valid' && lookup.record.lastSeenAt).toBe(
        record.createdAt + 10 * MINUTE,
      );
    });

    it.each(['ADMIN', 'CLIENT'] as const)(
      'expire une session %s par inactivité, et la supprime',
      async (audience) => {
        const { store, clock } = await setup();
        const { token, record } = await store.create(newSession(audience));
        clock.advance(SESSION_POLICIES[audience].idleTimeoutMs - 1);
        expect((await store.validate(token, audience)).status).toBe('valid');
        clock.advance(SESSION_POLICIES[audience].idleTimeoutMs);
        expect(await store.validate(token, audience)).toEqual({ status: 'absent' });
        // Supprimée : un retour en arrière de l'horloge ne la ressuscite pas.
        clock.advance(-SESSION_POLICIES[audience].idleTimeoutMs);
        expect(await store.validate(token, audience)).toEqual({ status: 'absent' });
        expect(await store.list(record.userId, audience)).toEqual([]);
      },
    );

    it('expire une session admin à 12 h même active', async () => {
      const { store, clock } = await setup();
      const { token, record } = await store.create(newSession('ADMIN'));
      const step = 25 * MINUTE;
      while (clock.now() + step < record.absoluteExpiresAt) {
        clock.advance(step);
        expect((await store.validate(token, 'ADMIN')).status).toBe('valid');
      }
      clock.advance(record.absoluteExpiresAt - clock.now());
      expect(await store.validate(token, 'ADMIN')).toEqual({ status: 'absent' });
      expect(record.absoluteExpiresAt - record.createdAt).toBe(12 * 60 * MINUTE);
    });

    it('expire une session client à 14 jours même active', async () => {
      const { store, clock } = await setup();
      const { token, record } = await store.create(newSession('CLIENT'));
      const step = 23 * 60 * MINUTE;
      while (clock.now() + step < record.absoluteExpiresAt) {
        clock.advance(step);
        expect((await store.validate(token, 'CLIENT')).status).toBe('valid');
      }
      clock.advance(record.absoluteExpiresAt - clock.now());
      expect(await store.validate(token, 'CLIENT')).toEqual({ status: 'absent' });
      expect(record.absoluteExpiresAt - record.createdAt).toBe(14 * 24 * 60 * MINUTE);
    });

    it('refuse une session présentée à l’autre audience, sans la prolonger ni la supprimer', async () => {
      const { store, clock } = await setup();
      const { token, record } = await store.create(newSession('CLIENT'));
      clock.advance(5 * MINUTE);
      expect(await store.validate(token, 'ADMIN')).toEqual({
        status: 'audience',
        userId: record.userId,
        publicId: record.publicId,
      });
      const lookup = await store.validate(token, 'CLIENT');
      expect(lookup.status === 'valid' && lookup.record.lastSeenAt).toBe(
        record.createdAt + 5 * MINUTE,
      );
    });

    it('ignore un jeton inconnu', async () => {
      const { store } = await setup();
      expect(await store.validate(generateSessionToken(), 'ADMIN')).toEqual({ status: 'absent' });
    });

    it('rotation : nouveau jeton et nouvel identifiant, l’ancien ne sert plus, durée absolue conservée', async () => {
      const { store, clock } = await setup();
      const { token, record } = await store.create(newSession('ADMIN'));
      clock.advance(3 * MINUTE);
      const rotated = await store.rotate(token, 'ADMIN', { reauthenticated: true });
      expect(rotated).not.toBeNull();
      if (rotated === null) return;
      expect(rotated.token).not.toBe(token);
      expect(rotated.record.publicId).not.toBe(record.publicId);
      expect(rotated.record.createdAt).toBe(record.createdAt);
      expect(rotated.record.absoluteExpiresAt).toBe(record.absoluteExpiresAt);
      expect(rotated.record.authenticatedAt).toBe(record.createdAt + 3 * MINUTE);
      expect(await store.validate(token, 'ADMIN')).toEqual({ status: 'absent' });
      expect((await store.validate(rotated.token, 'ADMIN')).status).toBe('valid');
      const listed = await store.list(record.userId, 'ADMIN');
      expect(listed.map((session) => session.publicId)).toEqual([rotated.record.publicId]);
      // Un second usage de l'ancien jeton (rotation concurrente) n'aboutit pas.
      expect(await store.rotate(token, 'ADMIN')).toBeNull();
    });

    it('rotation refusée pour une session expirée ou d’une autre audience', async () => {
      const { store, clock } = await setup();
      const client = await store.create(newSession('CLIENT'));
      expect(await store.rotate(client.token, 'ADMIN')).toBeNull();
      expect((await store.validate(client.token, 'CLIENT')).status).toBe('valid');
      clock.advance(SESSION_POLICIES.CLIENT.idleTimeoutMs);
      expect(await store.rotate(client.token, 'CLIENT')).toBeNull();
    });

    it('révoque une session par son jeton', async () => {
      const { store } = await setup();
      const { token, record } = await store.create(newSession('ADMIN'));
      expect(await store.revoke(token, 'CLIENT')).toBeNull();
      expect(await store.revoke(token, 'ADMIN')).toEqual(record);
      expect(await store.validate(token, 'ADMIN')).toEqual({ status: 'absent' });
      expect(await store.revoke(token, 'ADMIN')).toBeNull();
    });

    it('révoque une session par identifiant public, dans le compte seulement', async () => {
      const { store } = await setup();
      const mine = await store.create(newSession('CLIENT'));
      const other = await store.create(newSession('CLIENT'));
      expect(
        await store.revokeByPublicId(mine.record.userId, 'CLIENT', other.record.publicId),
      ).toBe(false);
      expect((await store.validate(other.token, 'CLIENT')).status).toBe('valid');
      expect(await store.revokeByPublicId(mine.record.userId, 'CLIENT', mine.record.publicId)).toBe(
        true,
      );
      expect(await store.validate(mine.token, 'CLIENT')).toEqual({ status: 'absent' });
    });

    it('révoque toutes les sessions d’un compte, pas celles des autres', async () => {
      const { store } = await setup();
      const userId = randomUUID();
      const first = await store.create(newSession('CLIENT', userId));
      const second = await store.create(newSession('CLIENT', userId));
      const other = await store.create(newSession('CLIENT'));
      expect(await store.revokeAll(userId, 'CLIENT')).toBe(2);
      expect(await store.validate(first.token, 'CLIENT')).toEqual({ status: 'absent' });
      expect(await store.validate(second.token, 'CLIENT')).toEqual({ status: 'absent' });
      expect((await store.validate(other.token, 'CLIENT')).status).toBe('valid');
      expect(await store.revokeAll(userId, 'CLIENT')).toBe(0);
    });

    it.each(['ADMIN', 'CLIENT'] as const)(
      'limite les sessions simultanées %s : la plus ancienne est révoquée',
      async (audience) => {
        const { store, clock } = await setup();
        const userId = randomUUID();
        const max = SESSION_POLICIES[audience].maxSessions;
        const sessions = [];
        for (let i = 0; i < max; i += 1) {
          sessions.push(await store.create(newSession(audience, userId)));
          clock.advance(1_000);
        }
        const extra = await store.create(newSession(audience, userId));
        const [oldest] = sessions;
        expect(extra.evicted).toEqual([oldest?.record.publicId]);
        expect(await store.validate(oldest?.token ?? '', audience)).toEqual({ status: 'absent' });
        const listed = await store.list(userId, audience);
        expect(listed).toHaveLength(max);
        expect(listed.at(-1)?.publicId).toBe(extra.record.publicId);
      },
    );

    it('une session expirée ne compte pas dans la limite', async () => {
      const { store, clock } = await setup();
      const userId = randomUUID();
      for (let i = 0; i < SESSION_POLICIES.ADMIN.maxSessions; i += 1) {
        await store.create(newSession('ADMIN', userId));
      }
      clock.advance(SESSION_POLICIES.ADMIN.idleTimeoutMs);
      const fresh = await store.create(newSession('ADMIN', userId));
      expect(fresh.evicted).toEqual([]);
      expect(await store.list(userId, 'ADMIN')).toEqual([fresh.record]);
    });

    it('liste les sessions vivantes du compte, de la plus ancienne à la plus récente', async () => {
      const { store, clock } = await setup();
      const userId = randomUUID();
      const first = await store.create(newSession('CLIENT', userId));
      clock.advance(1_000);
      const second = await store.create({
        ...newSession('CLIENT', userId),
        device: null,
        network: null,
      });
      await store.create(newSession('ADMIN', userId));
      expect(await store.list(userId, 'CLIENT')).toEqual([first.record, second.record]);
      expect(second.record.device).toBeNull();
    });

    it('anti-répétition : une seule fois par fenêtre', async () => {
      const { store } = await setup();
      const key = `contrat:${randomUUID()}`;
      expect(await store.claim(key, MINUTE)).toBe(true);
      expect(await store.claim(key, MINUTE)).toBe(false);
      expect(await store.claim(`${key}:autre`, MINUTE)).toBe(true);
      await store.release(key);
      expect(await store.claim(key, MINUTE)).toBe(true);
    });
  });
}
