# AMG Décoration d'Intérieur — nouveau site

Refonte complète de [amgdecorationdinterieur.com](https://amgdecorationdinterieur.com/) : Astro (statique) · Vercel · design pastel & terracotta · SEO soigné.
Le projet est conçu pour être **construit de A à Z par Claude Code**, encadré par `CLAUDE.md` et une équipe d'agents spécialisés.

## Prérequis (une seule fois)

| Outil                                            | Vérifier                                 |
| ------------------------------------------------ | ---------------------------------------- |
| Node.js ≥ 22.23.4 (24 recommandé, voir `.nvmrc`) | `node -v`                                |
| Git                                              | `git --version`                          |
| GitHub CLI connecté                              | `gh auth status` (sinon `gh auth login`) |
| Claude Code                                      | `claude --version`                       |

## Démarrage

```bash
cd amg-decoration
claude
```

Au premier lancement, Claude Code demande d'autoriser les serveurs MCP du projet (`context7` pour la doc Astro à jour, `playwright` pour que les agents _voient_ le rendu) : accepte les deux.

Puis tape :

```
/demarrer
```

Claude enchaîne les 9 phases de `docs/ROADMAP.md`. À chaque phase : il code, fait vérifier par les agents spécialistes, fait valider par le `reviewer`, pousse sur `dev` et ouvre (ou met à jour) la PR `dev → main`.

**Toi, tu fais :** relire la PR et la preview Vercel, puis merger dans `main` quand ça te plaît. Claude ne peut ni pousser sur `main`, ni merger.

> Plus d'autonomie : le projet est en mode `acceptEdits` (pas de confirmation pour les modifications de fichiers ; les commandes de la liste d'autorisation passent sans demander). Pour zéro interruption, tu peux lancer `claude --permission-mode bypassPermissions`. Les hooks Git restent actifs dans tous les cas.

## Connecter Vercel (une seule fois, après la phase 0)

1. Sur vercel.com : **Add New → Project**, importer le dépôt GitHub `kyoshiroDev/amg-decoration-site`.
2. Framework : Astro (détecté automatiquement). Branche de production : `main`.
3. Chaque push sur `dev` produit une **preview** ; chaque merge dans `main` met en **production**.
4. Le jour J : lancer `npm run check:prod` (pages légales complètes, ADR-0015), puis ajouter le domaine `amgdecorationdinterieur.com` dans Vercel et modifier les DNS chez le registrar actuel.

## Variables d’environnement

| Variable               | Obligatoire | Rôle                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_FORM_ENDPOINT` | non         | URL **https** du service de formulaire (ADR-0003, Formspark recommandé). Lue au build. Absente : le formulaire de contact se replie sur un `mailto:` vers l’email de `src/config/site.ts`. Son origine est autorisée dans la CSP (`connect-src`, `form-action`, ADR-0012) : changer de service impose un nouveau build. |

À définir dans Vercel (_Settings → Environment Variables_) pour Production et Preview. En local, un fichier `.env` (ignoré par git) suffit : `PUBLIC_FORM_ENDPOINT=https://…`.

## Commandes Claude

| Commande        | Effet                                                           |
| --------------- | --------------------------------------------------------------- |
| `/demarrer [n]` | Construit tout le site en autonomie (ou reprend à la phase _n_) |
| `/phase <n>`    | Exécute une seule phase                                         |
| `/revue`        | Vérifs + audits + verdict du reviewer                           |
| `/livrer`       | Push `dev` + PR vers `main` (exige l'approbation)               |
| `/audit`        | Audit complet sans modification                                 |

## L'équipe d'agents (`.claude/agents/`)

| Agent           | Rôle                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `reviewer`      | Relecteur final : seul à pouvoir débloquer un push                     |
| `architecte`    | Architecture, propreté du code, ADR                                    |
| `designer`      | Direction artistique, design system, animations, vérification visuelle |
| `redacteur`     | Textes, ton d'Amandine, SEO éditorial                                  |
| `seo`           | SEO technique, local, JSON-LD, redirections                            |
| `accessibilite` | WCAG 2.2 AA / RGAA                                                     |
| `performance`   | Core Web Vitals, images, budgets                                       |
| `qa`            | Tests unitaires, e2e, axe, régression visuelle                         |
| `conformite`    | Mentions légales, RGPD, cookies                                        |

## Garde-fous

- `.claude/hooks/guard-git.mjs` bloque : push sans approbation du reviewer, push sur `main`, push forcé, merge de PR, commit sur `main`, ajout de `.env`.
- La CI GitHub (`.github/workflows/ci.yml`) rejoue types, lint, tests, build, e2e + axe et Lighthouse sur chaque PR.
- Le build de **production** Vercel échoue tant qu'un `TODO(contenu)` reste dans les pages légales (ADR-0015) ; `npm run check:prod` donne la même liste en local.

## Documentation

Tout est dans [`docs/`](./docs) : brief, contenu existant, design system, architecture, stratégie SEO, roadmap, décisions (ADR).

## À fournir par Amandine

Photos HD et rendus 3D originaux · portrait · logo vectoriel · SIRET et statut (mentions légales) · tarifs à afficher ou non · choix du service de formulaire (ADR-0003) · accès Search Console et Google Business Profile.
