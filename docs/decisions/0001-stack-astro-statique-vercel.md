# ADR-0001 — Astro statique sur Vercel

- **Statut** : acceptée
- **Date** : 2026-11-17

## Contexte
Site vitrine + portfolio + blog, très visuel, objectif SEO et performance maximal, pas de besoin de back-end en V1, maintenance par une petite équipe assistée par Claude Code.

## Options envisagées
1. **Astro statique** — HTML pur par défaut, JS opt-in, images optimisées intégrées, Content Layer typé, View Transitions natives.
2. Next.js — plus lourd côté client, surdimensionné pour un site vitrine.
3. WordPress amélioré — dette existante, performance et maintenance moins maîtrisées.

## Décision
Astro (dernière version stable, v7.x au cadrage) en `output: 'static'`, déployé sur Vercel. `trailingSlash: 'always'` pour conserver les URLs du WordPress actuel.

## Conséquences
- Excellentes performances et SEO technique par défaut.
- Formulaire de contact via un service externe (ADR-0003).
- Passage à un CMS headless ou à du SSR possible plus tard sans réécriture.
