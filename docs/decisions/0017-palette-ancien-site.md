# ADR-0017 — Palette de l'ancien site : beige, grège et camel doré

- **Statut** : acceptée
- **Date** : 2026-11-21

## Contexte

Le cadrage initial (`docs/BRIEF.md`, CLAUDE.md §1 et §4) retenait une palette « pastel + terracotta » : le brief indique qu'Amandine aime les couleurs pastel et le terracotta. Le design system a été construit ainsi (lin, rose poudré, sauge, sable, terracotta).

Le 2026-11-21, **l'humain a tranché** : le nouveau site doit reprendre la palette de l'**ancien site d'Amandine**, pour une continuité visible de sa marque. Le terracotta est supprimé. L'humain a explicitement accepté que CLAUDE.md §1 et §4 et la documentation soient mis à jour ; `docs/BRIEF.md` (document de l'humain) reste inchangé et garde la trace du souhait initial.

Palette relevée sur l'ancien site (thème Elementor et couleurs réellement utilisées, par fréquence) : camel doré `#C4A882` (texte, filets, fonds de boutons), variantes `#A8916A` / `#C8A27A`, brun profond `#663601` ; fonds beige `#EEE3D6`, crème `#F3EFEC` / `#FAF8F5` / `#F6F3EE` / `#FCFAF8`, grège `#DEDAD4` / `#E0D7CE` ; boutons gris chaud `#9B9994` ; texte gris `#6B6B6B` / `#7A7A7A`, noir doux `#1D1D1D` ; touche de vieux rose `#DA9393`.

Contrainte bloquante : WCAG 2.2 AA (CLAUDE.md §6). Sur l'ancien site, le camel `#C4A882` servait au texte et aux fonds de boutons avec un contraste d'environ 2:1, sous le seuil de 4,5:1.

## Options envisagées

1. **Garder la palette pastel + terracotta** : cohérente avec le brief, mais en rupture avec l'identité que les clientes d'Amandine connaissent. L'humain l'a écartée.
2. **Mélange** : fonds de l'ancien site et terracotta en accent. Deux familles chaudes concurrentes (camel et terre cuite), une identité moins nette, et toujours pas la marque d'origine.
3. **Remplacer entièrement** par la palette de l'ancien site, en dérivant des teintes plus foncées pour tout ce qui doit être lu (texte d'accent, boutons, erreurs, contours).

## Décision

**Option 3**, avec la cible validée par l'humain.

| Token               | Hex       | Rôle                                                               |
| ------------------- | --------- | ------------------------------------------------------------------ |
| `--color-cream`     | `#FAF8F5` | Fond principal                                                     |
| `--color-ivory`     | `#FFFDFA` | Cartes, champs, texte sur boutons                                  |
| `--color-beige`     | `#EEE3D6` | Sections alternées, pied de page                                   |
| `--color-greige`    | `#DEDAD4` | Sections alternées                                                 |
| `--color-rose-100`  | `#F3E4E0` | Vieux rose très clair dérivé de `#DA9393`, une touche par page     |
| `--color-camel-300` | `#C4A882` | Camel doré d'origine : décor seulement (filets, arches, ornements) |
| `--color-camel-600` | `#7A6440` | Fond des boutons primaires                                         |
| `--color-camel-700` | `#6B5636` | Liens, texte d'accent, survol, anneau de focus                     |
| `--color-rose-700`  | `#9A4343` | Erreurs de formulaire                                              |
| `--color-ink`       | `#3A3530` | Texte principal (gris-brun)                                        |
| `--color-ink-soft`  | `#5C544C` | Texte secondaire                                                   |
| `--color-taupe`     | `#7A7168` | Contours des contrôles                                             |

- Les tokens qui portaient l'ancien nom de couleur sont **renommés** (`terracotta-*` → `camel-*`, `blush` → `rose-100`, `sage` → `greige`, `sand` → `beige`, `linen` → `cream`, ancien `cream` → `ivory`), ainsi que les valeurs de la prop `background` des sections et `tone` des pastilles. Les composants continuent d'utiliser les rôles (`--color-action`, `--color-accent-text`, `--color-border-control`…).
- Erreurs : le camel n'a pas de valeur d'alerte ; elles passent en vieux rose foncé (`rose-700`), toujours doublé d'un texte et d'un pictogramme.
- Fonds de section : alternance crème / ivoire / beige / grège ; le vieux rose est réservé à une section par page (avantages de la 3D, offres complémentaires, appel final de « À propos ») et à la pastille « La plus demandée ».

## Contrastes (WCAG 2.x, mesurés par `src/lib/color-contrast.ts`, tronqués au centième)

- Texte `ink` : 8.71 à 11.94 ; `ink-soft` : 5.33 à 7.31 ; `camel-700` : 5.01 à 6.87 ; `rose-700` : 4.63 à 6.34 sur les cinq fonds (cream, ivory, beige, greige, rose-100) : **AA partout**.
- Bouton : `ivory` sur `camel-600` = 5.55, sur `camel-700` (survol) = 6.87.
- Focus `camel-700` ≥ 5.01 et contour `taupe` ≥ 3.43 sur tous les fonds (seuil 3:1).
- `camel-300` : 1.62 à 2.23 : jamais de texte ni d'élément porteur d'information.
- `camel-600` échoue comme texte sur beige (4.45) et grège (4.05) : il ne sert qu'en fond de bouton.

Ces seuils sont **testés** (`tests/unit/palette-contrast.test.ts`, qui lit `tokens.css` et résout les rôles) et recalculés dans `/styleguide/`.

## Conséquences

- Positives : continuité visuelle avec l'ancien site d'Amandine ; une seule famille chaude (camel), plus sobre et plus « architecture intérieure » ; accessibilité meilleure que l'original (texte d'accent et boutons ≥ 4.5:1).
- Négatives : les placeholders raster (`src/assets/placeholders/`, image OG par défaut) gardent des touches terracotta jusqu'à leur remplacement par les visuels d'Amandine ; les références de régression visuelle sont régénérées ; le brief et le design system divergent sur la palette (le brief garde le souhait initial, l'ADR fait foi).
- CLAUDE.md §1 et §4, `docs/DESIGN-SYSTEM.md`, le favicon et le README sont mis à jour dans la même livraison.
