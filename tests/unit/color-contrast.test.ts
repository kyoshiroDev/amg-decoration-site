import { describe, expect, it } from 'vitest';
import {
  contrastLevel,
  contrastRatio,
  formatRatio,
  requireColorToken,
  normalizeHex,
  parseColorTokens,
  relativeLuminance,
} from '@/lib/color-contrast';

describe('normalizeHex', () => {
  it('développe la forme courte et passe en minuscules', () => {
    expect(normalizeHex('#AbC')).toBe('#aabbcc');
  });

  it('rejette une valeur invalide', () => {
    expect(() => normalizeHex('rouge')).toThrow();
  });
});

describe('relativeLuminance', () => {
  it('vaut 0 pour le noir et 1 pour le blanc', () => {
    expect(relativeLuminance('#000')).toBe(0);
    expect(relativeLuminance('#fff')).toBe(1);
  });
});

describe('contrastRatio', () => {
  it('vaut 21 entre noir et blanc, quel que soit l’ordre', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
  });

  it('retrouve les valeurs documentées du design system', () => {
    expect(formatRatio(contrastRatio('#9a4a30', '#f8f3ec'))).toBe('5.60');
    expect(formatRatio(contrastRatio('#fffcf7', '#b05a3d'))).toBe('4.68');
  });
});

describe('contrastLevel', () => {
  it('classe les ratios selon les seuils WCAG AA', () => {
    expect(contrastLevel(4.5)).toBe('AA');
    expect(contrastLevel(3.4)).toBe('AA-large');
    expect(contrastLevel(2.9)).toBe('fail');
  });
});

describe('parseColorTokens', () => {
  it('extrait uniquement les tokens de couleur hexadécimaux', () => {
    const css = `:root {
      --color-linen: #F8F3EC;
      --color-bg: var(--color-linen);
      --color-border: rgb(47 38 34 / 14%);
      --radius-sm: 6px;
      --color-ink: #2f2622;
    }`;
    expect(parseColorTokens(css)).toEqual([
      { name: 'linen', hex: '#f8f3ec' },
      { name: 'ink', hex: '#2f2622' },
    ]);
  });
});

describe('seuils sans arrondi', () => {
  it('un ratio de 4.496 échoue au niveau AA (pas d’arrondi à 4.50)', () => {
    expect(contrastLevel(4.496)).toBe('AA-large');
  });

  it('formatRatio tronque au lieu d’arrondir', () => {
    expect(formatRatio(4.499)).toBe('4.49');
    expect(formatRatio(21)).toBe('21.00');
  });
});

describe('requireColorToken', () => {
  const tokens = [{ name: 'ink', hex: '#2f2622' }];

  it('retourne la valeur d’un token présent', () => {
    expect(requireColorToken(tokens, 'ink')).toBe('#2f2622');
  });

  it('lève une erreur si le token est absent', () => {
    expect(() => requireColorToken(tokens, 'absent')).toThrow(/--color-absent/);
  });
});
