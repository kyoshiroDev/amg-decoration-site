import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import type { ServiceEntryLike } from '@/lib/cards';
import { ContentError } from '@/lib/content';
import type { PageSection } from '@/lib/pages/types';
import {
  buildProjectPageModel,
  buildProjectsIndexModel,
  buildRoomFilters,
  formatRoomList,
  groupGallery,
  selectSiblings,
  type ProjectDetailEntryLike,
  type ProjectLabels,
  type RoomType,
} from '@/lib/pages/projects-model';

const image = { src: '/x.jpg', width: 1600, height: 2000, format: 'jpg' } as ImageMetadata;

const roomTypes: Record<RoomType, string> = {
  'piece-de-vie': 'Pièce de vie',
  cuisine: 'Cuisine',
  chambre: 'Chambre',
  'chambre-parentale': 'Chambre parentale',
  'chambre-enfant': 'Chambre d’enfant',
  'salle-de-bain': 'Salle de bain',
  dressing: 'Dressing',
  bureau: 'Bureau',
  entree: 'Entrée',
  exterieur: 'Extérieur',
  studio: 'Studio',
  'meuble-sur-mesure': 'Meuble sur mesure',
};

const labels: ProjectLabels = {
  home: 'Accueil',
  indexLabel: 'Réalisations',
  roomTypes,
  facts: { location: 'Lieu', rooms: 'Pièces', style: 'Style', service: 'Formule' },
  galleryKinds: { avant: 'Avant', '3d': 'Rendu 3D', apres: 'Réalisé' },
};

function project(
  id: string,
  order: number,
  overrides: Partial<ProjectDetailEntryLike['data']> = {},
): ProjectDetailEntryLike {
  return {
    id,
    data: {
      title: `Projet ${id}`,
      summary: 'Résumé',
      style: 'Doux',
      cover: { image, alt: 'Salon lumineux' },
      featured: true,
      order,
      roomTypes: ['piece-de-vie'],
      gallery: [{ image, alt: 'Rendu du salon', kind: '3d' }],
      seo: { title: 'Titre', description: 'Description' },
      ...overrides,
    },
  };
}

const section = (heading: string): PageSection => ({ heading, items: [], actions: [] });

const confort: ServiceEntryLike = {
  id: 'confort',
  data: {
    title: 'Confort',
    kind: 'formule',
    tagline: 'pour les pièces de vie',
    summary: 'Résumé',
    highlight: true,
    order: 2,
  },
};

describe('buildRoomFilters', () => {
  it('ne garde que les types présents, dans l’ordre des libellés', () => {
    const filters = buildRoomFilters(
      [{ rooms: ['dressing', 'piece-de-vie'] }, { rooms: ['piece-de-vie'] }],
      roomTypes,
    );
    expect(filters.map((filter) => filter.value)).toEqual(['piece-de-vie', 'dressing']);
    expect(filters[0]).toEqual({ value: 'piece-de-vie', label: 'Pièce de vie', count: 2 });
  });

  it('renvoie une liste vide quand filtrer n’apporterait rien', () => {
    expect(buildRoomFilters([{ rooms: ['cuisine'] }, { rooms: ['cuisine'] }], roomTypes)).toEqual(
      [],
    );
    expect(buildRoomFilters([], roomTypes)).toEqual([]);
  });
});

describe('buildProjectsIndexModel', () => {
  const page = {
    seo: { title: 'Réalisations', description: 'Description' },
    hero: section('Mes réalisations'),
    sections: { cta: section('Votre intérieur') },
  };

  it('trie les projets, expose leurs pièces et le fil d’Ariane', () => {
    const model = buildProjectsIndexModel({
      page,
      projets: [project('b', 2, { roomTypes: ['cuisine'] }), project('a', 1)],
      roomTypeLabels: roomTypes,
      labels: { home: 'Accueil', indexLabel: 'Réalisations' },
    });
    expect(model.projects.map((item) => item.slug)).toEqual(['a', 'b']);
    expect(model.projects[1]?.rooms).toEqual(['cuisine']);
    expect(model.filters).toHaveLength(2);
    expect(model.breadcrumbs.at(-1)).toEqual({ label: 'Réalisations', href: '/realisations/' });
  });

  it('prend la couverture de la première carte comme image Open Graph', () => {
    const second = { src: '/y.jpg', width: 1600, height: 1200, format: 'jpg' } as ImageMetadata;
    const model = buildProjectsIndexModel({
      page,
      projets: [
        project('b', 2, { cover: { image: second, alt: 'Cuisine' } }),
        project('a', 1, { cover: { image, alt: 'Salon lumineux' } }),
      ],
      roomTypeLabels: roomTypes,
      labels: { home: 'Accueil', indexLabel: 'Réalisations' },
    });
    expect(model.ogImage).toEqual({ image, alt: 'Salon lumineux' });
  });

  it('n’a pas d’image Open Graph propre sans réalisation (image par défaut)', () => {
    const model = buildProjectsIndexModel({
      page,
      projets: [],
      roomTypeLabels: roomTypes,
      labels: { home: 'Accueil', indexLabel: 'Réalisations' },
    });
    expect(model.ogImage).toBeUndefined();
  });

  it('échoue si la section cta manque', () => {
    expect(() =>
      buildProjectsIndexModel({
        page: { ...page, sections: {} },
        projets: [],
        roomTypeLabels: roomTypes,
        labels: { home: 'Accueil', indexLabel: 'Réalisations' },
      }),
    ).toThrow(ContentError);
  });
});

describe('selectSiblings', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('boucle aux extrémités', () => {
    expect(selectSiblings(list, 'a')).toEqual({ previous: { id: 'c' }, next: { id: 'b' } });
    expect(selectSiblings(list, 'c')).toEqual({ previous: { id: 'b' }, next: { id: 'a' } });
  });

  it('ne double pas le même voisin avec deux entrées, rien avec une seule', () => {
    expect(selectSiblings(list.slice(0, 2), 'a')).toEqual({
      previous: undefined,
      next: { id: 'b' },
    });
    expect(selectSiblings(list.slice(0, 1), 'a')).toEqual({ previous: undefined, next: undefined });
  });
});

describe('groupGallery', () => {
  it('regroupe Avant → Rendu 3D → Réalisé et omet les groupes vides', () => {
    const groups = groupGallery(
      [
        { image, alt: 'Résultat', kind: 'apres' },
        { image, alt: 'Existant', kind: 'avant', caption: 'Le salon avant' },
        { image, alt: 'Résultat 2', kind: 'apres' },
      ],
      labels.galleryKinds,
    );
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Avant', 1],
      ['Réalisé', 2],
    ]);
    expect(groups[0]?.items[0]?.caption).toBe('Le salon avant');
  });
});

describe('formatRoomList', () => {
  it('ne garde la capitale qu’au premier élément', () => {
    expect(formatRoomList(['piece-de-vie', 'chambre-enfant'], roomTypes)).toBe(
      'Pièce de vie, chambre d’enfant',
    );
  });
});

describe('buildProjectPageModel', () => {
  const projets = [project('a', 1), project('b', 2), project('c', 3)];

  it('assemble la fiche, la galerie, les voisins et le fil d’Ariane', () => {
    const entry = project('b', 2, {
      location: 'Suisse',
      service: { id: 'confort' },
      roomTypes: ['piece-de-vie', 'dressing'],
    });
    const model = buildProjectPageModel({ entry, projets, prestations: [confort], labels });
    expect(model.href).toBe('/realisations/b/');
    expect(model.facts).toEqual([
      { label: 'Lieu', value: 'Suisse' },
      { label: 'Pièces', value: 'Pièce de vie, dressing' },
      { label: 'Style', value: 'Doux' },
      { label: 'Formule', value: 'Confort', href: '/prestations/confort/' },
    ]);
    expect(model.gallery.map((group) => group.label)).toEqual(['Rendu 3D']);
    expect(model.previous?.slug).toBe('a');
    expect(model.next?.slug).toBe('c');
    expect(model.beforeAfter).toBeUndefined();
    expect(model.breadcrumbs.map((item) => item.href)).toEqual([
      '/',
      '/realisations/',
      '/realisations/b/',
    ]);
  });

  it('omet le lieu absent et échoue sur une formule inconnue', () => {
    const model = buildProjectPageModel({
      entry: project('a', 1),
      projets,
      prestations: [],
      labels,
    });
    expect(model.facts.map((fact) => fact.label)).toEqual(['Pièces', 'Style']);
    expect(() =>
      buildProjectPageModel({
        entry: project('a', 1, { service: { id: 'inconnue' } }),
        projets,
        prestations: [confort],
        labels,
      }),
    ).toThrow(ContentError);
  });
});
