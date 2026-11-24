import { describe, expect, it } from 'vitest';
import { clampBounds, parseCustomProperties } from '@/lib/design-tokens';

const css = `:root {
  /* --space-commentee: 1px; */
  --space-s: clamp(1rem, 0.9583rem + 0.1852vw, 1.125rem);
  --space-section:   clamp(4rem,
    2rem + 7vw, 9rem);
  --radius-sm: 6px;
}`;

describe('parseCustomProperties', () => {
  it('filtre par préfixe, ignore les commentaires et normalise les espaces', () => {
    expect(parseCustomProperties(css, '--space-')).toEqual([
      { name: '--space-s', value: 'clamp(1rem, 0.9583rem + 0.1852vw, 1.125rem)' },
      { name: '--space-section', value: 'clamp(4rem, 2rem + 7vw, 9rem)' },
    ]);
  });

  it('renvoie une liste vide si aucun token ne correspond', () => {
    expect(parseCustomProperties(css, '--shadow-')).toEqual([]);
  });
});

describe('clampBounds', () => {
  it('extrait les bornes d’un clamp()', () => {
    expect(clampBounds('clamp(1rem, 0.9rem + 0.2vw, 1.125rem)')).toEqual({
      min: '1rem',
      max: '1.125rem',
    });
  });

  it('renvoie null pour une valeur fixe', () => {
    expect(clampBounds('6px')).toBeNull();
  });
});
