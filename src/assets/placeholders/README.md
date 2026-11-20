# Placeholders d'images

Images **provisoires**, à remplacer par les photos et rendus 3D fournis par Amandine.
Aucune image de banque d'images n'est utilisée ici.

| Fichier                   | Dimensions  | Origine                                                                                                                                                                                            | Licence                                     | Utilisé par                                                                      |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `interieur-lumiere.jpg`   | 1600 × 2000 | Illustration abstraite générée pour le projet (SVG fait main avec les couleurs du design system : mur lin, fenêtre en arche, assise terracotta, plante sauge), rastérisée en JPEG avec `sharp`.    | Création originale du projet, libre d'usage | `/styleguide/`                                                                   |
| `comparatif-rendu-3d.jpg` | 1600 × 1200 | Dessin au trait généré pour le projet (SVG fait main : salon, fenêtre en arche, canapé, plante, sol en perspective), mention « PLACEHOLDER · RENDU 3D » incrustée, rastérisé en JPEG avec `sharp`. | Création originale du projet, libre d'usage | `/styleguide/` (BeforeAfter, ProjectGallery), `/visualisation-3d/` (BeforeAfter) |
| `comparatif-realise.jpg`  | 1600 × 1200 | Même composition en aplats de couleurs du design system, mention « PLACEHOLDER · RÉALISÉ » incrustée, rastérisé en JPEG avec `sharp`.                                                              | Création originale du projet, libre d'usage | `/styleguide/` (BeforeAfter, ProjectGallery), `/visualisation-3d/` (BeforeAfter) |

Réutilisation provisoire de `interieur-lumiere.jpg` (Phase 3) : `cover` et `gallery` des 4 réalisations
(`src/content/projets/*.md`) et `cover` du modèle d'article (`src/content/articles/modele-article.mdx`),
en attendant les originaux HD (`TODO(contenu)`, docs/CONTENU-EXISTANT.md §8).

Réutilisation provisoire (Phase 4) : image du héros de l'accueil (`src/config/media.ts`, `TODO(contenu)` : rendu 3D
d'Amandine). Le portrait de la section « Qui suis-je ? » est remplacé par un décor CSS en attendant la photo.

Démonstration du comparateur « Rendu 3D ↔ Réalisé » (Phase 5) : `comparatif-rendu-3d.jpg` et `comparatif-realise.jpg`
sont utilisés dans `/styleguide/` (noindex) et, depuis la Phase 8, sur `/visualisation-3d/` (`media.methodCompare`,
`src/config/media.ts`). Partout ils sont libellés comme provisoires : dans l'image (« PLACEHOLDER »), le texte
alternatif (« Illustration provisoire ») et le chapeau de la section. Ils ne doivent jamais servir de `beforeAfter` à
une réalisation.

TODO(contenu): fournir une vraie paire rendu 3D / photo du résultat, cadrée à l'identique (même point de vue, même
focale, 4:3, 1600 × 1200 minimum), par exemple le salon de Mathieu publié sur Instagram. Elle s'ajoute dans
`src/assets/projets/<slug>/` et dans le champ `beforeAfter` du projet : le comparateur apparaît alors
automatiquement sur la page (ProjectLayout).
Elle remplace aussi `media.methodCompare` (et la mention « provisoires » du chapeau `sections.comparatif.lead` de
`src/content/pages/visualisation-3d.md`).
