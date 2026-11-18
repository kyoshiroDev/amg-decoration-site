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
    /** Bouton du défilement (WCAG 2.2.2) : nom accessible selon l'état. */
    pause: 'Mettre en pause le défilement des mots',
    play: 'Reprendre le défilement des mots',
  },
  /** Visionneuse des galeries de projet (ProjectGallery). */
  lightbox: {
    label: 'Visionneuse d’images',
    /** Préfixe masqué du nom des vignettes : « Agrandir l’image : <alt> ». */
    open: 'Agrandir l’image\u00A0:',
    close: 'Fermer la visionneuse',
    previous: 'Image précédente',
    next: 'Image suivante',
    /** `{current}` et `{total}` remplacés par le rang de l'image et le nombre d'images. */
    counter: '{current}\u00A0/\u00A0{total}',
  },
  services: {
    highlight: 'La plus demandée',
    more: 'Découvrir la formule',
    priceLabel: 'Tarif\u00A0:',
    /** Préfixe d'un prix « à partir de » (`price.from`). */
    priceFrom: 'À partir de',
    targetLabel: 'Pour\u00A0:',
    /** Fil d'Ariane des pages de prestation. */
    indexLabel: 'Prestations',
    /** Invitation des cartes d'offres complémentaires. */
    offerMore: 'Découvrir l’offre',
    offerIncludes: 'Ce qui est inclus',
    /** Carte « En bref » des pages de prestation. */
    facts: {
      label: 'En bref',
      target: 'Pour qui\u202F?',
      includes: 'Ce qui est inclus',
      options: 'En option',
      price: 'Tarif',
    },
  },
  /** Coordonnées de la page Contact (les valeurs viennent de config/site.ts). */
  contact: {
    whatsappLabel: 'WhatsApp',
  },
  /** Pages légales. */
  legal: {
    tocLabel: 'Sommaire',
  },
  projects: {
    more: 'Voir la réalisation',
    /** Fil d'Ariane de l'index et des pages projet. */
    indexLabel: 'Réalisations',
    /** Surtitre du héros d'une page projet. */
    eyebrow: 'Réalisation',
    /** Libellés des types de pièce (`roomTypes`, src/content.config.ts), dans l'ordre des filtres. */
    roomTypes: {
      'piece-de-vie': 'Pièce de vie',
      cuisine: 'Cuisine',
      chambre: 'Chambre',
      'chambre-parentale': 'Chambre parentale',
      'chambre-enfant': 'Chambre d’enfant',
      'salle-de-bain': 'Salle de bain',
      dressing: 'Dressing',
      bureau: 'Bureau',
      entree: 'Entrée',
      exterieur: 'Extérieur',
      studio: 'Studio',
      'meuble-sur-mesure': 'Meuble sur mesure',
    },
    /** Filtres de la page Réalisations (amélioration progressive). */
    filters: {
      label: 'Filtrer par pièce',
      all: 'Tous les projets',
      /** `{count}` est remplacé par le nombre de projets affichés. */
      statusOne: '{count}\u00A0projet affiché',
      statusOther: '{count}\u00A0projets affichés',
    },
    facts: {
      label: 'En bref',
      location: 'Lieu',
      rooms: 'Pièces',
      style: 'Style',
      service: 'Formule',
    },
    gallery: {
      heading: 'Le projet en images',
      kinds: { avant: 'Avant', '3d': 'Rendu 3D', apres: 'Réalisé' },
    },
    beforeAfter: {
      heading: 'Du rendu 3D à la réalité',
      rendering: 'Rendu 3D',
      result: 'Réalisé',
      /** Nom accessible du curseur du comparateur. */
      slider: 'Comparer le rendu 3D et la réalisation',
      /** `aria-valuetext` : `{rendering}` et `{result}` remplacés par les parts visibles. */
      valueText: '{rendering}\u202F% rendu 3D, {result}\u202F% réalisé',
      /** Consigne visible, reliée au curseur (`aria-describedby`) : souris, tactile et clavier. */
      hint: 'Faites glisser la poignée, touchez l’image ou utilisez les flèches du clavier pour comparer les deux images.',
    },
    pager: {
      label: 'Autres réalisations',
      previous: 'Projet précédent',
      next: 'Projet suivant',
    },
  },
  articles: {
    /** Fil d'Ariane des articles. */
    indexLabel: 'Conseils déco',
    more: 'Lire l’article',
    /** `{minutes}` est remplacé par la durée arrondie. */
    readingTime: '{minutes}\u00A0min de lecture',
    published: 'Publié le',
    updated: 'Mis à jour le',
    tagsLabel: 'Thèmes de l’article',
    further: {
      heading: 'Pour aller plus loin',
      service: 'La formule',
      project: 'La réalisation',
      article: 'À lire aussi',
    },
  },
  testimonials: {
    /** `{author}` : remplacé par l'auteur de l'avis (intitulé explicite hors contexte, WCAG 2.4.4). */
    googleLink: 'Lire l’avis de {author} sur Google',
    projectLabel: 'Projet\u00A0:',
  },
  footer: {
    tagline:
      'Je conçois votre intérieur en 3D pour que vous le voyiez avant de vous lancer, à Paris ou à distance partout en France.',
    contactTitle: 'Me contacter',
    hoursTitle: 'Horaires',
    areaTitle: 'Zone d’intervention',
    socialTitle: 'Me suivre',
    sitemapTitle: 'Plan du site',
    area: 'Basée en région parisienne, je vous accompagne à Paris, et à distance partout en France.',
    whatsapp: 'M’écrire sur WhatsApp',
    phoneLabel: 'Téléphone',
    emailLabel: 'Email',
    /** `{year}` est remplacé par l'année du build. */
    copyright: '© {year} AMG Décoration d’Intérieur — Amandine Gaury',
  },
} as const;
