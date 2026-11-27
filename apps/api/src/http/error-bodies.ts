// Corps des réponses d'erreur (ADR-0023, « Hôtes, gardes et limitation de débit ») : fixes par code,
// en français, sans le chemin, la méthode, le détail de l'erreur ni le code interne. Un seul 404
// pour une route inconnue, une route de l'autre audience et un hôte inconnu ; 401 et 403 non
// énumérants (même corps quelle que soit la raison du refus).
import { STATUS_CODES } from 'node:http';
import type { ErrorResponse } from '@amg/shared-schemas';

const MESSAGES: Readonly<Record<number, string>> = {
  400: 'Requête invalide',
  401: 'Authentification requise',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  405: 'Méthode non autorisée',
  413: 'Requête trop volumineuse',
  415: 'Type de contenu non pris en charge',
  429: 'Trop de requêtes, réessayer plus tard',
  500: 'Erreur interne',
  503: 'Service momentanément indisponible',
};

/** Corps de l'erreur `status` (500 pour un code hors des erreurs HTTP). */
export function errorBody(status: number): ErrorResponse {
  const code = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  return {
    statusCode: code,
    error: STATUS_CODES[code] ?? (code >= 500 ? 'Internal Server Error' : 'Bad Request'),
    message: MESSAGES[code] ?? (code >= 500 ? 'Erreur interne' : 'Requête refusée'),
  };
}
