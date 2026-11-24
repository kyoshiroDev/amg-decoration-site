import { describe, expect, it } from 'vitest';
import { coverCrop, fitWidths, parseAspectRatio } from '@/lib/responsive-image';

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

describe('coverCrop', () => {
  it('source plus large que le cadre : toute la hauteur, largeur au ratio du cadre', () => {
    expect(coverCrop({ width: 1200, height: 600 }, 0.8)).toEqual({ width: 480, height: 600 });
    expect(coverCrop({ width: 1200, height: 600 }, 1.25)).toEqual({ width: 750, height: 600 });
    expect(coverCrop({ width: 1200, height: 600 }, 1.5)).toEqual({ width: 900, height: 600 });
  });

  it('source plus haute que le cadre : toute la largeur, hauteur au ratio du cadre', () => {
    expect(coverCrop({ width: 800, height: 1200 }, 1.5)).toEqual({ width: 800, height: 533 });
    expect(coverCrop({ width: 1000, height: 2000 }, 0.8)).toEqual({ width: 1000, height: 1250 });
  });

  it('source déjà au ratio du cadre : inchangée', () => {
    expect(coverCrop({ width: 1500, height: 1000 }, 1.5)).toEqual({ width: 1500, height: 1000 });
    expect(coverCrop({ width: 1600, height: 2000 }, 0.8)).toEqual({ width: 1600, height: 2000 });
  });

  it('ne dépasse jamais la source malgré l’arrondi', () => {
    const crop = coverCrop({ width: 1001, height: 1251 }, 0.8);
    expect(crop.width).toBeLessThanOrEqual(1001);
    expect(crop.height).toBeLessThanOrEqual(1251);
  });
});
