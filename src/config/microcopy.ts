/**
 * Microcopie de l'interface (libellés, aria-label, titres de colonnes).
 * Aucun composant n'écrit ces textes en dur. Typographie : docs/DESIGN-SYSTEM.md (§ Typographie française).
 */
export const microcopy = {
  skipLink: 'Aller au contenu principal',
  newTab: ' (nouvel onglet)',
  nav: {
    main: 'Navigation principale',
    footer: 'Plan du site',
    legal: 'Informations légales',
    breadcrumb: 'Fil d’Ariane',
  },
  mobileMenu: {
    open: 'Menu',
    close: 'Fermer le menu',
  },
  home: 'Accueil',
  /** Bandeau de mots-clés (Marquee) : décoratif, lu une seule fois par les lecteurs d'écran. */
  marquee: {
    label: 'L’esprit de l’atelier',
    words: ['Douceur', 'Matières', 'Lumière', '3D'],
  },
  services: {
    highlight: 'La plus demandée',
    more: 'Découvrir la formule',
    priceLabel: 'Tarif\u00A0:',
    /** Préfixe d'un prix « à partir de » (`price.from`). */
    priceFrom: 'À partir de',
    targetLabel: 'Pour\u00A0:',
  },
  projects: {
    more: 'Voir le projet',
  },
  testimonials: {
    googleLink: 'Lire l’avis sur Google',
    projectLabel: 'Projet\u00A0:',
  },
  footer: {
    tagline:
      'Je dessine votre intérieur en 3D avant qu’il prenne vie, pour que vous avanciez sereinement, à Paris ou partout en France.',
    contactTitle: 'Me contacter',
    hoursTitle: 'Horaires',
    areaTitle: 'Zone d’intervention',
    socialTitle: 'Me suivre',
    sitemapTitle: 'Plan du site',
    area: 'Basée en région parisienne, j’accompagne vos projets à Paris et partout en France à distance.',
    whatsapp: 'M’écrire sur WhatsApp',
    phoneLabel: 'Téléphone',
    emailLabel: 'E-mail',
    /** `{year}` est remplacé par l'année du build. */
    copyright: '© {year} AMG Décoration d’Intérieur — Amandine Gaury',
  },
} as const;
