import { describe, expect, it } from 'vitest';
import { magneticOffset } from '@/lib/magnetic';

const box = { left: 100, top: 50, width: 200, height: 40 };

describe('magneticOffset', () => {
  it('aucun décalage au centre', () => {
    expect(magneticOffset(200, 70, box, 6)).toEqual({ x: 0, y: 0 });
  });

  it('décalage maximal sur les bords, dans la direction du pointeur', () => {
    expect(magneticOffset(300, 90, box, 6)).toEqual({ x: 6, y: 6 });
    expect(magneticOffset(100, 50, box, 6)).toEqual({ x: -6, y: -6 });
  });

  it('jamais plus de `max` pixels, même hors de la boîte', () => {
    const { x, y } = magneticOffset(2000, -500, box, 6);
    expect(x).toBe(6);
    expect(y).toBe(-6);
  });

  it('proportionnel entre le centre et le bord', () => {
    expect(magneticOffset(250, 70, box, 6).x).toBe(3);
  });

  it('boîte vide : aucun décalage', () => {
    expect(magneticOffset(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 6)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
