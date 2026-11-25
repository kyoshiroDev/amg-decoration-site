# Architecture

> Tenue à jour par l'agent `architecte`. L'arborescence de référence et les règles sont dans `CLAUDE.md` §3 ; ce document détaille le **pourquoi** et les flux.
>
> Chemins relatifs à `apps/site/` sauf mention contraire.

## Monorepo

Le dépôt est un monorepo **Nx 24.0.6 + workspaces npm** (ADR-0019 pour le choix, ADR-0021 pour l'outillage). Workspaces déclarés dans le `package.json` racine : `apps/*`, `libs/shared/*`. Scope des paquets internes : `@amg/` (privés, jamais publiés). `npx nx show projects` les liste.

| Projet               | Dossier               | Rôle                                                                                                                                                        |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@amg/site`          | `apps/site/`          | Site vitrine Astro statique. Projet à scripts npm : Nx infère les cibles de `apps/site/package.json`, sans plugin Astro ni `project.json` (propriété `nx`). |
| `@amg/shared-tokens` | `libs/shared/tokens/` | Tokens de design en CSS seul, sans build, exposé par `exports` (`@amg/shared-tokens/tokens.css`). Cible `lint` (Stylelint).                                 |

**Graphe** : `@amg/site` → `@amg/shared-tokens` (dépendance `"*"` du site). Le site l'importe en CSS (`@import url('@amg/shared-tokens/tokens.css')` dans `src/styles/global.css`), en texte brut pour le styleguide (`?raw`) et dans les tests (résolution du paquet). La texture de grain (`--grain-image`) est propre au site : elle est déclarée dans `src/styles/global.css`, pas dans la lib.

**Répartition** : l'outillage commun vit à la racine, une seule version par outil (ESLint et plugins, Prettier, Stylelint, TypeScript, Vitest, Playwright, axe, LHCI, Nx) ; les dépendances propres au site (Astro, intégrations, Sätteri, `schema-dts`, `@astrojs/check`) dans `apps/site/package.json`. ESLint : base partagée à la racine (`sharedConfigs`, `sharedRules` de `eslint.config.js`), config du site dans `apps/site/eslint.config.js`. Stylelint (`stylelint.config.mjs`) et Prettier sont uniques, à la racine.

**Cache Nx** (`nx.json`, dossier `.nx/` ignoré par git) sur `build`, `check`, `test` et `lint`. Entrées :

- `build` : entrées `production` du projet et de ses dépendances (tests, configs Playwright, Vitest, Lighthouse et ESLint exclus) **et** les variables qui changent le build : `PUBLIC_FORM_ENDPOINT`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`. Sortie : `apps/site/dist`.
- `test` : fichiers du projet + `vercel.json` racine (lu par les tests de redirections, d'en-têtes et de build Vercel).
- `lint` : fichiers du projet + `eslint.config.js` et `stylelint.config.mjs` racine.
- Toutes : version de Node (`sharedGlobals`). En cas de doute : `npx nx reset`.
- `apps/site/.env` (local, ignoré par git) n'entre **pas** dans les entrées : après l'avoir modifié, lancer `npx nx reset` avant `npm run build`, sinon Nx peut resservir un build en cache. Vercel et la CI ne sont pas concernés (pas de `.env`, build Vercel hors Nx).

**Réglages mémoire** (machine de développement limitée) : `parallel: 1`, pas de daemon (`useDaemonProcess: false`), pas de TUI, `analytics: false` ; les scripts racine passent `--outputStyle=static` pour des journaux lisibles par les agents.

**Commandes** : les `npm run …` racine sont inchangées. `build`, `check`, `lint` et `test` passent par `nx run-many` ; `dev`, `preview`, `test:e2e`, `lhci`… délèguent au workspace (`npm run <script> -w @amg/site`). `nx affected` est reporté à l'arrivée d'une deuxième app. **Jamais `npm ci` en local** : il effacerait le cache d'images `apps/site/node_modules/.astro`.

## Principes

1. **Statique d'abord** : tout est pré-rendu au build. Zéro serveur, zéro base de données.
2. **Contenu séparé du code** : les textes vivent dans `src/content/` (Markdown/YAML validés par Zod) ; les infos de l'entreprise dans `src/config/site.ts`.
3. **Couches** : `pages` (routes) → `layouts` (squelette + SEO) → `blocks` (sections) → `ui` (atomes). `lib/` est transverse et pur, à trois exceptions documentées : les lecteurs de collections `lib/pages/<page>.ts` (I/O Astro, ADR-0014), `lib/article-files.ts` (lecture du disque pour `astro.config.mjs` et les tests) et `lib/release-guard-files.ts` (lecture des pages légales pour le garde-fou de mise en production, ADR-0015).
4. **Progressive enhancement** : le HTML/CSS fonctionne seul ; le JS (`src/scripts/`) n'ajoute que de l'agrément.

## Styleguide interne

`/styleguide/` (noindex, exclue du sitemap) est la référence visuelle du `designer` et du `reviewer`. Ses sections vivent dans `src/components/styleguide/` et ne sont jamais importées par une page publique. Elles lisent `libs/shared/tokens/src/tokens.css` au build (`@amg/shared-tokens/tokens.css?raw`) via `src/lib/design-tokens.ts` et `src/lib/color-contrast.ts` : aucune valeur n'est recopiée (ADR-0005).

## Flux de données

```
src/content/**  (validé par src/content.config.ts, schémas Zod 4)
      │  getEntry / getCollection / render / getImage
      ▼
src/lib/pages/<page>.ts ──────── LECTEUR (I/O Astro) : lit les collections, src/config/site.ts
      │                          et microcopy.ts, reçoit l'origine du site, assemble le JSON-LD
      │  entrées brutes + libellés
      ▼
src/lib/pages/<page>-model.ts ── MODÈLE PUR : tri, filtres, sections obligatoires, cartes,
      │                          fil d'Ariane (testé dans tests/unit/*-model.test.ts)
      │  { ...modèle, jsonLd }
      ▼
src/pages/<route>.astro ──────── assemblage : requireSiteOrigin(Astro.site) → getXxxData(origin)
      │                          ou getStaticPaths = getXxxPaths
      ▼
src/layouts/*Layout.astro ────── BaseLayout : SEO.astro + JsonLd.astro (@graph global + jsonLd de la page)
      │                          PageLayout : fil d'Ariane + BreadcrumbList
      ▼
src/components/blocks/* ──> src/components/ui/*
```

`src/config/site.ts` (NAP, navigation) et `src/config/media.ts` (visuels de mise en page) sont lus directement par les layouts, `layout/*` et les pages ; `src/lib/jsonld.ts`, `seo.ts`, `url.ts` sont des fonctions pures appelées par les lecteurs et les layouts. L'origine du site vient toujours de `site` (`astro.config.mjs`) par `requireSiteOrigin` (`src/lib/url.ts`) : `Astro.site` dans un composant, `site` dans le contexte d'un endpoint, `import.meta.env.SITE` dans un `getStaticPaths` (où `Astro.site` n'existe pas). Son absence fait échouer le build ; aucun repli sur `Astro.url`.

### Données des pages : lecteur / modèle

Chaque page a deux fichiers dans `src/lib/pages/` (ADR-0014) :

| Fichier           | Rôle                                                                                                                                                                                                                                                                | Testé                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `<page>.ts`       | **Lecteur** : seul point d'accès aux collections pour la page (`getEntry`, `getCollection`, `render`, `getImage`). Passe les entrées brutes et les libellés au modèle, puis ajoute le JSON-LD (`WithJsonLd<Model>`) ou fournit `getStaticPaths` (`get<Page>Paths`). | non (I/O Astro, couvert par l'e2e)      |
| `<page>-model.ts` | **Modèle** : fonction pure `build<Page>Model(input)`, sans import Astro à l'exécution (types seulement). Lit les sections obligatoires, trie, filtre, construit les cartes et le fil d'Ariane.                                                                      | oui (`tests/unit/<page>-model.test.ts`) |

Briques partagées :

- `types.ts` : types de données de page (`PageData`, `PageSection`, `PageAction`, `QuoteData`) et `WithJsonLd<T>` (modèle + nœuds schema.org passés à la prop `jsonLd` des layouts). Import de type uniquement.
- `sections.ts` : `readSections(sections, KEYS, pageId)` lit d'un coup les sections obligatoires déclarées par un tableau `<PAGE>_SECTION_KEYS` et renvoie un objet typé par ces clés.
- `breadcrumb-trail.ts` : `breadcrumbTrail(homeLabel, ...items)`, fil d'Ariane depuis l'accueil (même tableau pour le composant `Breadcrumbs` et le `BreadcrumbList`).
- `page.ts` : `getPageData(id)`, lecteur générique d'une entrée `pages` (404, styleguide, pages simples).
- `ContentError` (`src/lib/content.ts`) : erreur levée par `requireEntry`, `requireSection` et les modèles quand un contenu attendu manque ; elle fait échouer le build avec le fichier et la clé en cause.

Une page ne fait donc qu'un appel (`getXxxData(origin)` ou `getStaticPaths = getXxxPaths`) et passe le résultat aux blocs. Ajouter une page : déclarer ses sections dans `src/content/pages/<page>.md`, écrire `<page>-model.ts` et son test, puis le lecteur `<page>.ts`.

### Fichiers pour les robots (endpoints statiques)

Les fichiers texte destinés aux robots sont des **endpoints statiques** `src/pages/<nom>.txt.ts` (`export const GET: APIRoute`), pré-rendus au build dans `dist/<nom>.txt`. Ils ne contiennent aucune logique : le contenu est produit par les fonctions pures de `src/lib/crawlers.ts` (testées dans `tests/unit/crawlers.test.ts`) ; l'URL absolue vient de `site` (`astro.config.mjs`) par `requireSiteOrigin`, dont l'échec fait échouer le build. Décisions : ADR-0011.

| Endpoint                  | Fonction                                                 | Contenu                                                                                      |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/pages/robots.txt.ts` | `buildRobotsTxt`                                         | Tout autorisé, sans `Disallow`, sitemap absolu.                                              |
| `src/pages/llms.txt.ts`   | `buildLlmsTxt` (+ `lib/pages/llms.ts` / `llms-model.ts`) | Résumé Markdown llmstxt.org : pages, prestations, réalisations, articles publiés, sans prix. |

Même mécanisme pour le **sprite d'icônes** `src/pages/icons.[version].svg.ts` → `dist/icons.<version>.svg` : `buildIconSprite` (`src/lib/icon-sprite.ts`, testé dans `tests/unit/icon-sprite.test.ts`) assemble un `<symbol>` par tracé de `src/components/ui/icons.ts` ; `Icon.astro` le référence par `<use href="/icons.<version>.svg#nom">` (`ICON_SPRITE_URL`). La version est le début de l'empreinte SHA-256 du sprite (`iconSpriteVersion`) : l'URL change avec le contenu, d'où un cache navigateur immuable d'un an (`vercel.json`) au lieu d'une revalidation à chaque page. Les pages n'embarquent plus les tracés : l'accueil tient sous 14 Kio gzip (fenêtre TCP initiale), contrôlé par `tests/e2e/html-budget.spec.ts`.

### Configuration (`src/config/`)

| Fichier        | Contenu                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site.ts`      | Source de vérité unique : nom, NAP, `registration.siret` et `registration.legalAddress` (pages légales seulement), horaires, zone, réseaux, `mainNav`, `headerCta`, `legalNav`, `pricing.showPrices`. |
| `microcopy.ts` | Tous les libellés d'interface : lien d'évitement, `aria-label` des navigations, menu mobile, titres et textes du pied de page.                                                                        |
| `seo.ts`       | Valeurs SEO par défaut et image OG (réservé aux composants : importe une image).                                                                                                                      |
| `media.ts`     | Visuels de mise en page hors contenu : héros de l'accueil et de « Visualisation 3D », portrait (importe des images : jamais lu par `lib/`).                                                           |

Les corps Markdown ne recopient pas non plus ces données : les jetons `{email}`, `{phone}`, `{phoneE164}`, `{siret}` et `{legalAddress}` y sont remplacés au rendu (§ Gabarit des corps Markdown).

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
- **Lecture des collections** : jamais dans une route. Le lecteur `src/lib/pages/<page>.ts` appelle `requireEntry(await getEntry('pages', id), 'pages', id)` (pas de `!`) ou `getPageData(id)` ; le modèle pur applique `sortByOrder`, `filterPublished` (articles) et `filterByPage` (témoignages, FAQ) de `src/lib/content.ts` et lit les sections avec `readSections` (§ Données des pages).

### Gabarit des corps Markdown

Le corps des fichiers `.md` (pas des `.mdx`) passe par le plugin Sätteri `contentTemplatePlugin` (`src/lib/content-template.ts`, branché dans `astro.config.mjs` → `markdown.processor`) avant d'être analysé (ADR-0016) :

- **Jetons** : `{email}`, `{phone}` (affichage), `{phoneE164}` (lien `tel:`), `{siret}`, `{legalAddress}`, valeurs de `src/config/site.ts` (`siteTemplateVariables`). Ils fonctionnent aussi dans les URL : `[{email}](mailto:{email})`. Un jeton inconnu fait échouer le build.
- **Blocs selon le mode du formulaire** (`resolveFormTarget`, ADR-0003) : `{formulaire:service}` … `{/formulaire}` n'est publié que si `PUBLIC_FORM_ENDPOINT` est défini, `{formulaire:mailto}` … `{/formulaire}` seulement en repli `mailto:`. Marqueurs seuls sur leur ligne, entourés de lignes vides, sans imbrication. Utilisé par la politique de confidentialité.
- Le contexte (mode, valeurs) fait partie de la configuration Astro : le changer vide le cache du Content Layer.

### Nommage des fichiers

- Un fichier = une entrée ; **le nom du fichier est le slug de l'URL** : minuscules, sans accents, mots séparés par des tirets (`chalet-suisse.md`, `bien-choisir-sa-peinture.mdx`). Le renommer change l'URL : prévoir une redirection 301 dans `vercel.json`.
- Dans les fichiers YAML, la clé de chaque entrée suit la même règle (`sebastien-t`).
- Images d'un projet : `src/assets/projets/<slug>/` (`01-avant.jpg`, `02-3d-salon.jpg`, `03-apres.jpg`…) ; images d'un article : `src/assets/articles/<slug>/`. En attendant les originaux : `src/assets/placeholders/` (listés dans son `README.md`).
- Aucun texte de la forme `TODO(contenu): …` ne doit rester dans une page publiée. Dans les trois pages légales, le moindre `TODO(contenu)` (même en commentaire YAML) fait échouer le build de production Vercel (§ Déploiement, ADR-0015).

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

| Script              | Chargé par                      | Rôle                                                                                                                                                                                                  | Poids (gzip) |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `lifecycle.ts`      | importé par tous                | `onPageReady(signal)`                                                                                                                                                                                 | 0,2 Ko       |
| `header.ts`         | `BaseLayout` (toutes)           | IntersectionObserver sur un repère à 80 px → `data-compact`                                                                                                                                           | 0,3 Ko       |
| `mobile-nav.ts`     | `BaseLayout` (toutes)           | Confort du menu mobile (Popover API native)                                                                                                                                                           | 0,5 Ko       |
| `reveal.ts`         | `BaseLayout` (toutes)           | Apparitions au scroll et image reveal (`data-reveal`, liées au défilement si `view()`, sinon IntersectionObserver ; une liste = un bloc ; hors écran uniquement, rien en mouvement réduit ; ADR-0013) | 0,6 Ko       |
| `magnetic.ts`       | `BaseLayout` (toutes)           | CTA magnétique (`[data-magnetic]`, pointeur fin, ≤ 6 px)                                                                                                                                              | 0,7 Ko       |
| `marquee.ts`        | `Marquee` (accueil)             | Bouton pause / lecture, pause hors écran                                                                                                                                                              | 0,4 Ko       |
| `project-filter.ts` | `ProjectFilters` (Réalisations) | Filtre par type de pièce, `aria-pressed`, annonce du nombre                                                                                                                                           | 0,5 Ko       |
| `lightbox.ts`       | `Lightbox` (pages projet)       | Visionneuse `<dialog>` : ouverture et fermeture reportées après le rendu (INP), image à la demande, ← →, retour du focus                                                                              | 1,1 Ko       |
| `before-after.ts`   | `BeforeAfter` (si paire)        | Comparateur : valeur, `aria-valuetext`, pointeur et tactile                                                                                                                                           | 0,8 Ko       |
| `contact-form.ts`   | `ContactForm` (`/contact/`)     | Validation et envoi `fetch`, repli HTML sans JS                                                                                                                                                       | 1,4 Ko       |
| _prefetch d'Astro_  | toutes                          | Préchargement au survol                                                                                                                                                                               | 1,1 Ko       |

Poids total mesuré par page (gzip, audit performance de la Phase 7, hors script inline de 153 octets) : 2,8 Ko sur les pages simples, 3,2 Ko sur l'accueil, 3,9 Ko sur les fiches projet, 4,2 Ko sur `/contact/`, 5,1 Ko sur `/styleguide/` (tous les scripts). Budget : 30 Ko.

- Interdits : `console.*`, écouteur `scroll` (préférer IntersectionObserver), état d'animation présent dans le HTML initial (il est posé par le script, ou par du CSS sous `.js`).

## Tests

- `tests/unit/` (Vitest, `npm run test`) : fonctions pures de `src/lib/` (dont `content-template.test.ts`, qui rend aussi du Markdown par Sätteri avec le plugin, et `release-guard.test.ts`).
- Gabarit Markdown (ADR-0016) : `tests/e2e/pages.spec.ts` vérifie les coordonnées de `site.ts` dans les pages légales, le texte du repli `mailto:` de `/confidentialite/` et l'absence de tout jeton ou marqueur dans les HTML de `dist/` ; `tests/e2e-service/privacy.spec.ts` vérifie le texte du mode service.
- `tests/e2e/` (Playwright + axe, `npm run test:e2e`, `playwright.config.ts`) : build de production `dist/` servi sur le port 4321, projets mobile (Pixel 7) et desktop. Ce build n'a pas de `PUBLIC_FORM_ENDPOINT` : le formulaire de contact y est en repli `mailto:`.
- CSP (ADR-0012) : `tests/e2e/csp.spec.ts` vérifie la politique et les empreintes de chaque page et l'absence de violation, au chargement et pendant les interactions ; aucun test n'injecte de balise `<style>` ou `<script>` (CSSOM `adoptedStyleSheets` à la place). `tests/e2e/smoke.spec.ts` : aucune erreur console sur toutes les pages, fichiers `/_astro/` cités présents, liens externes en https avec `rel="noopener noreferrer"`.
- `tests/e2e-service/` (`npm run test:e2e:service`, `playwright.service.config.ts`) : formulaire de contact **en mode service** (ADR-0003). Build distinct dans `dist-service/` (ignoré par git, ESLint, Prettier et TypeScript) avec `PUBLIC_FORM_ENDPOINT=https://formulaire.test/envoi` passé par `webServer.env`, servi sur le port 4322, projet desktop seul. Vérifie la destination, la mention d'information du service et le champ piège (`_honeypot` : `tabindex="-1"`, `autocomplete="off"`, conteneur `aria-hidden`, hors tabulation, envoyé vide avec et sans JS). L'endpoint est intercepté, aucune requête externe ne part. En CI, lancé dans le job `e2e` après la suite principale ; rapport HTML dans `playwright-report/service/`.
- `tests/unit/nginx-redirects.test.ts` : le générateur `scripts/nginx-redirects.ts` (configuration nginx de l'image Docker tirée de `vercel.json`) rejoué contre la simulation Vercel `resolveRedirect()` : mêmes codes (308), même casse, même ordre, mêmes en-têtes ; refus des règles non traduisibles.
- `tests/conformance/` (`npm run test:conformance -w @amg/site`, `vitest.conformance.config.ts`, hors `verify`) : image Docker du site lancée avec les contraintes de production (lecture seule, sans capacités, 64 Mo) ; redirections, en-têtes, 404, cache `/_astro/`, gzip. Avec `VERCEL_REFERENCE_URL`, comparaison en direct d'un échantillon avec Vercel. Prérequis : `docker build -f apps/site/Dockerfile -t amg-site:local .`.
- `tests/visual/` (`npm run test:visual`, `test:visual:update`, `playwright.visual.config.ts`) : régression visuelle `toHaveScreenshot` pleine page de 11 pages clés en mobile (390×844) et desktop (1440×900). Build distinct dans `dist-visual/` (ignoré par git, ESLint, Prettier et TypeScript), port 4338. **Hors CI et hors `test:e2e`** : le rendu des polices dépend de la machine, les références locales échoueraient sur le runner. Mode d'emploi et mise à jour des références : `tests/visual/README.md`.

## Configuration

- `astro.config.mjs` : `site: 'https://amgdecorationdinterieur.com'`, `trailingSlash: 'always'`, `output: 'static'`, intégrations `sitemap` (filtre des pages `noindex`, `lastmod` des articles lu dans leur frontmatter par `src/lib/article-files.ts` et `src/lib/sitemap-lastmod.ts`, importés sans alias ; les mêmes fichiers donnent les routes d'articles passées à `siteRoutes()`, assemblées dans `tests/site-routes.ts`) (+ `mdx`), `prefetch`, Fonts API, `image` (formats/qualités).
- `astro.config.mjs` → `security.csp` : Content-Security-Policy en balise meta, empreintes des scripts et styles calculées au build ; directives et empreintes des scripts `is:inline` fournies par `src/lib/csp.ts`, origine de `PUBLIC_FORM_ENDPOINT` autorisée si elle est définie ; intégration `amg:csp-par-page` (hook `astro:build:done`) qui réduit les empreintes de chaque page à celles de ses éléments inline (`pruneCspHashes`, ADR-0012).
- `vercel.json` (**racine du dépôt**) : `framework: astro`, `buildCommand` du workspace (`npm run build --workspace=@amg/site`, sans Nx) et `outputDirectory: apps/site/dist`, vérifiés par `tests/unit/vercel-build.test.ts` ; redirections permanentes (308, ADR-0008), en-têtes de sécurité (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, CSP d'en-tête limitée à `frame-ancestors`/`base-uri`/`object-src`), vérifiés par `tests/unit/security-headers.test.ts` ; cache immuable `/_astro/*` et `/icons.<version>.svg` (URLs versionnées par empreinte, vérifié par le même test).
- `astro.config.mjs` → `markdown.processor` : Sätteri (processeur par défaut d'Astro 7) avec le plugin `contentTemplatePlugin` (§ Gabarit des corps Markdown, ADR-0016).
- `astro.config.mjs` → intégration `amg:garde-fou-production` (hook `astro:build:start`) : si `VERCEL_ENV` vaut `production` **et** que `VERCEL_PROJECT_PRODUCTION_URL` désigne le vrai domaine (`isReleaseGuarded`), échec du build tant qu'un `TODO(contenu)` reste dans les pages légales (ADR-0015 révisée).
- `scripts/check-prod.ts` (`npm run check:prod`, exécuté directement par Node) : le même contrôle en local, quel que soit l'environnement. Ne pas confondre avec `src/scripts/` (JS client).
- `tsconfig.json` : `astro/tsconfigs/strictest` + alias `@/*`.
- Racine du dépôt : `nx.json` (§ Monorepo), `eslint.config.js` (base partagée), `stylelint.config.mjs`, Prettier, `vercel.json`, `.github/workflows/ci.yml`.

## Déploiement

GitHub → Vercel : chaque push sur `dev` = preview ; merge dans `main` (humain) = production. La CI GitHub Actions (`.github/workflows/ci.yml`) doit être verte avant tout merge. Le cache des images optimisées par Astro (`apps/site/node_modules/.astro/assets`) est conservé entre les runs (`actions/cache`, clé : `package-lock.json`, `apps/site/astro.config.mjs` et `apps/site/src/assets/`) : le job `verify` l'écrit, le job `e2e` le relit. Sans lui, chaque build régénère les ~2 200 variantes (~6 min).

Vercel lit `vercel.json` **à la racine du dépôt** : le **Root Directory** du projet Vercel reste **vide**, `buildCommand` construit le workspace `@amg/site` sans passer par Nx (aucun cache Nx ne peut resservir un build fait avec d'autres variables) et `outputDirectory` pointe sur `apps/site/dist`. Installation par défaut (`npm install` à la racine, workspaces compris).

**VPS (préparé, CRM 2 ; bascule du site en CRM 8)** : image `apps/site/Dockerfile` (copie de `apps/site/dist` déjà construit et vérifié par la CI, servi par nginx non root, configuration générée depuis `vercel.json`), publiée sur GHCR par `.github/workflows/deploy.yml` après analyse Trivy et test de conformité ; projets Compose `deploy/compose.yaml` (+ `compose.staging.yaml`), scripts `deploy/bin/` (déploiement sans coupure et retour arrière par digest, commande SSH forcée, sauvegardes, surveillance, test de restauration sur le poste de l'humain, restauration d'incident), slice systemd `deploy/systemd/amg.slice` (plafond de 4 Gio pour tout AMG) et garde-fou de budget en CI `deploy/ci/check-budget.sh`. Exploitation : `docs/EXPLOITATION.md` ; hébergement : ADR-0020.

**Garde-fou de mise en production** (ADR-0015) : le build de production Vercel qui sert le vrai domaine (`VERCEL_ENV=production` et `VERCEL_PROJECT_PRODUCTION_URL` = `amgdecorationdinterieur.com`) échoue tant qu'un `TODO(contenu)` reste dans `mentions-legales.md`, `conditions-generales.md` ou `confidentialite.md` ; le message liste chaque TODO en `fichier:ligne`, et la production précédente reste en ligne. Builds locaux, CI, previews et production sur `*.vercel.app` (en `noindex`) ne sont pas concernés. Rattacher le domaine ne relance pas de build : `check:prod` vert avant, redéploiement après (`docs/MISE-EN-LIGNE.md` §3). Avant de rattacher le domaine : `npm run check:prod` (même liste, code de sortie 1 s'il en reste) et vérifier dans Vercel que les variables système sont exposées.
