# Régression visuelle (`tests/visual/`)

> Chemins relatifs à `apps/site/` sauf mention contraire. Commandes `npm run …` à lancer depuis la racine du dépôt.

Captures pleine page de référence (`toHaveScreenshot`) des pages clés, en mobile (390×844) et
desktop (1440×900) : accueil, prestations, une fiche prestation, visualisation 3D, réalisations,
une fiche projet, à propos, conseils déco, un article, contact et 404. Les références sont dans
`__screenshots__/<projet>/<page>.png`.

## Commandes

```bash
npm run test:visual          # compare au rendu de référence
npm run test:visual:update   # régénère les références (changement visuel voulu uniquement)
```

La configuration `playwright.visual.config.ts` construit le site dans `dist-visual/` et le sert
sur le port 4338 : elle ne touche ni `dist/` ni le serveur de la suite e2e (4321). Si un serveur
écoute déjà sur 4338, il est réutilisé : l'arrêter après une modification du code pour forcer un
nouveau build.

## Mettre à jour les références

1. Vérifier que le changement visuel est voulu (ouvrir le diff dans `test-results/visual/`).
2. Lancer `npm run test:visual:update`, puis `npm run test:visual` deux fois : 0 diff attendu.
   `--update-snapshots` ne réécrit que les captures en échec : un changement de teinte léger (fonds,
   palette) reste sous le seuil par pixel de Playwright et laisserait des références périmées. Dans ce
   cas, régénérer tout : `npm run test:visual -- --update-snapshots=all`.
3. Committer les PNG avec un message qui nomme le changement visuel, par exemple
   `test(visuel): met à jour les références après la refonte du pied de page`.

## Pourquoi hors CI

Le rendu des polices et l'anticrénelage diffèrent d'une machine à l'autre : des références prises
en local échoueraient sur le runner GitHub Actions (ubuntu) sans aucune régression réelle. Ces
tests ne sont donc ni dans `npm run test:e2e` (son `testDir` est `tests/e2e/`) ni dans la CI. Ils
se lancent à la main, sur la même machine que celle qui a produit les références.

## Stabilité

- `reducedMotion: 'reduce'`, `animations: 'disabled'`, `caret: 'hide'`, `scale: 'css'`.
- Images différées passées en `loading="eager"` et décodées, polices attendues
  (`document.fonts.ready`), réseau au repos, animations terminées, retour en haut de page.
- Bandeau de mots (`[data-marquee]`) masqué.
- Grain de papier (`body::after`) retiré par une feuille CSSOM (`adoptedStyleSheets`, la CSP
  bloquerait une balise `<style>`) : ce bruit fixe triplait le poids des PNG sans aider à
  détecter une régression de mise en page.
- Tolérance : `maxDiffPixelRatio: 0.002`.
