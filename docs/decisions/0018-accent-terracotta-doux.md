# ADR-0018 — Accent terracotta doux à la place du camel

- **Statut** : acceptée
- **Date** : 2026-11-24
- **Remplace en partie** : [ADR-0017](0017-palette-ancien-site.md) (seulement la couleur d'accent ; les fonds restent ceux de l'ancien site)

## Contexte

L'ADR-0017 a repris la palette de l'ancien site d'Amandine : fonds crème, beige et grège, accent camel doré (`#C4A882` en décor, `#7A6440` pour les boutons, `#6B5636` pour les liens et le texte d'accent).

Le 2026-11-24, en validant la maquette des deux CRM (Atelier et Espace client), **l'humain a jugé le camel « pas joli »** et a demandé du terracotta, ce qui rejoint le souhait initial du brief (`docs/BRIEF.md` : Amandine aime le terracotta). Trois terracottas ont été comparés en direct sur la maquette (doux, brique, terre cuite rosée). L'humain a retenu le **terracotta doux, partout** : site public, Atelier et Espace client.

Contrainte bloquante inchangée : WCAG 2.2 AA (CLAUDE.md §6), vérifiée en test sur les cinq fonds de section.

## Décision

L'accent devient le terracotta doux. Les tokens prennent le nom de leur vraie couleur, comme le veut l'ADR-0017 :

| Token                    | Hex       | Remplace (camel) | Usage                                                                     |
| ------------------------ | --------- | ---------------- | ------------------------------------------------------------------------- |
| `--color-terracotta-300` | `#D79A7C` | `#C4A882`        | Décor seulement : filets, arches, ornements, surlignage (jamais de texte) |
| `--color-terracotta-600` | `#A4533A` | `#7A6440`        | Fond des boutons primaires (texte ivoire)                                 |
| `--color-terracotta-700` | `#8F4530` | `#6B5636`        | Liens, texte d'accent, italiques des titres, survol, anneau de focus      |

Les rôles sémantiques (`--color-accent`, `--color-accent-text`, `--color-action`, `--color-action-hover`, `--focus-ring-color`) ne changent pas de nom : seuls leurs tokens cibles changent. Les composants, qui n'utilisent que les rôles, ne bougent pas.

Contrastes mesurés (tronqués au centième) :

- `terracotta-700` (texte) : 6.47 crème, 6.75 ivoire, 5.41 beige, 4.92 grège, 5.54 vieux rose : ≥ 4.5:1 partout ;
- bouton : ivoire sur `terracotta-600` = 5.33:1, survol ivoire sur `terracotta-700` = 6.75:1 ;
- surlignage : encre sur `terracotta-300` = 5.08:1 ;
- `terracotta-600` échoue comme texte sur beige, grège et vieux rose : il ne sert jamais au texte ;
- `terracotta-300` (1.71 à 2.34:1) reste purement décoratif.

Les deux CRM (maquette validée, futur monorepo Nx) reprennent exactement ces trois valeurs.

## Conséquences

- `src/styles/tokens.css`, `public/favicon.svg`, le styleguide, les tests de contraste (`tests/unit/palette-contrast.test.ts`, `tests/unit/color-contrast.test.ts`), `docs/DESIGN-SYSTEM.md` et CLAUDE.md §1 et §4 sont mis à jour dans le même commit.
- Un test vérifie qu'aucun token `camel` ne subsiste.
- Les captures de régression visuelle (`npm run test:visual:update`) sont à régénérer.
- La vieille palette camel reste documentée dans l'ADR-0017 pour l'historique.
