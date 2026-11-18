/**
 * SOURCE DE VÉRITÉ UNIQUE des informations de l'entreprise (CLAUDE.md §3).
 * Nom, coordonnées (NAP), horaires, zone, réseaux et navigation : aucun composant
 * ne doit les écrire en dur. Données issues de docs/CONTENU-EXISTANT.md.
 */

export type DayOfWeek =
  'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** Heure au format 24 h « HH:MM ». */
export type ClockTime = `${number}${number}:${number}${number}`;

export interface OpeningHoursRule {
  readonly days: readonly DayOfWeek[];
  readonly opens: ClockTime;
  readonly closes: ClockTime;
}

export type InternalPath = `/${string}`;

export interface NavItem {
  readonly label: string;
  readonly href: InternalPath;
}

export type SocialNetwork = 'instagram' | 'facebook' | 'pinterest' | 'linkedin';

export interface SocialLink {
  readonly network: SocialNetwork;
  readonly label: string;
  readonly url: `https://${string}`;
}

export interface AreaServed {
  readonly type: 'City' | 'AdministrativeArea' | 'Country';
  readonly name: string;
}

export interface SiteConfig {
  readonly name: string;
  readonly shortName: string;
  readonly tagline: string;
  readonly founder: { readonly name: string; readonly jobTitle: string };
  readonly phone: { readonly display: string; readonly e164: `+${string}` };
  readonly email: string;
  readonly whatsapp: { readonly url: `https://wa.me/${string}` };
  readonly address: { readonly addressRegion: string; readonly addressCountry: 'FR' };
  readonly openingHours: readonly OpeningHoursRule[];
  readonly areaServed: readonly AreaServed[];
  readonly socials: readonly SocialLink[];
  readonly mainNav: readonly NavItem[];
  readonly headerCta: NavItem;
  readonly legalNav: readonly NavItem[];
}

export const site = {
  name: 'AMG Décoration d’Intérieur',
  shortName: 'AMG Décoration',
  tagline: 'Visualisez votre intérieur idéal en 3D, avant même qu’il prenne vie.',
  founder: { name: 'Amandine Gaury', jobTitle: 'Designer d’intérieur' },
  phone: { display: '07\u00A082\u00A035\u00A081\u00A032', e164: '+33782358132' },
  email: 'am.gaury@gmail.com',
  // TODO(contenu): confirmer que le compte WhatsApp utilise bien le même numéro que le téléphone.
  whatsapp: { url: 'https://wa.me/33782358132' },
  // TODO(contenu): adresse postale, ville et code postal inconnus (aucun streetAddress publié).
  address: { addressRegion: 'Île-de-France', addressCountry: 'FR' },
  openingHours: [
    {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
    },
  ],
  // TODO(contenu): confirmer si Amandine accepte des projets en Suisse (un projet cité) avant d'ajouter le pays.
  areaServed: [
    { type: 'City', name: 'Paris' },
    { type: 'AdministrativeArea', name: 'Île-de-France' },
    { type: 'Country', name: 'France' },
  ],
  // TODO(contenu): URL exacte du profil LinkedIn d'Amandine Gaury (non publiée tant qu'inconnue).
  socials: [
    {
      network: 'instagram',
      label: 'Instagram',
      url: 'https://www.instagram.com/amgdecorationdinterieur/',
    },
    { network: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/amgdecoration' },
    { network: 'pinterest', label: 'Pinterest', url: 'https://www.pinterest.fr/amgaury/' },
  ],
  mainNav: [
    { label: 'Accueil', href: '/' },
    { label: 'Prestations', href: '/prestations/' },
    { label: 'La 3D', href: '/visualisation-3d/' },
    { label: 'Réalisations', href: '/realisations/' },
    { label: 'À propos', href: '/a-propos/' },
    { label: 'Conseils déco', href: '/conseils-deco/' },
    { label: 'Contact', href: '/contact/' },
  ],
  headerCta: { label: 'Démarrer mon projet', href: '/contact/' },
  legalNav: [
    { label: 'Mentions légales', href: '/mentions-legales/' },
    { label: 'Confidentialité', href: '/confidentialite/' },
    { label: 'Conditions générales', href: '/conditions-generales/' },
  ],
} as const satisfies SiteConfig;
