import { describe, expect, it } from 'vitest';
import { clampPercent, compareValueText, positionFromPointer } from '@/lib/before-after';
import { microcopy } from '@/config/microcopy';

describe('clampPercent', () => {
  it('borne entre 0 et 100 et arrondit à l’entier', () => {
    expect(clampPercent(-12)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(42.6)).toBe(43);
  });

  it('ramène NaN au milieu', () => {
    expect(clampPercent(Number.NaN)).toBe(50);
  });
});

describe('positionFromPointer', () => {
  it('convertit la position du pointeur en pourcentage de la largeur', () => {
    expect(positionFromPointer(150, 100, 200)).toBe(25);
    expect(positionFromPointer(300, 100, 200)).toBe(100);
  });

  it('borne hors de la boîte (glisser au-delà des bords)', () => {
    expect(positionFromPointer(20, 100, 200)).toBe(0);
    expect(positionFromPointer(900, 100, 200)).toBe(100);
  });

  it('largeur nulle : milieu', () => {
    expect(positionFromPointer(150, 100, 0)).toBe(50);
  });
});

describe('compareValueText', () => {
  const template = microcopy.projects.beforeAfter.valueText;

  it('annonce les deux parts, libellés de la microcopie', () => {
    expect(compareValueText(60, template)).toBe('60 % rendu 3D, 40 % réalisé');
  });

  it('extrémités', () => {
    expect(compareValueText(0, template)).toBe('0 % rendu 3D, 100 % réalisé');
    expect(compareValueText(100, template)).toBe('100 % rendu 3D, 0 % réalisé');
  });
});
