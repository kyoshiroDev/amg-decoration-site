# Stratégie SEO

> Tenue à jour par l'agent `seo`.

## 1. Positionnement
Double ancrage :
- **Local** : décoratrice d'intérieur à Paris / Île-de-France.
- **National, à distance** : décoration d'intérieur en ligne avec visualisation 3D (marché bien moins concurrentiel que « décoratrice Paris », et c'est sa vraie différence).

## 2. Plan du site et intentions

| URL (trailing slash conservé) | Intention principale | Mot-clé cible (à valider par recherche) |
|---|---|---|
| `/` | Marque + offre | décoratrice d'intérieur Paris 3D |
| `/prestations/` | Comparer les offres | décoration d'intérieur en ligne / tarifs formules |
| `/prestations/<formule>/` | Détail d'une formule | aménagement studio 3D, décoration pièce de vie, etc. |
| `/visualisation-3d/` | Comprendre la 3D, la méthode | plan 3D décoration intérieure, visualisation 3D avant travaux |
| `/realisations/` | Preuve, inspiration | réalisations décoratrice d'intérieur |
| `/realisations/<projet>/` | Étude de cas | ex. décoration chalet résidence secondaire |
| `/a-propos/` | Confiance (E-E-A-T) | Amandine Gaury décoratrice |
| `/conseils-deco/` + articles | Longue traîne | voir §5 |
| `/contact/` | Conversion | contact décoratrice d'intérieur devis |
| `/mentions-legales/`, `/confidentialite/`, `/conditions-generales/` | Légal | — |

**Convention d'URL** : `trailingSlash: 'always'` (identique au WordPress actuel ⇒ moins de redirections), slugs en français sans accents.

## 3. Redirections 301 (`vercel.json`)

| Ancienne | Nouvelle | Statut |
|---|---|---|
| `/services/` | `/prestations/` | à créer |
| `/about/` | `/realisations/` | à créer |
| `/a-propos/` | `/a-propos/` | identique |
| `/contact/` | `/contact/` | identique |
| Pages projets WordPress | `/realisations/<slug>/` | **à relever (phase 3)** |
| Pages légales WordPress | nouvelles URLs légales | **à relever (phase 3)** |
| `/feed/`, `/wp-*`, `/category/*`, `/tag/*`, `/author/*` | `/` ou page la plus proche | à décider selon l'indexation réelle |

Avant mise en production : exporter les URLs indexées depuis la Search Console (ou `site:amgdecorationdinterieur.com`) et vérifier que **100 %** ont une destination 200 ou 301.

## 4. Données structurées
- Global (BaseLayout) : `WebSite`, `ProfessionalService` (NAP, horaires `openingHoursSpecification`, `areaServed`, `sameAs`, `founder` → `Person` Amandine Gaury).
- Prestations : `Service` (+ `provider`). Pas d'`Offer` avec prix tant que les tarifs ne sont pas validés.
- Réalisations : `CreativeWork` + `ImageObject`.
- Articles : `BlogPosting` (auteur `Person`, dates, image).
- Toutes pages internes : `BreadcrumbList`.
- Pas d'`AggregateRating` auto-attribué.
Validation : Rich Results Test + validator.schema.org avant chaque livraison de phase SEO.

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
