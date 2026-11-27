import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  csrfTokenMatches,
  deriveCsrfToken,
  generatePublicId,
  generateSessionToken,
  isSessionToken,
  sessionTokenHash,
} from '../../src/session/session-token.js';

describe('jetons de session', () => {
  it('génère 256 bits en base64url, toujours différents', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateSessionToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(isSessionToken(token)).toBe(true);
    }
  });

  it('génère un identifiant public de 128 bits indépendant du jeton', () => {
    expect(Buffer.from(generatePublicId(), 'base64url')).toHaveLength(16);
    expect(generatePublicId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it.each([
    ['vide', ''],
    ['trop court', 'A'.repeat(42)],
    ['trop long', 'A'.repeat(44)],
    ['base64 classique', `${'A'.repeat(41)}+A`],
    ['remplissage', `${'A'.repeat(42)}=`],
    ['encodage non canonique (bits de bourrage)', `${'A'.repeat(42)}B`],
    ['caractère de contrôle', `${'A'.repeat(42)}\n`],
  ])('refuse un cookie %s', (_label, value) => {
    expect(isSessionToken(value)).toBe(false);
  });

  it('refuse une valeur qui n’est pas une chaîne', () => {
    expect(isSessionToken(undefined)).toBe(false);
    expect(isSessionToken(['a'])).toBe(false);
  });

  it('stocke l’empreinte SHA-256 des 32 octets, jamais le jeton', () => {
    const token = generateSessionToken();
    const expected = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
    expect(sessionTokenHash(token)).toBe(expected);
    expect(sessionTokenHash(token)).not.toContain(token);
  });

  it('dérive un jeton CSRF propre à la session, comparé exactement', () => {
    const token = generateSessionToken();
    const other = generateSessionToken();
    const csrf = deriveCsrfToken(token);
    expect(csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(csrf).not.toBe(token);
    expect(deriveCsrfToken(token)).toBe(csrf);
    expect(csrfTokenMatches(token, csrf)).toBe(true);
    expect(csrfTokenMatches(other, csrf)).toBe(false);
    expect(csrfTokenMatches(token, csrf.slice(0, -1))).toBe(false);
    expect(csrfTokenMatches(token, `${csrf} `)).toBe(false);
    expect(csrfTokenMatches(token, [csrf])).toBe(false);
    expect(csrfTokenMatches(token, undefined)).toBe(false);
  });
});
