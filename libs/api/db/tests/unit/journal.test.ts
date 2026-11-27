// Écriture du journal, sans base : schémas de `details` bornés par type d'événement, un seul INSERT
// paramétré (aucune valeur interpolée dans le texte SQL), types et table qualifiés.
import { describe, expect, it } from 'vitest';
import {
  JOURNALED_EVENT_TYPES,
  securityEventSchema,
  writeSecurityEvent,
  type JournalWriter,
  type SecurityEventInput,
} from '../../src/journal.js';

const USER = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const SESSION_ID = 'AAAAAAAAAAAAAAAAAAAAAA';

const base = { userId: USER, actorId: null, ip: '203.0.113.7', device: 'Firefox sur Linux' };

/** Double du client : retient le texte et les valeurs de chaque requête. */
function fakeWriter(): JournalWriter & {
  readonly calls: { readonly sql: string; readonly values: readonly unknown[] }[];
} {
  const calls: { sql: string; values: readonly unknown[] }[] = [];
  const executeRaw = (strings: TemplateStringsArray, ...values: unknown[]): Promise<number> => {
    calls.push({ sql: strings.join('$?'), values });
    return Promise.resolve(1);
  };
  return { calls, $executeRaw: executeRaw as JournalWriter['$executeRaw'] };
}

describe('securityEventSchema', () => {
  it.each<SecurityEventInput>([
    { type: 'LOGOUT', ...base, details: { audience: 'ADMIN' } },
    {
      type: 'SESSION_REVOKED',
      ...base,
      details: { audience: 'CLIENT', reason: 'limit', sessionId: SESSION_ID },
    },
    { type: 'ACCESS_DENIED', ...base, details: { audience: 'ADMIN', reason: 'audience' } },
    {
      type: 'CSRF_REJECTED',
      ...base,
      details: { audience: 'CLIENT', failed: ['token', 'origin'] },
    },
  ])('accepte un événement $type conforme', (event) => {
    expect(securityEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    ['un type sans schéma', { type: 'LOGIN_SUCCEEDED', ...base, details: {} }],
    [
      'un champ inconnu dans details',
      { type: 'LOGOUT', ...base, details: { audience: 'ADMIN', email: 'a@b.c' } },
    ],
    [
      'un champ inconnu à la racine',
      { type: 'LOGOUT', ...base, token: 'x', details: { audience: 'ADMIN' } },
    ],
    ['une audience inconnue', { type: 'LOGOUT', ...base, details: { audience: 'ROOT' } }],
    [
      'un identifiant de session mal formé',
      {
        type: 'SESSION_REVOKED',
        ...base,
        details: { audience: 'ADMIN', reason: 'self', sessionId: 'x' },
      },
    ],
    [
      'aucun contrôle CSRF manquant',
      { type: 'CSRF_REJECTED', ...base, details: { audience: 'ADMIN', failed: [] } },
    ],
    [
      'un contrôle CSRF inconnu',
      { type: 'CSRF_REJECTED', ...base, details: { audience: 'ADMIN', failed: ['cookie'] } },
    ],
    [
      'une IP invalide',
      { type: 'LOGOUT', ...base, ip: '999.0.0.1', details: { audience: 'ADMIN' } },
    ],
    [
      'un appareil trop long',
      { type: 'LOGOUT', ...base, device: 'x'.repeat(65), details: { audience: 'ADMIN' } },
    ],
    [
      'un compte qui n’est pas un UUID',
      { type: 'LOGOUT', ...base, userId: 'admin', details: { audience: 'ADMIN' } },
    ],
  ])('refuse %s', (_label, event) => {
    expect(securityEventSchema.safeParse(event).success).toBe(false);
  });

  it('ne sait écrire que des types de l’énumération de la base', () => {
    expect(JOURNALED_EVENT_TYPES).toEqual([
      'LOGOUT',
      'SESSION_REVOKED',
      'ACCESS_DENIED',
      'CSRF_REJECTED',
    ]);
  });
});

describe('writeSecurityEvent', () => {
  it('écrit par un seul INSERT paramétré, table et types qualifiés', async () => {
    const writer = fakeWriter();
    await writeSecurityEvent(writer, { type: 'LOGOUT', ...base, details: { audience: 'ADMIN' } });
    expect(writer.calls).toHaveLength(1);
    const [call] = writer.calls;
    expect(call?.sql).toMatch(/^INSERT INTO public\.security_events /);
    expect(call?.sql).toContain('AS public.security_event_type');
    expect(call?.sql).not.toContain(USER);
    expect(call?.values).toEqual([
      'LOGOUT',
      USER,
      null,
      '203.0.113.7',
      'Firefox sur Linux',
      '{"audience":"ADMIN"}',
    ]);
  });

  it('n’écrit rien si l’événement est mal formé', async () => {
    const writer = fakeWriter();
    await expect(
      writeSecurityEvent(writer, {
        type: 'LOGOUT',
        ...base,
        details: { audience: 'ADMIN', extra: 1 },
      } as unknown as SecurityEventInput),
    ).rejects.toThrow();
    expect(writer.calls).toEqual([]);
  });
});
