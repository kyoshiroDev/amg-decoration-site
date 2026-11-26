import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { SECRET_MASK, SecretValue } from '../../src/config/secret-value.js';

describe('SecretValue', () => {
  const secret = new SecretValue('valeur-tres-secrete');

  it('ne livre la valeur que par reveal()', () => {
    expect(secret.reveal()).toBe('valeur-tres-secrete');
  });

  it('masque la valeur dans toute sérialisation accidentelle', () => {
    expect(String(secret)).toBe(SECRET_MASK);
    expect(`clé : ${String(secret)}`).toBe(`clé : ${SECRET_MASK}`);
    expect(JSON.stringify({ secret })).toBe(`{"secret":"${SECRET_MASK}"}`);
    expect(inspect({ secret })).not.toContain('valeur-tres-secrete');
    expect(Object.keys(secret)).toEqual([]);
  });
});
