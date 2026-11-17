---
description: Lance la construction complète du site en autonomie, phase par phase, jusqu'à la PR finale.
argument-hint: "[numéro de phase de départ, optionnel]"
---

Tu démarres (ou reprends) la construction du site AMG Décoration **en totale autonomie**.

1. Lis intégralement `CLAUDE.md`, puis `docs/BRIEF.md`, `docs/CONTENU-EXISTANT.md`, `docs/DESIGN-SYSTEM.md`, `docs/SEO-STRATEGIE.md`, `docs/ARCHITECTURE.md` et `docs/ROADMAP.md`.
2. Détermine la première phase non terminée de `docs/ROADMAP.md` (ou commence à la phase `$ARGUMENTS` si elle est fournie).
3. Pour chaque phase, applique **strictement** le cycle de `CLAUDE.md` §8 :
   planifier → implémenter (en déléguant aux agents spécialistes) → `npm run verify` → audits → docs (ROADMAP, CHANGELOG, ADR) → `reviewer` → push `dev` + PR `dev → main`.
4. Enchaîne les phases sans attendre de validation humaine, **sauf** :
   - 3 refus consécutifs du `reviewer` sur le même point ;
   - une décision irréversible ou qui contredit `CLAUDE.md` ;
   - une information indispensable manquante qui bloque toute la suite (sinon : `TODO(contenu)` et on continue).
5. À la fin de chaque phase, écris un résumé de 5 lignes maximum : ce qui est fait, lien de la PR, `TODO(contenu)` ajoutés, prochaine phase.
6. À la fin de la roadmap, produis la synthèse finale : état des budgets qualité (chiffres), liste consolidée des informations à demander à Amandine, checklist de mise en production.
