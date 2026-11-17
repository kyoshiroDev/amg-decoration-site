# AMG Décoration d'Intérieur — nouveau site

Refonte complète de [amgdecorationdinterieur.com](https://amgdecorationdinterieur.com/) : Astro (statique) · Vercel · design pastel & terracotta · SEO soigné.
Le projet est conçu pour être **construit de A à Z par Claude Code**, encadré par `CLAUDE.md` et une équipe d'agents spécialisés.

## Prérequis (une seule fois)

| Outil | Vérifier |
|---|---|
| Node.js ≥ 22 (24 recommandé) | `node -v` |
| Git | `git --version` |
| GitHub CLI connecté | `gh auth status` (sinon `gh auth login`) |
| Claude Code | `claude --version` |

## Démarrage

```bash
cd amg-decoration
claude
```

Au premier lancement, Claude Code demande d'autoriser les serveurs MCP du projet (`context7` pour la doc Astro à jour, `playwright` pour que les agents *voient* le rendu) : accepte les deux.

Puis tape :

```
/demarrer
```

Claude enchaîne les 9 phases de `docs/ROADMAP.md`. À chaque phase : il code, fait vérifier par les agents spécialistes, fait valider par le `reviewer`, pousse sur `dev` et ouvre (ou met à jour) la PR `dev → main`.

**Toi, tu fais :** relire la PR et la preview Vercel, puis merger dans `main` quand ça te plaît. Claude ne peut ni pousser sur `main`, ni merger.

> Plus d'autonomie : le projet est en mode `acceptEdits` (pas de confirmation pour les modifications de fichiers ; les commandes de la liste d'autorisation passent sans demander). Pour zéro interruption, tu peux lancer `claude --permission-mode bypassPermissions`. Les hooks Git restent actifs dans tous les cas.

## Connecter Vercel (une seule fois, après la phase 0)
1. Sur vercel.com : **Add New → Project**, importer le dépôt GitHub `amg-decoration`.
2. Framework : Astro (détecté automatiquement). Branche de production : `main`.
3. Chaque push sur `dev` produit une **preview** ; chaque merge dans `main` met en **production**.
4. Le jour J : ajouter le domaine `amgdecorationdinterieur.com` dans Vercel et modifier les DNS chez le registrar actuel.

## Commandes Claude

| Commande | Effet |
|---|---|
| `/demarrer [n]` | Construit tout le site en autonomie (ou reprend à la phase *n*) |
| `/phase <n>` | Exécute une seule phase |
| `/revue` | Vérifs + audits + verdict du reviewer |
| `/livrer` | Push `dev` + PR vers `main` (exige l'approbation) |
| `/audit` | Audit complet sans modification |

## L'équipe d'agents (`.claude/agents/`)

| Agent | Rôle |
|---|---|
| `reviewer` | Relecteur final : seul à pouvoir débloquer un push |
| `architecte` | Architecture, propreté du code, ADR |
| `designer` | Direction artistique, design system, animations, vérification visuelle |
| `redacteur` | Textes, ton d'Amandine, SEO éditorial |
| `seo` | SEO technique, local, JSON-LD, redirections |
| `accessibilite` | WCAG 2.2 AA / RGAA |
| `performance` | Core Web Vitals, images, budgets |
| `qa` | Tests unitaires, e2e, axe, régression visuelle |
| `conformite` | Mentions légales, RGPD, cookies |

## Garde-fous
- `.claude/hooks/guard-git.mjs` bloque : push sans approbation du reviewer, push sur `main`, push forcé, merge de PR, commit sur `main`, ajout de `.env`.
- La CI GitHub (`.github/workflows/ci.yml`) rejoue types, lint, tests, build, e2e + axe et Lighthouse sur chaque PR.

## Documentation
Tout est dans [`docs/`](./docs) : brief, contenu existant, design system, architecture, stratégie SEO, roadmap, décisions (ADR).

## À fournir par Amandine
Photos HD et rendus 3D originaux · portrait · logo vectoriel · SIRET et statut (mentions légales) · tarifs à afficher ou non · choix du service de formulaire (ADR-0003) · accès Search Console et Google Business Profile.
