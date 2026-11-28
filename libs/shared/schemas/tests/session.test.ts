import { describe, expect, it } from 'vitest';
import {
  adminSessionListResponseSchema,
  clientSessionListResponseSchema,
  currentSessionResponseSchema,
  sessionParamsSchema,
} from '../src/session.js';

const SUMMARY = {
  id: 'AAAAAAAAAAAAAAAAAAAAAA',
  current: true,
  createdAt: '2026-11-27T10:00:00.000Z',
  lastSeenAt: '2026-11-27T10:05:00.000Z',
  device: 'Firefox sur Linux',
};

describe('schémas des sessions', () => {
  it('accepte une session courante conforme', () => {
    expect(
      currentSessionResponseSchema.safeParse({
        id: SUMMARY.id,
        audience: 'CLIENT',
        createdAt: SUMMARY.createdAt,
        lastSeenAt: SUMMARY.lastSeenAt,
        idleExpiresAt: '2026-11-28T10:05:00.000Z',
        absoluteExpiresAt: '2026-12-11T10:00:00.000Z',
        csrfToken: 'a'.repeat(43),
      }).success,
    ).toBe(true);
  });

  it('refuse toute adresse réseau dans la liste de l’espace client', () => {
    expect(
      clientSessionListResponseSchema.safeParse({
        sessions: [{ ...SUMMARY, network: '203.0.113.0/24' }],
      }).success,
    ).toBe(false);
    expect(clientSessionListResponseSchema.safeParse({ sessions: [SUMMARY] }).success).toBe(true);
  });

  it('borne la liste au nombre de sessions simultanées', () => {
    const admin = { ...SUMMARY, network: null };
    expect(
      adminSessionListResponseSchema.safeParse({ sessions: [admin, admin, admin] }).success,
    ).toBe(true);
    expect(
      adminSessionListResponseSchema.safeParse({ sessions: [admin, admin, admin, admin] }).success,
    ).toBe(false);
  });

  it.each(['', 'x', 'A'.repeat(21), 'A'.repeat(23), `${'A'.repeat(21)}=`, `${'A'.repeat(21)}/`])(
    'refuse l’identifiant de session %j',
    (id) => {
      expect(sessionParamsSchema.safeParse({ id }).success).toBe(false);
    },
  );

  it('refuse un paramètre inconnu', () => {
    expect(sessionParamsSchema.safeParse({ id: SUMMARY.id, other: '1' }).success).toBe(false);
  });
});
