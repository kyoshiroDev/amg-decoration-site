// Briques communes aux schémas de l'API et des formulaires Angular (ADR-0019) : formats et bornes
// explicites, valeurs normalisées avant validation.
import { z } from 'zod';

/** Longueur maximale d'une adresse email (RFC 5321 : chemin de 256 octets, chevrons compris). */
export const EMAIL_MAX_LENGTH = 254;

/**
 * Adresse email normalisée : espaces retirés et minuscules **avant** la validation du format, pour
 * qu'une même adresse n'existe qu'une fois en base quelle que soit sa saisie.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(EMAIL_MAX_LENGTH)
  .pipe(z.email());

/** Identifiant de ressource : UUID version 7 (généré par la base, ordonné dans le temps). */
export const uuidSchema = z.uuidv7();
