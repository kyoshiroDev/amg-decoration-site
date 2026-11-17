---
description: Vérifie tout puis soumet les changements committés à l'agent reviewer.
---

1. Vérifie que `git status` est propre ; sinon, propose des commits conventionnels et committe.
2. Lance `npm run verify`. Corrige jusqu'à ce que ce soit vert.
3. Lance en parallèle les audits pertinents selon les fichiers modifiés (`git diff --name-only origin/dev...HEAD`) :
   - `src/styles`, composants visuels → `designer` + `accessibilite`
   - pages, layouts, `seo/`, `vercel.json` → `seo`
   - images, polices, scripts → `performance`
   - contenus → `redacteur`
   - pages légales, formulaire → `conformite`
4. Corrige les points bloquants, recommitte.
5. Appelle l'agent `reviewer` et affiche son verdict tel quel.
