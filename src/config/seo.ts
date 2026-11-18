/**
 * Valeurs SEO par défaut (CLAUDE.md §5, docs/SEO-STRATEGIE.md).
 * Importe une image : ce module est réservé aux composants, `lib/` ne l'importe jamais.
 */
import type { ImageMetadata } from 'astro';
import { seoLimits } from '@/lib/seo';
// TODO(contenu): remplacer par un visuel OG de marque (rendu 3D d'Amandine, 1200 × 630).
import defaultOgImage from '@/assets/placeholders/interieur-lumiere.jpg';

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
    'Illustration abstraite d’un intérieur lumineux\u00A0: arche terracotta, petite plante vert sauge et sol couleur sable',
  ogImageSize: { width: 1200, height: 630 },
  twitterCard: 'summary_large_image',
} as const satisfies SeoDefaults;
