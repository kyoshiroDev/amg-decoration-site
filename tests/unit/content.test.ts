import { describe, expect, it } from 'vitest';
import {
  ContentError,
  filterByPage,
  filterPublished,
  requireEntry,
  requireSection,
  sortByOrder,
} from '@/lib/content';

describe('sortByOrder', () => {
  it('trie par `order` croissant sans modifier le tableau d’origine', () => {
    const entries = [
      { id: 'c', data: { order: 3 } },
      { id: 'a', data: { order: 1 } },
      { id: 'b', data: { order: 2 } },
    ];
    expect(sortByOrder(entries).map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(entries[0]?.id).toBe('c');
  });

  it('départage les ex aequo par identifiant', () => {
    const entries = [
      { id: 'zeta', data: { order: 1 } },
      { id: 'alpha', data: { order: 1 } },
    ];
    expect(sortByOrder(entries).map((entry) => entry.id)).toEqual(['alpha', 'zeta']);
  });
});

describe('filterPublished', () => {
  it('retire les brouillons', () => {
    const entries = [
      { id: 'publie', data: { draft: false } },
      { id: 'brouillon', data: { draft: true } },
    ];
    expect(filterPublished(entries).map((entry) => entry.id)).toEqual(['publie']);
  });
});

describe('filterByPage', () => {
  it('garde les entrées prévues pour la page demandée', () => {
    const entries = [
      { id: 'a', data: { pages: ['accueil', 'a-propos'] } },
      { id: 'b', data: { pages: ['a-propos'] } },
    ];
    expect(filterByPage(entries, 'accueil').map((entry) => entry.id)).toEqual(['a']);
    expect(filterByPage(entries, 'contact')).toEqual([]);
  });
});

describe('requireSection', () => {
  const sections = { methode: { heading: 'Ma méthode' } };

  it('retourne la section demandée', () => {
    expect(requireSection(sections, 'methode', 'accueil')).toEqual({ heading: 'Ma méthode' });
  });

  it('lève une erreur explicite si la section manque', () => {
    expect(() => requireSection(sections, 'avantages', 'accueil')).toThrow(ContentError);
    expect(() => requireSection(sections, 'avantages', 'accueil')).toThrow(
      /avantages.*accueil\.md.*methode/,
    );
  });

  it('signale l’absence de toute section', () => {
    expect(() => requireSection({}, 'cta', 'contact')).toThrow(/aucune/);
  });
});

describe('requireEntry', () => {
  it('retourne l’entrée trouvée', () => {
    expect(requireEntry({ id: 'accueil' }, 'pages', 'accueil')).toEqual({ id: 'accueil' });
  });

  it('lève une erreur si l’entrée est introuvable', () => {
    expect(() => requireEntry(undefined, 'pages', 'inconnue')).toThrow(/« inconnue ».*« pages »/);
  });
});
