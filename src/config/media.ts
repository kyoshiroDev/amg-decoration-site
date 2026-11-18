/**
 * Visuels de mise en page qui ne relèvent d'aucune entrée de contenu (héros de l'accueil,
 * portrait). Importe des images : réservé aux composants et aux pages, `lib/` ne l'importe jamais.
 */
import type { ImageMetadata } from 'astro';
// TODO(contenu): remplacer par un rendu 3D d'Amandine (format portrait, 1600 × 2000 minimum).
import heroPlaceholder from '@/assets/placeholders/interieur-lumiere.jpg';

export interface MediaImage {
  readonly image: ImageMetadata;
  readonly alt: string;
}

export interface SiteMedia {
  readonly homeHero: MediaImage;
  /** Portrait d'Amandine (section « Qui suis-je ? ») ; décor en arche tant qu'il manque. */
  readonly portrait: MediaImage | undefined;
}

export const media: SiteMedia = {
  homeHero: {
    image: heroPlaceholder,
    alt: 'Illustration d’un intérieur lumineux\u00A0: fenêtre en arche, assise terracotta, plante vert sauge et sol couleur sable',
  },
  // TODO(contenu): portrait d'Amandine (photo HD, format portrait) et son texte alternatif.
  portrait: undefined,
};
