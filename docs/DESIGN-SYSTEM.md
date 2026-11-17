# Design system — « Atelier lumineux »

> Tenu à jour par l'agent `designer`. Toute valeur visuelle du site vient d'ici, via `src/styles/tokens.css`.

## 1. Intention

Un site qui se feuillette comme un magazine de décoration : lumineux, doux, chaleureux, raffiné. On doit **sentir les matières** (lin, bois clair, terre cuite) et **se projeter**, exactement ce que promet la 3D d'Amandine.

Mots-clés : douceur · lumière naturelle · terre cuite · éditorial · artisanal · serein · précis.

Inspirations de principe (sans jamais copier un site existant) : magazines déco (mise en page asymétrique, grandes photos plein cadre, légendes fines), studios d'architecture intérieure haut de gamme (beaucoup d'air, typographie serif expressive), céramique artisanale (arches, terre cuite, grain).

## 2. Couleurs

| Token                    | Hex       | Usage                                                                                 |
| ------------------------ | --------- | ------------------------------------------------------------------------------------- |
| `--color-linen`          | `#F8F3EC` | Fond principal                                                                        |
| `--color-cream`          | `#FFFCF7` | Cartes, surfaces surélevées, texte sur terracotta foncé                               |
| `--color-sand`           | `#EFE3D3` | Sections alternées, bordures douces                                                   |
| `--color-blush`          | `#F2DCD3` | Aplat pastel rose poudré (sections, pastilles)                                        |
| `--color-sage`           | `#DDE3D3` | Aplat pastel sauge                                                                    |
| `--color-terracotta-500` | `#C66B4E` | Accents décoratifs, traits, icônes, grandes formes (**jamais pour du texte courant**) |
| `--color-terracotta-600` | `#B05A3D` | Fond des boutons primaires (texte crème)                                              |
| `--color-terracotta-700` | `#9A4A30` | Liens et texte d'accent sur fonds clairs, survol des boutons                          |
| `--color-ink`            | `#2F2622` | Texte principal (brun encre, jamais de noir pur)                                      |
| `--color-ink-soft`       | `#5E514A` | Texte secondaire, légendes                                                            |
| `--color-taupe`          | `#857870` | Filets de contrôle (contour des boutons ghost) : ≥ 3:1 sur tous les fonds clairs      |

### Rôles sémantiques (à préférer dans les composants)

| Token                                      | Pointe vers          | Usage                                            |
| ------------------------------------------ | -------------------- | ------------------------------------------------ |
| `--color-bg` / `--color-surface`           | linen / cream        | Fond de page / cartes                            |
| `--color-text` / `--color-text-soft`       | ink / ink-soft       | Texte principal / secondaire                     |
| `--color-accent`                           | terracotta-500       | **Décor uniquement** (traits, icônes, ornements) |
| `--color-accent-text`                      | terracotta-700       | Liens, italiques d'accent, surtitres             |
| `--color-action` / `--color-action-hover`  | terracotta-600 / 700 | Fond du bouton primaire / survol                 |
| `--color-on-action`                        | cream                | Texte sur fond d'action                          |
| `--color-border` / `--color-border-strong` | encre à 14 % / 32 %  | Filets neutres                                   |
| `--color-border-control`                   | taupe                | Contour des boutons ghost (≥ 3:1, WCAG 1.4.11)   |
| `--color-scrim`                            | lin à 90 %           | Fond du header compacté                          |
| `--color-backdrop`                         | encre à 28 %         | Voile derrière le menu mobile (`::backdrop`)     |

`tokens.css` est le **seul** fichier contenant des couleurs littérales (Stylelint `color-no-hex` partout ailleurs). Exception documentée : `public/favicon.svg` (fichier statique non stylé).

### Contrastes vérifiés (WCAG 2.2)

> Recalculés à chaque build par `/styleguide/` (fonctions `src/lib/color-contrast.ts`, testées) à partir de `tokens.css`.

| Texte \ Fond   | linen                         | cream   | sand    | blush   | sage    |
| -------------- | ----------------------------- | ------- | ------- | ------- | ------- |
| ink            | 13.4 ✅                       | 14.4 ✅ | 11.7 ✅ | 11.2 ✅ | 11.3 ✅ |
| ink-soft       | 6.9 ✅                        | 7.5 ✅  | 6.0 ✅  | 5.8 ✅  | 5.8 ✅  |
| terracotta-700 | 5.6 ✅                        | 6.0 ✅  | 4.9 ✅  | 4.7 ✅  | 4.7 ✅  |
| terracotta-600 | 4.35 ⚠️ grand texte seulement | 4.7 ✅  | 3.8 ❌  | 3.7 ❌  | 3.7 ❌  |
| terracotta-500 | 3.4 ❌ décoratif / ≥ 24 px    | 3.65 ❌ | ❌      | ❌      | ❌      |

- Bouton primaire : texte `cream` sur `terracotta-600` = **4.7:1 ✅** ; survol `terracotta-700` = 6.0:1.
- Texte `cream` sur `terracotta-500` = 3.65:1 → réservé aux titres ≥ 24 px.
- `terracotta-500` sur `sand` / `blush` / `sage` < 3:1 (2.8 à 3.0) : **purement décoratif** sur ces fonds, ni texte (même grand) ni élément graphique porteur d'information (WCAG 1.4.11). Une icône informative (seule, sans libellé) utilise `--color-accent-text` ou `currentColor`.
- Focus : anneau `terracotta-700` 2 px + offset 3 px (≥ 3:1 sur tous les fonds clairs).
- Contour ghost : `taupe` = 3.87 (linen), 4.17 (cream), 3.38 (sand), 3.24 (blush), 3.25 (sage) — élément d'interface ≥ 3:1 partout ; jamais pour du texte courant.

Règle de composition : **1 fond pastel par section**, 2 pastels maximum visibles à l'écran, terracotta ≤ 10 % de la surface.

## 3. Typographie

| Rôle                         | Police                          | Fichiers chargés                                                         |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| Affichage (H1–H4, citations) | **Fraunces** (`--font-display`) | Statiques **300** et **400**, normal + italique (~18 Ko / ~23 Ko chacun) |
| Texte, interface             | **Manrope** (`--font-body`)     | Variable **400–700** (~25 Ko)                                            |

Chargées par la **Fonts API d'Astro** (`astro.config.mjs`, provider Fontsource), auto-hébergées dans `/_astro/fonts/`, sous-ensemble latin, `woff2`, `font-display: swap` (vérifié dans le CSS généré), polices de repli à métriques ajustées générées par Astro.

- **Choix des graisses statiques pour Fraunces** : le fichier variable Fontsource embarque les axes `opsz`/`SOFT`/`WONK` et pèse ~120 Ko (normal) + ~150 Ko (italique). Les deux graisses utilisées par le DS (300 pour les grands titres et les italiques, 400 pour les titres moyens) coûtent ~59 Ko au total pour ce qu'une page télécharge réellement (300, 400, 300 italique). Pas de gras Fraunces : un titre ne dépasse jamais 400.
- **Preload** : uniquement Fraunces 300 normal (police du H1), via `<Font cssVariable="--font-display" preload={[{ subset: 'latin', style: 'normal', weight: 300 }]} />`.
- Dans les composants, utiliser `--font-display-stack` / `--font-body-stack` (variable Astro + repli).

Échelle fluide (`clamp()`), ratio ~1.25 :

| Token       | Mobile → Desktop            |
| ----------- | --------------------------- |
| `--step--1` | 0.875 → 0.95 rem (légendes) |
| `--step-0`  | 1 → 1.125 rem (texte)       |
| `--step-1`  | 1.25 → 1.5 rem              |
| `--step-2`  | 1.56 → 2 rem                |
| `--step-3`  | 1.95 → 2.8 rem              |
| `--step-4`  | 2.44 → 4 rem                |
| `--step-5`  | 3 → 6 rem (H1 héro)         |

Échelle calculée entre 360 px et 1440 px de large. Tokens annexes : `--text-eyebrow`, `--leading-tight|heading|body|ui`, `--tracking-display|eyebrow|ui`, `--weight-light…bold`, `--measure` (66ch).

Interligne texte 1.65, titres 1.05–1.15 ; longueur de ligne 60–72 caractères ; `text-wrap: balance` sur les titres, `pretty` sur les paragraphes. Surtitres : Manrope 0.8 rem, capitales, `letter-spacing: .14em`, couleur `terracotta-700`.

### Typographie française (contenus et microcopie)

- Apostrophe : `’` (U+2019), jamais `'` dans le texte affiché. Guillemets : `« … »` avec U+00A0 à l’intérieur.
- Avant `;` `!` `?` : fine insécable U+202F. Avant `:` : insécable U+00A0. Aucune espace avant `,` et `.`.
- U+00A0 aussi dans : `9 h`, `17 h`, le téléphone (`07 82 35 81 32`), nombre + unité (`20 m²`), `n° 3`.
- Plages : tiret demi-cadratin `–` (U+2013), ex. `9 h – 17 h`. Incise : `—` (U+2014). Points de suspension : `…` (U+2026).
- Capitales accentuées : `À`, `É`, `Ç`. Ordinaux : `1ᵉʳ`, `2ᵉ`.
- Markdown et YAML : saisir les caractères réels (UTF-8). En YAML, guillemets doubles si la chaîne contient `:` ou `#`.
- `.astro` (gabarit HTML) : dans le **texte** du gabarit, entités `&nbsp;` (U+00A0) / `&#8239;` (U+202F) obligatoires (la règle ESLint `no-irregular-whitespace` refuse le caractère littéral) ; dans les **valeurs d’attribut** (`alt`, `label`…), caractère réel (une entité passée par une prop de composant serait affichée telle quelle).
- TypeScript (`src/config`, `src/lib`) : séquences d’échappement JS `\u00A0` et `\u202F`, plus visibles en relecture qu’un blanc invisible.
- Les attributs (`alt`, `aria-label`, `title`) suivent les mêmes règles que le texte visible.

## 4. Espacements, grille, formes

- Espacements fluides (Utopia, 360 → 1440 px) : `--space-3xs` (4–5 px), `2xs` (8–9), `xs` (12–14), `s` (16–18), `m` (24–27), `l` (32–36), `xl` (48–54), `2xl` (64–72), `3xl` (96–108). Paires « qui sautent » : `--space-s-l`, `--space-m-xl`, `--space-l-2xl`, `--space-xl-3xl`. Sections : `--space-section` = 64 → 144 px.
- Conteneur : `--container-max: 1320px`, `--container-narrow: 760px`, gouttières `--gutter` 20 → 48 px ; `--grid-gap` = `--space-m-xl` ; `--tap-target: 44px`.
- Points de rupture (mobile first, en `min-width` ; les custom properties ne fonctionnent pas dans `@media`, les valeurs `--bp-*` sont donc documentaires et s'écrivent littéralement, en notation de plage `(width >= 48rem)`) :

  | Token      | Valeur           | Usage                                |
  | ---------- | ---------------- | ------------------------------------ |
  | `--bp-sm`  | 40rem (640 px)   | grands mobiles                       |
  | `--bp-md`  | 48rem (768 px)   | tablettes portrait, grilles 2–3 col. |
  | `--bp-lg`  | 64rem (1024 px)  | mises en page asymétriques 7/5       |
  | `--bp-xl`  | 80rem (1280 px)  | bureau                               |
  | `--bp-2xl` | 100rem (1600 px) | grands écrans                        |

  Préférer les container queries pour les composants réutilisables.

- Grille 12 colonnes desktop, mises en page volontairement asymétriques (7/5, 5/7, image qui déborde du conteneur).
- Rayons : `--radius-sm: 6px`, `--radius-md: 14px`, `--radius-lg: 28px`, `--radius-pill: 999px`, `--radius-arch: 999px 999px 0 0` (**arche**, signature visuelle). Filets : `--border-hairline` (1 px), `--border-thin` (1.5 px).
- Ombres chaudes et diffuses : `--shadow-soft` (0 20px 50px -20px encre 18 %), `--shadow-lifted` (0 30px 70px -28px encre 26 %), `--shadow-inset-hairline` (liseré intérieur 1 px encre 8 %).
- Grain : `--grain-image` (SVG `feTurbulence` en data-URI, tuile 220 px) posé sur un pseudo-élément `body::after` **statique** (`position: absolute; inset: 0`, jamais `fixed`, jamais animé), `opacity: var(--grain-opacity)` = 0.035, `pointer-events: none`. Peint une fois avec la page, aucun coût au scroll ; il passe au-dessus des aplats de section pour une matière continue.
- Ornements : fins traits terracotta (1 px), petites arches/pastilles en filigrane, numéros d'étapes en Fraunces italique géante semi-transparente.

## 5. Motion

| Token               | Valeur                                    |
| ------------------- | ----------------------------------------- |
| `--ease-out`        | `cubic-bezier(.22, 1, .36, 1)`            |
| `--ease-in-out`     | `cubic-bezier(.65, 0, .35, 1)`            |
| `--dur-fast`        | 180 ms (survols)                          |
| `--dur-base`        | 450 ms (apparitions)                      |
| `--dur-slow`        | 800 ms (révélations d'images, zoom)       |
| `--dur-reduced`     | 150 ms (fondu de repli, mouvement réduit) |
| `--stagger`         | 70 ms                                     |
| `--reveal-distance` | 20 px                                     |
| `--hover-zoom`      | 1.04                                      |

Catalogue d'effets autorisés :

1. **Reveal** : `opacity 0→1` + `translateY(20px→0)`, stagger 70 ms, déclenché à 15 % de visibilité, une seule fois.
2. **Image reveal** : `clip-path: inset(100% 0 0 0) → inset(0)` + léger `scale(1.08→1)`.
3. **Hover image** : `scale(1.04)` sur 800 ms dans un conteneur `overflow: hidden`.
4. **Avant/Après 3D** : poignée ronde terracotta, étiquettes « Rendu 3D » / « Réalisé », clavier + tactile.
5. **View Transitions** (natives, ADR-0006) : `@view-transition { navigation: auto }` déclaré uniquement sous `prefers-reduced-motion: no-preference` (`global.css`), fondu croisé `--dur-base` / `--ease-out` ; header exclu du fondu (`view-transition-name: site-header`) ; `transition:name` sur le visuel d'un projet entre grille et page détail (Phase 5). Sans support : navigation classique.
6. **Header** : passe de transparent à `linen` translucide (`backdrop-filter`) et se compacte après 80 px de scroll.
7. **Liens** : soulignement qui se dessine de gauche à droite.
8. **Marquee** : bandeau de mots en Fraunces italique, défilement lent, en pause au survol et désactivé si mouvement réduit.

`prefers-reduced-motion: reduce` ⇒ effets 1, 2, 5, 8 remplacés par un simple fondu ≤ 150 ms ou supprimés. Un garde-fou global (`global.css`, couche `base`) ramène toutes les animations et transitions à 0.01 ms ; les composants qui veulent un fondu court le réactivent explicitement.

Liens : les liens **de texte** sont soulignés en permanence (le lien ne repose pas sur la seule couleur, WCAG 1.4.1). Les liens **autonomes** (classe `.link-draw`, composant `Link variant="draw"`) ont un trait en pseudo-élément qui se dessine de gauche à droite en `transform: scaleX()` au survol, au focus et sur `aria-current="page"`.

Focus : `:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }` — 2 px `terracotta-700`, décalage 3 px, rayon adapté au composant (pilule pour les boutons).

## 6. Composants

### Conventions CSS

- Couches : `@layer reset, base, components, utilities;` déclaré en tête de `global.css` (seul point d'entrée, importé par les layouts). Les styles scopés de chaque composant s'écrivent **dans `@layer components { … }`** : les utilitaires gagnent toujours.
- Mise en forme de la racine d'un composant enfant depuis un parent : Astro (stratégie `attribute`) ne transmet pas l'attribut de scope ; utiliser `:global(.bloc__element)` avec une classe BEM préfixée, jamais un sélecteur global générique.
- Les listes qui reçoivent une classe sont des listes de composant : sans puces via `list-style-type: ""` (reset), **pas** `none`. Avec `none`, WebKit/VoiceOver cesse d’annoncer la liste ; une chaîne vide conserve la sémantique. `role="list"` est refusé par la règle `astro/jsx-a11y/no-redundant-roles`. Seules les listes de prose gardent puces et `--measure`.
- Styles d’un composant `ui/` trop long : feuille sœur importée dans le frontmatter (ex. `ui/button.css`), toujours dans `@layer components`, classes BEM préfixées par le nom du composant.
- Aucune valeur magique : couleurs, rayons, durées, easings, espacements, graisses, interlignes et opacités viennent de `tokens.css`.

### `ui/` — usage

| Composant   | Props principales (défaut)                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`    | `variant` : `primary` \| `secondary` \| `ghost` \| `link` (`primary`) ; `href?` ; `type` (`button`) ; `icon?` / `iconStart?` ; `disabled` (`false`) ; `attrs?` (dont `popovertarget`) ; **`iconOnly` + `icon` + `label`, obligatoires ensemble**    | `<a>` si `href`, sinon `<button>`. Hauteur min. 44 px. Flèche qui glisse au survol. `link` : soulignement qui se redessine. `ghost` : fond crème, contour taupe ≥ 3:1. Icône seule : union de types, impossible sans `label` (texte masqué visuellement), bouton rond 44 × 44. Styles dans `ui/button.css`. |
| `Link`      | `href` ; `variant` **obligatoire** : `draw` (liens autonomes uniquement) \| `inline` (dans un paragraphe) ; `external` (`false`) ; `icon?` ; `iconStart?` ; `current` (`false`) ; `attrs?`                                                          | `external` ⇒ `target="_blank" rel="noopener noreferrer"`, flèche oblique visible (icône `external`, décorative) + `microcopy.newTab` masqué. `current` ⇒ `aria-current="page"`. `draw` : zone de clic étendue à 44 px de haut (`::before`).                                                                 |
| `Heading`   | `level` : 1–6 (**obligatoire**) ; `size?` : `display` \| `xl` \| `lg` \| `md` \| `sm` \| `xs` (selon le niveau) ; `id?` ; `align` (`start`)                                                                                                         | Balise et taille découplées : hiérarchie sans saut, rendu libre. `<em>` ⇒ italique Fraunces terracotta-700.                                                                                                                                                                                                 |
| `Eyebrow`   | `decorated` (`true`)                                                                                                                                                                                                                                | Rendu `<p>`, jamais un titre. Trait terracotta 32 px devant.                                                                                                                                                                                                                                                |
| `Tag`       | `tone` : `sand` \| `blush` \| `sage` \| `outline` (`sand`) ; `href?`                                                                                                                                                                                | `<span>` ou `<a>` ; la version lien étend sa zone de clic à 44 px de haut.                                                                                                                                                                                                                                  |
| `Icon`      | `name` (voir `ui/icons.ts`) ; `label?` ; `size` (`1em`, passer un token)                                                                                                                                                                            | `aria-hidden` sauf si `label` (`role="img"`). Set : arrow-right, external, phone, mail, whatsapp, instagram, facebook, pinterest, linkedin, menu, close, plus.                                                                                                                                              |
| `Container` | `width` : `normal` \| `narrow` (`normal`) ; `as` (`div`)                                                                                                                                                                                            | 1320 px / 760 px, gouttières `--gutter`. Utilitaires `.container`, `.container--narrow`.                                                                                                                                                                                                                    |
| `Section`   | `background` : `linen` \| `cream` \| `sand` \| `blush` \| `sage` (`linen`) ; `as` (`section`) ; `labelledby?` ; `spacing` : `section` \| `compact` \| `none` (`section`) ; `id?`                                                                    | Un pastel par section, deux maximum à l'écran. Donner `labelledby` (id du titre) pour une région nommée.                                                                                                                                                                                                    |
| `ArchImage` | `src` (`ImageMetadata`) ; `alt` (**obligatoire**, `""` si décorative) ; `widths` (`[360…1280]`, bornées à la largeur source) ; `sizes` ; `priority` (`false`) ; `ratio` (`4 / 5`) ; `shape` : `arch` \| `rounded` ; `framed` (`false`) ; `caption?` | `<Picture>` AVIF + WebP, repli JPEG. `priority` ⇒ `loading="eager"`, `fetchpriority="high"`, `decoding="sync"` (une seule par page). Zoom lent 1.04 au survol (désactivé si mouvement réduit). `caption` ⇒ `<figure>`.                                                                                      |
| `SiteLogo`  | `as` : `a` \| `span` (`a`) ; `current` (`false`) ; `size` : `md` \| `lg` (`md`)                                                                                                                                                                     | Logo texte provisoire (Fraunces, `site.shortName`). `a` ⇒ lien vers `/` ; `span` ⇒ `aria-hidden` (doublon décoratif). `TODO(contenu)` : logo vectoriel.                                                                                                                                                     |
| `Divider`   | `ornament` (`false`) ; `width` : `full` \| `short` (`full`)                                                                                                                                                                                         | Purement décoratif (`aria-hidden`). Ornement : double arche filaire terracotta.                                                                                                                                                                                                                             |

### `layout/` — en-tête, menus, pied de page

| Composant                                        | Rôle                                                                                                     | Notes                                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SkipLink`                                       | Lien d’évitement vers `#contenu`                                                                         | Hors écran (transform) au repos, glisse en haut à gauche au focus, `--z-skip` (au-dessus du header et du grain).                                                                                                                      |
| `Header`                                         | En-tête collant : `SiteLogo`, `MainNav` (≥ 80rem), CTA `site.headerCta` (≥ 48rem), `MobileNav` (< 80rem) | Voir « En-tête » ci-dessous.                                                                                                                                                                                                          |
| `MainNav`                                        | Navigation desktop                                                                                       | `aria-current="page"` : terracotta-700 + soulignement plein ; page enfant d’une rubrique (`isActivePath` = `section`) : trait court permanent (`--nav-section-mark`), sans `aria-current`. Zone de clic 44 px.                        |
| `MobileNav`                                      | Bouton « Menu » + panneau                                                                                | Popover API, voir « Menu mobile ».                                                                                                                                                                                                    |
| `MobileNavPanel` / `MobileNavLinks`              | Contenu du popover                                                                                       | Liens Fraunces `--step-3` légère, numéros `01…07` décoratifs en CSS (`content: counter() / ""`, non lus), page courante en italique terracotta ; en bas : CTA, téléphone, WhatsApp.                                                   |
| `Footer`                                         | Pied de page sur aplat `sand`                                                                            | Logo, accroche Fraunces `--step-2`, CTA ; arche filaire terracotta posée sur le filet des colonnes (≥ 48rem, `--footer-arch-size`) ; 4 colonnes : contact · horaires + zone · plan du site · réseaux ; bas : `FooterLegal`.           |
| `FooterColumn` / `FooterContact` / `FooterLegal` | Sous-parties du pied de page                                                                             | Titres `h2` en capitales espacées terracotta-700 + trait ; contact en `<dl>` ; liens en encre (survol terracotta), icônes de tête en `--color-accent` (décoratives) ; réseaux en `Link external` ; `#pied-navigation` = plan du site. |
| `Breadcrumbs`                                    | Fil d’Ariane (via `PageLayout`)                                                                          | `<nav><ol>`, séparateur = petite arche filaire terracotta (CSS), dernier élément `<span aria-current="page">` sans lien.                                                                                                              |

#### En-tête

- **Hauteur de mise en page fixe** (`--header-height`, 5.5rem) : le compactage ne change jamais `padding` ni `height` (tout le contenu se décalerait : CLS au scroll). Il est **visuel** : le fond (`::before` : `--color-scrim`, `backdrop-filter: blur(var(--header-blur))`, filet) se translate pour ne couvrir que `--header-height-compact` (4rem), la barre se translate de la moitié de l’écart, le logo passe à `--header-logo-compact-scale`. `transform` et `opacity` uniquement.
- **États** : sans JS (ou navigateur sans `@media (scripting)`), fond toujours visible, donc lisible. Avec JS : transparent en haut de page, puis `data-compact="true"` posé par `scripts/header.ts` quand le repère placé à `--header-compact-threshold` (80 px) sort de l’écran (IntersectionObserver, aucun écouteur de scroll).
- Barre centrée par `padding-block-start` sur le header (pas de `margin` : elle fusionnerait avec celle du header).
- Header en `pointer-events: none` sauf sa barre : la bande transparente sous la barre compacte ne capte pas les clics.
- `scroll-margin-block-start: calc(var(--header-height) + var(--space-s))` sur `main`, `footer` et leurs descendants : ni une ancre ni un élément focalisé ne passent sous le header (WCAG 2.4.11). **Pas de `scroll-padding` sur `html`** : Chromium l’applique aussi au focus des éléments de l’en-tête collant et ramène alors la page tout en haut (Maj+Tab vers l’en-tête, bouton Menu).
- `--color-scrim` à 90 % : même au-dessus d’un contenu encre, le lien courant terracotta-700 reste ≥ 4.5:1 et le liseré taupe ≥ 3:1.
- `view-transition-name: site-header` : l’en-tête ne participe pas au fondu entre pages.

#### Menu mobile

- `<button popovertarget="menu-mobile">` (nom accessible = libellé visible « Menu », sans `aria-label` : WCAG 2.5.3 ; l’état est porté par `expanded`, natif — un nom « Ouvrir le menu » contredirait l’état « développé ») et `<div id="menu-mobile" popover="auto">`. Échap, clic extérieur, `aria-expanded` et retour du focus au bouton sont **natifs**. Fermeture : `Button iconOnly` avec `popovertargetaction="hide"`.
- Panneau latéral droit `min(100%, --mobile-nav-width)` × `100dvh` (plein écran sur mobile), fond lin + grain à `--grain-opacity`, `--shadow-lifted`, voile `--color-backdrop`. Entrée : fondu + glissé de `--reveal-distance` en `--dur-base` (`@starting-style`, `allow-discrete` sur `display` et `overlay`). Mouvement réduit : garde-fou global (instantané).
- Page dessous figée pendant l’ouverture : `html:has(#menu-mobile:popover-open) { overflow: hidden; scrollbar-gutter: stable }`.
- `scripts/mobile-nav.ts` (amélioration progressive) : focus sur le premier élément à l’ouverture, fermeture si le focus quitte le panneau (Tab après le dernier élément ; Maj+Tab depuis le premier referme et rend le focus au bouton, qui serait sinon caché sous le panneau : WCAG 2.4.11), fermeture au clic sur un lien. Panneau **non modal** (navigation, pas dialogue) : ni piège ni `inert`, mais jamais ouvert quand le focus est ailleurs.
- **Repli sans Popover API** : lien « Menu » vers `#pied-navigation` affiché par défaut ; sous `@supports selector(:popover-open)`, il est masqué et le bouton apparaît. Hors support, le panneau reste `display: none`.

### Inventaire cible `blocks/`

Déjà livrés, provisoires (Phase 2) : `ProvisionalHero` (accueil temporaire, remplacé par `Hero` en Phase 4) et `NotFoundHero` (404 : arche pleine blush, liseré terracotta décalé, soleil sauge ; trois sorties primaire, secondaire, lien).

Cible :
Hero (accueil, avec arche et accroche) · PageHero · ServiceCard · ServicesGrid · ProjectCard · ProjectGrid (filtres par type de pièce, sans JS lourd) · ProjectGallery + Lightbox · BeforeAfter · ProcessSteps (6 étapes) · Benefits3D (8 bénéfices) · Values · Testimonials · Quote (Charles Eames) · CtaBanner · ContactForm · FaqList · Marquee · InstagramStrip (images locales, pas d'embed tiers) · ArticleCard.

## 7. Styleguide

`/styleguide/` (`src/pages/styleguide.astro`, `BaseLayout` en `noindex`, textes de `config/pages.ts`, exclu du sitemap) présente tous les tokens et composants : c'est la référence visuelle du `designer` et du `reviewer`. Les nuanciers, échelles, rayons, ombres, durées et ratios de contraste sont **lus dans `tokens.css` au build** (`src/lib/design-tokens.ts`, `src/lib/color-contrast.ts`) : la page ne peut pas diverger des tokens. Ses composants internes vivent dans `src/components/styleguide/` et ne sont jamais utilisés sur le site public. Test e2e : `tests/e2e/styleguide.spec.ts` (h1 unique, noindex, pas de débordement horizontal, 0 violation axe).

Favicon provisoire : arche terracotta sur fond lin (`public/favicon.svg`), en attendant le logo vectoriel.
