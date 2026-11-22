# Changelog

Toutes les évolutions notables du site, par phase. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### Production provisoire sur Vercel

- Pages légales : mention « Amandine Gaury EI » (entrepreneur individuel, imposée par le décret 2022-725) et adresse du siège (24 allée du Pré Lambesc, 91190 Gif-sur-Yvette, nouveau jeton `{legalAddress}` tiré de `site.ts`) dans les mentions légales, les CGS, le formulaire de rétractation et la confidentialité ; 6 points légaux restent bloquants.
- Correctif : le marqueur `{à-préciser}` ne bloque plus que les builds Vercel (production et previews) ; le build de test du mode service (`test:e2e:service`, endpoint factice) refonctionne en CI.
- Pas d'inscription au RCS : Amandine ne vend que des prestations de services (confirmé le 2026-11-22) ; 9 points légaux restent bloquants.
- Pages légales : 7 des 23 points bloquants réglés sans attendre Amandine (« prix nets » au lieu de « TTC », définitions des CGS alignées sur le devis signé, repli `mailto:` assumé, aucune photo Pexels, pas de crédit de conception, hébergeur sans téléphone, messagerie Gmail en simple recommandation) ; 16 restent (`npm run check:prod`).
- Consolidation des pages légales : 6 points de plus levés sans Amandine, décisions tracées en commentaire (immatriculation au RNE affichée avec le SIREN, puisqu'il n'existe pas de numéro RNE distinct ; délais renvoyés au devis, conformes à L111-1 3° ; RC Pro non obligatoire pour une décoratrice ; dates d'entrée en vigueur et de mise à jour sans obligation légale ; clients professionnels) ; durée de conservation et absence de prospection regroupées en un seul point ; il reste **10** `TODO(contenu)` bloquants (adresse ou domiciliation, mention « EI », inscription au RCS à exclure, médiateur, prix, validation de l'art. 4, accord des clients pour les photos, conservation et prospection).
- CGS : clause légale réservée aux clients professionnels dans l'article 5 (pénalités de retard au taux de la BCE majoré de 10 points, exigibles sans rappel, indemnité forfaitaire de 40 € pour frais de recouvrement, Code de commerce L441-10 et D441-5) ; définition « Client » alignée sur le devis signé ; « prix nets : TVA non applicable, article 293 B du CGI » sans doublon.
- Docs de conformité et de mise en ligne alignées : nouveau point « avis clients » (information sur le contrôle des avis, L111-7-2 du Code de la consommation, non bloquant), service de formulaire à nommer avant de définir `PUBLIC_FORM_ENDPOINT`, liste des questions pour Amandine réduite à l'essentiel.
- Chaque build de production écrit l'état du garde-fou légal dans son journal (« Garde-fou légal : actif / inactif »).
- Le garde-fou des pages légales ne bloque plus que le build de production qui sert le vrai domaine (`VERCEL_PROJECT_PRODUCTION_URL`) : la production se déploie sur son adresse `*.vercel.app` (en `noindex`) sans attendre les informations d'Amandine ; rattacher le domaine exige `check:prod` vert puis un redéploiement (ADR-0015 révisée, `docs/MISE-EN-LIGNE.md`).

### Images de l'ancien site

- Plus aucun placeholder sur les pages publiques : portrait d'Amandine (accueil, `/a-propos/`), rendus 3D en 2560 px pour les héros de l'accueil et de `/visualisation-3d/` et pour l'image Open Graph par défaut, vraie paire rendu 3D / photo du résultat pour le comparateur (chambre d'enfant sous combles, points de vue proches mais pas identiques, signalé dans le chapeau).
- 8 anciens projets publiés sans texte sur l'ancien site ajoutés aux réalisations (12 au total) : rendus 3D en 1600 × 900, photos avant et, pour la chambre d'enfant, photos après ; textes rédigés d'après les images, sans prénom de client, à faire confirmer par Amandine (`TODO(contenu)`).
- `/projet-1/` à `/projet-7/` et `/projet-marine/` redirigent vers leur nouvelle fiche au lieu de `/realisations/`.
- Les 4 projets récents restent en 1200 × 600 : c'est la taille des fichiers d'origine sur l'ancien site.
- Image héro (élément LCP) encodée en AVIF qualité 40 au lieu de 50 : 30 → 17 Ko en 720w sur un rendu détaillé, sans perte visible ; les fiches aux sources 1600 × 900 repassent sous les 2 s de LCP.
- CI : délai de démarrage du serveur e2e porté à 10 min, et cache des images optimisées entre les jobs (`actions/cache`), pour éviter de régénérer les ~2 200 variantes à chaque build.

### Palette de l'ancien site

- Palette « pastel + terracotta » remplacée par celle de l'ancien site d'Amandine : fonds crème, beige et grège, camel doré en décor, camel foncé pour les boutons et les liens, vieux rose en touche, texte gris-brun ; erreurs en vieux rose foncé ; favicon assorti (ADR-0017).
- Tokens renommés d'après leur vraie couleur (`camel-*`, `beige`, `greige`, `rose-*`, `ivory`), contrastes AA vérifiés en test sur les cinq fonds de section.

### Après la Phase 8 — Contenus de l'ancien site

- Vraies images des 4 réalisations (31 rendus 3D et photos avant travaux d'Amandine, repris de son ancien site en 1200 × 600) et des couvertures des 2 articles, avec des textes alternatifs descriptifs ; section « chambre des enfants » du chalet décrite d'après les rendus.
- Réponses reprises de l'ancien site : formation, rendez-vous à distance en visio ou par téléphone, WhatsApp comme canal d'accompagnement, chalet en Suisse mené à distance.
- Image Open Graph : la couverture si elle atteint 1200 × 630, sinon l'image par défaut avec son texte alternatif (ADR-0011 révisée) ; `srcset` jusqu'à la largeur de la source.
- Images en arche, cartes et vignettes de galerie recadrées au build à la proportion de leur cadre (`coverCrop`), au lieu de gonfler `sizes` : héro mobile des fiches projet de ~30–38 Kio à 14–19 Kio en AVIF (480 × 600), LCP de `/realisations/espace-de-vie-scandinave/` sous les 2 s, HTML de l'accueil 13,9 Ko gzip.
- Suivi de revue : MJM Design Graphic retiré de `/a-propos/` en attendant qu'Amandine confirme son lien avec la certification de 2010 ; chapeau du comparateur juste aussi sans JavaScript ; règle « une seule image » de la visionneuse testée en unitaire ; coloration Shiki désactivée (aucun bloc de code).

### Phase 8 — Préparation à la mise en ligne

- Garde-fou de mise en production : le build Vercel de production échoue tant qu'un `TODO(contenu)` reste dans les mentions légales, les CGS ou la confidentialité ; `npm run check:prod` donne la même liste en local (ADR-0015).
- Gabarit des corps Markdown : coordonnées et SIRET injectés depuis `site.ts`, paragraphes de la confidentialité affichés selon le mode réel du formulaire (repli `mailto:` ou service) ; jeton ou bloc inconnu = build en échec (ADR-0016).
- Comparateur « Rendu 3D ↔ Réalisé » visible sur `/visualisation-3d/` (paire configurable, images provisoires signalées), dévoilement en `transform` au lieu de `clip-path`.
- Section « Décoratrice d'intérieur à Paris, et à distance partout en France » sur `/contact/`.
- Redirection `www` → domaine nu en un seul saut (aussi pour les anciennes URL), nœud `Service` sur `/visualisation-3d/`, descriptions avec appel à l'action, plus de recouvrement « plan 3D ».
- Passe axe sur les colonnes collantes défilantes ; port du serveur de test surchargeable (`PLAYWRIGHT_PORT`).
- `docs/MISE-EN-LIGNE.md` : informations à obtenir d'Amandine (bloquantes, visuels, faits à confirmer) et checklist de bascule (Vercel, DNS, HTTPS, Search Console, Google Business Profile).

### Phase 7 — Qualité finale

- CSP stricte par empreintes (`security.csp` d'Astro, balise meta), élaguée page par page aux seuls éléments inline présents ; en-têtes Vercel complétés (`frame-ancestors`, `base-uri`, `object-src`, CORP, Permissions-Policy) ; aucune violation CSP sur les 25 pages, testé en e2e et sur le build en mode service (ADR-0012).
- Console propre et ressources vérifiées (liens internes, images, polices) sur toutes les pages, en e2e.
- Apparitions au défilement liées au scroll en CSS (`animation-timeline: view()`), animées par liste plutôt que par élément, repli IntersectionObserver pour Firefox : environ −75 % de recalculs de style sur l'accueil (ADR-0013).
- Icônes en sprite SVG `<use>` à URL versionnée (cache immuable d'un an) : HTML de l'accueil 14,9 → 13,5 Ko gzip, sous la fenêtre TCP initiale de 14 Ko, contrôlé en e2e.
- INP : fermeture de la visionneuse reportée après le rendu, trait du comparateur plus lisible.
- Accessibilité : visionneuse annonçant « Image n sur N : légende », bandeau en pause tant que le focus clavier y est, `scroll-margin` des ancres sous l'en-tête collant, nature des cartes « Pour aller plus loin » lue après leur titre.
- Formulaire : un clic sur « Envoyer » juste après la correction d'une erreur n'est plus perdu (test de régression).
- Audit d'accessibilité complet (0 P1) : les colonnes latérales collantes plus hautes que l'écran (sommaire des pages légales, coordonnées du contact) ne cachent plus de lien atteint au clavier.
- Régression visuelle de référence : 22 captures pleine page (11 pages, mobile et desktop), `npm run test:visual`, hors CI (rendu des polices propre à chaque machine).
- `/audit` global consolidé (`.claude/reports/audit-2026-11-19.md`) : 0 P1 dans le code ; les P1 restants (visuels, mentions légales, médiateur, CGS) attendent les informations d'Amandine et sont reportés en Phase 8.
- Architecture : origine du site exigée par `requireSiteOrigin` (plus de repli silencieux vers `localhost`), JSON-LD des prestations produit hors de la page, garde de type des microcopies du formulaire ; découpage lecteur / modèle de `lib/pages/` documenté (ADR-0014).

### Phase 6 — SEO avancé

- JSON-LD relié par `@id` sur chaque page (`#service`, `#projet`, `#article`, `#page`, `#fil-ariane`), `CollectionPage` des prestations, zone desservie tirée de `site.ts` ; un test valide le graphe de chaque page de `dist/` (références résolues, URL absolues, propriétés requises).
- Image Open Graph 1200 × 630 propre à chaque page (recadrage `getImage`, build en échec si la source est trop petite) ; balises `article:published_time`, `modified_time`, `author`, `section` et `tag`.
- `robots.txt` (sans `Disallow`) et `llms.txt` générés au build depuis `site.ts` et les collections (ADR-0011) ; `lastmod` du sitemap pour le blog, à partir des dates réelles.
- h1 orientés mot-clé sur les 6 fiches prestations (`heroTitle`, le nom passe en surtitre) ; Essentiel recentré sur la petite pièce, Professionnels sur le home staging virtuel.
- Accueil : méthode et avantages en résumé (titres seuls) avec lien vers `/visualisation-3d/`, plus aucun texte dupliqué.
- Maillage : « Pour aller plus loin » sur les fiches prestations et la page 3D, ancres descriptives, signature visible de l'autrice sur les articles, LinkedIn d'Amandine, zone Paris et Île-de-France dans le pied de page.
- Honeypot du formulaire testé sur un build en mode service (`npm run test:e2e:service`, en CI).

### Phase 5 — Effets et interactions

- Apparitions au scroll (texte décalé, révélation des images en arche) préparées en JS pour les seuls éléments sous la ligne de flottaison : le contenu est visible sans JS, en mouvement réduit et dès qu'il reçoit le focus clavier.
- Comparateur « Rendu 3D ↔ Réalisé » accessible : `<input type="range">` natif (clavier complet, `aria-valuetext`), glisser souris, geste tactile horizontal qui laisse défiler la page à la verticale.
- Visionneuse des galeries projet en `<dialog>` natif : focus piégé, Échap, flèches, focus rendu à la vignette ; image grand format chargée à l'ouverture avec un `sizes` adapté au portrait ; sans JS, les vignettes ouvrent l'image.
- Morphing grille → projet en View Transitions natives (ADR-0006), bandeau de mots animé avec bouton pause (WCAG 2.2.2), CTA magnétique léger (pointeur fin seulement).
- Classe `js` posée par un script inline de 170 octets, retirée si un module échoue : retour à la version sans JS (ADR-0010).
- Audit performance : ouverture de la visionneuse 184 → 88 ms (INP), glisser du comparateur sans layout forcé (97 → 5 layouts pour 100 déplacements), scripts communs réunis en un module (3 requêtes et 590 o de moins par page), bandeau hors écran sans calque composité.
- JS par page : 2,7 à 4,0 Ko gzip sur les pages publiques, 4,8 Ko sur le styleguide (budget 30 Ko) ; CSS total 14,1 Ko (budget 35 Ko).

### Phase 4 — Pages

- 25 pages : accueil définitif, prestations (liste + 6 fiches), visualisation 3D, réalisations filtrables + 4 fiches projet, à propos, conseils déco + 2 articles, contact + merci, mentions légales, confidentialité, CGS.
- 30 blocks éditoriaux partagés (Hero, ServicesGrid, ProjectGrid, ProcessSteps, Benefits3D, Testimonials, CtaBanner, Marquee, ContactForm…) ; pages = assemblage, contenu lu via `src/lib/pages/*`.
- Formulaire de contact conforme RGPD (aucune adresse, aucune case de consentement, mention d'information) : `POST` vers `PUBLIC_FORM_ENDPOINT` ou repli `mailto:` expliqué à l'écran ; validation et envoi accessibles avec JS.
- Pages légales rédigées (`docs/CONFORMITE.md` : 18 points ouverts pour Amandine) ; aucun cookie, donc pas de bandeau.
- JSON-LD par type de page : `Service`, `CreativeWork`, `BlogPosting`, `CollectionPage`, `AboutPage`, `ContactPage`, `BreadcrumbList`.
- Garde-fous : liens internes en 200 sans redirection, aucune page orpheline, aucun `TODO` ni brouillon dans `dist/`, débordement à 320 px et espacement WCAG testés sur toutes les pages.
- Lighthouse CI audite désormais les 25 pages (il n'en découvrait que 5), CLS en médiane, budgets JS/CSS bloquants. CLS de `/realisations/` corrigé (0,057 → 0,0002), Fraunces 400 italique retirée.
- Polices de repli ajustées écrites à la main pour Linux et Android (ADR-0009) : CLS de `/contact/` 0,0597 → 0 en CI.
- CI : un seul run par push (PR), actions en v7 (Node 24), Lighthouse sur l'artefact `dist` vérifié, rapports conservés.

### Phase 3 — Contenu

- Re-crawl complet du site actuel : 26 URLs de contenu inventoriées, textes intégraux, meta et avis exacts archivés dans `docs/contenu-source/`. Correction de l'attribution de l'avis « projet de cuisine » (Sébastien T.).
- Collections de contenu (ADR-0007) : `pages`, `prestations` (4 formules + meuble sur mesure + offre professionnels, prix stockés et pilotables par `site.pricing.showPrices`), `projets` (4 réalisations aux slugs descriptifs), `articles`, `temoignages` (4 avis mot pour mot), `faq`, `etapes`, `avantages`. Longueurs SEO, `alt` et liens internes validés au schéma.
- Textes réécrits par le `redacteur` à partir des seuls faits du site actuel ; chaque information manquante est un `TODO(contenu)`.
- Redirections de migration en un seul saut (ADR-0008) : 70 règles permanentes générées depuis `src/lib/redirects.ts` et testées.
- Placeholders d'images documentés dans `src/assets/placeholders/README.md`.

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
