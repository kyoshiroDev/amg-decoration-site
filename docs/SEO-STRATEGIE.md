# Stratégie SEO

> Tenue à jour par l'agent `seo`.

## 1. Positionnement

Double ancrage :

- **Local** : décoratrice d'intérieur à Paris / Île-de-France.
- **National, à distance** : décoration d'intérieur en ligne avec visualisation 3D (marché bien moins concurrentiel que « décoratrice Paris », et c'est sa vraie différence).

## 2. Plan du site et intentions

Une intention et un mot-clé principal par page (pas de cannibalisation). Titles réels relevés dans `dist/` (audit Phase 4, 18/11/2026) ; le suffixe « | AMG Décoration » n'est ajouté que si l'ensemble tient dans 60 caractères.

| URL                                                                 | Intention                          | Mot-clé principal (à valider par recherche)                                                                               | `<title>` actuel (car.)                                                   |
| ------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                                                 | Marque + offre                     | décoratrice d'intérieur Paris (3D)                                                                                        | Décoratrice d’intérieur 3D à Paris \| AMG Décoration (51)                 |
| `/prestations/`                                                     | `CollectionPage`, `BreadcrumbList` | `buildCollectionPage` : `ItemList` des formules puis des offres, dans l'ordre affiché                                     |
| `/prestations/essentiel/`                                           | Formule petite pièce               | décorer un petit espace en 3D                                                                                             | Formule Essentiel : décorer un petit espace en 3D (49)                    |
| `/prestations/confort/`                                             | Formule pièce de vie               | décoration pièce de vie 3D                                                                                                | Formule Confort : décoration de pièce de vie en 3D (50)                   |
| `/prestations/signature/`                                           | Formule espaces ouverts            | décoration espace ouvert / salon cuisine ouverte 3D                                                                       | Formule Signature : espaces ouverts en 3D \| AMG Décoration (58)          |
| `/prestations/studio/`                                              | Formule studio                     | aménagement studio / petit espace 3D                                                                                      | Formule Studio : aménagement de studio en 3D (44)                         |
| `/prestations/meuble-sur-mesure/`                                   | Conception de meuble               | meuble sur mesure 3D                                                                                                      | Meuble sur mesure en 3D, conçu pour votre intérieur (51)                  |
| `/prestations/professionnels/`                                      | Offre B2B                          | visuels 3D immobilier / home staging virtuel                                                                              | Visuels 3D pour agents immobiliers et investisseurs (51)                  |
| `/visualisation-3d/`                                                | Comprendre la 3D, la méthode       | visualisation 3D avant travaux, plan 3D déco                                                                              | Visualisation 3D avant travaux et plan 3D déco (46)                       |
| `/realisations/`                                                    | Preuve, inspiration                | réalisations décoratrice d'intérieur                                                                                      | Réalisations : décoration d’intérieur en 3D \| AMG Décoration (60)        |
| `/realisations/<projet>/`                                           | `CreativeWork`, `BreadcrumbList`   | `buildCreativeWork` (`@id` `#projet`, `creator` → `#fondatrice`, `isPartOf` → `#site`, images ≥ 1200 px en JPEG absolues) |
| `/a-propos/`                                                        | Confiance (E-E-A-T)                | Amandine Gaury décoratrice                                                                                                | Amandine Gaury, décoratrice d’intérieur 3D \| AMG Décoration (59)         |
| `/conseils-deco/`                                                   | Hub longue traîne                  | conseils déco                                                                                                             | Conseils déco d’une décoratrice d’intérieur \| AMG Décoration (60)        |
| `/conseils-deco/plan-3d-avant-renovation/`                          | Informationnelle                   | pourquoi faire un plan 3D avant de rénover                                                                                | Plan 3D décoration intérieure : l’atout avant de rénover (56), à corriger |
| `/conseils-deco/decoratrice-interieur-a-distance/`                  | Informationnelle                   | décoratrice d'intérieur à distance, conseil déco à distance                                                               | Décoratrice d’intérieur à distance : comment ça se passe (56)             |
| `/contact/`                                                         | Conversion                         | contact décoratrice d'intérieur, devis                                                                                    | Contact et devis décoratrice d’intérieur \| AMG Décoration (57)           |
| `/mentions-legales/`, `/confidentialite/`, `/conditions-generales/` | Légal                              | —                                                                                                                         | titres simples + suffixe                                                  |
| `/merci/`, `/404`, `/styleguide/`                                   | Technique                          | — (`noindex, nofollow`, hors sitemap)                                                                                     | —                                                                         |

**Cannibalisation à corriger** : l'article `plan-3d-avant-renovation` vise en tête de title « plan 3D décoration intérieure », mot-clé attribué à `/visualisation-3d/` (page de service). L'article doit garder l'intention informationnelle (« pourquoi un plan 3D avant de rénover ») et lier vers `/visualisation-3d/` avec l'ancre « plan 3D de décoration intérieure ». Proposition transmise au rédacteur (title = h1 : « Pourquoi faire un plan 3D avant de rénover son intérieur ? », 58 car.).

**Mot-clé dans le h1** : les fiches prestations ont pour h1 le seul nom de la formule (« Formule Confort ») ; le mot-clé n'apparaît que dans le title. À améliorer (voir rapport d'audit Phase 4 : champ de titre de héros distinct du nom de la formule).

**Convention d'URL** : slash final partout (`trailingSlash: 'always'` dans `astro.config.mjs`, identique au WordPress actuel ⇒ moins de redirections), slugs en français sans accents. Côté Vercel, la normalisation est la **dernière règle de `redirects`** et non l'option `trailingSlash` (voir §3).

### Réalisations migrées (slugs retenus en Phase 3)

Slug = sujet du projet (pièce, lieu ou style), jamais le prénom du client : c'est ce que tape l'internaute, et cela évite d'exposer un prénom dans l'URL. Constantes exportées par `src/lib/redirects.ts` (`PROJECT_SLUGS`).

| Ancienne URL      | Nouvelle URL                              | Contenu                                                        | Requête visée (à valider)                                    |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `/projet-chalet/` | `/realisations/chalet-suisse/`            | Appartement-chalet, résidence secondaire dans les Alpes        | décoration chalet, aménagement résidence secondaire montagne |
| `/projet-lamyae/` | `/realisations/piece-de-vie-bois-pierre/` | Pièce de vie d'une maison en construction, bois et pierre      | pièce de vie bois et pierre, salon bois pierre 3D            |
| `/projet-iryna/`  | `/realisations/espace-de-vie-scandinave/` | Espace de vie scandinave, bois clair, ciment, fibres           | espace de vie scandinave, salon scandinave 3D                |
| `/projet_magali/` | `/realisations/sous-sol-suite-parentale/` | Sous-sol transformé en suite parentale (dressing, salle d'eau) | transformer un sous-sol en chambre / suite parentale         |

## 3. Redirections 301 (`vercel.json`)

Base : inventaire exhaustif du 18/11/2026 (`docs/CONTENU-EXISTANT.md` §1). **Source de vérité : `src/lib/redirects.ts`** ; `vercel.json` → `redirects` doit lui être strictement égal (test `tests/unit/redirects.test.ts`, qui vérifie aussi : aucun doublon, aucune chaîne, aucune page du nouveau site redirigée, chaque ancienne URL — avec et sans slash final — aboutit en **un seul saut** à une page servie en 200). Pour ajouter une redirection : modifier `redirects.ts`, puis recopier `buildVercelRedirects()` dans `vercel.json`.

### Tableau final

Chaque URL de page est déclarée **avec et sans slash final** (l'accueil WordPress lie `/projet-chalet`, `/projet-lamyae`, `/projet-iryna` sans slash).

| Ancienne URL                                                                                                                                    | Nouvelle URL                              | Motif                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `/`, `/a-propos/`, `/contact/`                                                                                                                  | identique (200)                           | URL conservée                                               |
| `/services/`                                                                                                                                    | `/prestations/`                           | même contenu                                                |
| `/about/`                                                                                                                                       | `/realisations/`                          | la page « Réalisations » WordPress                          |
| `/politique-de-confidentialite/`                                                                                                                | `/mentions-legales/`                      | contenait en réalité les mentions légales                   |
| `/conditions-generales-de-services-cgs/`                                                                                                        | `/conditions-generales/`                  | même contenu                                                |
| `/projet-chalet/` et `/projet-iryna/projet-chalet/` (lien cassé de `/about/`)                                                                   | `/realisations/chalet-suisse/`            | même projet                                                 |
| `/projet-lamyae/`                                                                                                                               | `/realisations/piece-de-vie-bois-pierre/` | même projet                                                 |
| `/projet-iryna/`                                                                                                                                | `/realisations/espace-de-vie-scandinave/` | même projet                                                 |
| `/projet_magali/`                                                                                                                               | `/realisations/sous-sol-suite-parentale/` | même projet                                                 |
| `/projet-1/` à `/projet-7/`, `/projet-marine/`, `/projet-marine-dupliquer-3417/`, `/projet-chambre-ado/`, `/projet-chambre-ado-dupliquer-3454/` | `/realisations/`                          | projets sans texte non migrés : page parente la plus proche |
| `/bonjour-tout-le-monde/`, `/2593-2/`                                                                                                           | `/conseils-deco/`                         | articles vides (test WordPress, « Feed Instagram »)         |
| `/category/blog/`, `/category/*` (pagination, flux de catégorie)                                                                                | `/conseils-deco/`                         | archive du blog                                             |
| `/author/amgdecorationdinterieur-com/`, `/author/*`                                                                                             | `/a-propos/`                              | archive auteur → présentation d'Amandine                    |
| `/feed/`, `/feed/*` (`rss2`, `atom`…), `/comments/feed/`, `/bonjour-tout-le-monde/feed/`, `/2593-2/feed/`                                       | `/conseils-deco/`                         | voir « Flux RSS » ci-dessous                                |
| `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`, `/page-sitemap.xml`, `/post-sitemap.xml`, `/category-sitemap.xml`, `/sitemap.rss`      | `/sitemap-index.xml`                      | sitemap Astro                                               |
| `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`, `/wp-json/*`, `/wp-includes/*`, `/wp-content/*` (y compris `uploads`)                            | **404** (aucune règle)                    | voir décisions ci-dessous                                   |
| toute URL sans slash final (hors fichiers)                                                                                                      | même URL + `/`                            | normalisation, dernière règle                               |

### Décisions techniques et sources

- **Code HTTP** : `permanent: true` ⇒ Vercel renvoie **308**, pas 301. Google : « 308 — Equivalent to 301 », signal de redirection fort ([Google Search Central, codes HTTP](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)). On garde `permanent: true` (convention Vercel) ; `statusCode: 301` serait possible mais n'apporte rien.
- **Pas d'option `trailingSlash` dans `vercel.json`** : le compilateur de routes de Vercel (`@vercel/routing-utils`, `getTransformedRoutes`, v6.6.1) insère les règles de `trailingSlash` **avant** celles de `redirects`. Avec `trailingSlash: true`, `/projet-chalet` faisait donc `/projet-chalet` → 308 `/projet-chalet/` → 308 `/realisations/chalet-suisse/` (chaîne). On déclare les anciennes URLs sans slash explicitement, puis une **dernière règle** reproduit la normalisation de Vercel : `/:path((?!(?:\.well-known|_vercel)/)(?:[^/]+/)*[^/.]+)` → `/:path/` (dernier segment sans point : les fichiers `/_astro/*.css`, `robots.txt`, sitemaps ne sont pas touchés). Vérifié en simulant le `vercel.json` compilé par `@vercel/routing-utils` sur toutes les anciennes URLs et les pages du nouveau site : 0 écart avec `resolveRedirect()`, 0 chaîne. Seule différence avec l'ancienne option : un fichier suivi d'un slash (`/robots.txt/`) n'est plus redirigé vers `/robots.txt` (404, sans importance).
- **Casse** : les `source` de `redirects` sont sensibles à la casse (« the `source` property is case-sensitive », [doc `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json)). Les URLs WordPress étant en minuscules, aucune variante en majuscules n'est déclarée.
- **Ordre** : première règle correspondante gagnante ; ordre fixé par `buildVercelRedirects()` (pages exactes → préfixes `/:rest+` → fichiers → normalisation du slash). Limite Vercel : 2 048 redirections ([Configuration Redirects, Limits](https://vercel.com/docs/routing/redirects/configuration-redirects)) ; nous en avons 70.
- **Query strings** : conservées par Vercel vers la destination. `/?p=123` ou `/?page_id=…` (liens courts WordPress) tombent sur l'accueil (200, canonical sans paramètre) : acceptable, aucun lien de ce type n'est relevé.
- **`/wp-admin`, `/wp-login.php`, `/wp-json/*`, `/xmlrpc.php`, `/wp-includes/*` → 404** : ce ne sont pas des contenus (`/wp-admin/` était déjà en `Disallow`), le trafic y est surtout celui de robots d'attaque, et rediriger vers l'accueil créerait des « soft 404 ». 410 n'apporterait rien : Google « traite tous les 4xx (sauf 429) de la même façon » (source ci-dessus) ; et Vercel ne sait pas renvoyer 410 depuis `redirects` (seulement 301/302/303/307/308) — il faudrait une fonction ou la syntaxe historique `routes`, incompatible avec `redirects`/`headers`. Les règles de type `trailingSlash` ajoutent seulement un slash aux chemins sans point (`/wp-admin` → `/wp-admin/` → 404) : sans conséquence.
- **Médias `/wp-content/uploads/*` → 404** : Google Images envoie l'internaute vers la **page** hôte (déjà redirigée vers la bonne fiche), pas vers le fichier. Une image ne peut être remplacée que par une image équivalente ; or les nouvelles images passent par `astro:assets` (noms hachés, AVIF/WebP), donc sans URL stable à cibler. Rediriger ~100 PNG vers une page HTML (`/realisations/`) serait traité comme un soft 404. Le 404 laisse Google remplacer proprement les anciennes images par les nouveaux rendus, indexés via les nouvelles pages (avec `alt` descriptifs, ce que l'ancienne médiathèque n'avait pas). À réexaminer seulement si la Search Console montre un trafic Google Images significatif sur ces fichiers.
- **Flux RSS** → `/conseils-deco/` (contenu le plus proche : le flux listait les articles). `/` n'aurait pas été plus utile. Si un flux est créé plus tard (`@astrojs/rss`, ex. `/conseils-deco/rss.xml`), changer la destination de `/feed/` et `/feed/*` vers ce flux dans `redirects.ts`.
- **Pages pièces jointes WordPress** (`/<page>/<image>/`, `/?attachment_id=`) : non relevées dans les sitemaps ni l'API ; non traitées.

### Avant la mise en production (Phase 6)

- [ ] Exporter les URLs indexées depuis la Search Console (Pages + Images) ou `site:amgdecorationdinterieur.com`, et vérifier que **100 %** ont une destination 200 ou 301 (ajouter les manquantes dans `LEGACY_URLS` du test et dans `redirects.ts`).
- [ ] Après bascule : `curl -sI https://amgdecorationdinterieur.com/projet-chalet` → `308` + `location: /realisations/chalet-suisse/` ; idem un échantillon du tableau.
- [ ] Soumettre `/sitemap-index.xml` dans la Search Console ; suivre le rapport « Pages » (404, redirections) pendant 3 mois ; garder les redirections au moins un an (idéalement indéfiniment).

## 4. Données structurées

### Principe (implémenté en Phase 2)

- **Un seul `<script type="application/ld+json">` par page**, rendu par `src/components/seo/JsonLd.astro`, contenant un `@graph`. Jamais de JSON-LD écrit à la main dans une page : tout est généré par `src/lib/jsonld.ts` (types `schema-dts`, testé dans `tests/unit/jsonld.test.ts`). La sérialisation échappe `<` (`\u003c`).
- **Entités globales reliées par `@id`** (émises par `BaseLayout` sur toutes les pages) :

| `@id`                                             | Type                  | Propriétés clés                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://amgdecorationdinterieur.com/#site`       | `WebSite`             | `name`, `alternateName` (« AMG Décoration », nom de site Google), `url`, `inLanguage: fr-FR`, `publisher` → `#entreprise`                                                                                                  |
| `https://amgdecorationdinterieur.com/#entreprise` | `ProfessionalService` | `name`, `alternateName`, `slogan`, `url`, `telephone` (E.164), `email` (affiché dans le pied de page), `address` (région + pays seulement), `areaServed`, `openingHoursSpecification`, `founder` → `#fondatrice`, `sameAs` |
| `https://amgdecorationdinterieur.com/#fondatrice` | `Person`              | `name`, `jobTitle`, `url` (→ `/a-propos/`), `worksFor` → `#entreprise`, `sameAs` (LinkedIn)                                                                                                                                |

- Les nœuds propres à une page (`BreadcrumbList`, `Service`, `CreativeWork`, `BlogPosting`) s'ajoutent au même graphe via la prop `jsonLd` des layouts et référencent les entités globales par `@id` (`provider`, `creator`, `author`, `publisher`).
- Toutes les données viennent de `src/config/site.ts` (NAP identique partout).

### Choix assumés

- **Pas d'adresse précise** : ni `streetAddress`, ni `postalCode`, ni `geo` tant que l'adresse n'est pas fournie (`TODO(contenu)` dans `site.ts`). Google n'exige que `name` et `address` (« autant de propriétés que possible ») : un `PostalAddress` région + pays reste valide. Pour une entreprise de zone desservie, la visibilité locale repose surtout sur la fiche Google Business Profile.
- **`areaServed`** : sous-types de `Place` (`City` Paris, `AdministrativeArea` Île-de-France, `Country` France), générés par `buildAreaServed(site.areaServed)` et **partagés** par l'entreprise et chaque `Service` (une seule source). Zone **visible** sur toutes les pages : colonne « Zone d'intervention » du pied de page (`microcopy.footer.area` : Paris, Île-de-France, distanciel partout en France). À compléter avec la Suisse si Amandine confirme qu'elle y accepte des projets (un projet y est cité).
- **Pas de `priceRange`** ni d'`Offer` tant que les tarifs ne sont pas validés (on n'invente rien).
- **`logo` / `image`** : non émis pour l'instant. `buildBusiness(config, origin, { logoUrl, imageUrls })` les publiera dès que le logo (≥ 112 × 112 px, lisible sur fond blanc) et de vrais rendus 3D seront fournis. L'image OG provisoire n'est pas réutilisée : ce n'est pas un visuel de la marque.
- **Pas d'`AggregateRating` ni de `review`** auto-attribués (non éligibles, contraires aux consignes). Les avis Google seront affichés comme contenu avec lien vers la fiche.
- `ProfessionalService` : schema.org signale ce type comme « déprécié » au sens de catégorie générique, mais il reste valide et reconnu par Google comme sous-type de `LocalBusiness` ; aucun type plus précis n'existe pour un décorateur d'intérieur.

### Par type de page (implémenté en Phase 4)

Chaque page émet le graphe global (`WebSite`, `ProfessionalService`, `Person`) puis ses nœuds propres. Contrôlé sur toutes les pages du sitemap et `/merci/` par `tests/e2e/structured-data.spec.ts`, qui lit le HTML de `dist/` (contrôles dans `tests/e2e/jsonld-assert.ts`, table unique des types attendus par route `expectedPageTypes`) : un seul script parsable, `@context` schema.org, les 3 entités globales, types du gabarit, chaque référence `@id` résolue dans le graphe de la page, aucun `@id` dupliqué, URL absolues sur l'origine de production, images `/_astro/` présentes dans `dist/`, propriétés requises (`BlogPosting` : `headline` ≤ 110 caractères, `image`, `datePublished`, `author` ; `Service` : `name`, `provider`, `areaServed` ; `CreativeWork` : `image` ; `ItemList` : `numberOfItems` = nombre d'éléments ; positions 1..n des listes et fils d'Ariane).

| Page                                 | Nœuds propres (ordre du `@graph`)  | Source                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                  | —                                  | `BaseLayout`                                                                                                                                                                         |
| `/prestations/`                      | `CollectionPage`, `BreadcrumbList` | `buildCollectionPage` : `ItemList` des formules puis des offres, dans l'ordre affiché                                                                                                |
| `/prestations/<formule>/` (6 fiches) | `Service`, `BreadcrumbList`        | `buildService` (`@id` `#service`, `provider` → `#entreprise`, `areaServed` = celle de l'entreprise, `image` si `cover`, **sans `offers`**)                                           |
| `/visualisation-3d/`, pages légales  | `BreadcrumbList`                   | `PageLayout`                                                                                                                                                                         |
| `/realisations/`, `/conseils-deco/`  | `CollectionPage`, `BreadcrumbList` | `buildCollectionPage` : `mainEntity` = `ItemList` des cartes, dans l'ordre affiché                                                                                                   |
| `/realisations/<projet>/`            | `CreativeWork`, `BreadcrumbList`   | `buildCreativeWork` (`@id` `#projet`, `creator` → `#fondatrice`, `isPartOf` → `#site`, images ≥ 1200 px en JPEG absolues)                                                            |
| `/conseils-deco/<article>/`          | `BlogPosting`, `BreadcrumbList`    | `buildBlogPosting` (`@id` `#article`, `author` → `#fondatrice`, `publisher` → `#entreprise`, `isPartOf` → `#site`, `datePublished`/`dateModified`, `image`, `keywords` = étiquettes) |
| `/a-propos/`                         | `AboutPage`, `BreadcrumbList`      | `buildAboutPage` (`mainEntity` → `#fondatrice`, `about` → `#entreprise`)                                                                                                             |
| `/contact/`                          | `ContactPage`, `BreadcrumbList`    | `buildContactPage` (`about` → `#entreprise` ; coordonnées non dupliquées)                                                                                                            |
| `/merci/`, `/404`, `/styleguide/`    | —                                  | `noindex`                                                                                                                                                                            |

- **Identifiants des nœuds de page** (`pageNodeId`) : URL canonique + fragment — `#service`, `#projet`, `#article`, `#page` (`CollectionPage`, `AboutPage`, `ContactPage`) et `#fil-ariane` (`BreadcrumbList`, sur l'URL de la page courante). Les nœuds `WebPage` pointent leur fil par `breadcrumb: { "@id": "…#fil-ariane" }`.
- Volontairement absents : `FAQPage` (FAQ non affichée), `offers` (ADR-0007), `logo` (pas de logo vectoriel fourni).
- `BlogPosting.author` : la même personne est **signée visiblement** sous le h1 (« Par Amandine Gaury, designer d'intérieur », lien vers `/a-propos/`, `buildByline` dans `articles-model.ts`, nom et métier lus dans `site.founder`) ; l'e2e `structured-data.spec.ts` vérifie que le nom de l'auteur JSON-LD est dans le `<main>` avec un lien vers son `url`.
- `BreadcrumbList` : construite depuis le même tableau que le fil visible (`breadcrumbs` du modèle) ; l'e2e vérifie l'égalité des libellés et des URL sur chaque page interne.
- `Person` : `url` → `/a-propos/` (page de profil, signal E-E-A-T) et `sameAs` = profils personnels (`owner: 'founder'` dans `site.socials`, aujourd'hui LinkedIn, relevé sur le site actuel ; activité du profil à confirmer). Les autres réseaux (Instagram, Facebook, Pinterest) vont dans le `sameAs` de l'entreprise (`socialUrls` dans `jsonld.ts`).
- **Décisions** : `CollectionPage` + `ItemList` sur les index (sémantique uniquement : les carrousels Google ne concernent pas ce type de contenu ; aucun risque car la liste reprend exactement les cartes visibles). `AboutPage` et `ContactPage` : utiles pour relier les pages aux entités par `@id`, sans effet d'affichage attendu. **Pas de `FAQPage`** (FAQ vide ; et plus de résultat enrichi pour ce type de site). Pas de `WebPage` générique sur les autres pages (aucun gain). Le nom des nœuds `WebPage` reprend le title SEO (sans suffixe), la description reprend la meta description.
- `ImageObject` détaillé (licence, auteur) : à ajouter quand les vrais rendus 3D seront fournis (placeholders aujourd'hui).

Validation : Rich Results Test + validator.schema.org avant chaque livraison de phase SEO.

## 4 bis. Balises `<head>` (règles appliquées au build)

Composant `src/components/seo/SEO.astro`, valeurs par défaut dans `src/config/seo.ts`, règles pures dans `src/lib/seo.ts` (testées). **Toute violation fait échouer `astro build`.**

- **Titre** : 60 caractères maximum (comptés en NFC). Format « Titre | AMG Décoration » si l'ensemble tient dans 60 caractères, sinon le titre seul ; un titre seul de plus de 60 caractères lève une erreur. Mot-clé en tête.
- **Description** : 140 à 160 caractères, sinon erreur.
- **Canonical** : URL absolue avec slash final, sans query ni ancre ; **absente sur les pages `noindex`** (ainsi que `og:url`).
- **Robots** : `index, follow` par défaut ; `noindex, nofollow` pour la 404, `/merci/` et le styleguide.
- **Open Graph / Twitter** : `og:type`, `og:site_name`, `og:locale` (`fr_FR`), `og:title`, `og:description`, `og:url`, `og:image` (JPEG 1200 × 630 généré par `getImage`, URL absolue) + `og:image:type`, `:width`, `:height`, `:alt` ; `twitter:card` `summary_large_image` + titre, description, image, alt.
- **Image OG par page** (toujours avec son `og:image:alt`) : couverture de l'article ou du projet ; `/visualisation-3d/` → `media.methodHero` ; `/realisations/` et `/conseils-deco/` → couverture de la **première carte affichée** (champ `ogImage` des modèles `projects-model.ts` / `articles-model.ts`, testé) ; fiches prestations → `cover` si renseigné dans `src/content/prestations/*.md`, sinon image par défaut (`config/seo.ts`). Recadrage `fit: 'cover'` explicite par `getImage` ; **garde-fou** `assertOgImageSource` : une source de moins de 1200 × 630 px fait échouer le build (sharp redimensionne avec `withoutEnlargement`, l'image produite serait plus petite que les dimensions annoncées). L'e2e lit le JPEG de chaque page du sitemap dans `dist/` (segment SOF) et vérifie 1200 × 630 (ADR-0011).
- **Articles** (`og:type` `article`, dérivé de la prop `article` de `SEO.astro`, passée par `ArticleLayout` ; `website` partout ailleurs) : `article:published_time`, `article:modified_time` (= publication à défaut de mise à jour) en ISO 8601, **mêmes valeurs** que `datePublished` / `dateModified` du `BlogPosting`, et un `article:tag` par étiquette. Règle pure `buildArticleMetaTags` (`src/lib/seo.ts`) ; l'e2e vérifie l'égalité avec le JSON-LD et l'absence de balise `article:*` sur les autres pages.
- Ordre du `<head>` : `charset` en premier, puis viewport ; `lang="fr"` sur `<html>` ; pas de `hreflang` (site monolingue).
- **Sitemap** : `@astrojs/sitemap` ; la 404 est exclue d'office, `/styleguide/` et `/merci/` par le `filter` d'`astro.config.mjs` (toute future page `noindex` doit y être ajoutée). Les brouillons d'articles n'ont pas de route, donc pas d'entrée. Pas encore de `lastmod` (voir audit Phase 4). `<link rel="sitemap">` dans le `<head>`.
- **robots.txt** : généré au build par l'endpoint `src/pages/robots.txt.ts` à partir de `buildRobotsTxt` (`src/lib/crawlers.ts`, testé) : `User-agent: *`, `Allow: /`, puis `Sitemap:` en URL absolue (`site` + `/sitemap-index.xml`). **Aucun `Disallow`** : les pages `noindex` (404, `/merci/`, `/styleguide/`) doivent rester explorables pour que Google lise la directive ; rien d'autre à masquer sur un site statique. En-tête `Content-Type: text/plain; charset=utf-8` dans `vercel.json` ; la règle finale de normalisation du slash ne s'applique pas (dernier segment avec un point). E2e : `tests/e2e/crawlers.spec.ts`. Décision sur le blocage des robots d'IA (`GPTBot`, `Google-Extended`…) : **en attente de l'humain** (ADR-0011).
- **llms.txt** ([llmstxt.org](https://llmstxt.org)) : endpoint `src/pages/llms.txt.ts`, assemblé par `buildLlmsModel` (`src/lib/pages/llms-model.ts`, depuis `site.ts` et les collections) et mis en forme par `buildLlmsTxt` (`src/lib/crawlers.ts`). H1 nom, citation (tagline), paragraphe factuel (fondatrice, zone, contact), sections « Pages principales » (navigation + meta descriptions), « Prestations », « Réalisations », « Conseils déco » (articles publiés seulement), `## Optional` (pages légales). URL absolues, **aucun prix**. Même en-tête `text/plain` dans `vercel.json`. E2e : chaque lien est dans le sitemap, chaque prestation / réalisation / article du sitemap est dans `llms.txt`.
- **Prévisualisations Vercel** : en-tête `X-Robots-Tag: noindex` ajouté par Vercel par défaut, **sauf** sur un domaine personnalisé assigné à une branche (voir §6).

## 5. Calendrier éditorial « Conseils déco » (proposition initiale, à affiner)

1. Pourquoi faire réaliser un plan 3D avant de rénover son intérieur
2. Aménager un studio parisien : 7 idées pour gagner de la place
3. Le terracotta en décoration : comment l'adopter sans en faire trop
4. Planche d'ambiance : à quoi ça sert et comment la lire
5. Décoratrice d'intérieur à distance : comment ça se passe concrètement
6. Couleurs pastel au salon : associations qui fonctionnent
7. Décorer une résidence secondaire sans être sur place
8. Combien coûte une décoratrice d'intérieur ? (à rédiger uniquement avec les vrais tarifs)

Chaque article : 1 200–2 000 mots, 1 lien vers une prestation, 1 vers une réalisation, 1 CTA contact, visuels 3D propres à Amandine.

## 5 bis. Maillage interne (contrôlé par `tests/e2e/seo.spec.ts`)

- Toutes les pages (sitemap + `noindex`) sont parcourues : chaque lien interne répond **200** sans redirection, porte le **slash final**, ne pointe vers **aucune ancienne URL** (`resolveRedirect`), et chaque ancre `#id` existe ; aucune page du sitemap n'est orpheline.
- Articles → 1 prestation + 1 réalisation (bloc « Pour aller plus loin ») : en place.
- Réalisations → prestation correspondante : **à compléter** via le champ `service` des fiches projet (`src/content/projets/*.md`), à renseigner avec Amandine (formule réellement utilisée ; on n'invente pas). En attendant, chaque projet lie `/prestations/` et `/contact/`.

## 6. Hors site (checklist pour l'humain)

- [ ] Google Search Console : propriété domaine, envoi du sitemap, suivi de la migration
- [ ] Google Business Profile : catégorie « Décorateur d'intérieur », services, zone desservie, photos 3D, posts mensuels, lien vers le site
- [ ] Demander des avis Google aux clients récents (lien direct)
- [ ] NAP identique sur Instagram, Facebook, Pinterest, LinkedIn, Houzz/annuaires
- [ ] Bing Webmaster Tools (import depuis GSC)
- [ ] Vercel : ne pas rattacher `amgdecorationdinterieur.com` au projet (ou désactiver « Auto-assign Custom Production Domains ») avant la bascule de la Phase 6 ; ne pas assigner de domaine personnalisé à la branche `dev` sans en-tête `X-Robots-Tag: noindex`
- [ ] Vérifier `curl -I <url de preview>` → `x-robots-tag: noindex`
