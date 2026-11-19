import { describe, expect, it } from 'vitest';
import { counterText, wrapIndex } from '@/lib/lightbox';
import { microcopy } from '@/config/microcopy';

describe('wrapIndex', () => {
  it('boucle dans les deux sens', () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(1, 3)).toBe(1);
  });

  it('liste vide : 0', () => {
    expect(wrapIndex(2, 0)).toBe(0);
  });
});

describe('counterText', () => {
  it('numérote à partir de 1', () => {
    expect(counterText(1, 3, microcopy.lightbox.counter)).toBe('2 / 3');
  });
});
