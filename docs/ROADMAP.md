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

- [x] Lever les `TODO(contenu)` bloquants des pages légales (`npm run check:prod` vert, 2026-11-23)
- [ ] Visuels réels (originaux HD des réalisations — les images de l'ancien site, en 1200 × 600, sont en place depuis le 2026-11-20 —, paire du comparateur, héros, couvertures, OG, portrait, logo) ; puis logo et localité dans le JSON-LD, formule réelle de chaque réalisation (champ `service`), régénération de la régression visuelle (Git LFS ou références locales)
- [ ] 150 à 300 mots propres par fiche prestation (`redacteur`) et `serviceType` par fiche, à partir des informations d'Amandine
- [ ] Décision sur les robots d'IA (ADR-0011)
- [ ] Améliorations non bloquantes de l'audit global : allègement de l'accueil (`content-visibility`, moins de `:has()`, styles inline vers le CSS partagé ; marge HTML de ~0,9 Ko), section accueil vers les offres Meuble / Pros ou les derniers articles, comparateur et section « Paris et à distance » sur l'accueil (reportés : marge HTML de l'accueil insuffisante, à faire après l'allègement), héros intérieurs et gabarits texte (figure, citation), `view-transition-name` sur la seule carte cliquée si le nombre de projets grandit, finitions P3 design et SEO, nom de la formule dans la navigation par titres des fiches

## Projet CRM : monorepo, admin et espace client (ADR-0019, ADR-0020)

Maquette validée par l'humain le 2026-11-24 : https://claude.ai/artifact/8qrSz67JD3KziATdinRuhK. Chaque étape suit le circuit : implémentation (`backend`, `frontend`, `devops`), audits (`qa`, `securite`, `accessibilite`), `reviewer`, push sur `dev` ; merge sur `main` par l'humain.

### CRM 1 — Monorepo Nx

- [x] Nx initialisé, site déplacé dans `apps/site` sans changement visible (build, tests, e2e, Lighthouse, garde-fous identiques)
- [x] `libs/shared/tokens` extrait de `tokens.css`, consommé par le site
- [x] CI GitHub Actions adaptée aux chemins du monorepo (`nx affected` reporté à l'arrivée d'une 2e app, ADR-0021), `CLAUDE.md` et `docs/ARCHITECTURE.md` réécrits pour le monorepo

### CRM 2 — Socle serveur et préproduction

- [ ] Images Docker (site, admin, espace client, api, worker), projet Compose `amg` branché sur le Traefik existant, Postgres et Redis propres à AMG, plafond mémoire de 4 Gio pour tout AMG (slice systemd)
- [ ] Préproduction `staging.` déployée depuis `dev`, production depuis `main`, sans coupure et avec retour arrière
- [ ] Sauvegardes chiffrées base + fichiers vers Backblaze B2, test de restauration documenté (`docs/EXPLOITATION.md`)
- [ ] Vérification du serveur avec l'humain : pare-feu, SSH par clé, fail2ban, mises à jour automatiques

Avancement (2026-11-25) : image du site (nginx non root, configuration générée depuis `vercel.json`, conformité vérifiée contre Vercel), projet Compose prod/staging, déploiement sans coupure avec retour arrière, sauvegardes restic + age, surveillance, test de restauration et `docs/EXPLOITATION.md` écrits ; Traefik partagé reconfiguré côté projet voisin (ADR-0020, révision du 2026-11-25). Restent : réglages AMG sur le serveur, actions de l'humain (`docs/EXPLOITATION.md` §9), premier déploiement de `staging.`, images admin, espace client, api et worker (à leur création), installation du plafond mémoire (`amg.slice`, `amg-prod.slice`, `amg-staging.slice` : 4 Gio tout compris). Fichiers déposés : reconstruction du contenu au lieu de ClamAV (ADR-0022).

### CRM 3 — API et sécurité

- [ ] Prisma (schéma initial, migrations), schémas Zod partagés, variables d'environnement validées
- [ ] Authentification : Argon2id, sessions cookies, CSRF, TOTP (obligatoire admin), lien d'activation à usage unique (le client choisit son mot de passe ; remplace le mot de passe provisoire, ADR-0023), renvoi par Amandine, blocage, alertes, journal
- [ ] Autorisation refus par défaut, tests d'accès croisé ; audit `securite` sans ❌

Avancement (2026-11-26) : lot 0 « socle » fait (ADR-0023) : `apps/api` (NestJS 12 sur Fastify, ESM, `tsc`, Vitest), `libs/shared/schemas`, `tsconfig.base.json` sans `paths` (références de projet), lint typé commun, `GET /api/health` avec en-têtes de sécurité et sans CORS, configuration validée par Zod avec secrets `*_FILE` obligatoires en production, `compose.dev.yaml` (Postgres et Redis aux digests de production, 127.0.0.1). Décisions consignées : API sous `admin.…/api/` et `espace.…/api/` (même origine, cookies `__Host-`, CSRF en `X-CSRF-Token`), durées de session, codes de secours et `reset-mfa`, emails par Resend depuis le worker. Lots suivants : 1 base (Prisma 7.10.1), 2 image et préproduction, 3 sessions et accès, 4 TOTP et liens d'activation, 5 worker et emails, 6 clôture.

Avancement (2026-11-26, lot 1 « base ») : `libs/api/db` (`@amg/api-db`, Prisma 7.10.1 épinglé, générateur `prisma-client` ESM, adapter `pg`) ; schéma initial (comptes, liens d'activation, TOTP chiffré, codes de secours et d'enrôlement, journal de sécurité en ajout seul) et première migration avec ses contraintes ; rôles PostgreSQL `amg_migrator` et `amg_app` (`sql/roles.sql`) ; module Nest d'accès à la base (connexion depuis `DB_*` et `DB_PASSWORD_FILE`, pool fermé à l'arrêt) ; job CI « API (intégration) » (même digest PostgreSQL que la production, migrations, dérive, droits, contraintes) et contrôle d'immuabilité des migrations. Décision de l'humain : lien d'activation à usage unique au lieu du mot de passe provisoire (ADR-0023 et ADR-0019 révisées). Les tests d'intégration ne tournent qu'en CI (pas de Docker sur le poste de développement).

Avancement (2026-11-27, lot 2 « image de l'API et préproduction », non encore installé sur le serveur) : images `amg-api` (distroless Node 24, sans shell, non root, dépendances de production seules, CLI Prisma et `effect` exclus et vérifiés, Trivy sans exception) et `amg-api-migrate` (`apps/api/Dockerfile`, cibles `api` et `migrate`), contrôlées en CI sur PostgreSQL (`.github/scripts/check-api-images.sh`) et publiées sur GHCR derrière `AMG_STAGING_API_ON_VPS` / `AMG_PROD_API_ON_VPS` ; service `api` dans `deploy/compose.yaml` (routeur `(Host(admin.…) || Host(espace.…)) && PathPrefix(/api/)`, réseaux internes, secret `pg_app_password`, 256 / 160 Mio) ; `deploy.sh deploy api` avec fenêtre de migration (journal vérifié avant, `LOGIN` sous piège `EXIT`, migrations en conteneur ponctuel `amg_run` rôle `migrate`, `NOLOGIN` et `pg_terminate_backend`, rejeu de `roles.sql`, journal vérifié après, puis bascule) ; vérification continue du journal dans `watch.sh` ; restauration dans une base neuve sous `amg_migrator` avec liste filtrée et bascule par renommage (`restore-gate.sh`, `restore-prod.sh`, `restore-test.sh`) ; tests hors ligne des scripts (`deploy/ci/test-scripts.sh`). Worker reporté au lot 5. Restent : actions de l'humain (`docs/EXPLOITATION.md` §9, étapes 13 à 17), premier déploiement de l'API en préproduction, mesure de sa mémoire.

Avancement (2026-11-27, lot 3 « sessions et accès », non encore installé sur le serveur) : ADR-0023 complétée avant le code (« Magasin de sessions », « Hôtes, gardes et limitation de débit », « Journal de sécurité : rôle et pool dédiés ») ; magasin de sessions Redis (ioredis 6.0.0 ; jeton opaque de 256 bits, clé = SHA-256, un script Lua atomique par opération : expirations d'inactivité et absolue, audience, rotation, révocations, 3 sessions admin et 5 client au plus, liste ; Redis indisponible : 503, jamais d'accès) ; gardes globales hôte (un seul 404 générique), session (refus par défaut, cookies `__Host-amg_admin_sid` / `__Host-amg_client_sid`, `@Public()`) et CSRF (jeton dérivé, `Sec-Fetch-Site`, `Origin` exacts) ; préfixes `/api/admin/*` et `/api/client/*` ; proxy de confiance à un saut limité au CIDR `TRUSTED_PROXY` ; limitation de débit `@fastify/rate-limit` sur Redis (300/min/IP, 404 compris) et aides du lot 4 ; routes de session des deux audiences (courante, liste, fermeture d'une session, déconnexion) ; rôle PostgreSQL `amg_journal`, seul écrivain du journal (migration `20261127120000_journal_role`, contrôle à cliquet), pool dédié et `details` bornés par type d'événement ; CI : Redis au digest de production et utilisateur ACL de l'API. Côté serveur, fichiers prêts (`devops` : service `api` et ses secrets, `redis.conf` à utilisateurs ACL sans persistance, `TRUSTED_PROXY` contrôlé par `deploy.sh` et `watch.sh`) ; restent les actions de l'humain sur le serveur (`docs/EXPLOITATION.md` §9, étapes 18 à 26), connexion, TOTP et liens d'activation (lot 4), « fermer toutes les autres sessions » (lot 4, ré-authentification récente).

### CRM 4 — Admin : contenu du site

- [ ] Réalisations (galerie avant / 3D / après, textes alternatifs, ordre), formules et options (créer, modifier, archiver), brouillon et aperçu
- [ ] « Publier » : reconstruction atomique du site depuis l'API ; le site lit réalisations, formules et options publiées

### CRM 5 — Espace client et projets

- [ ] Invitations, projets (étapes, tâches, notes privées, devis figés, avenants), fichiers (reconstruction des photos, PDF et vidéos sans antivirus, ADR-0022 ; liens signés), rendus commentés et demandes de modification

### CRM 6 — Messagerie et notifications

- [ ] Messagerie temps réel (boîte de réception admin, conversation client), PWA installables, Web Push, emails via le Gmail d'Amandine

### CRM 7 — Pilotage

- [ ] Activité et revenus : CA, Urssaf et revenu net par mois et par année, réglages du taux, plafond, statistiques

### CRM 8 — Audit final et bascule

- [ ] Audit `securite` complet et test d'intrusion de la préproduction
- [ ] Bascule du site de Vercel vers le VPS (redirections, en-têtes, garde-fou légal transposés), domaines `admin.` et `espace.`, mise en production
