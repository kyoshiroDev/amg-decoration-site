# Placeholders d'images

Images **provisoires** dessinées pour le projet. Aucune image de banque d'images n'est utilisée ici.

Depuis le 2026-11-21, plus aucune page publique ne les affiche : héros, portrait, image Open Graph, comparateur et
réalisations utilisent les vraies images d'Amandine reprises de son ancien site (`src/assets/brand/`,
`src/assets/projets/<slug>/`, `src/config/media.ts`). Elles restent pour les pages internes (noindex) ci-dessous.

Ces illustrations ont été dessinées avec l'**ancienne palette** (terracotta, sauge), d'avant l'ADR-0017.

| Fichier                   | Dimensions  | Origine                                                                                                                                                                                            | Licence                                     | Utilisé par                                                          |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `interieur-lumiere.jpg`   | 1600 × 2000 | Illustration abstraite générée pour le projet (SVG fait main avec les couleurs du design system : mur lin, fenêtre en arche, assise terracotta, plante sauge), rastérisée en JPEG avec `sharp`.    | Création originale du projet, libre d'usage | `/styleguide/`, couverture du modèle d'article (`draft`, non publié) |
| `comparatif-rendu-3d.jpg` | 1600 × 1200 | Dessin au trait généré pour le projet (SVG fait main : salon, fenêtre en arche, canapé, plante, sol en perspective), mention « PLACEHOLDER · RENDU 3D » incrustée, rastérisé en JPEG avec `sharp`. | Création originale du projet, libre d'usage | `/styleguide/` (BeforeAfter, ProjectGallery)                         |
| `comparatif-realise.jpg`  | 1600 × 1200 | Même composition en aplats de couleurs du design system, mention « PLACEHOLDER · RÉALISÉ » incrustée, rastérisé en JPEG avec `sharp`.                                                              | Création originale du projet, libre d'usage | `/styleguide/` (BeforeAfter, ProjectGallery)                         |

Les deux images `comparatif-*` ne doivent jamais servir de `beforeAfter` à une réalisation.

## Images reprises de l'ancien site (2026-11-21)

Le plus grand fichier publié sur l'ancien site a été retenu pour chaque image : les variantes WordPress `-scaled`
(2560 px) quand elles existent, sinon le fichier d'origine.

- Héros de l'accueil, image Open Graph par défaut : `brand/rendu-salon-lumineux.jpg` (2560 × 1440).
- Héros de `/visualisation-3d/` : `brand/rendu-cuisine-verriere.jpg` (2560 × 1440).
- Portrait (« Qui suis-je ? », `/a-propos/`) : `brand/portrait-amandine.jpg` (1600 × 1929).
- Comparateur de `/visualisation-3d/` et de la chambre d'enfant sous combles : `projets/chambre-enfant-dinosaures/
comparatif-*.jpg`. Le rendu est recadré au point de vue de la photo, mais les deux prises de vue ne sont pas
  identiques, et la photo ne fait que 676 × 507.
- 8 anciens projets publiés sans texte (`/projet-1/` à `/projet-7/`, `/projet-marine/`) : rendus 3D en 1600 × 900,
  photos avant et après.
- Les 4 projets récents restent en 1200 × 600 : c'est la taille des fichiers d'origine sur l'ancien site.

TODO(contenu): demander à Amandine les originaux HD (rendus 4K, photos du résultat) et une paire rendu 3D / photo
cadrée à l'identique (même point de vue, même focale, 4:3, 1600 × 1200 minimum).
