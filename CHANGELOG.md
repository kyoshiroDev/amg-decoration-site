# Changelog

Toutes les évolutions notables du site, par phase. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

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
