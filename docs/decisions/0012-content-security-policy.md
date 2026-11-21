# ADR-0012 — Content-Security-Policy

- **Statut** : acceptée
- **Date** : 2026-11-19

## Contexte

La CSP avait été reportée à la Phase 7 (ADR-0004). Le site est 100 % statique, tout est servi par lui-même (polices auto-hébergées, images `astro:assets`, aucun script tiers). Trois éléments inline pèsent sur la politique :

- le script de classe `js` de `BaseLayout`, en `is:inline` (ADR-0010) ;
- les `<style>` inline produits par Astro (`@font-face` de la Fonts API, CSS des composants sous le seuil `inlineStylesheets`), dont le contenu, donc l'empreinte, change à chaque modification de style ;
- des attributs `style` qui transmettent une variable CSS au composant (`--icon-size`, `--arch-ratio`, `view-transition-name` des visuels de projet, `--marquee-copies`, échantillons du styleguide).

Le formulaire de contact envoie vers le service de `PUBLIC_FORM_ENDPOINT` (ADR-0003), par `fetch` avec JS et par envoi HTML sans JS ; sans service, il se replie sur `mailto:`.

## Options envisagées

1. **En-tête `Content-Security-Policy` dans `vercel.json`, empreintes figées** : la seule voie pour `frame-ancestors` et `report-to`, mais les empreintes des styles inline changent à chaque build : il faudrait les recalculer et recopier à la main, ou désactiver l'inlining des styles (requêtes en plus), ou céder `'unsafe-inline'` sur `style-src`. Fragile, non vérifiable par `astro preview` (qui n'applique pas `vercel.json`).
2. **`security.csp` d'Astro** (retenue) : Astro calcule au build les empreintes de tous les scripts et styles qu'il produit (source vérifiée dans `astro@7.4.12` : scripts traités et inlinés, styles inlinés, `<style>` de la Fonts API) et rend la politique dans une balise `<meta http-equiv="content-security-policy">` de chaque page. Les scripts `is:inline` ne sont **pas** hachés : leur empreinte se déclare dans `scriptDirective.hashes`.
3. **Nonces** : impossibles sur un site statique (aucun rendu par requête).

## Décision

- `astro.config.mjs` → `security.csp`, directives fournies par `src/lib/csp.ts` (fonctions pures testées dans `tests/unit/csp.test.ts`) :

  | Directive                 | Valeur                                                                    |
  | ------------------------- | ------------------------------------------------------------------------- |
  | `default-src`             | `'self'`                                                                  |
  | `script-src`              | `'self'` + empreintes (Astro + `INLINE_SCRIPT_HASHES`), jamais `unsafe-*` |
  | `style-src`               | `'self'` + empreintes calculées par Astro                                 |
  | `style-src-attr`          | `'unsafe-inline'` (voir ci-dessous)                                       |
  | `img-src`                 | `'self' data:` (flèche du `<select>` en SVG `data:`)                      |
  | `font-src`                | `'self'`                                                                  |
  | `connect-src`             | `'self'` + origine de `PUBLIC_FORM_ENDPOINT` si définie au build          |
  | `form-action`             | `'self'` + origine du service, sinon `mailto:` (repli du formulaire)      |
  | `base-uri`                | `'self'`                                                                  |
  | `object-src`              | `'none'`                                                                  |
  | `frame-src`, `worker-src` | `'none'`                                                                  |
  | `manifest-src`            | `'self'`                                                                  |

- `PUBLIC_FORM_ENDPOINT` est lu dans la configuration comme Vite le lira (`process.env`, puis fichiers `.env` via `loadEnv`) ; une URL non https fait échouer le build, comme `resolveFormTarget`.
- **Attributs `style`** : `style-src-attr 'unsafe-inline'`. L'alternative, `'unsafe-hashes'` + une empreinte par valeur, demanderait de recenser après le build toutes les valeurs générées (une par taille d'icône, ratio, nom de transition de projet…) : fragile pour un gain faible. Ces attributs ne contiennent que des variables CSS tirées du code ou du contenu versionné ; une injection de style ne peut ni exécuter de script ni charger de ressource externe (`img-src`/`font-src 'self'`). Les `<style>` restent, eux, autorisés par empreinte seulement. Les scripts qui écrivent `element.style.setProperty(…)` (comparateur, visionneuse) passent par le CSSOM, que la CSP ne bloque pas. Le build affiche l'avertissement Astro `[csp] security.csp.styleDirective defines style-src resources ('self') as well as style-src-attr…` : il est attendu, c'est précisément cette combinaison (feuilles et `<style>` par empreinte, attributs `style` permis) qui est voulue.
- **En-tête complémentaire** dans `vercel.json` : `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. `frame-ancestors` est ignoré dans une balise meta ; `X-Frame-Options: DENY` reste pour les navigateurs anciens. Cet en-tête ne contient ni `default-src` ni `script-src`/`style-src` : deux politiques se cumulent, une seconde politique figée bloquerait les styles inline.
- `upgrade-insecure-requests` n'est pas déclaré : toutes les ressources sont relatives au site, servi uniquement en HTTPS (HSTS) ; la directive casserait en outre le serveur de prévisualisation local en HTTP.

### Empreintes limitées à chaque page (amendement, audit performance de fin de Phase 7)

**Constat** (source `astro@7.4.12`, `core/build/plugins/plugin-manifest.js` et `core/csp/common.js`) : la politique est calculée **une fois pour tout le site** et copiée dans chaque page. `trackStyleHashes` parcourt les styles inlinés de toutes les pages (`internals.pagesByViteID`), `trackScriptHashes` ajoute les scripts inlinés et les 5 directives `client:*` même sans île. Résultat : 38 empreintes (8 `script-src`, 30 `style-src`) dans chaque `<meta>`, ~2,3 Ko bruts et ~1,5 Ko gzip incompressibles par document, alors qu'une page n'a que 3 à 4 éléments inline (script de classe `js`, deux `@font-face`, une feuille de page, plus celle du formulaire sur `/contact/`). L'accueil dépassait le budget HTML de 14 Kio gzip (14 901 octets). Aucune option d'Astro ne restreint la liste à la page ; l'API `Astro.csp` ne sait qu'ajouter.

**Options mesurées** (accueil, gzip ; Lighthouse mobile simulé, médiane de 5, A/B/C entrelacés) :

| Option                                  | HTML accueil (gzip) | Feuilles bloquantes accueil | Requêtes accueil | FCP accueil / article |
| --------------------------------------- | ------------------- | --------------------------- | ---------------- | --------------------- |
| État initial (`inlineStylesheets` auto) | 14 901 o            | 1                           | 15               | 940 / 907 ms          |
| **Élagage par page** (retenue)          | **13 458 o**        | 1                           | 15               | 966 / 843 ms          |
| Élagage + `inlineStylesheets: 'never'`  | 10 089 o            | 12                          | 26               | 1 187 / 1 107 ms      |

`'never'` fait tomber les empreintes de style à 2 mais éclate la CSS en 12 feuilles bloquantes sur l'accueil (+11 requêtes, FCP +200 à +250 ms sur 4 des 5 pages mesurées). `'always'` ajouterait la feuille commune (9,2 Ko gzip) dans chaque document : budget HTML hors de portée.

**Décision** : une intégration `amg:csp-par-page` (`astro.config.mjs`, hook `astro:build:done`) passe chaque fichier HTML produit à `pruneCspHashes` (`src/lib/csp.ts`, fonction pure testée dans `tests/unit/csp.test.ts`), qui retire de `script-src`, `script-src-elem`, `style-src` et `style-src-elem` toute empreinte sans élément `<script>`/`<style>` inline correspondant **dans la page**. Le reste de la politique est intact. La politique est **plus stricte** qu'avant (une empreinte inutile autoriserait ce contenu s'il était injecté) et rien n'est assoupli : ni `'unsafe-inline'` en `script-src`/`style-src`, ni test désactivé. `tests/e2e/csp.spec.ts` vérifie désormais les deux sens : chaque élément inline a son empreinte, et chaque empreinte correspond à un élément de la page.

Gain : −1 430 à −1 445 octets gzip sur chacune des 25 pages, accueil 13 458 octets (marge de 878 octets sous le budget). À surveiller si Astro change la forme de sa balise meta (expression régulière de `pruneCspHashes`) : le test e2e échouerait alors sur les empreintes superflues.

## Conséquences

- **Toute nouvelle ressource externe** (police, image distante, carte, vidéo, analytics, widget d'avis, iframe) **exige d'amender la politique** dans `src/lib/csp.ts`, avec son test et cette ADR. Sans cela, elle est bloquée en production.
- Tout nouveau script `is:inline` doit voir son empreinte ajoutée à `INLINE_SCRIPT_HASHES` ; `tests/e2e/csp.spec.ts` échoue sinon (chaque `<script>`/`<style>` inline de chaque page doit avoir son empreinte dans la politique, et seulement celles de ses éléments après `pruneCspHashes`).
- La balise meta est rendue par Astro avec le reste du `<head>`, après le script `is:inline` et les `<style>` de la Fonts API : ceux-ci s'exécutent avant que la politique ne s'applique. Leurs empreintes figurent quand même dans la politique (vérifié par `tests/e2e/csp.spec.ts`), si bien qu'un déplacement de la balise ne casserait rien.
- Limites d'une balise meta : pas de `frame-ancestors` (porté par l'en-tête), pas de `report-to`/`report-uri` (aucun rapport de violation en production), pas de `sandbox`.
- `<ClientRouter />` reste exclu (incompatible avec `security.csp`, ADR-0006).
- Vérifications : `tests/e2e/csp.spec.ts` (politique et empreintes de chaque page, aucune violation au chargement ni pendant les interactions : menu mobile, navigation avec préchargement et transition, filtres, visionneuse, comparateur, formulaire en `mailto:`), `tests/e2e-service/csp.spec.ts` (origine du service autorisée, envoi avec et sans JS), `tests/unit/security-headers.test.ts` (en-têtes de `vercel.json`). La politique d'en-tête n'est vérifiable que sur un déploiement Vercel (preview).
- Les tests qui injectent du CSS passent par le CSSOM (`adoptedStyleSheets`), jamais par une balise `<style>` ; les tests de `contact.spec.ts` qui simulent un service sur le build `mailto:` contournent la CSP (`bypassCSP`), la CSP réelle du mode service étant testée sur son propre build.
