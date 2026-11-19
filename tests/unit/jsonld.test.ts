import { describe, expect, it } from 'vitest';
import { site, type SocialLink } from '@/config/site';
import {
  buildAboutPage,
  buildAreaServed,
  buildBlogPosting,
  buildBreadcrumbList,
  buildBusiness,
  buildCollectionPage,
  buildContactPage,
  buildCreativeWork,
  buildFounder,
  buildGraph,
  buildItemList,
  buildOpeningHoursSpecification,
  buildService,
  buildWebSite,
  entityId,
  FOUNDER_PROFILE_PATH,
  pageNodeId,
  serializeJsonLd,
  socialUrls,
  webPageInputFrom,
} from '@/lib/jsonld';

const origin = new URL('https://amgdecorationdinterieur.com');
/** Vue élargie (`owner` facultatif) de la configuration littérale. */
const socials: readonly SocialLink[] = site.socials;

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

  it('reprend les réseaux de l’entreprise dans sameAs, sans les profils personnels', () => {
    expect(business['sameAs']).toEqual(
      socials.filter((s) => s.owner !== 'founder').map((s) => s.url),
    );
    expect(business['sameAs']).not.toContain(
      'https://www.linkedin.com/in/amandine-gaury-97a263193/',
    );
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

  it('donne à la fondatrice l’URL absolue de sa page de présentation', () => {
    expect(FOUNDER_PROFILE_PATH).toBe('/a-propos/');
    expect(buildFounder(site, origin)).toMatchObject({
      url: 'https://amgdecorationdinterieur.com/a-propos/',
    });
  });

  it('publie le profil LinkedIn personnel dans le sameAs de la fondatrice', () => {
    expect(asJson<Record<string, unknown>>(buildFounder(site, origin))['sameAs']).toEqual([
      'https://www.linkedin.com/in/amandine-gaury-97a263193/',
    ]);
  });
});

describe('socialUrls', () => {
  it('répartit les profils entre entreprise et fondatrice sans en perdre', () => {
    const business = socialUrls(site, 'business');
    const founder = socialUrls(site, 'founder');
    expect([...business, ...founder].sort()).toEqual(site.socials.map((s) => s.url).sort());
    expect(founder).toEqual(['https://www.linkedin.com/in/amandine-gaury-97a263193/']);
  });

  it('n’émet pas de sameAs vide quand aucun profil n’existe', () => {
    const bare = { ...site, socials: [] };
    expect(buildFounder(bare, origin)).not.toHaveProperty('sameAs');
    expect(buildBusiness(bare, origin)).not.toHaveProperty('sameAs');
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
      site.areaServed,
      origin,
    );
    expect(service).not.toHaveProperty('offers');
    expect(service).toMatchObject({ provider: { '@id': entityId(origin, 'entreprise') } });
  });

  it('reprend la zone desservie de l’entreprise (même source que buildBusiness)', () => {
    const service = asJson<Record<string, unknown>>(
      buildService(
        {
          name: 'Formule Essentiel',
          description: 'Petits espaces',
          path: '/prestations/essentiel/',
        },
        site.areaServed,
        origin,
      ),
    );
    const business = asJson<Record<string, unknown>>(buildBusiness(site, origin));
    expect(service['areaServed']).toEqual(business['areaServed']);
    expect(service['areaServed']).toEqual(asJson(buildAreaServed(site.areaServed)));
  });
});

describe('buildCreativeWork', () => {
  it('rend les images absolues et attribue la création à la fondatrice', () => {
    const work = buildCreativeWork(
      {
        name: 'Chalet en Suisse',
        description: 'Résidence secondaire',
        path: '/realisations/chalet-suisse/',
        imageUrls: ['/_astro/rendu.jpg', 'https://cdn.example.com/photo.jpg'],
      },
      origin,
    );
    expect(work).toMatchObject({
      url: 'https://amgdecorationdinterieur.com/realisations/chalet-suisse/',
      image: [
        'https://amgdecorationdinterieur.com/_astro/rendu.jpg',
        'https://cdn.example.com/photo.jpg',
      ],
      creator: { '@id': entityId(origin, 'fondatrice') },
    });
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

  it('attribue l’article à la fondatrice et le rattache au site et à l’entreprise par @id', () => {
    const post = buildBlogPosting(
      {
        headline: 'Titre',
        description: 'Description',
        path: '/conseils-deco/article',
        datePublished: new Date('2026-11-17T00:00:00Z'),
        dateModified: new Date('2026-11-20T00:00:00Z'),
        imageUrl: '/_astro/cover.jpg',
      },
      origin,
    );
    expect(post).toMatchObject({
      url: 'https://amgdecorationdinterieur.com/conseils-deco/article/',
      mainEntityOfPage: 'https://amgdecorationdinterieur.com/conseils-deco/article/',
      dateModified: '2026-11-20T00:00:00.000Z',
      author: { '@id': entityId(origin, 'fondatrice') },
      publisher: { '@id': entityId(origin, 'entreprise') },
      isPartOf: { '@id': entityId(origin, 'site') },
    });
  });
});

describe('webPageInputFrom', () => {
  it('reprend le titre et la description SEO et le chemin du dernier élément du fil', () => {
    expect(
      webPageInputFrom({
        seo: { title: 'Contact', description: 'Écrivez-moi' },
        breadcrumbs: [
          { label: 'Accueil', href: '/' },
          { label: 'Contact', href: '/contact/' },
        ],
      }),
    ).toEqual({ name: 'Contact', description: 'Écrivez-moi', path: '/contact/' });
  });

  it('lève une erreur si le fil d’Ariane est vide', () => {
    expect(() =>
      webPageInputFrom({ seo: { title: 'T', description: 'D' }, breadcrumbs: [] }),
    ).toThrow();
  });
});

describe('buildItemList et buildCollectionPage', () => {
  const items = [
    { name: 'Chalet en Suisse', path: '/realisations/chalet-suisse/' },
    { name: 'Espace scandinave', path: '/realisations/espace-de-vie-scandinave' },
  ] as const;

  it('numérote les éléments à partir de 1 avec des URL absolues à slash final', () => {
    expect(asJson(buildItemList(items, origin))).toEqual({
      '@type': 'ItemList',
      numberOfItems: 2,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Chalet en Suisse',
          url: 'https://amgdecorationdinterieur.com/realisations/chalet-suisse/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Espace scandinave',
          url: 'https://amgdecorationdinterieur.com/realisations/espace-de-vie-scandinave/',
        },
      ],
    });
  });

  it('rattache la page au site et en fait l’entité principale de la liste', () => {
    const page = asJson<Record<string, unknown>>(
      buildCollectionPage(
        { name: 'Réalisations', description: 'Mes projets', path: '/realisations/', items },
        origin,
      ),
    );
    expect(page).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://amgdecorationdinterieur.com/realisations/',
      isPartOf: { '@id': entityId(origin, 'site') },
      inLanguage: 'fr-FR',
      mainEntity: { '@type': 'ItemList', numberOfItems: 2 },
    });
  });
});

describe('buildAboutPage et buildContactPage', () => {
  const input = { name: 'Page', description: 'Description', path: '/a-propos/' } as const;

  it('AboutPage : entité principale = fondatrice, sujet = entreprise', () => {
    expect(buildAboutPage(input, origin)).toMatchObject({
      '@type': 'AboutPage',
      url: 'https://amgdecorationdinterieur.com/a-propos/',
      mainEntity: { '@id': entityId(origin, 'fondatrice') },
      about: { '@id': entityId(origin, 'entreprise') },
      isPartOf: { '@id': entityId(origin, 'site') },
    });
  });

  it('ContactPage : rattachée à l’entreprise, sans dupliquer ses coordonnées', () => {
    const page = asJson<Record<string, unknown>>(
      buildContactPage({ ...input, path: '/contact/' }, origin),
    );
    expect(page).toMatchObject({
      '@type': 'ContactPage',
      url: 'https://amgdecorationdinterieur.com/contact/',
      about: { '@id': entityId(origin, 'entreprise') },
    });
    expect(page).not.toHaveProperty('telephone');
    expect(page).not.toHaveProperty('email');
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

describe('identifiants @id des nœuds de page', () => {
  const page = 'https://amgdecorationdinterieur.com/prestations/confort/';

  it('pageNodeId : URL canonique à slash final + fragment', () => {
    expect(pageNodeId('/prestations/confort', origin, 'service')).toBe(`${page}#service`);
  });

  it('Service : @id #service, image seulement si un visuel est fourni', () => {
    const input = {
      name: 'Confort',
      description: 'Pièces de vie',
      path: '/prestations/confort/',
    } as const;
    const bare = asJson<Record<string, unknown>>(buildService(input, site.areaServed, origin));
    expect(bare['@id']).toBe(`${page}#service`);
    expect(bare).not.toHaveProperty('image');
    expect(
      buildService({ ...input, imageUrl: '/_astro/confort.jpg' }, site.areaServed, origin),
    ).toMatchObject({ image: 'https://amgdecorationdinterieur.com/_astro/confort.jpg' });
  });

  it('CreativeWork : @id #projet et rattachement au site', () => {
    expect(
      buildCreativeWork(
        { name: 'Chalet', description: 'D', path: '/realisations/chalet-suisse/', imageUrls: [] },
        origin,
      ),
    ).toMatchObject({
      '@id': 'https://amgdecorationdinterieur.com/realisations/chalet-suisse/#projet',
      isPartOf: { '@id': entityId(origin, 'site') },
    });
  });

  it('BlogPosting : @id #article et keywords tirés des étiquettes (omis si aucune)', () => {
    const input = {
      headline: 'Titre',
      description: 'D',
      path: '/conseils-deco/plan-3d/',
      datePublished: new Date('2026-11-17T00:00:00Z'),
      imageUrl: '/_astro/cover.jpg',
    } as const;
    expect(
      buildBlogPosting({ ...input, keywords: ['Plan 3D', 'Rénovation'] }, origin),
    ).toMatchObject({
      '@id': 'https://amgdecorationdinterieur.com/conseils-deco/plan-3d/#article',
      keywords: 'Plan 3D, Rénovation',
    });
    expect(buildBlogPosting({ ...input, keywords: [] }, origin)).not.toHaveProperty('keywords');
  });

  it('BreadcrumbList : @id #fil-ariane sur l’URL de la page courante (dernier élément)', () => {
    expect(
      buildBreadcrumbList(
        [
          { label: 'Accueil', href: '/' },
          { label: 'Confort', href: '/prestations/confort/' },
        ],
        origin,
      ),
    ).toMatchObject({ '@id': `${page}#fil-ariane` });
  });

  it('pages WebPage : @id #page et breadcrumb relié au fil d’Ariane de la même page', () => {
    const input = { name: 'Contact', description: 'D', path: '/contact/' } as const;
    const contact = 'https://amgdecorationdinterieur.com/contact/';
    for (const node of [
      buildContactPage(input, origin),
      buildAboutPage(input, origin),
      buildCollectionPage({ ...input, items: [] }, origin),
    ]) {
      expect(node).toMatchObject({
        '@id': `${contact}#page`,
        breadcrumb: { '@id': `${contact}#fil-ariane` },
      });
    }
  });
});
