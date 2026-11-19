# ADR-0002 — CSS natif avec design tokens (sans Tailwind)

- **Statut** : acceptée
- **Date** : 2026-11-17

## Contexte

Site à forte identité éditoriale (mises en page asymétriques, arches, typographie fluide, motion soignée). Le design doit rester cohérent et piloté par des tokens.

## Options envisagées

1. **CSS natif moderne** (custom properties, `@layer`, nesting, container queries, `clamp()`) + styles scopés Astro.
2. Tailwind CSS v4 — rapide, mais markup chargé et tentation de valeurs arbitraires qui contournent le design system.

## Décision

CSS natif. Tokens dans `src/styles/tokens.css`, couches `reset, base, components, utilities`, styles de composant scopés dans chaque `.astro`. Stylelint interdit les couleurs hexadécimales hors `tokens.css`.

## Conséquences

- Zéro dépendance CSS, contrôle total, HTML lisible.
- Discipline nécessaire : le `designer` et le `reviewer` veillent à l'usage exclusif des tokens.
