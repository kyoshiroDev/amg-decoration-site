import { describe, expect, it } from 'vitest';
import { WORDS_PER_MINUTE, countWords, readingTime, stripMarkdown } from '@/lib/reading-time';

const words = (count: number): string => Array.from({ length: count }, () => 'mot').join(' ');

describe('countWords', () => {
  it('compte les mots, apostrophes et tirets compris', () => {
    expect(countWords('L’atelier d’Amandine, c’est peut-être le bon choix.')).toBe(7);
    expect(countWords('  ')).toBe(0);
  });
});

describe('stripMarkdown', () => {
  it('retire la syntaxe et garde les libellés des liens', () => {
    const text = stripMarkdown(
      [
        "import Foo from './foo';",
        '## Titre',
        'Voir [ma formule](/prestations/confort/) et ![un salon](./salon.jpg).',
        '<Foo prop="valeur" />',
        '```js',
        'const code = 1;',
        '```',
      ].join('\n'),
    );
    expect(text).toContain('ma formule');
    expect(text).not.toMatch(/prestations|salon|import|const|Foo|##/);
  });
});

describe('readingTime', () => {
  it('arrondit à la minute supérieure', () => {
    expect(readingTime(words(WORDS_PER_MINUTE))).toBe(1);
    expect(readingTime(words(WORDS_PER_MINUTE + 1))).toBe(2);
  });

  it('vaut au moins une minute, même pour un texte vide', () => {
    expect(readingTime('')).toBe(1);
  });

  it('accepte une vitesse personnalisée et refuse une vitesse invalide', () => {
    expect(readingTime(words(300), 100)).toBe(3);
    expect(() => readingTime('texte', 0)).toThrow(RangeError);
  });
});
