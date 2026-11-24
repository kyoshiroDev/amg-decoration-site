# @amg/shared-tokens

Tokens de design communs à toutes les apps du monorepo : couleurs (fonds de l'ancien site, ADR-0017 ; accent terracotta doux, ADR-0018), typographie, espacements, rayons, ombres, durées.

- Seul fichier autorisé à contenir des couleurs littérales (Stylelint `color-no-hex`).
- Contrastes WCAG vérifiés par `apps/site/tests/unit/palette-contrast.test.ts`.
- Les familles de polices `--font-display` et `--font-body` sont fournies par chaque app (Fonts API d'Astro pour le site).

Utilisation : `@import url('@amg/shared-tokens/tokens.css');` (CSS) ou `import tokens from '@amg/shared-tokens/tokens.css?raw';` (Vite).
