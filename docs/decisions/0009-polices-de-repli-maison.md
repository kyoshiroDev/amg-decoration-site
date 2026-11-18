# ADR-0009 — Polices de repli à métriques ajustées, écrites à la main

- **Statut** : acceptée
- **Date** : 2026-11-18

## Contexte

La CI Lighthouse (25 pages, mobile émulé) a mesuré un CLS de 0,0597 sur `/contact/`, au-dessus du seuil de 0,05 (`CLAUDE.md` §6). Ce décalage se produit quand les polices web arrivent (`font-display: swap`).

Les replis à métriques ajustées générés par la Fonts API d'Astro ne pointent que vers `local("Times New Roman")`, `local("Arial")` et quelques polices système (Roboto, Segoe UI…). Sous Linux (runner CI) comme sous Android, aucune de ces polices n'est trouvée. La pile retombe alors sur le générique non ajusté (DejaVu, Noto), 3 à 20 % plus large : le paragraphe d'introduction de `/contact/` passe de 99 à 62 px de haut à l'arrivée de Manrope.

Par ailleurs, Astro calcule la largeur de Manrope sur l'instance ExtraLight du fichier variable : son `size-adjust` est faux d'environ 3 % à la graisse 400.

L'option `fallbacks` ne transmet que des noms de familles. Astro ne génère des métriques que pour sa liste figée (vérifié dans le code d'Astro 7.4) : on ne peut pas lui ajouter Liberation, DejaVu ou Noto.

## Décision

- `optimizedFallbacks: false` pour Fraunces et Manrope dans `astro.config.mjs`.
- Des `@font-face` de repli écrits à la main dans `src/styles/font-fallbacks.css` : une famille par jeu de métriques, avec plusieurs sources `local()` (nom complet et nom PostScript).
  - `*-fallback-sans` / `*-fallback-times` : Arial, Liberation Sans, Arimo et Roboto, ou Times New Roman, Liberation Serif et Tinos.
  - `*-fallback-noto` et `*-fallback-dejavu`.
- `size-adjust` est le rapport de largeur **mesuré dans Chrome** sur environ 6 000 caractères de textes du site, par graisse et par style. `ascent-override` et `descent-override` sont les métriques hhea de la police web divisées par `size-adjust`.

## Conséquences

- CLS de `/contact/` : de 0,066 à 0 en médiane (0,017 au maximum). Pile DejaVu forcée, celle du runner CI : de 0,036 à 0. Aucune requête supplémentaire ; +0,6 Ko gzip de CSS.
- **Si une police change** (famille, graisse, sous-ensemble), il faut recalculer les valeurs : la méthode et les métriques sources sont décrites en tête de `font-fallbacks.css`.
- Préchargement de Manrope écarté : il ajoutait 25 Ko dans la fenêtre critique, alors que ce correctif suffit.
