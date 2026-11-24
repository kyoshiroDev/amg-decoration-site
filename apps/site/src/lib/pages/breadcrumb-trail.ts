/**
 * Fil d'Ariane d'une page interne : l'accueil, puis le chemin jusqu'à la page courante
 * (dernier élément). Fonction PURE, partagée par les modèles de page (lot 2A).
 */
import type { BreadcrumbItem } from '../jsonld';

export function breadcrumbTrail(
  homeLabel: string,
  ...items: readonly BreadcrumbItem[]
): BreadcrumbItem[] {
  return [{ label: homeLabel, href: '/' }, ...items];
}
