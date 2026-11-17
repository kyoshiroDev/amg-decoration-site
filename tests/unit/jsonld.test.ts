import { describe, expect, it } from 'vitest';
import { site } from '@/config/site';
import {
  buildBlogPosting,
  buildBreadcrumbList,
  buildBusiness,
  buildFounder,
  buildGraph,
  buildOpeningHoursSpecification,
  buildService,
  buildWebSite,
  entityId,
  serializeJsonLd,
} from '@/lib/jsonld';

const origin = new URL('https://amgdecorationdinterieur.com');

/** Vue « objet JSON » d'un nœud schema-dts, pour inspecter ses propriétés dans les tests. */
const asJson = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

describe('entityId', () => {
  it('construit un identifiant stable à partir de l’origine', () => {
    expect(entityId(origin, 'entreprise')).toBe('https://amgdecorationdinterieur.com/#entreprise');
  });
});

describe('buildOpeningHoursSpecification', () => {
  it('génère les jours schema.org, l’ouverture et la fermeture', () => {
    expect(
      buildOpeningHoursSpecification([
        { days: ['Monday', 'Friday'], opens: '09:00', closes: '17:00' },
      ]),
    ).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['https://schema.org/Monday', 'https://schema.org/Friday'],
        opens: '09:00',
        closes: '17:00',
      },
    ]);
  });
});

describe('buildBusiness', () => {
  const business = asJson<Record<string, unknown>>(buildBusiness(site, origin));

  it('n’invente pas d’adresse postale mais indique le pays', () => {
    expect(business['address']).toEqual({
      '@type': 'PostalAddress',
      addressRegion: 'Île-de-France',
      addressCountry: 'FR',
    });
  });

  it('ne publie ni rue, ni coordonnées, ni fourchette de prix inventées', () => {
    expect(business['address']).not.toHaveProperty('streetAddress');
    expect(business['address']).not.toHaveProperty('postalCode');
    expect(business).not.toHaveProperty('geo');
    expect(business).not.toHaveProperty('priceRange');
  });

  it('n’émet logo et image que lorsque de vrais visuels sont fournis', () => {
    expect(business).not.toHaveProperty('logo');
    expect(business).not.toHaveProperty('image');
    const withMedia = asJson<Record<string, unknown>>(
      buildBusiness(site, origin, { logoUrl: '/logo.png', imageUrls: ['/_astro/rendu.jpg'] }),
    );
    expect(withMedia['logo']).toBe('https://amgdecorationdinterieur.com/logo.png');
    expect(withMedia['image']).toEqual(['https://amgdecorationdinterieur.com/_astro/rendu.jpg']);
  });

  it('déclare la zone desservie avec des sous-types de Place', () => {
    expect(business['areaServed']).toEqual([
      { '@type': 'City', name: 'Paris' },
      { '@type': 'AdministrativeArea', name: 'Île-de-France' },
      { '@type': 'Country', name: 'France' },
    ]);
  });

  it('reprend exactement les réseaux de la configuration dans sameAs', () => {
    expect(business['sameAs']).toEqual(site.socials.map((s) => s.url));
  });

  it('relie la fondatrice par @id et publie le téléphone en E.164', () => {
    expect(business['founder']).toEqual({ '@id': entityId(origin, 'fondatrice') });
    expect(business['telephone']).toBe('+33782358132');
  });

  it('ne contient aucune note ni avis auto-attribué', () => {
    expect(business).not.toHaveProperty('aggregateRating');
    expect(business).not.toHaveProperty('review');
  });
});

describe('buildWebSite et buildFounder', () => {
  it('relient le site et la fondatrice à l’entreprise', () => {
    expect(buildWebSite(site, origin)).toMatchObject({
      alternateName: site.shortName,
      publisher: { '@id': entityId(origin, 'entreprise') },
    });
    expect(buildFounder(site, origin)).toMatchObject({
      name: 'Amandine Gaury',
      worksFor: { '@id': entityId(origin, 'entreprise') },
    });
  });
});

describe('buildBreadcrumbList', () => {
  it('numérote à partir de 1 avec des URL absolues à slash final', () => {
    const list = asJson<{ itemListElement: { position: number; item: string }[] }>(
      buildBreadcrumbList(
        [
          { label: 'Accueil', href: '/' },
          { label: 'Réalisations', href: '/realisations' },
        ],
        origin,
      ),
    );
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(list.itemListElement[1]?.item).toBe('https://amgdecorationdinterieur.com/realisations/');
  });

  it('lève une erreur pour une liste vide', () => {
    expect(() => buildBreadcrumbList([], origin)).toThrow();
  });
});

describe('buildService', () => {
  it('ne publie aucune offre tarifaire', () => {
    const service = buildService(
      { name: 'Formule Essentiel', description: 'Petits espaces', path: '/prestations/essentiel/' },
      origin,
    );
    expect(service).not.toHaveProperty('offers');
    expect(service).toMatchObject({ provider: { '@id': entityId(origin, 'entreprise') } });
  });
});

describe('buildBlogPosting', () => {
  it('sérialise les dates en ISO et reprend la date de publication par défaut', () => {
    const post = buildBlogPosting(
      {
        headline: 'Titre',
        description: 'Description',
        path: '/conseils-deco/article/',
        datePublished: new Date('2026-11-17T00:00:00Z'),
        imageUrl: '/_astro/cover.jpg',
      },
      origin,
    );
    expect(post).toMatchObject({
      datePublished: '2026-11-17T00:00:00.000Z',
      dateModified: '2026-11-17T00:00:00.000Z',
      image: 'https://amgdecorationdinterieur.com/_astro/cover.jpg',
    });
  });
});

describe('serializeJsonLd', () => {
  it('neutralise toute séquence </script>', () => {
    const graph = buildGraph([{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }]);
    const json = serializeJsonLd(graph);
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual(graph);
  });

  it('produit un graphe global stable', () => {
    const graph = buildGraph([
      buildWebSite(site, origin),
      buildBusiness(site, origin),
      buildFounder(site, origin),
    ]);
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toHaveLength(3);
    expect(graph).toMatchSnapshot();
  });
});
