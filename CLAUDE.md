# CLAUDE.md — Site AMG Décoration d'Intérieur

> Fichier de cadrage lu par Claude Code à chaque session. **Il fait autorité.**
> En cas de doute : ce fichier > `docs/` > ton intuition. Si une règle bloque, propose une ADR, ne contourne jamais.

---

## 1. Mission

Refondre totalement le site **amgdecorationdinterieur.com** d'Amandine Gaury, décoratrice / designer d'intérieur spécialisée dans la **visualisation 3D** (Paris + accompagnement à distance partout en France).

Objectifs, par ordre de priorité :

1. **Donner envie** : site éditorial, chaleureux, raffiné, qui met ses réalisations et ses rendus 3D en valeur (palette **pastel + terracotta**).
2. **Être trouvé** : SEO irréprochable (technique, local, sémantique), migration sans perte de référencement.
3. **Convertir** : chaque page mène vers une prise de contact (formulaire, téléphone, WhatsApp).
4. **Être rapide et accessible** : Lighthouse ≥ 95 partout, WCAG 2.2 AA.

Le brief complet est dans `docs/BRIEF.md` et l'inventaire du contenu existant dans `docs/CONTENU-EXISTANT.md`. **Lis-les avant toute phase.**

---

## 2. Stack (non négociable sans ADR)

| Sujet        | Choix                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Astro, dernière version stable** (v7.x au moment du cadrage). Vérifier la version réelle avec `npm view astro version` et la doc via le MCP Context7. |
| Langage      | TypeScript `strict` (preset `astro/tsconfigs/strictest`)                                                                                                |
| Rendu        | **100 % statique** (`output: 'static'`), aucun SSR pour l'instant                                                                                       |
| Hébergement  | **Vercel** (statique ; adaptateur `@astrojs/vercel` seulement si un besoin réel apparaît)                                                               |
| Styles       | **CSS natif moderne** : tokens en custom properties, `@layer`, nesting, container queries, styles scopés Astro. Pas de Tailwind (voir ADR-0002).        |
| JS client    | Vanilla TypeScript dans `src/scripts/`, chargé par des `<script>` Astro. **Aucun framework UI** (React/Vue…) sans ADR.                                  |
| Contenu      | Content Layer API (`src/content.config.ts`, loaders `glob`/`file`, schémas Zod 4)                                                                       |
| Images       | `astro:assets` (`<Image>` / `<Picture>`, AVIF + WebP)                                                                                                   |
| Polices      | Fonts API intégrée d'Astro (auto-hébergées, `font-display: swap`, preload de la police d'affichage uniquement)                                          |
| SEO          | `@astrojs/sitemap`, composant `SEO.astro` maison, JSON-LD typé                                                                                          |
| Qualité      | ESLint (flat config + `eslint-plugin-astro` + `jsx-a11y-x`, voir ADR-0004), Prettier (+ `prettier-plugin-astro`), Stylelint, `astro check`              |
| Tests        | Vitest (unitaires `src/lib`), Playwright + `@axe-core/playwright` (e2e + a11y), Lighthouse CI                                                           |
| Gestionnaire | **npm** · Node **≥ 22.23.4**, 24 en CI (voir `.nvmrc`, ADR-0004)                                                                                        |

Avant d'utiliser une API Astro, **vérifie-la dans la doc à jour** (MCP `context7` ou docs.astro.build). Ne te fie jamais à ta mémoire pour une API qui a pu changer entre v5 et v7.

---

## 3. Architecture

```
src/
├── assets/                 # images traitées par astro:assets (jamais dans public/)
│   ├── projets/<slug>/     # une galerie par réalisation (avant / 3D / après)
│   └── brand/              # logo, portrait, textures
├── components/
│   ├── ui/                 # atomes sans logique métier : Button, Link, Heading, Tag, Icon, Container, Section
│   ├── blocks/             # sections réutilisables : Hero, ServiceCard, ProjectCard, ProjectGrid,
│   │                       #   ProcessSteps, BeforeAfter, Testimonials, CtaBanner, FaqList, Marquee
│   ├── layout/             # Header, Footer, MobileNav, SkipLink, Breadcrumbs
│   └── seo/                # SEO.astro, JsonLd.astro
├── config/
│   ├── site.ts             # SOURCE DE VÉRITÉ UNIQUE : nom, NAP, horaires, réseaux, navigation
│   └── seo.ts              # valeurs SEO par défaut, image OG par défaut
├── content/                # contenus éditoriaux (md/mdx/yaml)
│   ├── projets/            # réalisations
│   ├── prestations/        # formules (Essentiel, Confort, Signature, Studio)
│   ├── articles/           # blog "Conseils déco" (moteur SEO longue traîne)
│   ├── temoignages.yaml
│   └── faq.yaml
├── content.config.ts       # schémas Zod de toutes les collections
├── layouts/                # BaseLayout (html/head/SEO), PageLayout, ArticleLayout, ProjectLayout
├── lib/                    # fonctions PURES et testées (jsonld.ts, seo.ts, format.ts, reading-time.ts)
├── pages/                  # routes uniquement : assemblage de blocks, zéro logique
├── scripts/                # JS client : reveal.ts, before-after.ts, header.ts, lightbox.ts
└── styles/
    ├── tokens.css          # couleurs, typo, espacements, rayons, ombres, durées, easings
    ├── reset.css
    ├── global.css          # @layer reset, base, components, utilities
    └── utilities.css
tests/
├── unit/                   # Vitest
└── e2e/                    # Playwright (+ axe)
docs/                       # documentation vivante (voir §9)
```

### Règles d'architecture

- **Une responsabilité par fichier.** Composant > ~150 lignes ⇒ le découper.
- **Pages = assemblage.** Aucune requête, calcul ou markup complexe dans `src/pages/` : tout passe par `components/blocks` et `lib/`.
- **Dépendances descendantes uniquement** : `pages → layouts → blocks → ui`. Un `ui/` n'importe jamais un `blocks/`.
- **Aucune donnée en dur** dans les composants : nom, téléphone, email, réseaux, navigation viennent de `src/config/site.ts` ; les textes éditoriaux viennent de `src/content/`.
- Chaque composant déclare `interface Props` (typée, sans `any`), avec valeurs par défaut explicites.
- Alias d'import : `@/components/*`, `@/lib/*`, `@/config/*`, `@/styles/*`, `@/assets/*`.
- Nommage : composants `PascalCase.astro`, scripts/lib `kebab-case.ts`, slugs d'URL en français sans accents (`/realisations/chalet-suisse`).
- **Langue** : identifiants de code en anglais, contenu, commentaires utiles, docs et commits en **français**.

---

## 4. Design (résumé, détail dans `docs/DESIGN-SYSTEM.md`)

- Direction : **"Atelier lumineux"**, éditorial et chaleureux, beaucoup d'air, grandes images, typographie serif expressive, formes en **arche**, grain de papier subtil.
- Palette : fond lin/crème, terracotta (couleur de marque), rose poudré, sauge, sable, encre brun profond. **Uniquement via les tokens** `--color-*` ; aucune couleur hexadécimale hors de `tokens.css`.
- Effets : apparitions douces au scroll, View Transitions entre pages, **slider avant/après "Rendu 3D ↔ Réalisé"** (signature du site), zoom lent des images au survol, curseur/CTA magnétiques légers, marquee de mots-clés.
- **Toute animation respecte `prefers-reduced-motion`**, n'anime que `transform`/`opacity`, et ne bloque jamais le contenu (le contenu est visible sans JS).
- Mobile first. Points de rupture via tokens. Cibles tactiles ≥ 44 px.

---

## 5. SEO (résumé, détail dans `docs/SEO-STRATEGIE.md`)

Chaque page **doit** :

- passer par `BaseLayout` avec les props SEO obligatoires (`title` ≤ 60 car., `description` 140–160 car., `canonical` auto) ;
- avoir **un seul `<h1>`** et une hiérarchie de titres sans saut ;
- avoir Open Graph + Twitter Card, une image OG 1200×630 ;
- inclure le JSON-LD adapté (généré par `src/lib/jsonld.ts`, jamais écrit à la main dans une page) ;
- avoir des `alt` descriptifs (pas "image de…") sur toute image informative, `alt=""` sur les décoratives ;
- être liée depuis au moins une autre page (maillage interne).

**Migration** : les anciennes URLs (`/services/`, `/about/`, `/a-propos/`, `/contact/`, pages légales, pages projets) **doivent** rediriger en 301 vers les nouvelles (`vercel.json` → `redirects`). Aucune URL indexée ne doit tomber en 404.

---

## 6. Budgets qualité (bloquants pour la relecture)

| Indicateur                                        | Seuil                                                         |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Lighthouse Performance (mobile)                   | ≥ 95                                                          |
| Lighthouse Accessibilité / Bonnes pratiques / SEO | 100                                                           |
| LCP / CLS / INP                                   | < 2,0 s / < 0,05 / < 200 ms                                   |
| JS client par page (gzip)                         | < 30 Ko                                                       |
| CSS total (gzip)                                  | < 35 Ko                                                       |
| Image héro                                        | AVIF, < 180 Ko, `fetchpriority="high"`, dimensions explicites |
| Violations axe-core                               | 0                                                             |
| `astro check`, ESLint, Stylelint, tests           | 0 erreur, 0 warning                                           |

---

## 7. Équipe d'agents (`.claude/agents/`)

Tu es le **chef de projet / lead dev**. Tu planifies, implémentes et **délègues** aux spécialistes. Tu ne te relis jamais toi-même : c'est le rôle du `reviewer`.

| Agent           | Quand l'appeler                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `architecte`    | Avant de créer une nouvelle structure, un composant partagé, une collection ; pour tout refactor ; arbitre la propreté du code.                                    |
| `designer`      | Design system, tokens, mise en page, composants visuels, animations, cohérence de la DA. Vérifie le rendu réel avec le MCP Playwright (captures mobile + desktop). |
| `redacteur`     | Tous les textes : titres, accroches, pages, articles, `alt`, meta descriptions. Ton chaleureux, "je", français impeccable.                                         |
| `seo`           | Balises, JSON-LD, sitemap, redirections, maillage, mots-clés, stratégie de contenu.                                                                                |
| `accessibilite` | Audit WCAG 2.2 AA / RGAA de toute page ou composant interactif.                                                                                                    |
| `performance`   | Images, polices, poids JS/CSS, Core Web Vitals, Lighthouse.                                                                                                        |
| `qa`            | Écrit et exécute les tests (unitaires, e2e, a11y, régression visuelle), vérifie liens et build.                                                                    |
| `conformite`    | Mentions légales, CGS, RGPD, cookies, formulaire de contact.                                                                                                       |
| `reviewer`      | **Gardien final.** Obligatoire avant tout `git push` et toute PR. Seul habilité à approuver.                                                                       |

Les sous-agents ne peuvent pas s'appeler entre eux : **c'est toi qui orchestres**. Lance en parallèle les audits indépendants (ex. `accessibilite` + `performance` + `seo`).

---

## 8. Workflow Git & cycle de livraison (OBLIGATOIRE)

Branches : `main` = production (Vercel prod, **jamais touchée par Claude**) · `dev` = intégration (Vercel preview).

Pour **chaque phase** de `docs/ROADMAP.md` :

1. **Planifier** — lire la phase, lister les tâches (TaskCreate), consulter `architecte` si nouvelle structure.
2. **Implémenter** sur `dev` — commits atomiques, [Conventional Commits](https://www.conventionalcommits.org/) en français : `feat(accueil): ajoute le slider avant/après 3D`.
3. **Vérifier** — `npm run verify` doit être vert (check + lint + tests + build).
4. **Auditer** — lancer les agents spécialistes concernés ; corriger tout point bloquant.
5. **Documenter** — cocher la phase dans `docs/ROADMAP.md`, compléter `CHANGELOG.md`, ajouter une ADR si une décision structurante a été prise. Committer.
6. **Relire** — appeler `reviewer`. S'il renvoie `CHANGES_REQUESTED` : corriger, recommitter, relancer. Après **3 refus consécutifs** sur le même point : s'arrêter et demander à l'humain.
7. **Livrer** — uniquement après `APPROVED` : `git push origin dev`, puis créer la PR `dev → main` (ou mettre à jour sa description si elle existe) avec `gh pr create --base main --head dev` en utilisant `.github/pull_request_template.md`.
8. **Passer à la phase suivante.** Le merge vers `main` est fait **par l'humain**.

### Garde-fous techniques (`.claude/hooks/guard-git.mjs`)

- `git push` et `gh pr create` sont **bloqués** tant que le SHA de `HEAD` n'est pas celui approuvé par le `reviewer` (`.claude/state/approved-sha`).
- **Seul l'agent `reviewer` écrit ce fichier.** L'écrire toi-même est une faute grave.
- Interdits absolus : push sur `main`, `--force`, `gh pr merge`, commit sur `main`, réécriture d'historique déjà poussé, commit de secrets (`.env*`).

---

## 9. Documentation vivante (`docs/`)

| Fichier                 | Contenu                                        | Mis à jour par     |
| ----------------------- | ---------------------------------------------- | ------------------ |
| `BRIEF.md`              | Besoin client, cible, ton, objectifs           | humain             |
| `CONTENU-EXISTANT.md`   | Inventaire du site actuel à migrer             | toi / `redacteur`  |
| `DESIGN-SYSTEM.md`      | Palette, typo, espacements, motion, composants | `designer`         |
| `ARCHITECTURE.md`       | Arborescence, flux de données, conventions     | `architecte`       |
| `SEO-STRATEGIE.md`      | Mots-clés, plan de site, redirections, JSON-LD | `seo`              |
| `ROADMAP.md`            | Phases et cases à cocher                       | toi                |
| `decisions/`            | ADR numérotées (`NNNN-titre.md`)               | toi / `architecte` |
| `CHANGELOG.md` (racine) | Historique lisible par phase                   | toi                |

Une modification de code qui rend une doc fausse **doit** mettre à jour cette doc dans le même commit.

---

## 10. Commandes

```bash
npm run dev          # serveur local
npm run build        # build statique dans dist/
npm run preview      # prévisualiser dist/
npm run check        # astro check (types)
npm run lint         # eslint + stylelint + prettier --check
npm run format       # prettier --write
npm run test         # vitest
npm run test:e2e     # playwright (lance le build + preview)
npm run lhci         # lighthouse ci sur le build
npm run verify       # check + lint + test + build  ← doit être vert avant toute revue
```

Commandes Claude (slash) : `/demarrer` (enchaîne toute la roadmap en autonomie), `/phase <n>`, `/revue`, `/livrer`, `/audit`.

---

## 11. Ce que tu ne fais JAMAIS

- Inventer des faits sur Amandine (diplômes, chiffres, prix, avis clients, projets). Si une info manque : placeholder `TODO(contenu): …` + liste dans la PR.
- Inventer de faux témoignages ou de fausses notes Google.
- Copier le design, les textes ou les images d'un autre site.
- Utiliser des images de banques d'images sans l'indiquer ; les placeholders vont dans `src/assets/placeholders/` et sont listés dans la PR.
- Ajouter une dépendance sans justification (une ligne dans la PR ; une ADR si elle est structurante).
- Laisser un `console.log`, un `any`, un `// @ts-ignore`, un TODO non tracé.
- Désactiver une règle de lint, un test ou un hook pour "faire passer".
- Pousser sans approbation du `reviewer`.

## 12. Infos manquantes à demander à l'humain (une seule fois, en fin de phase)

Photos HD des réalisations et rendus 3D · portrait d'Amandine · logo vectoriel · SIRET / statut juridique (mentions légales) · tarifs à afficher ou non · service de formulaire choisi (voir ADR-0003) · accès Google Search Console / Google Business Profile.
