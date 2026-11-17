---
description: Audit complet du site (architecture, design, SEO, accessibilité, performance, conformité) sans modifier le code.
---

Lance un `npm run build`, puis **en parallèle** les agents `architecte` (mode audit), `designer` (revue visuelle avec captures 375 et 1440 px), `seo`, `accessibilite`, `performance` et `conformite`, en leur demandant un rapport **sans modification de code**.

Consolide le tout dans `.claude/reports/audit-<date>.md` : tableau des scores, problèmes classés P1 / P2 / P3, et un plan d'action ordonné. Affiche la synthèse.
