# ADR-0021 — Outillage du monorepo Nx

- **Statut** : acceptée
- **Date** : 2026-11-24

## Contexte

L'[ADR-0019](0019-monorepo-nx-et-crm.md) décide du monorepo Nx. Il faut fixer comment Nx accueille un site Astro statique déjà en production sur Vercel, **sans aucun changement visible**, sur une machine de développement limitée en mémoire. Plan préparé par l'agent `architecte` d'après la documentation à jour de Nx (nx.dev) et de Vercel.

## Décision

- **Nx 24.0.6**, épinglé, ajouté à la main (équivalent du mode minimum de `nx init`). `nx init` n'est pas lancé : en 24.x il propose de configurer les agents IA (`CLAUDE.md`, `AGENTS.md`, `.mcp.json`) et peut réécrire des scripts.
- **Workspaces npm explicites** : `apps/*`, puis `libs/shared/*`. Scope des paquets internes : `@amg/` (privé, jamais publié).
- **Le site est un projet à scripts npm** (tâches inférées de `apps/site/package.json`), **sans plugin Astro** : il n'existe pas de plugin officiel, et `@nxtensions/astro` est abandonné (Astro ≤ 4). Pas de `project.json` : la configuration Nx du site vit dans la propriété `nx` de son `package.json`.
- **Outillage commun à la racine**, une seule version par outil (ESLint et plugins, Prettier, Stylelint, TypeScript, Vitest, Playwright, axe, LHCI, Nx) ; dépendances propres au site (Astro, intégrations, satteri, schema-dts, `@astrojs/check`) dans `apps/site`.
- **ESLint** : base partagée à la racine (`sharedConfigs`, `sharedRules`), config par projet (`apps/site/eslint.config.js`) ; **Stylelint et Prettier** uniques à la racine.
- **Réglages mémoire** : `parallel: 1`, pas de daemon, pas de TUI, `analytics: false` ; `--outputStyle=static` dans les scripts pour que les journaux restent lisibles par les agents.
- **Cache Nx** sur `build`, `check`, `test` et `lint`. Les variables qui changent le build (`PUBLIC_FORM_ENDPOINT`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`) et `vercel.json` (pour les tests de redirections et d'en-têtes) font partie des entrées.
- **Vercel** lit `vercel.json` à la racine (`framework: astro`, `buildCommand` du workspace `@amg/site`, `outputDirectory: apps/site/dist`, installation par défaut) et construit le site **sans passer par Nx** : aucun cache ne peut resservir un build fait avec d'autres variables. Le Root Directory du projet Vercel reste vide.
- **`nx affected`** reporté à l'arrivée d'une deuxième app ; la PR vers `main` vérifie tout.
- **`libs/shared/tokens`** : CSS seul, sans build, exposé par `exports`.
- Commandes `npm run …` inchangées à la racine. **Jamais `npm ci` en local** (il effacerait le cache d'images Astro `apps/site/node_modules/.astro`).

## Alternatives écartées

- `@nxtensions/astro` (abandonné) ; plugins `@nx/vite`, `@nx/playwright`, `@nx/eslint` à ce stade (cibles en double des scripts, pièces mobiles en plus).
- `vercel.json` dans `apps/site` avec un Root Directory Vercel : imposerait une action sur le tableau de bord.
- Tout garder à la racine sans workspaces : impossible d'accueillir les apps Angular et NestJS.

## Conséquences

- Premier build froid en CI et sur Vercel plus long (~6 min) : le cache d'images change de chemin.
- Le choix `tsconfig.base.json` (paths) ou mode « TS solution » (project references) se fera à la création de la première app Angular.
- `npx nx show projects` liste les projets ; `npx nx reset` vide le cache en cas de doute.
