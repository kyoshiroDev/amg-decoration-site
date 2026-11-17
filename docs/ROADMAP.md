# Roadmap

> Une phase = un cycle complet (CLAUDE.md §8) = un push sur `dev` + PR `dev → main` mise à jour.
> Cocher au fur et à mesure. Ne jamais cocher une tâche non vérifiée.

## Phase 0 — Initialisation

- [x] Amorçage (seule exception autorisée par le hook) : `git init -b main`, commit initial du kit `chore: kit de cadrage initial`, création du dépôt GitHub **public** `kyoshiroDev/amg-decoration-site` (le nom `amg-decoration` étant déjà pris, voir ADR-0004), `git push -u origin main`, puis `git switch -c dev`. Tout le reste se fait sur `dev`.
- [x] Vérifier la dernière version d'Astro (`npm view astro version`) et scaffolder Astro **dans le dossier courant** sans écraser `CLAUDE.md`, `docs/`, `.claude/`, `.github/` (template minimal, TypeScript strictest)
- [x] Intégrations : `@astrojs/sitemap`, `@astrojs/mdx` ; configurer `site`, `trailingSlash: 'always'`, `prefetch`
- [x] Outillage : ESLint (flat, astro, jsx-a11y-x, typescript-eslint — ADR-0004), Prettier (+ plugin astro), Stylelint (standard), Vitest, Playwright + axe, `@lhci/cli`
- [x] Scripts npm de `CLAUDE.md` §10, dont `verify`
- [x] Alias `@/*`, `.nvmrc`, `.editorconfig`, `.gitignore` complétés
- [x] `vercel.json` initial (en-têtes, cache, redirections connues)
- [x] CI GitHub Actions verte en local (`npm run verify`)
- [ ] Revue + push `dev` + première PR `dev → main`

## Phase 1 — Design system

- [ ] `tokens.css`, `reset.css`, `global.css` (layers), grain de papier
- [ ] Polices via la Fonts API (Fraunces + Manrope)
- [ ] Composants `ui/` : Button, Link, Heading, Eyebrow, Tag, Icon, Container, Section, ArchImage, Divider
- [ ] Page `/styleguide/` (noindex) montrant tokens et composants
- [ ] Captures 375/1440 vérifiées par `designer` ; audit `accessibilite` (contrastes, focus)

## Phase 2 — Squelette et navigation

- [ ] `src/config/site.ts` (NAP, horaires, réseaux, navigation) et `seo.ts`
- [ ] `lib/seo.ts`, `lib/jsonld.ts` + tests unitaires
- [ ] `BaseLayout` (SEO, JSON-LD global, View Transitions, skip link), `PageLayout`
- [ ] Header (compactage au scroll), MobileNav accessible, Footer (NAP, réseaux, liens légaux), Breadcrumbs
- [ ] Page 404
- [ ] Tests e2e : navigation, menu mobile, axe

## Phase 3 — Contenu

- [ ] Re-crawl complet du site actuel → compléter `CONTENU-EXISTANT.md` + liste exhaustive des URLs
- [ ] `content.config.ts` (projets, prestations, articles, témoignages, faq)
- [ ] Migration et réécriture des contenus (`redacteur`) ; `TODO(contenu)` pour les manques
- [ ] Placeholders d'images documentés

## Phase 4 — Pages

- [ ] Accueil (héro arche, promesse 3D, prestations, réalisations à la une, avant/après, méthode, bénéfices, avis, CTA)
- [ ] Prestations (liste + détail par formule)
- [ ] Visualisation 3D / Ma méthode
- [ ] Réalisations (grille filtrable + page projet avec galerie, avant/après, lightbox)
- [ ] À propos
- [ ] Conseils déco (liste + gabarit article + 2 premiers articles rédigés)
- [ ] Contact (formulaire selon ADR-0003, téléphone, WhatsApp, horaires, zone)
- [ ] Pages légales (`conformite`)

## Phase 5 — Effets et interactions

- [ ] Reveal au scroll, image reveal, hover zoom
- [ ] BeforeAfter accessible (clavier, tactile, `aria-valuetext`)
- [ ] View Transitions grille → projet
- [ ] Marquee, soulignés animés, CTA magnétique léger
- [ ] Tout vérifié en `prefers-reduced-motion` et sans JS

## Phase 6 — SEO avancé

- [ ] JSON-LD complet par type de page, validé
- [ ] Images OG (1200×630) par page/projet/article (générées au build ou statiques)
- [ ] Redirections 301 exhaustives + tests
- [ ] Sitemap, robots.txt, maillage interne audité, `llms.txt`
- [ ] Audit `seo` complet sur `dist/`

## Phase 7 — Qualité finale

- [ ] Audit `performance` : budgets atteints (chiffres dans la PR)
- [ ] Audit `accessibilite` complet : 0 violation, parcours clavier OK
- [ ] Régression visuelle de référence
- [ ] Vérification des liens, console propre, en-têtes de sécurité
- [ ] `/audit` global : 0 point P1

## Phase 8 — Préparation à la mise en ligne

- [ ] Checklist de mise en production dans la PR (domaine sur Vercel, DNS, HTTPS, Search Console, GBP)
- [ ] Liste consolidée des `TODO(contenu)` et infos à fournir par Amandine
- [ ] Synthèse finale (scores, captures)
