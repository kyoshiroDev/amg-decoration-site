/**
 * Textes des pages techniques et provisoires (accueil temporaire, 404, styleguide).
 * Provisoire : migreront vers les collections de contenu en Phase 3 (docs/ROADMAP.md).
 */
export const pageTexts = {
  home: {
    title: 'Décoratrice d’intérieur 3D à Paris',
    description:
      'Décoratrice d’intérieur à Paris, je vous montre votre futur intérieur en 3D avant tout achat. Des décisions sereines, partout en France. Parlons-en.',
    heading:
      'Décoratrice d’intérieur à Paris, je vous montre votre intérieur en 3D avant qu’il prenne vie',
    /** Fragment du titre mis en italique Fraunces terracotta (doit figurer dans `heading`). */
    headingEmphasis: 'en 3D',
    lead: 'Le site fait peau neuve ; d’ici là, je reste à votre écoute pour parler de votre projet, à Paris ou à distance partout en France.',
  },
  notFound: {
    title: 'Page introuvable',
    description:
      'Cette page n’existe plus ou a changé d’adresse. Retrouvez mes réalisations en 3D, mes prestations de décoration d’intérieur ou contactez-moi directement.',
    heading: 'Cette page n’existe pas (ou plus)',
    lead: 'Son adresse a peut-être changé avec le nouveau site. Je vous propose de reprendre depuis l’une de ces pages, ou de m’écrire directement : je vous répondrai avec plaisir.',
    links: {
      home: 'Revenir à l’accueil',
      projects: 'Voir mes réalisations',
      contact: 'Parlons de votre projet',
    },
  },
  styleguide: {
    title: 'Guide de style : tokens et composants',
    description:
      'Page interne de référence du site AMG Décoration d’Intérieur : couleurs, typographie, espacements et composants réunis pour garder un design cohérent.',
  },
} as const;
