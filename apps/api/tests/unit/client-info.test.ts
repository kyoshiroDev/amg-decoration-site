import { describe, expect, it } from 'vitest';
import { deviceLabel, networkPrefix } from '../../src/http/client-info.js';

describe('networkPrefix', () => {
  it.each([
    ['203.0.113.77', '203.0.113.0/24'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1::/48'],
    ['2001:db8::1', '2001:db8:0::/48'],
    ['::1', '0:0:0::/48'],
    [null, null],
  ])('%s → %s', (ip, expected) => {
    expect(networkPrefix(ip)).toBe(expected);
  });
});

describe('deviceLabel', () => {
  it.each([
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox sur Linux'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari sur iPhone',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      'Edge sur Windows',
    ],
    [
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      'Chrome sur Android',
    ],
    ['curl/8.0', null],
    [undefined, null],
  ])('%s', (userAgent, expected) => {
    expect(deviceLabel(userAgent)).toBe(expected);
  });

  it('ne recopie jamais l’en-tête brut', () => {
    const label = deviceLabel(`Firefox/1 ${'<script>'.repeat(200)}`);
    expect(label).toBe('Firefox');
  });
});
