# Architecture

> Tenue à jour par l'agent `architecte`. L'arborescence de référence et les règles sont dans `CLAUDE.md` §3 ; ce document détaille le **pourquoi** et les flux.

## Principes

1. **Statique d'abord** : tout est pré-rendu au build. Zéro serveur, zéro base de données.
2. **Contenu séparé du code** : les textes vivent dans `src/content/` (Markdown/YAML validés par Zod) ; les infos de l'entreprise dans `src/config/site.ts`.
3. **Couches** : `pages` (routes) → `layouts` (squelette + SEO) → `blocks` (sections) → `ui` (atomes). `lib/` est transverse et pur.
4. **Progressive enhancement** : le HTML/CSS fonctionne seul ; le JS (`src/scripts/`) n'ajoute que de l'agrément.

## Styleguide interne

`/styleguide/` (noindex, exclue du sitemap) est la référence visuelle du `designer` et du `reviewer`. Ses sections vivent dans `src/components/styleguide/` et ne sont jamais importées par une page publique. Elles lisent `src/styles/tokens.css` au build (`?raw`) via `src/lib/design-tokens.ts` et `src/lib/color-contrast.ts` : aucune valeur n'est recopiée (ADR-0005).

## Flux de données

```
src/config/site.ts ──────┐
src/config/microcopy.ts ─┤
src/config/pages.ts ─────┼──> layouts/BaseLayout.astro ──> components/seo/SEO.astro + JsonLd.astro
src/lib/jsonld.ts ───────┘                │            └─> components/layout/* (SkipLink, Header, Footer)
                                      ▼
src/content/** ──(getCollection)──> pages/*.astro ──> components/blocks/* ──> components/ui/*
       ▲
src/content.config.ts (schémas Zod 4)
```

### Configuration (`src/config/`)

| Fichier        | Contenu                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `site.ts`      | Source de vérité unique : nom, NAP, horaires, zone, réseaux, `mainNav`, `headerCta`, `legalNav`.                               |
| `microcopy.ts` | Tous les libellés d'interface : lien d'évitement, `aria-label` des navigations, menu mobile, titres et textes du pied de page. |
| `pages.ts`     | Textes des pages techniques et provisoires (accueil temporaire, 404, styleguide), en attendant les collections (Phase 3).      |
| `seo.ts`       | Valeurs SEO par défaut et image OG (réservé aux composants : importe une image).                                               |

Aucun composant n'écrit de texte en dur : il lit l'un de ces modules ou reçoit le texte en prop.

### JSON-LD : un graphe relié par `@id`

`BaseLayout` émet **un seul** `<script type="application/ld+json">` contenant un `@graph` (`buildGraph`) : `WebSite`, `ProfessionalService` (l'entreprise) et `Person` (la fondatrice), plus les nœuds propres à la page passés en prop `jsonLd` (ex. `BreadcrumbList` ajouté par `PageLayout`). Les entités globales ont un identifiant stable `https://domaine/#site|#entreprise|#fondatrice` (`entityId`) et se référencent par `{ "@id": … }` au lieu d'être dupliquées.

## Collections de contenu (cible)

| Collection    | Loader                                 | Champs clés                                                                                                                                                                                         |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projets`     | `glob('src/content/projets/*.md')`     | title, slug, summary, location, roomTypes (enum), style, cover (`image()`), gallery[{image, alt, kind: `'avant' \| '3d' \| 'apres'`}], beforeAfter?, featured, publishedAt, seo{title, description} |
| `prestations` | `glob`                                 | title, formula (enum Essentiel/Confort/Signature/Studio), target, includes[], deliverables[], price? (optionnel, masqué si absent), order                                                           |
| `articles`    | `glob('**/*.mdx')`                     | title, description, publishedAt, updatedAt?, cover, tags[], relatedService, relatedProject, draft                                                                                                   |
| `temoignages` | `file('src/content/temoignages.yaml')` | author, text, source ('google'), projectType?, url?                                                                                                                                                 |
| `faq`         | `file('src/content/faq.yaml')`         | question, answer, page                                                                                                                                                                              |

## Scripts client

JavaScript vanilla, chargé par un `<script>` Astro dans le composant qui en a besoin (Astro le regroupe en module, dédupliqué, différé). Tout est **amélioration progressive** : le HTML et le CSS fonctionnent seuls.

- **Cycle de vie** : `src/scripts/lifecycle.ts` exporte `onPageReady(init: (signal: AbortSignal) => void)`. `init` est appelée tout de suite, puis à chaque `astro:page-load` ; le contrôleur précédent est coupé (`abort()`) avant chaque relance et sur `astro:before-swap`. Chaque script passe le `signal` à `addEventListener(…, { signal })` et déconnecte ses observers sur `abort` : aucune fuite, aucun double écouteur.
- **View Transitions natives** (ADR-0006) : pas de `<ClientRouter />`, donc chaque navigation recharge le document et les scripts ne s'exécutent qu'une fois par page ; les écouteurs `astro:*` gardent le code prêt pour un éventuel retour du routeur client. Les transitions sont purement CSS (`@view-transition` dans `global.css`).
- **Popover API** pour le menu mobile : ouverture, fermeture, Échap, clic extérieur, `aria-expanded` et retour du focus sont natifs ; le script ne fait qu'ajouter du confort (focus initial, fermeture au `focusout` et au clic sur un lien). Repli sans support : lien vers le plan du site du pied de page.
- Scripts actuels : `header.ts` (IntersectionObserver sur un repère à 80 px → `data-compact`), `mobile-nav.ts`. Poids mesuré : ≈ 0,9 Ko gzip à eux deux (+ ≈ 1,1 Ko pour le prefetch d'Astro), budget 30 Ko.
- Interdits : `console.*`, écouteur `scroll` (préférer IntersectionObserver), état d'animation présent dans le HTML initial (il est posé par le script).

## Configuration

- `astro.config.mjs` : `site: 'https://amgdecorationdinterieur.com'`, `trailingSlash: 'always'`, `output: 'static'`, intégrations `sitemap` (+ `mdx`), `prefetch`, Fonts API, `image` (formats/qualités).
- `vercel.json` : redirections 301, en-têtes de sécurité (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), cache immuable `/_astro/*`.
- `tsconfig.json` : `astro/tsconfigs/strictest` + alias `@/*`.

## Déploiement

GitHub → Vercel : chaque push sur `dev` = preview ; merge dans `main` (humain) = production. La CI GitHub Actions (`.github/workflows/ci.yml`) doit être verte avant tout merge.
