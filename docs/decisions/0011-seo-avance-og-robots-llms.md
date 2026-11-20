# ADR-0011 — SEO avancé : images Open Graph, robots.txt et llms.txt générés

- **Statut** : acceptée (révisée le 2026-11-20 : repli de l’image OG)
- **Date** : 2026-11-19

## Contexte

Phase 6 (SEO avancé). Trois besoins :

1. Chaque page doit avoir une image Open Graph 1200 × 630 qui lui est propre quand un visuel existe (article, projet, 3D, index, prestation). Le service sharp d'Astro redimensionne avec `withoutEnlargement` : une source plus petite que la cible produirait une image plus petite que les dimensions annoncées dans `og:image:width` / `og:image:height`, sans erreur.
2. Le site n'avait pas de `robots.txt` (l'ancien site WordPress en avait un, avec `Disallow: /wp-admin/`).
3. Les assistants et moteurs conversationnels lisent de plus en plus `/llms.txt` (proposition llmstxt.org) : un résumé Markdown du site et de ses pages clés.

## Options envisagées

1. **Images OG composées (satori / `@vercel/og`)** : visuels avec texte incrusté, mais dépendance lourde, polices à embarquer, temps de build, et rendu à valider par le designer. Écartée pour l'instant.
2. **Images OG recadrées par `getImage`** à partir des visuels existants (retenue) : aucune dépendance, recadrage `fit: 'cover'` explicite, garde-fou de taille.
3. **`robots.txt` / `llms.txt` statiques dans `public/`** : simples, mais l'URL du sitemap serait recopiée en dur et la liste des pages de `llms.txt` se désynchroniserait des collections. Écartée.
4. **Endpoints statiques générés au build** (retenue) : `src/pages/robots.txt.ts` et `llms.txt.ts`, contenu produit par des fonctions pures testées (`src/lib/crawlers.ts`, `src/lib/pages/llms-model.ts`), URL absolues tirées de `site`.
5. **`Disallow` des pages `noindex`** (404, `/merci/`, `/styleguide/`) : écarté. Une page bloquée au crawl ne peut pas voir sa balise `noindex` lue, et peut quand même être indexée sans contenu à partir de liens externes.

## Décision

- `SEO.astro` choisit l'image par `pickOgImage(candidate, défaut, 1200 × 630)` (`src/lib/seo.ts`) avant `getImage({ fit: 'cover', format: 'jpg' })` : une candidate trop petite cède la place à l'image par défaut et à son `alt` ; une image par défaut trop petite fait **échouer le build** (voir « Révision » ci-dessous). Images dédiées : couverture (article, projet), `media.methodHero` (`/visualisation-3d/`), couverture de la première carte (`/realisations/`, `/conseils-deco/`, champ `ogImage` des modèles), `cover` des prestations si renseigné ; sinon image par défaut. Toujours avec `og:image:alt`.
- `robots.txt` : `User-agent: *`, `Allow: /`, `Sitemap:` absolu, **aucun `Disallow`**.
- `llms.txt` : H1 (nom), citation (tagline), paragraphe factuel tiré de `site.ts`, sections « Pages principales », « Prestations », « Réalisations », « Conseils déco » (articles publiés seulement), `## Optional` (pages légales). URL absolues, **aucun prix** (ADR-0007).
- En-tête `Content-Type: text/plain; charset=utf-8` pour les deux fichiers dans `vercel.json`.

## Conséquences

- Un visuel de page trop petit (< 1200 × 630) ne produit jamais d'aperçu dégradé : l'image par défaut le remplace silencieusement. Seule une image par défaut trop petite bloque le build (message explicite).
- `llms.txt` suit automatiquement les collections ; l'e2e vérifie que chaque lien est dans le sitemap et que chaque prestation, réalisation et article publié y figure.
- **À trancher par l'humain** : bloquer ou non les robots d'entraînement des IA (`GPTBot`, `Google-Extended`, `CCBot`, `ClaudeBot`…). Aujourd'hui tout est autorisé, ce qui favorise la visibilité dans les réponses des assistants ; un blocage s'ajouterait dans `buildRobotsTxt`.
- Les visuels OG restent des placeholders tant que les vrais rendus 3D ne sont pas fournis.

## Révision (2026-11-20) : repli au lieu de l'échec

La version initiale (`assertOgImageSource`) faisait échouer le build dès qu'une image de page mesurait moins de 1200 × 630. Les seules images réelles des réalisations disponibles (ancien site) font 1200 × 600 : elles auraient bloqué toutes les fiches projets. Options :

1. **Garder l'échec** : impose de recadrer ou d'agrandir les visuels à la main. Écartée (agrandir dégrade, et bloque la mise à jour du contenu).
2. **Laisser sharp produire une image plus petite** : `og:image:width` / `:height` mentiraient. Écartée.
3. **Repli explicite sur l'image par défaut** (retenue) : `pickOgImage` retient la candidate si elle couvre 1200 × 630, sinon l'image par défaut avec son propre `alt`. Garde-fou conservé sur l'image par défaut.

Conséquence : tant que les images HD ne sont pas fournies, les fiches projets partagent l'image OG par défaut. À revoir à leur arrivée.
