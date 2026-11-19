# ADR-0014 — Lecteurs Astro et modèles purs dans lib/pages/

- **Statut** : acceptée
- **Date** : 2026-11-19

## Contexte

CLAUDE.md §3 impose des pages sans logique (« pages = assemblage ») et un `lib/` de fonctions pures et testées, sans import Astro. Or chaque page doit lire des collections (`getEntry`, `getCollection`, `render`), générer des images (`getImage`, pour le JSON-LD), puis trier, filtrer, vérifier les sections obligatoires, construire cartes, fil d'Ariane et JSON-LD.

Au fil des phases, cette mise en forme s'est retrouvée dans le frontmatter des pages (requêtes, tris, `as`), puis dans des modules `lib/pages/*.ts` qui mêlaient lecture Astro et logique : impossibles à tester avec Vitest, car `astro:content` n'existe qu'au build. L'audit d'architecture de la Phase 7 a aussi relevé onze replis `Astro.site ?? Astro.url` (URL absolues dépendant de l'hôte de rendu) et le JSON-LD des prestations assemblé dans la route.

## Options envisagées

1. **Tout dans les pages** : simple à lire page par page, mais logique non testable, dupliquée, et contraire à §3.
2. **Un seul module par page dans `lib/pages/`** (lecture + mise en forme) : pages propres, mais logique toujours non testable sans simuler `astro:content`.
3. **Deux modules par page** : un lecteur `<page>.ts` (I/O Astro, mince) et un modèle `<page>-model.ts` (pur, testé). Un fichier de plus par page, frontière nette.

## Décision

**Option 3.**

- `src/lib/pages/<page>.ts` — **lecteur**. Seul point d'accès aux collections pour la page. Il lit les entrées, la configuration (`site.ts`, `microcopy.ts`) et génère les images, appelle le modèle avec des entrées **brutes**, puis ajoute le JSON-LD avec les fonctions pures de `src/lib/jsonld.ts`. Il expose `get<Page>Data(origin: URL)` (renvoie `WithJsonLd<Model>`) ou `get<Page>Paths()` (`getStaticPaths` prêt à l'emploi, props JSON-LD comprises).
- `src/lib/pages/<page>-model.ts` — **modèle**. Fonction pure `build<Page>Model(input)`. Pas d'import Astro à l'exécution (les types `CollectionEntry` sont importés en `import type`). Testé dans `tests/unit/<page>-model.test.ts` avec des entrées fabriquées.
- Briques partagées : `types.ts` (`PageSection`, `WithJsonLd`…), `sections.ts` (`readSections`), `breadcrumb-trail.ts` (`breadcrumbTrail`), `page.ts` (`getPageData`), et `ContentError` (`src/lib/content.ts`) pour tout contenu attendu manquant.
- L'origine du site vient toujours de `site` (`astro.config.mjs`) via `requireSiteOrigin` (`src/lib/url.ts`) : la page passe `requireSiteOrigin(Astro.site)` au lecteur ; dans un `getStaticPaths`, où `Astro.site` n'existe pas (déprécié depuis Astro 6), le lecteur lit `import.meta.env.SITE`. Aucun repli sur `Astro.url`.

Une page se réduit à un appel au lecteur et à l'assemblage de blocs.

## Conséquences

- Positif : toute la logique de page est couverte par Vitest ; les pages et les lecteurs n'ont plus de branche à tester (l'e2e, dont `structured-data.spec.ts`, couvre le câblage) ; une configuration sans `site` fait échouer le build au lieu de publier des URL fausses.
- Négatif : deux fichiers par page et un niveau d'indirection de plus ; un développeur qui découvre le projet doit savoir où regarder (`docs/ARCHITECTURE.md`, § Données des pages).
- À surveiller : un lecteur qui grossit (tri, condition, calcul) signale de la logique à redescendre dans le modèle ; un modèle qui importe `astro:*` à l'exécution casse les tests unitaires.
