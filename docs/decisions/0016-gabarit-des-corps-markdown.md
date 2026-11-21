# ADR-0016 — Gabarit des corps Markdown : jetons de site.ts et blocs selon le mode du formulaire

- **Statut** : acceptée
- **Date** : 2026-11-20

## Contexte

Deux problèmes dans les pages légales, dont le corps est du Markdown rendu par Astro :

1. **Coordonnées recopiées.** Email, téléphone et SIRET y étaient écrits en dur, alors que `src/config/site.ts` est la source de vérité unique (CLAUDE.md §3). Un changement d'adresse aurait laissé des pages légales fausses.
2. **Confidentialité inexacte en repli `mailto:`.** Sans `PUBLIC_FORM_ENDPOINT`, le formulaire ouvre la messagerie du visiteur (ADR-0003). La politique de confidentialité affirmait pourtant qu'un service de formulaire reçoit les données et enregistre l'adresse IP (RGPD art. 13 : l'information doit être exacte).

Contraintes : Astro 7 rend le Markdown avec **Sätteri** (processeur natif par défaut) ; `markdown.remarkPlugins` est déprécié et exigerait d'installer `@astrojs/markdown-remark`. Le Content Layer met en cache le HTML rendu (`node_modules/.astro/data-store.json`, conservé d'un build à l'autre, y compris sur Vercel) et ne le vide que si le fichier ou la configuration Astro change. Le texte doit rester lisible et modifiable par une personne qui ne code pas.

## Options envisagées

1. **Pages légales en `.astro`** (ou MDX avec expressions) — accès direct à `site` et aux conditions, mais le texte juridique quitte `src/content/` et se mêle au balisage.
2. **Remplacement dans le HTML rendu** (`entry.rendered.html` + `set:html`) — pas de plugin, mais les URL sont déjà encodées (`mailto:%7Bemail%7D`) et les intertitres du sommaire sont calculés avant le filtrage des blocs.
3. **Plugin Sätteri qui réécrit le source Markdown avant analyse**, piloté par des fonctions pures : jetons `{email}` (texte et URL des liens) et blocs `{formulaire:service}` … `{/formulaire}`.

## Décision

**Option 3.**

- `src/lib/content-template.ts` : fonctions pures `fillTokens`, `selectFormBlocks`, `renderContentTemplate`, `siteTemplateVariables(site)`, et la fabrique `contentTemplatePlugin(context)` (plugin mdast Sätteri, hook `before` qui remplace la racine par le source réécrit ; import de types seulement). Tests : `tests/unit/content-template.test.ts`, dont un rendu réel par `markdownToHtml` de Sätteri.
- `astro.config.mjs` : `markdown.processor: satteri({ mdastPlugins: [contentTemplatePlugin(contentTemplate)] })`, avec `contentTemplate = { variables: siteTemplateVariables(site), formMode: resolveFormTarget(PUBLIC_FORM_ENDPOINT, site.email).kind }` : le même calcul de mode que le formulaire.
- Syntaxe, dans le corps des fichiers `.md` (les `.mdx` sont ignorés : `{…}` y est une expression) :
  - jetons `{email}`, `{phone}` (affichage), `{phoneE164}` (lien `tel:`), `{siret}` ;
  - blocs `{formulaire:service}` / `{formulaire:mailto}`, fermés par `{/formulaire}`, marqueurs seuls sur leur ligne et entourés de lignes vides ; le bloc du mode du build est gardé, l'autre retiré, les marqueurs toujours supprimés.
- **Erreurs explicites** : jeton inconnu (faute de frappe), bloc non fermé, imbriqué, orphelin ou mode inconnu font échouer le build avec le fichier et la ligne du corps.
- **Cache** : le contexte (mode et valeurs) est une propriété du plugin, donc sérialisé dans l'empreinte de configuration d'Astro (`astro-config-digest`) ; un changement de mode ou de coordonnées vide le cache du Content Layer. Vérifié : le build `dist-service/` lancé juste après `dist/` publie bien les blocs du mode service.
- Nouveau champ `site.registration.siret`.
- Dépendances déclarées : `@astrojs/markdown-satteri` (dépendance, pour configurer le processeur) et `satteri` (développement, types et test du plugin). Toutes deux étaient déjà installées par Astro : aucun octet ajouté.

## Conséquences

- Positif : une seule source pour les coordonnées ; la politique de confidentialité décrit exactement le mode du build (aucun service mentionné en repli `mailto:`) ; une faute de frappe dans un jeton casse le build au lieu de publier `{emial}`. Contrôles : `tests/e2e/pages.spec.ts` (coordonnées, texte du mode `mailto:`, aucun jeton ni marqueur dans `dist/`) et `tests/e2e-service/privacy.spec.ts` (texte du mode service).
- Négatif : une mini-syntaxe maison à connaître (documentée en tête des fichiers concernés et dans `docs/ARCHITECTURE.md`) ; le plugin s'applique à tous les `.md`, donc une accolade littérale `{mot}` dans un corps Markdown est refusée.
- À surveiller : l'API de plugins de Sätteri (0.11) peut évoluer ; le test unitaire qui rend le Markdown par Sätteri le signalera. Le mode du formulaire est figé au build : changer `PUBLIC_FORM_ENDPOINT` impose un nouveau build (déjà le cas pour la CSP, ADR-0012).
