---
description: Pousse la branche dev et crée ou met à jour la PR dev → main (nécessite l'approbation du reviewer).
---

1. Vérifie que la branche courante est `dev` et que `git status` est propre.
2. Vérifie que `.claude/state/approved-sha` existe et correspond à `git rev-parse HEAD`. Sinon : arrête-toi et lance `/revue`.
3. `git push -u origin dev`
4. Si aucune PR ouverte `dev → main` (`gh pr list --head dev --base main --state open`) :
   `gh pr create --base main --head dev --title "<titre de la phase>" --body-file <fichier généré depuis .github/pull_request_template.md>`
   Sinon : mets à jour la description avec `gh pr edit` (ajoute la phase livrée, les `TODO(contenu)`, les chiffres Lighthouse).
5. Affiche l'URL de la PR et l'URL de preview Vercel si disponible (`gh pr checks` / commentaires du bot Vercel).

Ne merge **jamais** la PR : c'est l'humain qui valide la mise en production.
