# ADR-0013 — Apparitions au défilement : liées au scroll, une liste = un bloc

- **Statut** : acceptée
- **Date** : 2026-11-19

## Contexte

L'audit performance de la Phase 5 a mesuré, sur l'accueil, un défilement complet à CPU ×4 : 386 recalculs de style, 69 layouts et 157 peintures, contre 8 / 1 / 18 sans les apparitions (effet 1 du design system : `src/scripts/reveal.ts` + `src/styles/motion.css`). 41 éléments `[data-reveal]` étaient observés et animés un par un, chaque carte d'une liste comprise, par une transition retardée de `--stagger` × rang.

Mesures complémentaires (Chromium) :

- une animation temporelle `opacity` / `transform` est bien composée, mais **pendant un défilement le fil principal recalcule le style de chaque élément en cours d'animation à chaque image** ; et chaque animation qui démarre ou finit à un instant propre coûte environ 6 recalculs (5 cartes avec un délai chacune : ~32 recalculs ; les mêmes avec une durée partagée : ~5) ;
- une animation liée au défilement (`animation-timeline: view()`) n'impose rien de tel : elle reste sur le compositeur.

Options évaluées par l'audit :

- **(A)** animations pilotées par le défilement, CSS seul : −77 % de recalculs, mais rendu lié à la position, sans cascade, Firefox statique ;
- **(B)** animer les listes plutôt que chaque carte, en gardant la cascade.

B seule a été implémentée et mesurée d'abord (listes en un bloc, cascade à durée partagée) : −38 % de recalculs en défilement lent, mais seulement −10 à −40 % en défilement continu, parce que des animations temporelles restent en cours presque tout le temps.

## Décision

**A en premier choix, B en repli**, avec les garde-fous de l'existant.

1. **Une liste = un bloc.** `data-reveal="list"` sur le `<ul>` / `<ol>` (prestations, projets, étapes, avantages, valeurs, piliers, témoignages, offres, points de `MediaText`) au lieu de `data-reveal` sur chaque `<li>`. Accueil : 18 blocs au lieu de 41.
2. **Navigateurs qui gèrent `animation-timeline: view()`** (Chromium, Safari ; `@supports` + `prefers-reduced-motion: no-preference`) : `reveal.ts` pose `data-reveal-state="scroll"` sur les blocs sous la ligne de flottaison et s'arrête là (aucun observateur, aucun changement d'état ensuite). Le bloc se dévoile (fondu + `translateY(--reveal-distance)`, `--ease-out`) **pendant les `--reveal-scroll-length` (18vh) de son entrée par le bas de la fenêtre**. Dans une rangée de cartes (≥ 48rem), chaque colonne démarre `--reveal-scroll-stagger` (3vh) plus tard : la cascade devient spatiale.
3. **Repli** (Firefox, ou `CSS.supports` négatif) : `pending` → `in` par IntersectionObserver quand le haut du bloc franchit 90 % de la fenêtre, une fois, animation CSS temporelle, état retiré au premier `animationend`. Cascade d'une liste **sans délai par enfant** : chaque enfant joue `reveal-cascade-<rang>` (6 rangs, `:nth-child`), toutes de même durée `--reveal-cascade-duration` (`--dur-base` + 5 × `--stagger` = 800 ms) et démarrées ensemble ; les `@keyframes` attendent rang × `--stagger`, puis bougent en `--dur-base`. Pourcentages vérifiés contre les tokens par `tests/unit/reveal-keyframes.test.ts`.
4. L'**image reveal** des galeries (masque `clip-path`) reste temporelle (`pending` → `in`) : c'est un lever de rideau, pas un fondu, et il ne concerne que les pages projet.

Inchangé : contenu complet sans JS et en mouvement réduit (aucun état dans le HTML, le script ne fait rien), rien de préparé au-dessus de la ligne de flottaison (LCP intact), focus clavier qui révèle aussitôt (`:focus-within` sur le bloc et les enfants d'une liste, `focusin` dans `reveal.ts`, quel que soit l'état), `transform` / `opacity` / `clip-path` uniquement.

### Pourquoi c'est acceptable pour la direction artistique

- Le dévoilement tient dans une **bande basse courte** : un bloc est entièrement net avant d'atteindre la zone de lecture, jamais de texte voilé au milieu de l'écran, même à l'arrêt.
- Il suit la main du lecteur : lent quand on feuillette lentement, immédiat quand on défile vite (jamais de contenu « en retard »). C'est l'esprit du magazine qu'on feuillette.
- En remontant, un bloc qui ressort par le bas se voile de la même façon : il quitte l'écran, ce n'est pas une disparition de contenu lu.
- La cascade de 70 ms entre cartes devient un décalage de 3vh entre colonnes : même intention, sans minuterie.

## Mesures

Accueil, défilement complet à la molette (un tiers de fenêtre toutes les 120 ms, ou toutes les 1 000 ms pour la « lecture »), CPU ×4, Chromium de Playwright, compteurs `Performance.getMetrics` et trace `devtools.timeline` (`UpdateLayoutTree`, `Layout`, `Paint`), médiane de 3 par mesure, même serveur statique pour tous les builds. Machine partagée très chargée pendant la mesure (charge 20 à 65 sur 8 cœurs) : les durées varient d'une série à l'autre, les nombres d'événements sont plus fiables.

Recalculs de style / layouts / peintures (médianes) :

| Scénario                     | Avant (41 cibles, transitions) | B seule (repli, Firefox) | **Retenu : A + repli B** | Sans apparition |
| ---------------------------- | ------------------------------ | ------------------------ | ------------------------ | --------------- |
| Défilement continu, 1440 px  | 181–197 / 50–53 / 129–139      | 161–171 / 17–19 / 87–108 | **46–49 / 3 / 22–24**    | 24 / 3 / 22     |
| Défilement continu, 375 px   | 280–333 / 62–63 / 156–167      | 172 / 20 / 113           | **61 / 3 / 38**          | —               |
| Lecture (pause 1 s), 1440 px | 183 / 55 / 182                 | 113 / 19 / 141           | **50 / 3 / 24**          | —               |

Soit, en défilement continu sur l'accueil : **−75 % de recalculs de style à 1440 px et −82 % à 375 px, −94 % de layouts, −76 à −83 % de peintures**, et aucune durée de script pendant le défilement (0 ms contre 36 à 61 ms). La durée cumulée de recalcul de style passe de 1 044–1 193 ms à 111–131 ms (1440 px, CPU ×4). Le prototype A seul de l'audit (CSS injecté sur l'ancien build) donnait 55 / 3 / 20 dans les mêmes conditions : le choix retenu garde son coût tout en conservant la cascade, le repli Firefox et les garde-fous (ligne de flottaison, focus, ancre).

## Conséquences

- Firefox garde l'apparition temporelle (repli B) : son coût est réduit mais reste supérieur à celui de Chromium et Safari.
- Les enfants d'une liste révélée ne portent pas de `transform` propre (la fin des `@keyframes` du repli fixe `transform: none` ; les décalages éditoriaux passent déjà par les marges).
- Changer `--dur-base` ou `--stagger` impose de recalculer les pourcentages des `@keyframes reveal-cascade-*` (le test échoue sinon).
- Sur mobile, dans le repli, les cartes d'une longue liste déjà sous l'écran quand la liste apparaît ont fini leur animation avant d'être vues : elles sont simplement en place.
- Les tests e2e couvrent les deux chemins : Chromium natif (`ViewTimeline`) et repli simulé (`CSS.supports` forcé à `false`).

## Révision du 2026-11-20 (audit global)

- **Cascade par colonne dans l’ordre de lecture.** Le décalage supposait trois colonnes (`:nth-child(3n + 2)` / `(3n)` dès 48rem) : faux pour `ServicesGrid` (4 colonnes) et pour les grilles à 2 colonnes (projets, avantages), où des cartes apparaissaient dans le désordre. Chaque bloc de liste déclare désormais son nombre de colonnes (`--reveal-columns`, aux points de rupture de sa grille) ; une requête de style `@container style(--reveal-columns: n)` en déduit la colonne de chaque enfant. Un enfant abaissé par une marge éditoriale (zigzag) déclare cette marge dans `--reveal-shift`, retranchée de son décalage : sans cela, une carte basse de la 2ᵉ colonne entrait après la 3ᵉ. Propriétés enregistrées (`@property`, non héritées). Les requêtes de style sur propriété personnalisée sont gérées partout où `view()` l’est (Chromium 111+, Safari 18+) ; le repli temporel garde sa cascade par rang, déjà dans l’ordre de lecture.
