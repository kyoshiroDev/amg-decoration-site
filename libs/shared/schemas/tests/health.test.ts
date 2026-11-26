import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../src/index.js';

describe('healthResponseSchema', () => {
  it('accepte la seule réponse prévue', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('refuse tout champ supplémentaire (aucune fuite d’information)', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', version: '1.0.0' }).success).toBe(false);
  });

  it('refuse un autre statut', () => {
    expect(healthResponseSchema.safeParse({ status: 'ko' }).success).toBe(false);
  });
});
