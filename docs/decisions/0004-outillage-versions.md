# ADR-0004 — Versions de l'outillage et dépôt GitHub

- **Statut** : acceptée
- **Date** : 2026-11-17

## Contexte

Lors de l'initialisation (Phase 0), plusieurs versions « dernières stables » se sont révélées incompatibles entre elles, et le nom de dépôt prévu était déjà pris.

## Décisions

1. **Astro 7.4.12**, qui exige Node ≥ 22.23.4. `.nvmrc` vise **Node 24** (CI et Vercel) ; `engines.node` dans `package.json` reprend le minimum d'Astro.
2. **TypeScript 6.0.x** (et non 7.x) : `typescript-eslint` 8.x et `@astrojs/check` n'acceptent pas encore TypeScript 7.
3. **ESLint 10** avec **`eslint-plugin-jsx-a11y-x`** (fork maintenu par es-tooling) à la place de `eslint-plugin-jsx-a11y`, qui ne déclare pas la compatibilité ESLint 10. `eslint-plugin-astro` 3.x prend officiellement en charge ce fork (`astro.configs['jsx-a11y-strict']`). Les règles sont les mêmes, l'esprit de `CLAUDE.md` §2 (« jsx-a11y ») est respecté.
4. **Dépôt GitHub public `kyoshiroDev/amg-decoration-site`** : le nom `amg-decoration` est déjà occupé par un ancien dépôt (mars 2026) qu'on ne réécrit pas (push forcé interdit). Visibilité publique validée par l'humain.
5. **CSP** reportée à la Phase 7 : elle doit être validée sur un déploiement Vercel réel (le serveur `astro preview` n'applique pas les en-têtes de `vercel.json`). Les autres en-têtes de sécurité sont posés dès la Phase 0.

## Conséquences

- Revoir TypeScript 7 et `eslint-plugin-jsx-a11y` dès que leurs écosystèmes seront compatibles.
- L'ancien dépôt `amg-decoration` reste intact ; l'humain décidera de l'archiver.
