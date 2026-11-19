/**
 * Collections de contenu (Content Layer API, schémas Zod 4) — voir docs/ARCHITECTURE.md
 * (§ Collections) et ADR-0007. Tout contenu invalide fait échouer `astro build`.
 *
 * Conventions : objets stricts (une clé inconnue = erreur de frappe détectée), textes non vides,
 * longueurs SEO vérifiées ici (mêmes règles que le composant SEO), liens internes avec slash final.
 */
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { EMAIL_TOKEN } from '@/lib/contact-form';
import { isDescriptionLengthValid, isTitleLengthValid, seoLimits } from '@/lib/seo';

/* ------------------------------------------------------------------ */
/* Briques communes                                                    */
/* ------------------------------------------------------------------ */

const text = z.string().trim().min(1);

/** Lien interne : `/`, `/contact/`, `/realisations/chalet-suisse/`, ancre optionnelle. */
const internalPath = z
  .templateLiteral(['/', z.string()])
  .refine((path) => /^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9-]+)?$/.test(path), {
    message: 'Lien interne attendu : minuscules, tirets, slash final (ex. « /contact/ »).',
  });

/** Texte alternatif informatif : jamais vide, jamais « image de… » (CLAUDE.md §5). */
const altText = text.refine((alt) => !/^(image|photo|visuel)\s+(de|du|des|d’|d')/i.test(alt), {
  message: 'Décrire ce que montre l’image, sans commencer par « image de », « photo de »…',
});

const seo = z.strictObject({
  title: z.string().refine((title) => isTitleLengthValid(title, seoLimits.titleMaxLength), {
    message: `Titre SEO vide ou trop long (≤ ${seoLimits.titleMaxLength} caractères).`,
  }),
  description: z
    .string()
    .refine((description) => isDescriptionLengthValid(description, seoLimits.descriptionLength), {
      message: `Meta description hors limites (${seoLimits.descriptionLength.min} à ${seoLimits.descriptionLength.max} caractères).`,
    }),
});

const action = z.strictObject({ label: text, href: internalPath });
/** Élément de liste : `text` est facultatif pour les listes simples (inclus, options). */
const textItem = z.strictObject({ title: text, text: text.optional() });
const order = z.number().int().nonnegative();

/** Pages où un témoignage ou une question de FAQ peut s'afficher. */
const displayPage = z.enum([
  'accueil',
  'prestations',
  'visualisation-3d',
  'realisations',
  'a-propos',
  'contact',
]);

/** Section éditoriale d'une page : titre, chapeau, éléments, citation, boutons. */
const pageSection = z
  .strictObject({
    eyebrow: text.optional(),
    heading: text,
    /** Fragment de `heading` mis en italique Fraunces terracotta. */
    headingEmphasis: text.optional(),
    lead: text.optional(),
    items: z.array(textItem).default([]),
    quote: z.strictObject({ text, author: text }).optional(),
    actions: z.array(action).max(3).default([]),
    /**
     * Liens de maillage interne affichés en cartes « Pour aller plus loin » (`label` = surtitre,
     * `href` = article, prestation ou réalisation ; titre et texte lus dans la collection visée).
     */
    links: z.array(action).min(1).max(6).optional(),
  })
  .refine(
    (section) => !section.headingEmphasis || section.heading.includes(section.headingEmphasis),
    {
      message: '`headingEmphasis` doit être un fragment exact de `heading`.',
      path: ['headingEmphasis'],
    },
  );

/** Clé de section : kebab-case, lue explicitement par la route (`requireSection`). */
const sectionKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const textWithEmail = text.refine((value) => value.includes(EMAIL_TOKEN), {
  message: `Texte attendu avec le jeton « ${EMAIL_TOKEN} » (remplacé par site.email).`,
});

/** Champ de formulaire : libellé visible et aide facultative (reliée par `aria-describedby`). */
const formField = z.strictObject({ label: text, hint: text.optional() });

/**
 * Microcopies du formulaire de contact (docs/CONFORMITE.md §5). Les champs eux-mêmes (types,
 * `autocomplete`, obligation) sont fixés par le composant : le contenu ne porte que les textes.
 */
const contactForm = z.strictObject({
  fields: z.strictObject({
    name: formField,
    email: formField,
    phone: formField,
    project: formField
      .extend({ options: z.array(text).min(2), defaultOption: text })
      .refine((field) => field.options.includes(field.defaultOption), {
        message: '`defaultOption` doit faire partie de `options`.',
        path: ['defaultOption'],
      }),
    message: formField,
  }),
  /** Suffixe du libellé d'un champ facultatif : « (facultatif) ». */
  optionalMark: text,
  /** Libellé du champ piège (honeypot), jamais visible. */
  honeypotLabel: text,
  submit: z.strictObject({ label: text, sending: text }),
  /**
   * Mention d'information RGPD sous le bouton, suivie d'un lien vers la politique. `text` :
   * envoi par le service de formulaire ; `mailtoText` : repli `mailto:` (aucun service configuré).
   */
  notice: z.strictObject({
    text: textWithEmail,
    mailtoText: textWithEmail,
    moreLabel: text,
    link: action,
  }),
  /** Repli `mailto:` : indice visible près du bouton si la messagerie ne s'ouvre pas. */
  mailtoHint: textWithEmail,
  errors: z.strictObject({
    summary: text,
    nameRequired: text,
    emailRequired: text,
    emailInvalid: text,
    phoneInvalid: text,
    messageRequired: text,
  }),
  success: z.strictObject({ title: text, text }),
  failure: textWithEmail,
});

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

/** Textes éditoriaux des pages (une page = un fichier Markdown, ADR-0007). */
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.strictObject({
    seo,
    noindex: z.boolean().default(false),
    /** Ouverture de la page : `heading` est le `<h1>`. */
    hero: pageSection,
    sections: z.record(sectionKey, pageSection).default({}),
    /** Formulaire de contact (page `contact` uniquement). */
    form: contactForm.optional(),
  }),
});

/** Formules (Essentiel, Confort, Signature, Studio) et offres complémentaires. */
const prestations = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/prestations' }),
  schema: ({ image }) =>
    z
      .strictObject({
        title: text,
        kind: z.enum(['formule', 'offre']),
        /** Accroche courte (« pour les petits espaces »), sur les cartes. */
        tagline: text,
        /** h1 de la fiche, orienté mot-clé ; le nom (`title`) reste affiché en surtitre. */
        heroTitle: text,
        /** Fragment exact de `heroTitle` mis en italique terracotta. */
        heroTitleEmphasis: text.optional(),
        /** Pièces ou public ciblés, texte libre. */
        target: text.optional(),
        summary: text,
        includes: z.array(text).default([]),
        options: z.array(text).default([]),
        /** Mise en avant (« la formule la plus demandée »). */
        highlight: z.boolean().default(false),
        /** Prix public (ADR-0007) ; affichage piloté par `site.pricing.showPrices`, jamais d'`Offer` JSON-LD. */
        price: z
          .strictObject({
            amount: z.number().int().positive(),
            currency: z.literal('EUR'),
            from: z.boolean().default(false),
            note: text.optional(),
          })
          .optional(),
        /** Prestation sur devis (à la place d'un prix). */
        quote: z.strictObject({ label: text, note: text.optional() }).optional(),
        cover: z.strictObject({ image: image(), alt: altText }).optional(),
        order,
        seo,
      })
      .refine((entry) => !(entry.price && entry.quote), {
        message: 'Une prestation a un prix OU un devis, pas les deux.',
        path: ['quote'],
      })
      .refine((entry) => entry.heroTitle !== entry.title, {
        message:
          'Le h1 (`heroTitle`) doit porter le mot-clé, pas seulement le nom de la prestation.',
        path: ['heroTitle'],
      })
      .refine(
        (entry) => !entry.heroTitleEmphasis || entry.heroTitle.includes(entry.heroTitleEmphasis),
        {
          message: '`heroTitleEmphasis` doit être un fragment exact de `heroTitle`.',
          path: ['heroTitleEmphasis'],
        },
      ),
});

const roomType = z.enum([
  'piece-de-vie',
  'cuisine',
  'chambre',
  'chambre-parentale',
  'chambre-enfant',
  'salle-de-bain',
  'dressing',
  'bureau',
  'entree',
  'exterieur',
  'studio',
  'meuble-sur-mesure',
]);

/** Réalisations : une galerie par projet (avant / rendu 3D / après). */
const projets = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projets' }),
  schema: ({ image }) => {
    const figure = z.strictObject({ image: image(), alt: altText });
    return z.strictObject({
      title: text,
      /** Accroche des cartes et de la grille. */
      summary: text,
      location: text.optional(),
      roomTypes: z.array(roomType).min(1),
      style: text,
      service: reference('prestations').optional(),
      cover: figure,
      gallery: z
        .array(
          z.strictObject({
            image: image(),
            alt: altText,
            kind: z.enum(['avant', '3d', 'apres']),
            caption: text.optional(),
          }),
        )
        .min(1),
      /** Paire du slider « Rendu 3D ↔ Réalisé » (Phase 5). */
      beforeAfter: z.strictObject({ rendering: figure, result: figure }).optional(),
      featured: z.boolean().default(false),
      order,
      seo,
    });
  },
});

/** Blog « Conseils déco ». */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/articles' }),
  schema: ({ image }) =>
    z
      .strictObject({
        title: text,
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        cover: z.strictObject({ image: image(), alt: altText }),
        tags: z.array(text).default([]),
        relatedService: reference('prestations').optional(),
        relatedProject: reference('projets').optional(),
        draft: z.boolean().default(false),
        seo,
      })
      .refine((entry) => !entry.updatedAt || entry.updatedAt >= entry.publishedAt, {
        message: '`updatedAt` ne peut pas précéder `publishedAt`.',
        path: ['updatedAt'],
      }),
});

/** Avis clients, textes EXACTS (jamais reformulés), sans note ni date inventées. */
const temoignages = defineCollection({
  loader: file('src/content/temoignages.yaml'),
  schema: z
    .strictObject({
      author: text,
      text,
      source: z.enum(['google', 'direct']),
      url: z.url({ protocol: /^https$/ }).optional(),
      projectType: text.optional(),
      pages: z.array(displayPage).min(1),
      order,
    })
    .refine((entry) => entry.source !== 'google' || entry.url !== undefined, {
      message: 'Un avis Google doit renvoyer vers sa source (`url`).',
      path: ['url'],
    }),
});

/** Questions fréquentes : uniquement tirées du discours d'Amandine. */
const faq = defineCollection({
  loader: file('src/content/faq.yaml'),
  schema: z.strictObject({
    question: text,
    answer: text,
    pages: z.array(displayPage).min(1),
    order,
  }),
});

/** Méthode en 6 étapes (accueil, visualisation 3D, prestations). */
const etapes = defineCollection({
  loader: file('src/content/etapes.yaml'),
  schema: z.strictObject({ title: text, text, order }),
});

/** Bénéfices de la 3D (accueil, visualisation 3D). */
const avantages = defineCollection({
  loader: file('src/content/avantages.yaml'),
  schema: z.strictObject({ title: text, text, order }),
});

export const collections = {
  pages,
  prestations,
  projets,
  articles,
  temoignages,
  faq,
  etapes,
  avantages,
};
