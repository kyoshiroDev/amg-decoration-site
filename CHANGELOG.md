# Changelog

Toutes les évolutions notables du site, par phase. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### Phase 2 — Squelette et navigation

- Source de vérité `src/config/site.ts` (NAP, horaires, zone, réseaux, navigation), microcopie d'interface (`config/microcopy.ts`) et textes provisoires des pages (`config/pages.ts`, à migrer en Phase 3).
- SEO au build : `lib/seo.ts` (titre ≤ 60, description 140–160, canonical), `SEO.astro` (Open Graph, Twitter, image OG 1200 × 630 générée), JSON-LD unique par page (`lib/jsonld.ts`, types `schema-dts`) : `WebSite`, `ProfessionalService`, `Person` reliés par `@id`, `BreadcrumbList` ; squelettes `Service`, `CreativeWork`, `BlogPosting`.
- `BaseLayout` et `PageLayout` ; lien d'évitement, header collant qui se compacte sans décalage de mise en page, menu mobile en Popover API (fonctionne sans JS), footer complet, fil d'Ariane.
- View Transitions natives en CSS, sans `ClientRouter` (ADR-0006).
- Page 404 (noindex) ; accueil provisoire et styleguide migrés sur `BaseLayout`.
- Reports de la Phase 1 : convention typographique française (espaces insécables), contrastes comparés sans arrondi, token manquant = build en échec, `--z-grain`, `Button` icône seule avec nom accessible obligatoire, zone de clic de 44 px sur la navigation, icône « externe », liseré du bouton ghost à ≥ 3:1, listes sans puces qui gardent leur sémantique (`list-style-type: ''`), composants découpés sous 150 lignes.
- Lighthouse CI : 404 et styleguide exclus des assertions SEO (noindex) ; en-tête `X-Robots-Tag: noindex` sur les domaines `*.vercel.app`.
- Performance : grain de papier en tuile WebP pré-rendue (2,1 Ko) au lieu d'un SVG `feTurbulence` rasterisé à chaque rendu.

### Phase 1 — Design system

- Tokens « Atelier lumineux » (`src/styles/tokens.css`) : palette pastel et terracotta avec rôles sémantiques, échelle typographique fluide, espacements Utopia, rayons dont l'arche, ombres chaudes, motion, anneau de focus.
- Couches CSS `reset, base, components, utilities`, grain de papier statique (`body::after`), mouvement réduit respecté partout.
- Polices auto-hébergées via la Fonts API : Fraunces 300/400 (normal + italique) et Manrope variable ; préchargement de Fraunces 300 uniquement (environ 84 Ko de polices par page).
- Composants `ui/` : Button, Link, Heading, Eyebrow, Tag, Icon, Container, Section, ArchImage, Divider.
- Page interne `/styleguide/` (noindex, hors sitemap), alimentée directement par `tokens.css` via `src/lib/design-tokens.ts` et `src/lib/color-contrast.ts` (testés).
- Favicon provisoire (arche terracotta) et premier placeholder d'image documenté.
- Audit WCAG 2.2 AA : 0 violation axe ; `Button disabled` rend toujours un `<button>` ; `Link` exige une variante explicite (`draw` ou `inline`).
- Lighthouse CI : budgets complets sur les pages publiques, accessibilité seule sur `/styleguide/`.
- ADR-0005 : arbitrages du design system (Fraunces en graisses fixes, réglages Stylelint, dossier `components/styleguide/`, favicon).

### Phase 0 — Initialisation

- Dépôt GitHub public `kyoshiroDev/amg-decoration-site`, branches `main` (production) et `dev` (intégration).
- Astro 7.4.12 en rendu 100 % statique, `trailingSlash: 'always'`, prefetch au survol, intégrations `@astrojs/sitemap` et `@astrojs/mdx`.
- TypeScript 6 en preset `strictest`, alias `@/…`.
- Outillage qualité : ESLint 10 (TypeScript strict, Astro, `jsx-a11y-x`), Prettier, Stylelint (hexadécimal interdit hors `tokens.css`), Vitest, Playwright + axe-core (mobile et desktop), Lighthouse CI avec les budgets de `CLAUDE.md` §6.
- Script `npm run verify` (types + lint + tests + build).
- Premier utilitaire pur testé : `src/lib/url.ts` (slash final, URL canonique absolue).
- Page d'accueil provisoire en français (Lighthouse : 100 / 100 / 100 / 100).
- En-têtes Vercel : HSTS et `Cross-Origin-Opener-Policy` ajoutés ; la CSP est reportée à la Phase 7 (ADR-0004).
- ADR-0004 : versions de l'outillage (Node 24, TypeScript 6, `jsx-a11y-x`) et nom du dépôt.

### Kit de cadrage

- Kit de cadrage : `CLAUDE.md`, 9 agents spécialisés, commandes `/demarrer`, `/phase`, `/revue`, `/livrer`, `/audit`, hooks Git, documentation (`docs/`), CI GitHub Actions, configuration Vercel initiale.
