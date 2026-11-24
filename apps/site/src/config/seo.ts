/**
 * Valeurs SEO par défaut (CLAUDE.md §5, docs/SEO-STRATEGIE.md).
 * Importe une image : ce module est réservé aux composants, `lib/` ne l'importe jamais.
 */
import type { ImageMetadata } from 'astro';
import { seoLimits } from '@/lib/seo';
// Rendu 3D d'Amandine (2560 × 1440, recadré en 1200 × 630 au build).
// TODO(contenu): visuel Open Graph de marque (logo, nom) à valider avec Amandine.
import defaultOgImage from '@/assets/brand/rendu-salon-lumineux.jpg';

export interface SeoDefaults {
  readonly titleSuffix: string;
  readonly titleSeparator: string;
  readonly titleMaxLength: number;
  readonly descriptionLength: { readonly min: number; readonly max: number };
  readonly locale: string;
  readonly ogImage: ImageMetadata;
  readonly ogImageAlt: string;
  readonly ogImageSize: { readonly width: number; readonly height: number };
  readonly twitterCard: 'summary' | 'summary_large_image';
}

export const seoDefaults = {
  titleSuffix: 'AMG Décoration',
  titleSeparator: ' | ',
  titleMaxLength: seoLimits.titleMaxLength,
  descriptionLength: seoLimits.descriptionLength,
  locale: 'fr_FR',
  ogImage: defaultOgImage,
  ogImageAlt:
    'Rendu 3D d’un salon lumineux\u00A0: canapé d’angle blanc, coussins orangés, tables basses en bois et mur en tasseaux',
  ogImageSize: { width: 1200, height: 630 },
  twitterCard: 'summary_large_image',
} as const satisfies SeoDefaults;
