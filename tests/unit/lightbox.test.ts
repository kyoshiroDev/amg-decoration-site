import { describe, expect, it } from 'vitest';
import { counterText, hasNavigation, statusText, wrapIndex } from '@/lib/lightbox';
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

describe('statusText', () => {
  it('annonce le rang, le total et la légende', () => {
    expect(statusText(1, 5, microcopy.lightbox.status, 'Salon, rendu 3D')).toBe(
      'Image 2 sur 5 : Salon, rendu 3D',
    );
  });

  it('sans légende : le rang seul, sans deux-points orphelin', () => {
    expect(statusText(0, 3, microcopy.lightbox.status, '  ')).toBe('Image 1 sur 3');
  });

  it('boucle comme le compteur', () => {
    expect(statusText(-1, 3, microcopy.lightbox.status, 'Cuisine')).toBe('Image 3 sur 3 : Cuisine');
  });
});

describe('counterText', () => {
  it('numérote à partir de 1', () => {
    expect(counterText(1, 3, microcopy.lightbox.counter)).toBe('2 / 3');
  });
});

describe('hasNavigation', () => {
  it('masque la navigation pour une galerie d’une seule image', () => {
    expect(hasNavigation(1)).toBe(false);
    expect(hasNavigation(0)).toBe(false);
  });

  it('affiche la navigation dès deux images', () => {
    expect(hasNavigation(2)).toBe(true);
    expect(hasNavigation(8)).toBe(true);
  });
});
