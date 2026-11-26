import { describe, expect, it } from 'vitest';
import { EMAIL_MAX_LENGTH, emailSchema, uuidSchema } from '../src/index.js';

describe('emailSchema', () => {
  it('normalise la casse et les espaces avant de valider', () => {
    expect(emailSchema.parse('  Contact@Exemple.FR ')).toBe('contact@exemple.fr');
  });

  it.each([
    '',
    'sans-arobase',
    'a@b',
    '@exemple.fr',
    'nom@',
    'deux@@exemple.fr',
    'nom @exemple.fr',
  ])('refuse « %s »', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });

  it('refuse une adresse plus longue que la limite', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(EMAIL_MAX_LENGTH - local.length - 1 - 3)}.fr`;
    const atLimit = `${local}@${domain}`;
    expect(atLimit).toHaveLength(EMAIL_MAX_LENGTH);
    expect(emailSchema.safeParse(`a${atLimit}`).success).toBe(false);
  });

  it('refuse ce qui n’est pas une chaîne', () => {
    expect(emailSchema.safeParse(42).success).toBe(false);
    expect(emailSchema.safeParse(null).success).toBe(false);
  });
});

describe('uuidSchema', () => {
  it('accepte un UUID v7', () => {
    expect(uuidSchema.safeParse('01936f3e-8b6a-7c2d-9e4f-1a2b3c4d5e6f').success).toBe(true);
  });

  it('refuse un UUID d’une autre version et les formats approchants', () => {
    expect(uuidSchema.safeParse('3d6f0a4e-2b1c-4d5e-8f9a-0b1c2d3e4f5a').success).toBe(false);
    expect(uuidSchema.safeParse('01936f3e8b6a7c2d9e4f1a2b3c4d5e6f').success).toBe(false);
    expect(uuidSchema.safeParse('../../etc/passwd').success).toBe(false);
  });
});
