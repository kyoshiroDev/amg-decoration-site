# ADR-0005 — Arbitrages du design system (Phase 1)

- **Statut** : acceptée
- **Date** : 2026-11-17

## Contexte

La mise en œuvre du design system « Atelier lumineux » a demandé quatre arbitrages par rapport à `docs/DESIGN-SYSTEM.md` et `CLAUDE.md`.

## Décisions

1. **Fraunces en graisses fixes 300 et 400** (normal + italique), et non en fichier variable. Le fichier variable Fontsource embarque les axes `opsz`, `SOFT` et `WONK` : il pèse environ 121 Ko en normal et 150 Ko en italique, contre environ 18 à 23 Ko par graisse fixe. Le design system n'utilise jamais Fraunces au-delà de 400. Seule Fraunces 300 normal (police du H1) est préchargée. Manrope reste variable (400–700, environ 25 Ko). Utiliser un jour l'axe `SOFT` demandera une nouvelle ADR (environ +200 Ko).
2. **Stylelint** : deux règles sont **paramétrées**, aucune n'est désactivée.
   - `custom-property-pattern` accepte le double tiret pour les pas négatifs imposés par le design system (`--step--1`).
   - `selector-pseudo-class-no-unknown` reconnaît `:global()`, la syntaxe Astro pour cibler la racine d'un composant enfant.
3. **Dossier `src/components/styleguide/`** : il contient les sections internes de la page `/styleguide/` (`noindex`, hors sitemap), pour que la page reste un simple assemblage (`CLAUDE.md` §3). Ces composants ne sont jamais importés par une page publique. Ils lisent `tokens.css` au build (`?raw`) via des fonctions pures de `src/lib/` (`design-tokens.ts`, `color-contrast.ts`) : le styleguide ne recopie aucune valeur.
4. **`public/favicon.svg`** contient des couleurs littérales. C'est un fichier statique hors de la chaîne CSS : un SVG servi tel quel ne peut pas lire les custom properties. Cette exception à la règle « aucune couleur hors `tokens.css` » est limitée aux fichiers de `public/` (favicon, et plus tard les icônes d'application).

## Conséquences

- `CLAUDE.md` §3 et `docs/ARCHITECTURE.md` mentionnent `components/styleguide/`.
- Le provider Fontsource télécharge les polices au build : la CI et Vercel ont besoin d'un accès réseau pendant le build.
