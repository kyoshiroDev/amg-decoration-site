/**
 * Visuels de mise en page qui ne relèvent d'aucune entrée de contenu (héros de l'accueil,
 * portrait). Importe des images : réservé aux composants et aux pages, `lib/` ne l'importe jamais.
 */
import type { ImageMetadata } from 'astro';
// TODO(contenu): remplacer par un rendu 3D d'Amandine (format portrait, 1600 × 2000 minimum).
import heroPlaceholder from '@/assets/placeholders/interieur-lumiere.jpg';
// TODO(contenu): remplacer par une vraie paire d'Amandine, rendu 3D et photo du résultat cadrés à
// l'identique (même point de vue, 4:3, 1600 × 1200 minimum), décrire chaque image dans `alt` et
// retirer la mention « provisoires » du chapeau (`sections.comparatif.lead`, visualisation-3d.md).
import compareRenderingPlaceholder from '@/assets/placeholders/comparatif-rendu-3d.jpg';
import compareResultPlaceholder from '@/assets/placeholders/comparatif-realise.jpg';

export interface MediaImage {
  readonly image: ImageMetadata;
  readonly alt: string;
}

/** Paire du comparateur « Rendu 3D ↔ Réalisé », cadrée à l'identique. */
export interface ComparePair {
  readonly rendering: MediaImage;
  readonly result: MediaImage;
}

export interface SiteMedia {
  readonly homeHero: MediaImage;
  /** Héros de la page « Visualisation 3D » (rendu 3D attendu). */
  readonly methodHero: MediaImage;
  /** Comparateur de la page « Visualisation 3D » (section `comparatif`). */
  readonly methodCompare: ComparePair;
  /** Portrait d'Amandine (section « Qui suis-je ? ») ; décor en arche tant qu'il manque. */
  readonly portrait: MediaImage | undefined;
}

export const media: SiteMedia = {
  homeHero: {
    image: heroPlaceholder,
    alt: 'Illustration d’un intérieur lumineux\u00A0: fenêtre en arche, assise terracotta, plante vert sauge et sol couleur sable',
  },
  // TODO(contenu): remplacer par un rendu 3D d'Amandine (format portrait 3:4, 1200 × 1600 minimum)
  // et décrire ce qu'il montre dans `alt`.
  methodHero: {
    image: heroPlaceholder,
    alt: 'Illustration provisoire d’un intérieur lumineux\u00A0: fenêtre en arche, assise terracotta et plante vert sauge',
  },
  // Placeholders signalés dans l'image (« PLACEHOLDER »), dans `alt` et dans le chapeau de la
  // section : jamais présentés comme une réalisation (src/assets/placeholders/README.md).
  methodCompare: {
    rendering: {
      image: compareRenderingPlaceholder,
      alt: 'Illustration provisoire\u00A0: dessin au trait d’un salon (canapé, fenêtre en arche, plante), à la place d’un rendu 3D',
    },
    result: {
      image: compareResultPlaceholder,
      alt: 'Illustration provisoire\u00A0: le même salon en aplats de couleur (canapé terracotta, plante sauge), à la place d’une photo du projet réalisé',
    },
  },
  // TODO(contenu): portrait d'Amandine (photo HD, format portrait) et son texte alternatif.
  portrait: undefined,
};
