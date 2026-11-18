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
document.documentElement.classList.add('js');
```

- Chaîne exacte : `JS_CLASS_SCRIPT` dans `src/lib/inline-scripts.ts`, rendue par `<script is:inline set:html={JS_CLASS_SCRIPT} />` (44 octets).
- Les styles dépendants du JS s'écrivent `.js .composant { … }` (ou `:global(.js) .composant` dans un style scopé) ; par défaut, le composant est dans son état sans JS.
- Les **états d'animation** (apparitions au scroll) ne dépendent pas de cette classe : ils restent posés élément par élément par `scripts/reveal.ts`, uniquement hors écran, pour ne jamais cacher le contenu visible au chargement.

## CSP (Phase 7)

Le script est inline : la future `Content-Security-Policy` devra l'autoriser par son empreinte, jamais par `'unsafe-inline'`.

- Empreinte actuelle : `sha256-oO9dQz2/+Q17QWsmmtXJ9ZNoha86yQvUljQCBOLLu2E=` (170 octets).
- **Filet de sécurité** (audit accessibilité de la Phase 5) : si un module ne se charge pas ou lève une exception, le script retire la classe `js`. Le site revient alors à sa version sans JS, complète, au lieu d'afficher des filtres ou un comparateur inertes accompagnés d'une consigne fausse. Les erreurs d'images ne déclenchent pas ce retour (cible `<img>`). Contrepartie acceptée : une exception sans rapport, venant par exemple d'une extension du navigateur, peut aussi faire repasser la page en version sans JS, ce qui reste sans danger.
- À déclarer dans `security.csp.scriptDirective.hashes` (configuration Astro) ou dans l'en-tête CSP de `vercel.json`. La documentation d'Astro ne garantit pas que les scripts `is:inline` soient hachés automatiquement : à vérifier sur le build en Phase 7.
- `tests/unit/inline-scripts.test.ts` vérifie la taille (< 200 octets) et l'empreinte : toute modification du script fait échouer le test, ce qui oblige à mettre à jour cette ADR et la CSP.

## Alternatives écartées

- **`<noscript><style>`** dans le `body` : non conforme, retiré.
- **Classe `no-js` retirée par le script** : même mécanisme inversé, mais le HTML statique porterait un état (`no-js`) que les robots et les outils d'audit liraient comme tel ; la classe positive est plus simple.
- **Affichage par un script différé** : CLS mesurable sur `/realisations/` (filtres au-dessus de la grille).

## Conséquences

- Un navigateur avec JS mais dont les modules échouent affiche les filtres et le comparateur sans interactivité (le curseur natif reste utilisable au clavier, sans effet visuel). Cas marginal, accepté.
- Le script bloquant coûte moins d'une milliseconde ; il n'a aucune dépendance.
