# ADR-0010 — Classe `js` posée par un script inline en tête de page

- **Statut** : acceptée
- **Date** : 2026-11-18

## Contexte

Plusieurs composants n'ont de sens qu'avec JavaScript : la barre de filtres de `/realisations/`, le comparateur « Rendu 3D ↔ Réalisé », le bandeau de mots animé et son bouton pause. Sans JS, ils doivent s'effacer (filtres, bouton) ou garder leur version statique (paire d'images côte à côte, bandeau immobile).

La Phase 4 masquait les filtres sans JS par un `<noscript><style is:inline>` placé dans le `body` : HTML non conforme hors du `head`, et signalé en revue. Les autres options ont des défauts :

- un script de module (différé) qui affiche le composant après coup provoque un **décalage de mise en page** (CLS) : le composant apparaît après le premier rendu ;
- `@media (scripting: enabled)` est vrai dès que le JS est actif dans le navigateur, même si nos scripts n'ont pas chargé, et n'est pas reconnu par les navigateurs anciens.

## Décision

Un mini-script **inline et bloquant**, placé dans le `<head>` de `BaseLayout` juste après la balise `viewport`, pose la classe `js` sur `<html>` avant le premier rendu :

```js
var d = document.documentElement;
d.classList.add('js');
addEventListener(
  'error',
  function (e) {
    var t = e.target;
    if (t == window || t.tagName == 'SCRIPT') d.classList.remove('js');
  },
  true,
);
```

- Chaîne exacte (minifiée) : `JS_CLASS_SCRIPT` dans `src/lib/inline-scripts.ts`, rendue par `<script is:inline set:html={JS_CLASS_SCRIPT} />` (170 octets).
- **Filet de sécurité** (audit accessibilité de la Phase 5) : si un module ne se charge pas ou lève une exception, le script retire la classe `js`. Le site revient alors à sa version sans JS, complète, au lieu d'afficher des filtres ou un comparateur inertes accompagnés d'une consigne fausse. Les erreurs d'images ne déclenchent pas ce retour (cible `<img>`). Vérifié par `tests/e2e/js-fallback.spec.ts`.
- Les styles dépendants du JS s'écrivent `.js .composant { … }` (ou `:global(.js) .composant` dans un style scopé) ; par défaut, le composant est dans son état sans JS.
- Les **états d'animation** (apparitions au scroll) ne dépendent pas de cette classe : ils restent posés élément par élément par `scripts/reveal.ts`, uniquement hors écran, pour ne jamais cacher le contenu visible au chargement.

## CSP (Phase 7)

Le script est inline : la `Content-Security-Policy` (ADR-0012) l'autorise par son empreinte, jamais par `'unsafe-inline'`.

- Empreinte : `sha256-oO9dQz2/+Q17QWsmmtXJ9ZNoha86yQvUljQCBOLLu2E=` (170 octets).
- Vérifié sur le build (`astro@7.4.12`) : Astro **ne hache pas** les scripts `is:inline`. L'empreinte est calculée par `src/lib/csp.ts` (`INLINE_SCRIPT_HASHES`, à partir de `JS_CLASS_SCRIPT`) et déclarée dans `security.csp.scriptDirective.hashes` (`astro.config.mjs`).
- `tests/unit/inline-scripts.test.ts` vérifie la taille (< 200 octets) et l'empreinte documentée ici ; `tests/e2e/csp.spec.ts` vérifie que chaque script inline de chaque page a son empreinte dans la politique. Toute modification du script met donc à jour l'empreinte de la CSP automatiquement, et oblige à mettre à jour cette ADR.

## Alternatives écartées

- **`<noscript><style>`** dans le `body` : non conforme, retiré.
- **Classe `no-js` retirée par le script** : même mécanisme inversé, mais le HTML statique porterait un état (`no-js`) que les robots et les outils d'audit liraient comme tel ; la classe positive est plus simple.
- **Affichage par un script différé** : CLS mesurable sur `/realisations/` (filtres au-dessus de la grille).

## Conséquences

- Un navigateur avec JS mais dont les modules échouent retombe sur la version sans JS : filtres masqués, grille complète, comparateur remplacé par ses deux images. Aucun composant inerte.
- Contreparties acceptées : une exception sans rapport (extension du navigateur, par exemple) fait aussi repasser la page en version sans JS ; et une exception levée **après** le chargement, pendant l'usage, fait basculer la mise en page en cours de visite. Les deux cas restent sans danger : le contenu reste complet et lisible.
- Le script bloquant coûte moins d'une milliseconde ; il n'a aucune dépendance.
