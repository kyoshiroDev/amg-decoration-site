# Stratégie SEO

> Tenue à jour par l'agent `seo`.

## 1. Positionnement

Double ancrage :

- **Local** : décoratrice d'intérieur à Paris / Île-de-France.
- **National, à distance** : décoration d'intérieur en ligne avec visualisation 3D (marché bien moins concurrentiel que « décoratrice Paris », et c'est sa vraie différence).

## 2. Plan du site et intentions

| URL (trailing slash conservé)                                       | Intention principale         | Mot-clé cible (à valider par recherche)                       |
| ------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| `/`                                                                 | Marque + offre               | décoratrice d'intérieur Paris 3D                              |
| `/prestations/`                                                     | Comparer les offres          | décoration d'intérieur en ligne / tarifs formules             |
| `/prestations/<formule>/`                                           | Détail d'une formule         | aménagement studio 3D, décoration pièce de vie, etc.          |
| `/visualisation-3d/`                                                | Comprendre la 3D, la méthode | plan 3D décoration intérieure, visualisation 3D avant travaux |
| `/realisations/`                                                    | Preuve, inspiration          | réalisations décoratrice d'intérieur                          |
| `/realisations/<projet>/`                                           | Étude de cas                 | ex. décoration chalet résidence secondaire                    |
| `/a-propos/`                                                        | Confiance (E-E-A-T)          | Amandine Gaury décoratrice                                    |
| `/conseils-deco/` + articles                                        | Longue traîne                | voir §5                                                       |
| `/contact/`                                                         | Conversion                   | contact décoratrice d'intérieur devis                         |
| `/mentions-legales/`, `/confidentialite/`, `/conditions-generales/` | Légal                        | —                                                             |

**Convention d'URL** : `trailingSlash: 'always'` (identique au WordPress actuel ⇒ moins de redirections), slugs en français sans accents.

## 3. Redirections 301 (`vercel.json`)

| Ancienne                                                | Nouvelle                   | Statut                               |
| ------------------------------------------------------- | -------------------------- | ------------------------------------ |
| `/services/`                                            | `/prestations/`            | dans `vercel.json`, cible en Phase 4 |
| `/about/`                                               | `/realisations/`           | dans `vercel.json`, cible en Phase 4 |
| `/a-propos/`                                            | `/a-propos/`               | identique                            |
| `/contact/`                                             | `/contact/`                | identique                            |
| Pages projets WordPress                                 | `/realisations/<slug>/`    | **à relever (phase 3)**              |
| Pages légales WordPress                                 | nouvelles URLs légales     | **à relever (phase 3)**              |
| `/feed/`, `/wp-*`, `/category/*`, `/tag/*`, `/author/*` | `/` ou page la plus proche | à décider selon l'indexation réelle  |

Avant mise en production : exporter les URLs indexées depuis la Search Console (ou `site:amgdecorationdinterieur.com`) et vérifier que **100 %** ont une destination 200 ou 301.

## 4. Données structurées

### Principe (implémenté en Phase 2)

- **Un seul `<script type="application/ld+json">` par page**, rendu par `src/components/seo/JsonLd.astro`, contenant un `@graph`. Jamais de JSON-LD écrit à la main dans une page : tout est généré par `src/lib/jsonld.ts` (types `schema-dts`, testé dans `tests/unit/jsonld.test.ts`). La sérialisation échappe `<` (`\u003c`).
- **Entités globales reliées par `@id`** (émises par `BaseLayout` sur toutes les pages) :

| `@id`                                             | Type                  | Propriétés clés                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://amgdecorationdinterieur.com/#site`       | `WebSite`             | `name`, `alternateName` (« AMG Décoration », nom de site Google), `url`, `inLanguage: fr-FR`, `publisher` → `#entreprise`                                                                                                  |
| `https://amgdecorationdinterieur.com/#entreprise` | `ProfessionalService` | `name`, `alternateName`, `slogan`, `url`, `telephone` (E.164), `email` (affiché dans le pied de page), `address` (région + pays seulement), `areaServed`, `openingHoursSpecification`, `founder` → `#fondatrice`, `sameAs` |
| `https://amgdecorationdinterieur.com/#fondatrice` | `Person`              | `name`, `jobTitle`, `worksFor` → `#entreprise`                                                                                                                                                                             |

- Les nœuds propres à une page (`BreadcrumbList`, `Service`, `CreativeWork`, `BlogPosting`) s'ajoutent au même graphe via la prop `jsonLd` des layouts et référencent les entités globales par `@id` (`provider`, `creator`, `author`, `publisher`).
- Toutes les données viennent de `src/config/site.ts` (NAP identique partout).

### Choix assumés

- **Pas d'adresse précise** : ni `streetAddress`, ni `postalCode`, ni `geo` tant que l'adresse n'est pas fournie (`TODO(contenu)` dans `site.ts`). Google n'exige que `name` et `address` (« autant de propriétés que possible ») : un `PostalAddress` région + pays reste valide. Pour une entreprise de zone desservie, la visibilité locale repose surtout sur la fiche Google Business Profile.
- **`areaServed`** : sous-types de `Place` (`City` Paris, `AdministrativeArea` Île-de-France, `Country` France). À compléter avec la Suisse si Amandine confirme qu'elle y accepte des projets (un projet y est cité).
- **Pas de `priceRange`** ni d'`Offer` tant que les tarifs ne sont pas validés (on n'invente rien).
- **`logo` / `image`** : non émis pour l'instant. `buildBusiness(config, origin, { logoUrl, imageUrls })` les publiera dès que le logo (≥ 112 × 112 px, lisible sur fond blanc) et de vrais rendus 3D seront fournis. L'image OG provisoire n'est pas réutilisée : ce n'est pas un visuel de la marque.
- **Pas d'`AggregateRating` ni de `review`** auto-attribués (non éligibles, contraires aux consignes). Les avis Google seront affichés comme contenu avec lien vers la fiche.
- `ProfessionalService` : schema.org signale ce type comme « déprécié » au sens de catégorie générique, mais il reste valide et reconnu par Google comme sous-type de `LocalBusiness` ; aucun type plus précis n'existe pour un décorateur d'intérieur.

### Par type de page (à venir)

- Prestations : `Service` (+ `provider`). Pas d'`Offer` avec prix tant que les tarifs ne sont pas validés.
- Réalisations : `CreativeWork` + `ImageObject`.
- Articles : `BlogPosting` (auteur `Person`, dates, image).
- Toutes pages internes : `BreadcrumbList` (ajoutée automatiquement par `PageLayout`).
- FAQ éventuelle : `FAQPage` pour la sémantique uniquement (plus de résultat enrichi pour ce type de site).

Validation : Rich Results Test + validator.schema.org avant chaque livraison de phase SEO.

## 4 bis. Balises `<head>` (règles appliquées au build)

Composant `src/components/seo/SEO.astro`, valeurs par défaut dans `src/config/seo.ts`, règles pures dans `src/lib/seo.ts` (testées). **Toute violation fait échouer `astro build`.**

- **Titre** : 60 caractères maximum (comptés en NFC). Format « Titre | AMG Décoration » si l'ensemble tient dans 60 caractères, sinon le titre seul ; un titre seul de plus de 60 caractères lève une erreur. Mot-clé en tête.
- **Description** : 140 à 160 caractères, sinon erreur.
- **Canonical** : URL absolue avec slash final, sans query ni ancre ; **absente sur les pages `noindex`** (ainsi que `og:url`).
- **Robots** : `index, follow` par défaut ; `noindex, nofollow` pour la 404 et le styleguide.
- **Open Graph / Twitter** : `og:type`, `og:site_name`, `og:locale` (`fr_FR`), `og:title`, `og:description`, `og:url`, `og:image` (JPEG 1200 × 630 généré par `getImage`, URL absolue) + `og:image:type`, `:width`, `:height`, `:alt` ; `twitter:card` `summary_large_image` + titre, description, image, alt.
- Ordre du `<head>` : `charset` en premier, puis viewport ; `lang="fr"` sur `<html>` ; pas de `hreflang` (site monolingue).
- **Sitemap** : `@astrojs/sitemap` ; la 404 est exclue d'office, `/styleguide/` par le `filter` d'`astro.config.mjs` (toute future page `noindex` — ex. `merci` — doit y être ajoutée). `<link rel="sitemap">` dans le `<head>`.
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

## 6. Hors site (checklist pour l'humain)

- [ ] Google Search Console : propriété domaine, envoi du sitemap, suivi de la migration
- [ ] Google Business Profile : catégorie « Décorateur d'intérieur », services, zone desservie, photos 3D, posts mensuels, lien vers le site
- [ ] Demander des avis Google aux clients récents (lien direct)
- [ ] NAP identique sur Instagram, Facebook, Pinterest, LinkedIn, Houzz/annuaires
- [ ] Bing Webmaster Tools (import depuis GSC)
- [ ] Vercel : ne pas rattacher `amgdecorationdinterieur.com` au projet (ou désactiver « Auto-assign Custom Production Domains ») avant la bascule de la Phase 6 ; ne pas assigner de domaine personnalisé à la branche `dev` sans en-tête `X-Robots-Tag: noindex`
- [ ] Vérifier `curl -I <url de preview>` → `x-robots-tag: noindex`
