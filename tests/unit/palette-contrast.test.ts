import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, normalizeHex } from '@/lib/color-contrast';
import { parseCustomProperties } from '@/lib/design-tokens';

// ADR-0017 : la palette de l'ancien site (beige, grège, camel doré) doit tenir WCAG 2.2 AA
// sur CHAQUE fond de section. Le test lit tokens.css et résout les rôles (var(--…)) :
// changer une valeur ou un rôle sans tenir les seuils le fait échouer.

const tokens = parseCustomProperties(readFileSync('src/styles/tokens.css', 'utf8'), '--');

/** Valeur hexadécimale d'un token, en suivant les alias `var(--…)`. */
function hex(name: string, depth = 0): string {
  const value = tokens.find((token) => token.name === name)?.value;
  if (!value || depth > 5) throw new Error(`${name} introuvable ou non résolu`);
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1];
  return alias ? hex(alias, depth + 1) : normalizeHex(value);
}

/** Fonds de section (Section.astro) et surfaces où du texte ou un contrôle peut apparaître. */
const BACKGROUNDS = [
  '--color-cream',
  '--color-ivory',
  '--color-beige',
  '--color-greige',
  '--color-rose-100',
];

const TEXT_ROLES = [
  '--color-text',
  '--color-text-soft',
  '--color-accent-text',
  '--color-action-hover',
  '--color-error',
];

describe('palette : texte ≥ 4.5:1 sur chaque fond (WCAG 1.4.3)', () => {
  for (const fg of TEXT_ROLES) {
    for (const bg of BACKGROUNDS) {
      it(`${fg} sur ${bg}`, () => {
        expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('palette : texte des boutons et pastilles pleines ≥ 4.5:1', () => {
  it.each([
    ['--color-on-action', '--color-action'],
    ['--color-on-action', '--color-action-hover'],
    ['--color-ivory', '--color-error'],
    ['--color-ink', '--color-camel-300'],
  ])('%s sur %s', (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('palette : filets de contrôle et focus ≥ 3:1 (WCAG 1.4.11, 2.4.13)', () => {
  for (const fg of ['--color-border-control', '--field-border', '--focus-ring-color']) {
    for (const bg of BACKGROUNDS) {
      it(`${fg} sur ${bg}`, () => {
        expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('palette : le camel décoratif ne sert jamais au texte', () => {
  it('--color-accent reste sous 4.5:1 sur le fond principal (rôle décor documenté)', () => {
    expect(hex('--color-accent')).toBe(hex('--color-camel-300'));
    expect(contrastRatio(hex('--color-accent'), hex('--color-bg'))).toBeLessThan(4.5);
  });

  it('aucun token terracotta ne subsiste', () => {
    expect(tokens.some((token) => token.name.includes('terracotta'))).toBe(false);
  });
});
