/**
 * Pages servies par le site, articles publiés compris (lus sur le disque) : liste partagée par
 * les tests unitaires et e2e. La lecture du disque reste ici, hors de `src/lib/redirects.ts`.
 */
import { publishedArticleRoutes } from '../src/lib/article-files';
import { siteRoutes } from '../src/lib/redirects';

export const SITE_ROUTES = siteRoutes(publishedArticleRoutes());
