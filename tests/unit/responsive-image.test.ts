import { describe, expect, it } from 'vitest';
import { coverScale, fitWidths, parseAspectRatio, scaleSizes } from '@/lib/responsive-image';

describe('fitWidths', () => {
  it('plafonne à la largeur source et l’ajoute comme dernière variante (source 1200 px)', () => {
    expect(fitWidths([360, 540, 720, 960, 1280], 1200)).toEqual([360, 540, 720, 960, 1200]);
    expect(fitWidths([640, 960, 1280, 1600, 2400], 1200)).toEqual([640, 960, 1200]);
  });

  it('garde les largeurs demandées telles quelles si la source est plus large', () => {
    expect(fitWidths([360, 540, 720, 960], 1200)).toEqual([360, 540, 720, 960]);
  });

  it('n’ajoute pas de doublon quand une largeur demandée égale la source', () => {
    expect(fitWidths([640, 1200, 1600], 1200)).toEqual([640, 1200]);
  });

  it('n’est jamais vide : source plus étroite que toutes les étapes, ou liste vide', () => {
    expect(fitWidths([360, 540], 300)).toEqual([300]);
    expect(fitWidths([], 800)).toEqual([800]);
  });

  it('trie et dédoublonne', () => {
    expect(fitWidths([960, 360, 960, 540], 2000)).toEqual([360, 540, 960]);
  });
});

describe('parseAspectRatio', () => {
  it('lit « largeur / hauteur » et un nombre seul', () => {
    expect(parseAspectRatio('4 / 5')).toBe(0.8);
    expect(parseAspectRatio('16/9')).toBeCloseTo(1.778, 3);
    expect(parseAspectRatio('1.5')).toBe(1.5);
  });

  it('refuse une valeur invalide', () => {
    expect(() => parseAspectRatio('auto')).toThrow();
    expect(() => parseAspectRatio('4 / 0')).toThrow();
    expect(() => parseAspectRatio('1 / 2 / 3')).toThrow();
  });
});

describe('coverScale', () => {
  it('source paysage 2 : 1 dans une arche 4 / 5 : 2,5 fois la largeur du cadre', () => {
    expect(coverScale({ width: 1200, height: 600 }, 0.8)).toBe(2.5);
  });

  it('1 quand la source est plus haute que le cadre, ou de même ratio', () => {
    expect(coverScale({ width: 800, height: 1000 }, 1.5)).toBe(1);
    expect(coverScale({ width: 1500, height: 1000 }, 1.5)).toBe(1);
  });
});

describe('scaleSizes', () => {
  it('multiplie chaque longueur en conservant les conditions média', () => {
    expect(scaleSizes('(min-width: 64rem) 40vw, 100vw', 2.5)).toBe(
      '(min-width: 64rem) calc(40vw * 2.5), calc(100vw * 2.5)',
    );
  });

  it('ne coupe pas à l’intérieur des fonctions CSS', () => {
    expect(scaleSizes('(min-width: 40rem) min(30rem, 50vw), calc(100vw - 2rem)', 1.333333)).toBe(
      '(min-width: 40rem) calc(min(30rem, 50vw) * 1.333), calc(calc(100vw - 2rem) * 1.333)',
    );
  });

  it('conserve les conditions composées et la valeur auto', () => {
    expect(scaleSizes('(min-width: 40rem) and (max-width: 64rem)  50vw, auto', 2)).toBe(
      '(min-width: 40rem) and (max-width: 64rem) calc(50vw * 2), auto',
    );
  });

  it('rend sizes inchangé pour un facteur 1', () => {
    expect(scaleSizes('(min-width: 64rem) 40vw, 100vw', 1)).toBe('(min-width: 64rem) 40vw, 100vw');
  });
});
