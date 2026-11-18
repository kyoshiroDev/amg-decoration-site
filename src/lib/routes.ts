/**
 * Chemins des pages de détail, construits depuis l'identifiant des entrées de contenu
 * (le nom du fichier est le slug de l'URL, docs/ARCHITECTURE.md § Nommage des fichiers).
 * Fonctions pures : aucune vérification d'existence (le build échoue sur un lien mort au lot 2).
 */

export type ServicePath = `/prestations/${string}/`;
export type ProjectPath = `/realisations/${string}/`;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSlug(slug: string): string {
  if (!SLUG.test(slug)) {
    throw new Error(`Slug invalide « ${slug} » : minuscules, chiffres et tirets uniquement.`);
  }
  return slug;
}

/** `/prestations/<slug>/` */
export function servicePath(slug: string): ServicePath {
  return `/prestations/${assertSlug(slug)}/`;
}

/** `/realisations/<slug>/` */
export function projectPath(slug: string): ProjectPath {
  return `/realisations/${assertSlug(slug)}/`;
}
