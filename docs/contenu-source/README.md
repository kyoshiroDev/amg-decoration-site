# Contenu source du site actuel (WordPress)

Extraction **brute et fidèle** du HTML public de https://amgdecorationdinterieur.com/, relevée le 18/11/2026
(`curl` puis extraction du texte, sans réécriture). Ces fichiers servent de **référence** pour la migration
des contenus (Phase 3) : textes intégraux, `title`, meta description, texte exact des avis, images et liens.

- Ce ne sont pas des contenus publiés : les textes du nouveau site vivent dans `src/content/`.
- Les avis clients doivent être repris **mot pour mot** depuis ces fichiers (jamais reformulés).
- Les en-têtes, menus et pieds de page WordPress sont exclus de l'extraction.
- L'inventaire structuré (URLs, redirections, faits, manques) est dans `docs/CONTENU-EXISTANT.md`.
