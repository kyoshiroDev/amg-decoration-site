# Architecture

> Tenue à jour par l'agent `architecte`. L'arborescence de référence et les règles sont dans `CLAUDE.md` §3 ; ce document détaille le **pourquoi** et les flux.

## Principes

1. **Statique d'abord** : tout est pré-rendu au build. Zéro serveur, zéro base de données.
2. **Contenu séparé du code** : les textes vivent dans `src/content/` (Markdown/YAML validés par Zod) ; les infos de l'entreprise dans `src/config/site.ts`.
3. **Couches** : `pages` (routes) → `layouts` (squelette + SEO) → `blocks` (sections) → `ui` (atomes). `lib/` est transverse et pur, à deux exceptions documentées : les lecteurs de collections `lib/pages/*.ts` (`getCollection`) et `lib/article-files.ts` (lecture du disque pour `astro.config.mjs` et les tests).
4. **Progressive enhancement** : le HTML/CSS fonctionne seul ; le JS (`src/scripts/`) n'ajoute que de l'agrément.

## Styleguide interne

`/styleguide/` (noindex, exclue du sitemap) est la référence visuelle du `designer` et du `reviewer`. Ses sections vivent dans `src/components/styleguide/` et ne sont jamais importées par une page publique. Elles lisent `src/styles/tokens.css` au build (`?raw`) via `src/lib/design-tokens.ts` et `src/lib/color-contrast.ts` : aucune valeur n'est recopiée (ADR-0005).

## Flux de données

```
src/config/site.ts ──────┐
src/config/microcopy.ts ─┼──> layouts/BaseLayout.astro ──> components/seo/SEO.astro + JsonLd.astro
src/lib/jsonld.ts ───────┘                │            └─> components/layout/* (SkipLink, Header, Footer)
                                      ▼
src/content/** ──(getEntry / getCollection)──> pages/*.astro ──> components/blocks/* ──> components/ui/*
       ▲                                            │
src/content.config.ts (schémas Zod 4)        src/lib/content.ts (tri, filtres, requireEntry)
```

### Fichiers pour les robots (endpoints statiques)

Les fichiers texte destinés aux robots sont des **endpoints statiques** `src/pages/<nom>.txt.ts` (`export const GET: APIRoute`), pré-rendus au build dans `dist/<nom>.txt`. Ils ne contiennent aucune logique : le contenu est produit par les fonctions pures de `src/lib/crawlers.ts` (testées dans `tests/unit/crawlers.test.ts`) ; l'URL absolue vient de `site` (`astro.config.mjs`), dont l'absence fait échouer le build. Décisions : ADR-0011.

| Endpoint                  | Fonction                                                 | Contenu                                                                                      |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/pages/robots.txt.ts` | `buildRobotsTxt`                                         | Tout autorisé, sans `Disallow`, sitemap absolu.                                              |
| `src/pages/llms.txt.ts`   | `buildLlmsTxt` (+ `lib/pages/llms.ts` / `llms-model.ts`) | Résumé Markdown llmstxt.org : pages, prestations, réalisations, articles publiés, sans prix. |

### Configuration (`src/config/`)

| Fichier        | Contenu                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `site.ts`      | Source de vérité unique : nom, NAP, horaires, zone, réseaux, `mainNav`, `headerCta`, `legalNav`, `pricing.showPrices`.         |
| `microcopy.ts` | Tous les libellés d'interface : lien d'évitement, `aria-label` des navigations, menu mobile, titres et textes du pied de page. |
| `seo.ts`       | Valeurs SEO par défaut et image OG (réservé aux composants : importe une image).                                               |

Aucun composant n'écrit de texte en dur : il lit l'un de ces modules ou reçoit le texte en prop. Les textes éditoriaux (y compris ceux des pages techniques : 404, styleguide) vivent dans `src/content/` (§ Collections).

### JSON-LD : un graphe relié par `@id`

`BaseLayout` émet **un seul** `<script type="application/ld+json">` contenant un `@graph` (`buildGraph`) : `WebSite`, `ProfessionalService` (l'entreprise) et `Person` (la fondatrice), plus les nœuds propres à la page passés en prop `jsonLd` (ex. `BreadcrumbList` ajouté par `PageLayout`). Les entités globales ont un identifiant stable `https://domaine/#site|#entreprise|#fondatrice` (`entityId`) et se référencent par `{ "@id": … }` au lieu d'être dupliquées.

## Collections de contenu

Schémas dans `src/content.config.ts` (Content Layer API d'Astro 7, `z` importé de `astro/zod`, loaders de `astro/loaders`). Décisions : ADR-0007. **Tout contenu invalide fait échouer le build** avec un message en français qui indique le fichier et le champ.

| Collection    | Loader et fichiers                           | Identifiant = URL                  | Champs clés                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | -------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages`       | `glob` · `src/content/pages/<page>.md`       | nom du fichier (`accueil`, `404`…) | `seo{title, description}`, `noindex`, `hero` (section dont `heading` = h1), `sections{<clé>: section}`, `form?` (microcopies du formulaire, page `contact` uniquement ; `{email}` remplacé par `site.email`) ; corps Markdown facultatif (texte long : à propos, pages légales)                                                                                                     |
| `prestations` | `glob` · `src/content/prestations/<slug>.md` | `/prestations/<slug>/`             | `title` (surtitre de la fiche, fil d'Ariane, JSON-LD), `kind` (`formule` \| `offre`), `tagline` (cartes), `heroTitle` (h1 orienté mot-clé, ≠ `title`), `heroTitleEmphasis?` (fragment exact), `target?`, `summary`, `includes[]`, `options[]`, `highlight`, `price?{amount, currency: 'EUR', from, note?}`, `quote?{label, note?}`, `cover?`, `order`, `seo` ; corps = présentation |
| `projets`     | `glob` · `src/content/projets/<slug>.md`     | `/realisations/<slug>/`            | `title`, `summary`, `location?`, `roomTypes[]` (enum), `style`, `service?` (→ `prestations`), `cover{image, alt}`, `gallery[{image, alt, kind: 'avant' \| '3d' \| 'apres', caption?}]`, `beforeAfter?{rendering, result}`, `featured`, `order`, `seo` ; corps = récit                                                                                                               |
| `articles`    | `glob` · `src/content/articles/**/*.mdx`     | `/conseils-deco/<slug>/`           | `title`, `publishedAt`, `updatedAt?` (≥ `publishedAt`), `cover{image, alt}`, `tags[]`, `relatedService?` (→ `prestations`), `relatedProject?` (→ `projets`), `draft`, `seo` ; corps MDX                                                                                                                                                                                             |
| `temoignages` | `file` · `src/content/temoignages.yaml`      | clé YAML (`patrick-v`)             | `author`, `text` (**exact**), `source` (`google` \| `direct`), `url?` (obligatoire si `google`), `projectType?`, `pages[]`, `order` — jamais de note ni de date                                                                                                                                                                                                                     |
| `faq`         | `file` · `src/content/faq.yaml`              | clé YAML                           | `question`, `answer`, `pages[]`, `order`                                                                                                                                                                                                                                                                                                                                            |
| `etapes`      | `file` · `src/content/etapes.yaml`           | clé YAML                           | `title`, `text`, `order` (méthode en 6 étapes, partagée accueil / visualisation 3D / prestations)                                                                                                                                                                                                                                                                                   |
| `avantages`   | `file` · `src/content/avantages.yaml`        | clé YAML                           | `title`, `text`, `order` (les 8 bénéfices de la 3D, partagés accueil / visualisation 3D)                                                                                                                                                                                                                                                                                            |

### Règles communes

- **Objets stricts** (`z.strictObject`) : une clé inconnue (faute de frappe) est une erreur, pas un champ ignoré.
- **SEO validé dans le schéma** : `seo.title` ≤ 60 caractères, `seo.description` de 140 à 160, comptés en NFC (`isTitleLengthValid`, `isDescriptionLengthValid` et `seoLimits` de `src/lib/seo.ts`, les mêmes que le composant `SEO`).
- **Images** : `image()` (chemin relatif au fichier de contenu), toujours accompagnées d'un `alt` non vide qui ne commence pas par « image de », « photo de »…
- **Liens internes** (`actions[].href`, `links[].href`) : `/chemin/` en minuscules avec slash final, ancre facultative.
- **Pages où afficher** (`pages[]` des témoignages et de la FAQ) : `accueil`, `prestations`, `visualisation-3d`, `realisations`, `a-propos`, `contact`.
- **Section de page** : `eyebrow?`, `heading`, `headingEmphasis?` (fragment exact de `heading`, mis en italique), `lead?`, `items[{title, text?}]`, `quote?{text, author}`, `actions[]` (3 au plus), `links?[]` (1 à 6 liens de maillage `{label, href}` rendus en cartes « Pour aller plus loin » par `resolveFurtherLinks`, `src/lib/pages/further-links.ts` : `label` = surtitre, titre et texte lus dans l'article publié, la prestation ou la réalisation visée ; une cible inconnue ou un brouillon fait échouer le build). La route lit chaque section par sa clé avec `requireSection` : une section manquante fait échouer le build au lieu de publier une page amputée.
- **Prix** : stockés quand ils sont publics, affichés seulement si `site.pricing.showPrices` vaut `true`, **jamais** en JSON-LD (`Offer`) tant qu'Amandine ne les a pas confirmés (ADR-0007).
- **Lecture dans une route** : `requireEntry(await getEntry('pages', 'accueil'), 'pages', 'accueil')` (pas de `!`), puis `sortByOrder`, `filterPublished` (articles) et `filterByPage` (témoignages, FAQ) de `src/lib/content.ts`.

### Nommage des fichiers

- Un fichier = une entrée ; **le nom du fichier est le slug de l'URL** : minuscules, sans accents, mots séparés par des tirets (`chalet-suisse.md`, `bien-choisir-sa-peinture.mdx`). Le renommer change l'URL : prévoir une redirection 301 dans `vercel.json`.
- Dans les fichiers YAML, la clé de chaque entrée suit la même règle (`sebastien-t`).
- Images d'un projet : `src/assets/projets/<slug>/` (`01-avant.jpg`, `02-3d-salon.jpg`, `03-apres.jpg`…) ; images d'un article : `src/assets/articles/<slug>/`. En attendant les originaux : `src/assets/placeholders/` (listés dans son `README.md`).
- Aucun texte de la forme `TODO(contenu): …` ne doit rester dans une page publiée.

### Ajouter une réalisation (pas à pas)

1. Déposer les images dans `src/assets/projets/<slug>/` (JPEG ou PNG en haute définition, Astro produit l'AVIF et le WebP).
2. Copier un fichier de `src/content/projets/`, le renommer `<slug>.md`.
3. Remplir l'en-tête (entre les `---`) : `title`, `summary`, `roomTypes`, `style`, `cover`, puis une entrée de `gallery` par image avec son `alt` (ce que l'on voit) et son `kind` (`avant`, `3d` ou `apres`). Pour le slider « Rendu 3D ↔ Réalisé », ajouter `beforeAfter` avec les deux images cadrées à l'identique.
4. Écrire `seo.title` (60 caractères au plus) et `seo.description` (140 à 160).
5. Écrire le récit du projet sous l'en-tête, en Markdown.
6. Lancer `npm run build` : un champ manquant ou trop long est signalé avec son nom.

### Ajouter un article (pas à pas)

1. Copier `src/content/articles/modele-article.mdx`, le renommer `<slug>.mdx`, passer `draft` à `false` quand il est prêt.
2. Remplir `title`, `publishedAt` (AAAA-MM-JJ), `cover` (image + `alt`), `tags`, `seo`, et éventuellement `relatedService` (ex. `confort`) et `relatedProject` (ex. `chalet-suisse`) : un identifiant inexistant fait échouer le build.
3. Rédiger le corps avec des intertitres `##` (jamais `#` : le titre de l'article est le seul h1) et au moins un lien vers une prestation ou une réalisation.

## Scripts client

JavaScript vanilla, chargé par un `<script>` Astro dans le composant qui en a besoin (Astro le regroupe en module, dédupliqué, différé). Les scripts présents sur toutes les pages sont réunis dans le seul `<script>` de `BaseLayout` (une requête au lieu de quatre). Tout est **amélioration progressive** : le HTML et le CSS fonctionnent seuls.

- **Cycle de vie** : `src/scripts/lifecycle.ts` exporte `onPageReady(init: (signal: AbortSignal) => void)`. `init` est appelée tout de suite, puis à chaque `astro:page-load` ; le contrôleur précédent est coupé (`abort()`) avant chaque relance et sur `astro:before-swap`. Chaque script passe le `signal` à `addEventListener(…, { signal })` et déconnecte ses observers sur `abort` : aucune fuite, aucun double écouteur.
- **View Transitions natives** (ADR-0006) : pas de `<ClientRouter />`, donc chaque navigation recharge le document et les scripts ne s'exécutent qu'une fois par page ; les écouteurs `astro:*` gardent le code prêt pour un éventuel retour du routeur client. Les transitions sont purement CSS (`@view-transition` dans `global.css`).
- **Popover API** pour le menu mobile : ouverture, fermeture, Échap, clic extérieur, `aria-expanded` et retour du focus sont natifs ; le script ne fait qu'ajouter du confort (focus initial, fermeture au `focusout` et au clic sur un lien). Repli sans support : lien vers le plan du site du pied de page.
- **Classe `js`** : un script inline de 170 octets en tête de `BaseLayout` (`JS_CLASS_SCRIPT`, `src/lib/inline-scripts.ts`) pose `js` sur `<html>` avant le premier rendu, et la retire si un module échoue (retour à la version sans JS). Les composants qui n'ont de sens qu'avec JS (filtres, comparateur, bandeau animé) s'affichent sous `.js` sans décalage de mise en page. Empreinte CSP et test : ADR-0010.
- **Logique pure** des scripts dans `src/lib/` (testée par Vitest) : `before-after.ts` (position sous le pointeur, `aria-valuetext`), `magnetic.ts` (décalage borné), `lightbox.ts` (index en boucle, compteur).

| Script              | Chargé par                      | Rôle                                                                                                   | Poids (gzip) |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| `lifecycle.ts`      | importé par tous                | `onPageReady(signal)`                                                                                  | 0,2 Ko       |
| `header.ts`         | `BaseLayout` (toutes)           | IntersectionObserver sur un repère à 80 px → `data-compact`                                            | 0,3 Ko       |
| `mobile-nav.ts`     | `BaseLayout` (toutes)           | Confort du menu mobile (Popover API native)                                                            | 0,5 Ko       |
| `reveal.ts`         | `BaseLayout` (toutes)           | Apparitions au scroll et image reveal (`data-reveal`, hors écran uniquement, rien en mouvement réduit) | 0,6 Ko       |
| `magnetic.ts`       | `BaseLayout` (toutes)           | CTA magnétique (`[data-magnetic]`, pointeur fin, ≤ 6 px)                                               | 0,7 Ko       |
| `marquee.ts`        | `Marquee` (accueil)             | Bouton pause / lecture, pause hors écran                                                               | 0,4 Ko       |
| `project-filter.ts` | `ProjectFilters` (Réalisations) | Filtre par type de pièce, `aria-pressed`, annonce du nombre                                            | 0,5 Ko       |
| `lightbox.ts`       | `Lightbox` (pages projet)       | Visionneuse `<dialog>` : ouverture, image à la demande, ← →, retour du focus                           | 0,9 Ko       |
| `before-after.ts`   | `BeforeAfter` (si paire)        | Comparateur : valeur, `aria-valuetext`, pointeur et tactile                                            | 0,8 Ko       |
| `contact-form.ts`   | `ContactForm` (`/contact/`)     | Validation et envoi `fetch`, repli HTML sans JS                                                        | 1,4 Ko       |
| _prefetch d'Astro_  | toutes                          | Préchargement au survol                                                                                | 1,1 Ko       |

Poids total mesuré par page (gzip, fin de Phase 5, hors script inline de 0,15 Ko) : 2,7 Ko sur la plupart des pages, 3,0 Ko sur l'accueil, 3,1 Ko sur `/realisations/`, 3,6 Ko sur les pages projet, 4,0 Ko sur `/contact/`, 4,8 Ko sur `/styleguide/` (tous les scripts). Budget : 30 Ko.

- Interdits : `console.*`, écouteur `scroll` (préférer IntersectionObserver), état d'animation présent dans le HTML initial (il est posé par le script, ou par du CSS sous `.js`).

## Tests

- `tests/unit/` (Vitest, `npm run test`) : fonctions pures de `src/lib/`.
- `tests/e2e/` (Playwright + axe, `npm run test:e2e`, `playwright.config.ts`) : build de production `dist/` servi sur le port 4321, projets mobile (Pixel 7) et desktop. Ce build n'a pas de `PUBLIC_FORM_ENDPOINT` : le formulaire de contact y est en repli `mailto:`.
- CSP (ADR-0012) : `tests/e2e/csp.spec.ts` vérifie la politique et les empreintes de chaque page et l'absence de violation, au chargement et pendant les interactions ; aucun test n'injecte de balise `<style>` ou `<script>` (CSSOM `adoptedStyleSheets` à la place). `tests/e2e/smoke.spec.ts` : aucune erreur console sur toutes les pages, fichiers `/_astro/` cités présents, liens externes en https avec `rel="noopener noreferrer"`.
- `tests/e2e-service/` (`npm run test:e2e:service`, `playwright.service.config.ts`) : formulaire de contact **en mode service** (ADR-0003). Build distinct dans `dist-service/` (ignoré par git, ESLint, Prettier et TypeScript) avec `PUBLIC_FORM_ENDPOINT=https://formulaire.test/envoi` passé par `webServer.env`, servi sur le port 4322, projet desktop seul. Vérifie la destination, la mention d'information du service et le champ piège (`_honeypot` : `tabindex="-1"`, `autocomplete="off"`, conteneur `aria-hidden`, hors tabulation, envoyé vide avec et sans JS). L'endpoint est intercepté, aucune requête externe ne part. En CI, lancé dans le job `e2e` après la suite principale ; rapport HTML dans `playwright-report/service/`.

## Configuration

- `astro.config.mjs` : `site: 'https://amgdecorationdinterieur.com'`, `trailingSlash: 'always'`, `output: 'static'`, intégrations `sitemap` (filtre des pages `noindex`, `lastmod` des articles lu dans leur frontmatter par `src/lib/article-files.ts` et `src/lib/sitemap-lastmod.ts`, importés sans alias ; les mêmes fichiers donnent les routes d'articles passées à `siteRoutes()`, assemblées dans `tests/site-routes.ts`) (+ `mdx`), `prefetch`, Fonts API, `image` (formats/qualités).
- `astro.config.mjs` → `security.csp` : Content-Security-Policy en balise meta, empreintes des scripts et styles calculées au build ; directives et empreintes des scripts `is:inline` fournies par `src/lib/csp.ts`, origine de `PUBLIC_FORM_ENDPOINT` autorisée si elle est définie (ADR-0012).
- `vercel.json` : redirections 301, en-têtes de sécurité (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, CSP d'en-tête limitée à `frame-ancestors`/`base-uri`/`object-src`), vérifiés par `tests/unit/security-headers.test.ts` ; cache immuable `/_astro/*`.
- `tsconfig.json` : `astro/tsconfigs/strictest` + alias `@/*`.

## Déploiement

GitHub → Vercel : chaque push sur `dev` = preview ; merge dans `main` (humain) = production. La CI GitHub Actions (`.github/workflows/ci.yml`) doit être verte avant tout merge.
