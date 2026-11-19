import { describe, expect, it } from 'vitest';
import { absoluteUrl, isActivePath, withTrailingSlash } from '@/lib/url';

describe('withTrailingSlash', () => {
  it('ajoute un slash final à un chemin de page', () => {
    expect(withTrailingSlash('/realisations')).toBe('/realisations/');
  });

  it('ne double pas un slash déjà présent', () => {
    expect(withTrailingSlash('/contact/')).toBe('/contact/');
  });

  it('retourne la racine pour une chaîne vide', () => {
    expect(withTrailingSlash('')).toBe('/');
  });

  it('ne modifie pas un fichier avec extension', () => {
    expect(withTrailingSlash('/robots.txt')).toBe('/robots.txt');
  });

  it('conserve la query string et l’ancre', () => {
    expect(withTrailingSlash('/realisations?piece=salon#grille')).toBe(
      '/realisations/?piece=salon#grille',
    );
  });
});

describe('absoluteUrl', () => {
  it('construit une URL absolue canonique', () => {
    expect(absoluteUrl('/a-propos', 'https://amgdecorationdinterieur.com')).toBe(
      'https://amgdecorationdinterieur.com/a-propos/',
    );
  });
});

describe('isActivePath', () => {
  it('reconnaît la page courante', () => {
    expect(isActivePath('/contact/', '/contact/')).toBe('page');
    expect(isActivePath('/contact', '/contact/')).toBe('page');
  });

  it('reconnaît une page enfant de la section', () => {
    expect(isActivePath('/realisations/chalet/', '/realisations/')).toBe('section');
  });

  it('ne marque l’accueil que sur l’accueil', () => {
    expect(isActivePath('/contact/', '/')).toBe(false);
    expect(isActivePath('/', '/')).toBe('page');
  });
});
