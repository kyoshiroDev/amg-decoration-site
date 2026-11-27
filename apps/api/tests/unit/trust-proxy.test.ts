import { describe, expect, it } from 'vitest';
import { buildTrustProxy, normalizeIp, parseTrustedProxy } from '../../src/http/trust-proxy.js';

describe('parseTrustedProxy', () => {
  it.each([
    ['172.30.0.2', { family: 'ipv4', address: '172.30.0.2', prefix: 32 }],
    ['172.30.0.0/24', { family: 'ipv4', address: '172.30.0.0', prefix: 24 }],
    ['fd00:1::/64', { family: 'ipv6', address: 'fd00:1::', prefix: 64 }],
    ['fd00::2', { family: 'ipv6', address: 'fd00::2', prefix: 128 }],
  ])('accepte %s', (value, expected) => {
    expect(parseTrustedProxy(value)).toEqual(expected);
  });

  it.each(['', 'true', '0.0.0.0/0', '10.0.0.0/15', '::/0', 'fd00::/47', '1.2.3.4/33', '1.2.3.4/'])(
    'refuse %j',
    (value) => {
      expect(parseTrustedProxy(value)).toBeUndefined();
    },
  );
});

describe('buildTrustProxy', () => {
  it('sans proxy configuré, ne croit aucun en-tête', () => {
    expect(buildTrustProxy(undefined)).toBe(false);
  });

  const trust = buildTrustProxy(parseTrustedProxy('172.30.0.0/24'));
  if (trust === false) throw new Error('fonction de confiance attendue');

  it('croit la socket dans le CIDR, au premier saut seulement', () => {
    expect(trust('172.30.0.5', 0)).toBe(true);
    expect(trust('::ffff:172.30.0.5', 0)).toBe(true);
    expect(trust('172.30.0.5', 1)).toBe(false);
    expect(trust('172.30.0.5', 2)).toBe(false);
  });

  it('ne croit pas une socket hors du CIDR', () => {
    expect(trust('172.30.1.5', 0)).toBe(false);
    expect(trust('203.0.113.9', 0)).toBe(false);
    expect(trust('fd00::1', 0)).toBe(false);
    expect(trust('pas-une-ip', 0)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('ramène une IPv4 mappée en IPv4 et refuse ce qui n’est pas une IP', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeIp('203.0.113.7, 10.0.0.1')).toBeUndefined();
    expect(normalizeIp(undefined)).toBeUndefined();
  });
});
