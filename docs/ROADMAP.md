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
- [x] Revue + push `dev` + première PR `dev → main` (PR #1)

## Phase 1 — Design system

- [x] `tokens.css`, `reset.css`, `global.css` (layers), grain de papier
- [x] Polices via la Fonts API (Fraunces 300/400 fixes + Manrope variable, ADR-0005)
- [x] Composants `ui/` : Button, Link, Heading, Eyebrow, Tag, Icon, Container, Section, ArchImage, Divider
- [x] Page `/styleguide/` (noindex) montrant tokens et composants
- [x] Captures 375/1440 vérifiées par `designer` ; audit `accessibilite` (contrastes, focus)
- [x] Revue + push `dev` + PR mise à jour (PR #1)

## Phase 2 — Squelette et navigation

- [x] `src/config/site.ts` (NAP, horaires, réseaux, navigation) et `seo.ts`
- [x] `lib/seo.ts`, `lib/jsonld.ts` + tests unitaires
- [x] `BaseLayout` (SEO, JSON-LD global, View Transitions, skip link), `PageLayout`
- [x] Header (compactage au scroll), MobileNav accessible, Footer (NAP, réseaux, liens légaux), Breadcrumbs
- [x] Page 404
- [x] Tests e2e : navigation, menu mobile, axe
- [x] ADR-0006 : View Transitions natives (`@view-transition`), sans `<ClientRouter />` (compatibilité CSP, 0 Ko de JS)
- [x] Reports de la Phase 1 : convention d'espaces insécables (« : », « ; », « ? », « ! », « € »), erreur au build si un token du styleguide est manquant, contraste comparé sans arrondi, `--z-grain` dédié, assertion `warn` de perf/LCP sur `/styleguide/`, sémantique des listes sans puces (Safari/VoiceOver), découpage de `Button.astro` et `ContrastTable.astro` sous ~150 lignes
- [x] Reports a11y de la Phase 1 : nom accessible obligatoire pour un `Button` icône seule, zone de clic de 44 px sur les liens de navigation, icône visuelle « externe », liseré du bouton ghost
- [x] Revue + push `dev` + PR mise à jour (PR #1, CI verte)

## Phase 3 — Contenu

- [x] Re-crawl complet du site actuel → compléter `CONTENU-EXISTANT.md` + liste exhaustive des URLs
- [x] `content.config.ts` (projets, prestations, articles, témoignages, faq)
- [x] Migration et réécriture des contenus (`redacteur`) ; `TODO(contenu)` pour les manques
- [x] Migrer les textes provisoires de `src/config/pages.ts` vers les collections de contenu
- [x] Placeholders d'images documentés
- [x] Reports de la Phase 2 : commentaire de `serializeJsonLd`, tests `isActivePath` dans `url.test.ts`, test de `buildCreativeWork`, sélecteurs robustes du menu mobile (`data-*` au lieu de l'id et de `popovertarget`), poids du grain harmonisé
- [x] Revue + push `dev` + PR mise à jour (PR #1, CI verte)

## Phase 4 — Pages

- [x] Accueil (héro arche, promesse 3D, prestations, réalisations à la une, avant/après, méthode, bénéfices, avis, CTA)
- [x] Prestations (liste + détail par formule)
- [x] Visualisation 3D / Ma méthode
- [x] Réalisations (grille filtrable + page projet avec galerie, avant/après, lightbox)
- [x] À propos
- [x] Conseils déco (liste + gabarit article + 2 premiers articles rédigés)
- [x] Contact (formulaire selon ADR-0003, téléphone, WhatsApp, horaires, zone)
- [x] Pages légales (`conformite`)
- [x] e2e + axe de `PageLayout`/`Breadcrumbs` sur la première page interne (report de la Phase 2)
- [x] Test : chaque destination de redirection (`SITE_ROUTES`, `src/lib/redirects.ts`) répond 200 dans `dist/`
- [x] Brouillons exclus partout (`filterPublished` sur les routes dynamiques et le sitemap) ; aucun `TODO` dans `dist/`
- [x] Lecture du contenu par les pages via des helpers de `src/lib/` (pages = assemblage, `CLAUDE.md` §3)
- [x] Revue + push `dev` + PR mise à jour (PR #1, CI verte sur 25 pages)

## Phase 5 — Effets et interactions

- [x] Reveal au scroll, image reveal, hover zoom
- [x] BeforeAfter accessible (clavier, tactile, `aria-valuetext`)
- [x] View Transitions grille → projet
- [x] Marquee, soulignés animés, CTA magnétique léger
- [x] Tout vérifié en `prefers-reduced-motion` et sans JS
- [x] Masquage sans JS des filtres en CSS valide (`@media (scripting: none)` ou classe `no-js`) au lieu de `<noscript><style>` dans le `body`
- [x] Marquee animé : bouton pause accessible au clavier (WCAG 2.2.2), arrêt en mouvement réduit
- [x] Lightbox de la galerie projet (clavier, focus piégé, Échap, sans JS = images visibles)
- [x] Revue + push `dev` + PR mise à jour

## Phase 6 — SEO avancé

- [x] JSON-LD complet par type de page, validé
- [x] Images OG (1200×630) par page/projet/article (générées au build ou statiques)
- [x] Redirections 301 exhaustives + tests
- [x] Sitemap, robots.txt, maillage interne audité, `llms.txt`
- [x] Audit `seo` complet sur `dist/`
- [x] Contenu dupliqué entre l'accueil et `/visualisation-3d/` (6 étapes, 8 avantages affichés mot pour mot) : extrait sur l'accueil + lien, ou textes courts dédiés
- [x] h1 des fiches formules orientés mot-clé (champ de titre de héros distinct du nom de la formule, décision `architecte`)
- [x] Balises `article:published_time` / `article:modified_time` sur les articles
- [x] Test du honeypot en mode service (build de test avec `PUBLIC_FORM_ENDPOINT`)
- [ ] Revue + push `dev` + PR mise à jour

## Phase 7 — Qualité finale

- [x] Audit `performance` : budgets atteints (chiffres dans la PR)
- [x] Audit `accessibilite` complet : 0 violation, parcours clavier OK
- [x] Régression visuelle de référence (`npm run test:visual`, hors CI)
- [x] Vérification des liens, console propre, en-têtes de sécurité
- [x] `/audit` global : 0 point P1 dans le code (`.claude/reports/audit-2026-11-19.md`) ; P1 de contenu reportés en Phase 8
- [x] Coût des apparitions au défilement (audit perf Phase 5 : 386 recalculs de style sur l'accueil) : animations pilotées par le scroll en CSS (`animation-timeline: view()`) ou animer les listes plutôt que chaque élément ; décision `designer` (ADR si changement de rendu)
- [x] HTML de l'accueil sous 14 Ko gzip (fenêtre TCP initiale) : sprite SVG `<use>` pour les icônes, contrôle en CI
- [ ] `view-transition-name` posé seulement sur la carte cliquée si le nombre de projets grandit (sans objet à 4 projets ; reporté après la mise en ligne)
- [x] Accessibilité (P3) : visionneuse annonçant « Image n sur N : légende », pause du bandeau au focus, visibilité du trait du comparateur
- [x] Accessibilité (P3, Phase 6) : ancre `#avantages-titre` dont le surtitre passe sous le header collant (`scroll-margin`), nature de la carte « Pour aller plus loin » lue après son titre, nom de la formule dans la navigation par titres des fiches (à arbitrer avec le SEO), fond des cartes « Pour aller plus loin » sur section crème (`designer`)

## Phase 8 — Préparation à la mise en ligne

- [x] Checklist de mise en production (domaine sur Vercel, DNS, HTTPS, Search Console, GBP) : `docs/MISE-EN-LIGNE.md`, reprise dans la PR
- [x] Liste consolidée des `TODO(contenu)` et infos à fournir par Amandine (`docs/MISE-EN-LIGNE.md` §1)
- [x] Synthèse finale (scores, budgets) dans la PR
- [x] Garde-fou : build de production Vercel en échec tant qu'un `TODO(contenu)` reste dans les pages légales, `npm run check:prod` (ADR-0015)
- [x] Confidentialité selon le mode réel du formulaire (repli `mailto:` ou service), blocs conditionnels du gabarit Markdown (ADR-0016)
- [x] Pages légales : email, téléphone et SIRET injectés depuis `src/config/site.ts` (jetons)
- [x] Comparateur « Rendu 3D ↔ Réalisé » sur `/visualisation-3d/` (paire configurable, placeholders signalés), dévoilement en `transform`
- [x] Section « Paris et à distance partout en France » sur `/contact/`
- [x] Redirection `www` → domaine nu en un seul saut ; nœud `Service` sur `/visualisation-3d/`
- [x] Descriptions avec appel à l'action, plus de recouvrement « plan 3D » ; passe axe sur les colonnes défilantes

## Après les contenus d'Amandine (hors roadmap de construction)

Ces points attendent une information ou un visuel d'Amandine, ou une décision humaine (`docs/MISE-EN-LIGNE.md`) :

- [ ] Lever les `TODO(contenu)` bloquants des pages légales (`npm run check:prod` vert) : adresse, EI, médiateur, validation de l'article 4 des CGS, prix (`showPrices`, title de `/prestations/`), accord des clients pour les photos, conservation et prospection
- [ ] Visuels réels (originaux HD des réalisations — les images de l'ancien site, en 1200 × 600, sont en place depuis le 2026-11-20 —, paire du comparateur, héros, couvertures, OG, portrait, logo) ; puis logo et localité dans le JSON-LD, formule réelle de chaque réalisation (champ `service`), régénération de la régression visuelle (Git LFS ou références locales)
- [ ] 150 à 300 mots propres par fiche prestation (`redacteur`) et `serviceType` par fiche, à partir des informations d'Amandine
- [ ] Décision sur les robots d'IA (ADR-0011)
- [ ] Améliorations non bloquantes de l'audit global : allègement de l'accueil (`content-visibility`, moins de `:has()`, styles inline vers le CSS partagé ; marge HTML de ~0,9 Ko), section accueil vers les offres Meuble / Pros ou les derniers articles, comparateur et section « Paris et à distance » sur l'accueil (reportés : marge HTML de l'accueil insuffisante, à faire après l'allègement), héros intérieurs et gabarits texte (figure, citation), `view-transition-name` sur la seule carte cliquée si le nombre de projets grandit, finitions P3 design et SEO, nom de la formule dans la navigation par titres des fiches
