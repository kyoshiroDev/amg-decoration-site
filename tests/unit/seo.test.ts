import { describe, expect, it } from 'vitest';
import {
  SeoValidationError,
  assertDescriptionLength,
  buildCanonicalUrl,
  buildPageTitle,
  buildRobots,
  countCharacters,
  isDescriptionLengthValid,
  isTitleLengthValid,
  seoLimits,
} from '@/lib/seo';

const options = { suffix: 'AMG Décoration', separator: ' | ', maxLength: 60 } as const;
const site = new URL('https://amgdecorationdinterieur.com');

describe('countCharacters', () => {
  it('compte un « é » décomposé (NFD) pour un seul caractère', () => {
    expect(countCharacters('é')).toBe(1);
    expect(countCharacters('Décoration')).toBe(10);
  });
});

describe('buildPageTitle', () => {
  it('ajoute le suffixe quand le titre complet tient en 60 caractères', () => {
    expect(buildPageTitle('Prestations', options)).toBe('Prestations | AMG Décoration');
  });

  it('accepte un titre complet de exactement 60 caractères', () => {
    const title = 'a'.repeat(60 - ' | AMG Décoration'.length);
    expect(countCharacters(buildPageTitle(title, options))).toBe(60);
  });

  it('retire le suffixe quand il ferait dépasser la limite', () => {
    const title = 'a'.repeat(50);
    expect(buildPageTitle(title, options)).toBe(title);
  });

  it('lève une erreur si le titre seul dépasse 60 caractères', () => {
    expect(() => buildPageTitle('a'.repeat(61), options)).toThrow(SeoValidationError);
  });

  it('accepte un titre seul de exactement 60 caractères', () => {
    expect(buildPageTitle('a'.repeat(60), options)).toBe('a'.repeat(60));
  });

  it('respecte withSuffix = false', () => {
    expect(buildPageTitle('Accueil', options, false)).toBe('Accueil');
  });

  it('lève une erreur pour un titre vide', () => {
    expect(() => buildPageTitle('   ', options)).toThrow(SeoValidationError);
  });
});

describe('assertDescriptionLength', () => {
  const range = { min: 140, max: 160 } as const;

  it.each([140, 150, 160])('accepte %i caractères', (n) => {
    expect(assertDescriptionLength('a'.repeat(n), range)).toHaveLength(n);
  });

  it.each([139, 161])('refuse %i caractères en citant la longueur', (n) => {
    expect(() => assertDescriptionLength('a'.repeat(n), range)).toThrow(`${n} caractères`);
  });
});

describe('buildCanonicalUrl', () => {
  it('produit une URL absolue avec slash final', () => {
    expect(buildCanonicalUrl('/realisations', site)).toBe(
      'https://amgdecorationdinterieur.com/realisations/',
    );
  });

  it('ignore la query string et l’ancre', () => {
    expect(buildCanonicalUrl('/realisations/?piece=salon#grille', site)).toBe(
      'https://amgdecorationdinterieur.com/realisations/',
    );
  });

  it('lève une erreur si site est indéfini', () => {
    expect(() => buildCanonicalUrl('/', undefined)).toThrow(SeoValidationError);
  });
});

describe('buildRobots', () => {
  it('retourne la directive attendue', () => {
    expect(buildRobots(false)).toBe('index, follow');
    expect(buildRobots(true)).toBe('noindex, nofollow');
  });
});

describe('seoLimits', () => {
  it('reprend les seuils de CLAUDE.md §5', () => {
    expect(seoLimits).toEqual({ titleMaxLength: 60, descriptionLength: { min: 140, max: 160 } });
  });
});

describe('isTitleLengthValid', () => {
  it('accepte un titre de 1 à 60 caractères, bornes incluses', () => {
    expect(isTitleLengthValid('a', 60)).toBe(true);
    expect(isTitleLengthValid('a'.repeat(60), 60)).toBe(true);
  });

  it('refuse un titre vide (ou fait d’espaces) et un titre trop long', () => {
    expect(isTitleLengthValid('   ', 60)).toBe(false);
    expect(isTitleLengthValid('a'.repeat(61), 60)).toBe(false);
  });

  it('compte en NFC : un « é » décomposé vaut un caractère', () => {
    const decomposed = 'e\u0301'.repeat(60);
    expect(isTitleLengthValid(decomposed, 60)).toBe(true);
  });
});

describe('isDescriptionLengthValid', () => {
  const range = { min: 140, max: 160 };

  it('accepte les bornes 140 et 160', () => {
    expect(isDescriptionLengthValid('a'.repeat(140), range)).toBe(true);
    expect(isDescriptionLengthValid('a'.repeat(160), range)).toBe(true);
  });

  it('refuse 139 et 161 caractères', () => {
    expect(isDescriptionLengthValid('a'.repeat(139), range)).toBe(false);
    expect(isDescriptionLengthValid('a'.repeat(161), range)).toBe(false);
  });

  it('ignore les espaces de bord', () => {
    expect(isDescriptionLengthValid(`  ${'a'.repeat(139)}  `, range)).toBe(false);
  });
});
