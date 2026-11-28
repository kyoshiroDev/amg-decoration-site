import { describe, expect, it } from 'vitest';
import { buildTrustProxy, normalizeIp, parseTrustedProxy } from '../../src/http/trust-proxy.js';

describe('parseTrustedProxy', () => {
  it.each([
    ['192.0.2.2', { family: 'ipv4', address: '192.0.2.2', prefix: 32 }],
    ['192.0.2.0/24', { family: 'ipv4', address: '192.0.2.0', prefix: 24 }],
    ['2001:db8:1::/64', { family: 'ipv6', address: '2001:db8:1::', prefix: 64 }],
    ['2001:db8::2', { family: 'ipv6', address: '2001:db8::2', prefix: 128 }],
  ])('accepte %s', (value, expected) => {
    expect(parseTrustedProxy(value)).toEqual(expected);
  });

  it.each([
    '',
    'true',
    '0.0.0.0/0',
    '198.18.0.0/15',
    '::/0',
    '2001:db8::/47',
    '192.0.2.4/33',
    '192.0.2.4/',
  ])('refuse %j', (value) => {
    expect(parseTrustedProxy(value)).toBeUndefined();
  });
});

describe('buildTrustProxy', () => {
  it('sans proxy configuré, ne croit aucun en-tête', () => {
    expect(buildTrustProxy(undefined)).toBe(false);
  });

  const trust = buildTrustProxy(parseTrustedProxy('192.0.2.0/24'));
  if (trust === false) throw new Error('fonction de confiance attendue');

  it('croit la socket dans le CIDR, au premier saut seulement', () => {
    expect(trust('192.0.2.5', 0)).toBe(true);
    expect(trust('::ffff:192.0.2.5', 0)).toBe(true);
    expect(trust('192.0.2.5', 1)).toBe(false);
    expect(trust('192.0.2.5', 2)).toBe(false);
  });

  it('ne croit pas une socket hors du CIDR', () => {
    expect(trust('198.51.100.5', 0)).toBe(false);
    expect(trust('203.0.113.9', 0)).toBe(false);
    expect(trust('2001:db8::1', 0)).toBe(false);
    expect(trust('pas-une-ip', 0)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('ramène une IPv4 mappée en IPv4 et refuse ce qui n’est pas une IP', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeIp('203.0.113.7, 198.51.100.1')).toBeUndefined();
    expect(normalizeIp(undefined)).toBeUndefined();
  });
});
