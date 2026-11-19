# ADR-0007 — Collections de contenu : format des pages, sections partagées et prix

- **Statut** : acceptée
- **Date** : 2026-11-18

## Contexte

La Phase 3 crée `src/content.config.ts`. Trois questions structurent la suite :

1. **Textes des pages** (accueil, visualisation 3D, à propos, contact, listes, 404, styleguide) : jusqu'ici dans `src/config/pages.ts`, un module TypeScript qu'Amandine ne pourra pas modifier seule et qui ne valide pas les longueurs SEO.
2. **Contenus partagés** entre plusieurs pages : la méthode en 6 étapes et les 8 bénéfices de la 3D (accueil, visualisation 3D, prestations).
3. **Prix** : le site actuel affiche 189 / 339 / 489 / 689 € (et 339 € pour le meuble sur mesure), mais Amandine ne les a pas encore confirmés pour le nouveau site.

## Options envisagées

Pour les pages :

1. **Un seul `pages.yaml` (loader `file`)** : tout est structuré, mais le fichier devient long, chaque modification touche toutes les pages, et le texte long (biographie, pages légales) s'écrit mal en YAML.
2. **Un fichier Markdown par page (loader `glob`)**, avec un en-tête validé (SEO, hero, sections nommées) et un corps Markdown facultatif : un fichier par page, des différences lisibles, un format que les CMS Git (Pages CMS, Decap) éditent nativement, et `render()` disponible pour le texte long.
3. **Un schéma par page** (union discriminée sur un champ `template`) : typage parfait, mais plus lourd à lire, à maintenir et à faire évoluer pour un petit site.

Pour les contenus partagés :

1. Les recopier dans chaque page : duplication, risque de divergence.
2. **Petites collections dédiées** (`etapes.yaml`, `avantages.yaml`, loader `file`) : une seule source, triée par `order`.

Pour les prix :

1. Ne pas les stocker : on perd une information publique et déjà affichée.
2. **Les stocker** dans un champ optionnel `price` et piloter l'affichage par un interrupteur global.

## Décision

- **Pages : option 2.** `src/content/pages/<page>.md` ; schéma commun `{ seo, noindex, hero, sections }`. Une _section_ a une forme unique et simple (`eyebrow?`, `heading`, `headingEmphasis?`, `lead?`, `items[]`, `quote?`, `actions[]`), et les sections sont **nommées** (`sections.methode`, `sections.cta`). La route choisit explicitement quelles sections afficher et dans quel ordre (la mise en page reste dans le code, le texte dans le contenu) ; `requireSection` (`src/lib/content.ts`) fait échouer le build si une section attendue manque. `src/config/pages.ts` est supprimé.
- **Longueurs SEO validées dans Zod** pour toutes les collections (`seo.title` ≤ 60, `seo.description` 140–160, comptage NFC), avec les fonctions et les seuils (`seoLimits`) de `src/lib/seo.ts`, aussi utilisés par le composant `SEO` : une seule source pour les seuils.
- **Contenus partagés : collections `etapes` et `avantages`.** Les valeurs (écoute, confiance, rigueur) n'apparaissent que sur « À propos » : elles restent une section de cette page.
- **Listes pures en YAML** (`temoignages`, `faq`, `etapes`, `avantages`) au format objet (la clé est l'identifiant), **contenus avec récit en Markdown/MDX** (`pages`, `prestations`, `projets`, `articles`).
- **Prix** : `price?: { amount, currency: 'EUR', from, note? }` ; les offres sur devis utilisent `quote?: { label, note? }` (l'un ou l'autre, jamais les deux). L'affichage dépend de `site.pricing.showPrices` (`src/config/site.ts`, `true` aujourd'hui puisque les prix sont publics, avec un `TODO(contenu)` de confirmation avant la mise en production). **Jamais d'`Offer` ni de `priceRange` en JSON-LD** tant que les prix ne sont pas validés.
- **Objets stricts** partout (`z.strictObject`) pour détecter les fautes de frappe dans les clés.

## Conséquences

- Amandine (ou un CMS Git) peut modifier un texte de page sans toucher au code ; le build refuse un titre trop long, une description hors limites, un `alt` vide ou un lien interne mal formé.
- Les sections sont faiblement couplées aux blocs : un bloc qui n'utilise pas `items` ou `quote` les ignore. À surveiller : si une page a besoin d'une structure vraiment différente, ajouter un champ optionnel à la section plutôt qu'un schéma par page (revoir cette ADR si cela se répète).
- Les squelettes contiennent des `TODO(contenu)` qui respectent les longueurs du schéma pour que le build passe : ils ne doivent jamais atteindre une page publiée (à vérifier en revue de la Phase 4).
- Masquer les prix se fait en une ligne (`showPrices: false`), sans toucher au contenu.
