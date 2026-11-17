# ADR-0006 — View Transitions natives entre documents

- **Statut** : acceptée
- **Date** : 2026-11-17

## Contexte

Le design system prévoit des transitions douces entre les pages (fondu croisé, puis morphing du visuel d'un projet entre la grille et la page détail en Phase 5). Astro propose deux voies : le routeur client `<ClientRouter />` ou les View Transitions **natives entre documents** (CSS `@view-transition`). Deux contraintes pèsent sur le choix :

- une **CSP** est prévue (Phase 7). La documentation d'Astro (`security.csp`) indique que les view transitions via `<ClientRouter />` ne sont pas prises en charge ;
- le budget JS est de 30 Ko par page.

## Décision

Transitions **natives**, sans `<ClientRouter />` :

```css
@media (prefers-reduced-motion: no-preference) {
  @view-transition {
    navigation: auto;
  }
}
```

La directive `transition:name` d'Astro reste utilisable : elle génère `view-transition-name`, qui sert aussi aux transitions natives (morphing grille → projet en Phase 5).

## Alternatives écartées

- **`<ClientRouter />`** : incompatible avec `security.csp`, ajoute environ 5 Ko de JS, oblige à rejouer les scripts à chaque navigation et à gérer le focus après navigation.
- **Aucune transition** : contraire au design system.

## Conséquences

- Navigateurs sans support (Firefox à ce jour) : chargement de page classique, sans transition. C'est de l'amélioration progressive, acceptable.
- Les scripts client s'exécutent une fois par chargement de page. `src/scripts/lifecycle.ts` (`onPageReady`) reste compatible avec un éventuel retour de `ClientRouter` (écoute de `astro:page-load` et `astro:before-swap`, nettoyage par `AbortSignal`).
- Mouvement réduit : aucune transition (la règle n'est déclarée que sous `prefers-reduced-motion: no-preference`).
