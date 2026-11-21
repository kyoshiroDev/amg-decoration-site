/**
 * Visuels de mise en page qui ne relèvent d'aucune entrée de contenu (héros de l'accueil,
 * portrait). Importe des images : réservé aux composants et aux pages, `lib/` ne l'importe jamais.
 *
 * Images reprises de l'ancien site d'Amandine (2026-11-21) : rendus 3D en 2560 × 1440, portrait
 * en 1600 × 1911 (source PNG détourée de 2611 × 3148, transparence remplie en crème
 * `--color-cream`). TODO(contenu): originaux HD (rendus 4K, portrait) à demander à Amandine.
 */
import type { ImageMetadata } from 'astro';
import livingRendering from '@/assets/brand/rendu-salon-lumineux.jpg';
import kitchenRendering from '@/assets/brand/rendu-cuisine-verriere.jpg';
import portraitImage from '@/assets/brand/portrait-amandine.jpg';
// Seule paire « rendu 3D / photo du résultat » publiée par Amandine : chambre d'enfant sous combles.
// Le rendu est recadré au point de vue de la photo, mais les deux prises de vue ne sont pas
// identiques. TODO(contenu): paire cadrée à l'identique, photo du résultat en HD (actuelle : 676 × 507).
import compareRendering from '@/assets/projets/chambre-enfant-dinosaures/comparatif-rendu-3d.jpg';
import compareResult from '@/assets/projets/chambre-enfant-dinosaures/comparatif-realise.jpg';

export interface MediaImage {
  readonly image: ImageMetadata;
  readonly alt: string;
}

/** Paire du comparateur « Rendu 3D ↔ Réalisé », cadrée au plus près. */
export interface ComparePair {
  readonly rendering: MediaImage;
  readonly result: MediaImage;
}

export interface SiteMedia {
  readonly homeHero: MediaImage;
  /** Héros de la page « Visualisation 3D » (rendu 3D). */
  readonly methodHero: MediaImage;
  /** Comparateur de la page « Visualisation 3D » (section `comparatif`). */
  readonly methodCompare: ComparePair;
  /** Portrait d'Amandine (section « Qui suis-je ? ») ; décor en arche s'il manque. */
  readonly portrait: MediaImage | undefined;
}

export const media: SiteMedia = {
  homeHero: {
    image: livingRendering,
    alt: 'Rendu 3D d’un séjour lumineux : canapé blanc aux coussins orangés, tables basses en bois, cuisine ouverte sur mur de pierre',
  },
  methodHero: {
    image: kitchenRendering,
    alt: 'Rendu 3D d’une cuisine ouverte : meubles vert sauge, fenêtre en arche, comptoir blanc, tabourets en rotin et verrière noire',
  },
  methodCompare: {
    rendering: {
      image: compareRendering,
      alt: 'Rendu 3D d’une chambre d’enfant sous combles : lit cabane blanc, linge à dinosaures, tapis rond en jute',
    },
    result: {
      image: compareResult,
      alt: 'Photo de la chambre réalisée : lit cabane en bois, mur vert sauge soutenu, tapis rond en jute et suspension en rotin',
    },
  },
  portrait: {
    image: portraitImage,
    alt: 'Portrait d’Amandine Gaury en blouse bleu ciel à volants, devant une arche terre cuite',
  },
};
