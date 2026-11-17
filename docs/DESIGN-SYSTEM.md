# Design system — « Atelier lumineux »

> Tenu à jour par l'agent `designer`. Toute valeur visuelle du site vient d'ici, via `src/styles/tokens.css`.

## 1. Intention

Un site qui se feuillette comme un magazine de décoration : lumineux, doux, chaleureux, raffiné. On doit **sentir les matières** (lin, bois clair, terre cuite) et **se projeter**, exactement ce que promet la 3D d'Amandine.

Mots-clés : douceur · lumière naturelle · terre cuite · éditorial · artisanal · serein · précis.

Inspirations de principe (sans jamais copier un site existant) : magazines déco (mise en page asymétrique, grandes photos plein cadre, légendes fines), studios d'architecture intérieure haut de gamme (beaucoup d'air, typographie serif expressive), céramique artisanale (arches, terre cuite, grain).

## 2. Couleurs

| Token | Hex | Usage |
|---|---|---|
| `--color-linen` | `#F8F3EC` | Fond principal |
| `--color-cream` | `#FFFCF7` | Cartes, surfaces surélevées, texte sur terracotta foncé |
| `--color-sand` | `#EFE3D3` | Sections alternées, bordures douces |
| `--color-blush` | `#F2DCD3` | Aplat pastel rose poudré (sections, pastilles) |
| `--color-sage` | `#DDE3D3` | Aplat pastel sauge |
| `--color-terracotta-500` | `#C66B4E` | Accents décoratifs, traits, icônes, grandes formes (**jamais pour du texte courant**) |
| `--color-terracotta-600` | `#B05A3D` | Fond des boutons primaires (texte crème) |
| `--color-terracotta-700` | `#9A4A30` | Liens et texte d'accent sur fonds clairs, survol des boutons |
| `--color-ink` | `#2F2622` | Texte principal (brun encre, jamais de noir pur) |
| `--color-ink-soft` | `#5E514A` | Texte secondaire, légendes |

### Contrastes vérifiés (WCAG 2.2)

| Texte \ Fond | linen | cream | sand | blush | sage |
|---|---|---|---|---|---|
| ink | 13.4 ✅ | 14.4 ✅ | 11.7 ✅ | 11.2 ✅ | 11.3 ✅ |
| ink-soft | 6.9 ✅ | 7.5 ✅ | 6.0 ✅ | 5.8 ✅ | 5.8 ✅ |
| terracotta-700 | 5.6 ✅ | 6.0 ✅ | 4.9 ✅ | 4.7 ✅ | 4.7 ✅ |
| terracotta-600 | 4.35 ⚠️ grand texte seulement | 4.7 ✅ | 3.8 ❌ | 3.7 ❌ | 3.7 ❌ |
| terracotta-500 | 3.4 ❌ décoratif / ≥ 24 px | 3.65 ❌ | ❌ | ❌ | ❌ |

- Bouton primaire : texte `cream` sur `terracotta-600` = **4.7:1 ✅** ; survol `terracotta-700` = 6.0:1.
- Texte `cream` sur `terracotta-500` = 3.65:1 → réservé aux titres ≥ 24 px.
- Focus : anneau `terracotta-700` 2 px + offset 3 px (≥ 3:1 sur tous les fonds clairs).

Règle de composition : **1 fond pastel par section**, 2 pastels maximum visibles à l'écran, terracotta ≤ 10 % de la surface.

## 3. Typographie

| Rôle | Police (proposition) | Notes |
|---|---|---|
| Affichage (H1–H3, citations) | **Fraunces** (variable, axe `SOFT` et `opsz`) | Serif chaleureuse et expressive ; italique pour les mots émotionnels (« *chez vous* »). |
| Texte, interface | **Manrope** (variable) | Sans-serif nette, très lisible. |

Chargées via la Fonts API d'Astro (auto-hébergées, sous-ensemble latin, `woff2`). Le `designer` peut proposer une alternative (ex. Cormorant / DM Sans) par ADR.

Échelle fluide (`clamp()`), ratio ~1.25 :

| Token | Mobile → Desktop |
|---|---|
| `--step--1` | 0.875 → 0.95 rem (légendes) |
| `--step-0` | 1 → 1.125 rem (texte) |
| `--step-1` | 1.25 → 1.5 rem |
| `--step-2` | 1.56 → 2 rem |
| `--step-3` | 1.95 → 2.8 rem |
| `--step-4` | 2.44 → 4 rem |
| `--step-5` | 3 → 6 rem (H1 héro) |

Interligne texte 1.65, titres 1.05–1.15 ; longueur de ligne 60–72 caractères ; `text-wrap: balance` sur les titres, `pretty` sur les paragraphes. Surtitres : Manrope 0.8 rem, capitales, `letter-spacing: .14em`, couleur `terracotta-700`.

## 4. Espacements, grille, formes

- Espacements fluides : `--space-3xs` → `--space-3xl` (échelle Utopia), sections : `--space-section` = `clamp(4rem, 10vw, 9rem)`.
- Conteneur : `--container-max: 1320px`, gouttières `clamp(1.25rem, 4vw, 3rem)` ; variante étroite 760 px pour la lecture.
- Grille 12 colonnes desktop, mises en page volontairement asymétriques (7/5, 5/7, image qui déborde du conteneur).
- Rayons : `--radius-sm: 6px`, `--radius-md: 14px`, `--radius-lg: 28px`, `--radius-arch: 999px 999px 0 0` (**arche**, signature visuelle).
- Ombres chaudes et diffuses : `--shadow-soft: 0 20px 50px -20px rgb(47 38 34 / .18)`.
- Grain : SVG `feTurbulence` en fond du `body`, opacité 0.035, `pointer-events: none`.
- Ornements : fins traits terracotta (1 px), petites arches/pastilles en filigrane, numéros d'étapes en Fraunces italique géante semi-transparente.

## 5. Motion

| Token | Valeur |
|---|---|
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` |
| `--ease-in-out` | `cubic-bezier(.65, 0, .35, 1)` |
| `--dur-fast` | 180 ms (survols) |
| `--dur-base` | 450 ms (apparitions) |
| `--dur-slow` | 800 ms (révélations d'images, zoom) |

Catalogue d'effets autorisés :
1. **Reveal** : `opacity 0→1` + `translateY(20px→0)`, stagger 70 ms, déclenché à 15 % de visibilité, une seule fois.
2. **Image reveal** : `clip-path: inset(100% 0 0 0) → inset(0)` + léger `scale(1.08→1)`.
3. **Hover image** : `scale(1.04)` sur 800 ms dans un conteneur `overflow: hidden`.
4. **Avant/Après 3D** : poignée ronde terracotta, étiquettes « Rendu 3D » / « Réalisé », clavier + tactile.
5. **View Transitions** : fondu croisé par défaut ; `transition:name` sur le visuel d'un projet entre grille et page détail.
6. **Header** : passe de transparent à `linen` translucide (`backdrop-filter`) et se compacte après 80 px de scroll.
7. **Liens** : soulignement qui se dessine de gauche à droite.
8. **Marquee** : bandeau de mots en Fraunces italique, défilement lent, en pause au survol et désactivé si mouvement réduit.

`prefers-reduced-motion: reduce` ⇒ effets 1, 2, 5, 8 remplacés par un simple fondu ≤ 150 ms ou supprimés.

## 6. Composants (inventaire cible)

`ui/` : Button (primary, secondary, ghost, link) · Link · Heading · Eyebrow · Tag · Icon (SVG inline) · Container · Section (variantes de fond) · ArchImage · Divider.

`blocks/` : Hero (accueil, avec arche et accroche) · PageHero · ServiceCard · ServicesGrid · ProjectCard · ProjectGrid (filtres par type de pièce, sans JS lourd) · ProjectGallery + Lightbox · BeforeAfter · ProcessSteps (6 étapes) · Benefits3D (8 bénéfices) · Values · Testimonials · Quote (Charles Eames) · CtaBanner · ContactForm · FaqList · Marquee · InstagramStrip (images locales, pas d'embed tiers) · ArticleCard.

Une page `/styleguide` (`noindex`, exclue du sitemap) présente tous les tokens et composants : c'est la référence visuelle du `designer` et du `reviewer`.
