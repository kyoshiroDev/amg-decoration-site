# ADR-0008 — Redirections de migration en un seul saut

- **Statut** : acceptée
- **Date** : 2026-11-18

## Contexte

La migration WordPress → Astro impose que toute URL indexée réponde 200 ou soit redirigée de façon permanente (`CLAUDE.md` §5). Le site actuel utilise des URLs avec slash final, mais sa page d'accueil lie aussi des projets **sans** slash final (`/projet-chalet`).

Avec `"trailingSlash": true` dans `vercel.json`, Vercel place sa règle d'ajout de slash **avant** les `redirects` (vérifié dans `@vercel/routing-utils`, `getTransformedRoutes`). `/projet-chalet` faisait alors deux sauts : `/projet-chalet/`, puis la fiche projet. Une chaîne de redirections dilue le signal et ralentit l'exploration.

## Décision

- `trailingSlash` est **retiré de `vercel.json`**. Côté Astro, `trailingSlash: 'always'` reste en place : les URLs générées et les canonicals gardent leur slash final.
- Chaque ancienne URL est déclarée **avec et sans** slash final, et redirige directement vers sa destination finale.
- Une **dernière règle** reproduit le comportement de Vercel pour toutes les autres URLs : un chemin sans extension et sans slash final est redirigé vers le même chemin avec `/`. `.well-known` et `_vercel` sont exclus.
- La table de référence est `src/lib/redirects.ts`. `tests/unit/redirects.test.ts` vérifie que `vercel.json` lui correspond exactement, qu'il n'y a ni doublon ni chaîne, et que chaque URL de l'inventaire du 18/11/2026 aboutit en un saut.
- Les URLs techniques WordPress (`/wp-admin/*`, `/wp-content/*`, `/wp-json/*`…) restent en **404**. Ce ne sont pas des contenus. Les rediriger créerait des soft 404, et un 410 n'apporterait rien à Google : tous les 4xx sauf 429 sont traités de la même façon.

## Conséquences

- `permanent: true` produit un **308**, que Google traite comme un 301.
- Pour ajouter une redirection, on modifie `src/lib/redirects.ts` puis on régénère `vercel.json` : le test échoue si les deux divergent.
- Perte négligeable : `/fichier.ext/` n'est plus ramené vers `/fichier.ext`.
