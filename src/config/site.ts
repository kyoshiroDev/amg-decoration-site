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
  /**
   * Titulaire du profil : `founder` pour un profil personnel d'Amandine (`sameAs` de `Person`),
   * sinon profil de l'entreprise (`sameAs` de `ProfessionalService`).
   */
  readonly owner?: 'founder';
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
  /**
   * Identifiants légaux, injectés dans les pages légales par les jetons `{siret}` et
   * `{legalAddress}` (ADR-0016). L'adresse du siège n'est publiée que là : ni JSON-LD, ni pied de page.
   */
  readonly registration: { readonly siret: string; readonly legalAddress: string };
  readonly openingHours: readonly OpeningHoursRule[];
  readonly areaServed: readonly AreaServed[];
  readonly socials: readonly SocialLink[];
  readonly mainNav: readonly NavItem[];
  readonly headerCta: NavItem;
  readonly legalNav: readonly NavItem[];
  /** Affichage public des prix des prestations (`price` dans src/content/prestations/, ADR-0007). */
  readonly pricing: { readonly showPrices: boolean };
}

export const site = {
  name: 'AMG Décoration d’Intérieur',
  shortName: 'AMG Décoration',
  tagline: 'Visualisez votre intérieur idéal en 3D, avant même qu’il prenne vie.',
  founder: { name: 'Amandine Gaury', jobTitle: 'Designer d’intérieur' },
  phone: { display: '07\u00A082\u00A035\u00A081\u00A032', e164: '+33782358132' },
  email: 'am.gaury@gmail.com',
  // TODO(contenu): canal WhatsApp confirmé par l’ancien site (« Accompagnement par WhatsApp ou email ») ;
  // numéro identique au téléphone à confirmer (aucun numéro WhatsApp distinct publié).
  whatsapp: { url: 'https://wa.me/33782358132' },
  // Adresse du siège (registration.legalAddress) volontairement absente des données structurées :
  // activité sans accueil du public, zone desservie seulement (src/lib/jsonld.ts).
  address: { addressRegion: 'Île-de-France', addressCountry: 'FR' },
  // SIRET publié sur le site actuel (docs/CONTENU-EXISTANT.md) ; adresse du siège donnée par l'humain,
  // le 2026-11-22 et confirmée par l'annuaire des entreprises (recherche-entreprises.api.gouv.fr).
  registration: {
    siret: '531\u00A0938\u00A0868\u00A000019',
    legalAddress: '24\u00A0allée du Pré Lambesc, 91190\u00A0Gif-sur-Yvette',
  },
  openingHours: [
    {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
    },
  ],
  // TODO(contenu): un projet déjà mené à distance en Suisse (chalet) ; accepter d’autres projets hors de
  // France ? Décision d’Amandine. Ne pas ajouter la Suisse à areaServed sans sa réponse.
  areaServed: [
    { type: 'City', name: 'Paris' },
    { type: 'AdministrativeArea', name: 'Île-de-France' },
    { type: 'Country', name: 'France' },
  ],
  socials: [
    {
      network: 'instagram',
      label: 'Instagram',
      url: 'https://www.instagram.com/amgdecorationdinterieur/',
    },
    { network: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/amgdecoration' },
    { network: 'pinterest', label: 'Pinterest', url: 'https://www.pinterest.fr/amgaury/' },
    // Profil relevé sur le site actuel (docs/CONTENU-EXISTANT.md, Identité).
    // TODO(contenu): confirmer que le profil LinkedIn est toujours actif
    {
      network: 'linkedin',
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/amandine-gaury-97a263193/',
      owner: 'founder',
    },
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
  // Prix fixes confirmés par l'humain le 2026-11-23 (offre officielle « Offres particuliers », avril 2026) :
  // formules et options à prix fixe (CGS art. 1, 3, 5). Pas d'`Offer` JSON-LD sans ADR (ADR-0007).
  pricing: { showPrices: true },
} as const satisfies SiteConfig;
