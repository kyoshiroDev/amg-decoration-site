# ADR-0019 — Monorepo Nx : site, admin, espace client et API

- **Statut** : acceptée, révisée le 2026-11-26 (lignes Notifications : Resend, et Authentification : lien d'activation, ADR-0023)
- **Date** : 2026-11-24

## Contexte

Le site public (Astro, statique) est terminé. L'humain veut qu'Amandine gère seule son contenu et échange avec ses clients, sans développeur. Il a validé le 2026-11-24 la maquette interactive de deux applications (https://claude.ai/artifact/8qrSz67JD3KziATdinRuhK) :

- **Admin** (CRM d'Amandine) : réalisations, formules et options (brouillon, aperçu, publication), projets clients (étapes, tâches, notes privées, devis, fichiers, livrable final), messagerie, activité et revenus (CA, Urssaf, revenu net), notifications sur téléphone ;
- **Espace client** : son projet, rendus 3D commentés, demandes de modification, messages, documents, options.

Stack imposée par l'humain : **Angular** (front), **NestJS** (back), **PostgreSQL** avec **Prisma**, **Zod** pour la validation au runtime, **Docker** sur son VPS OVH. Sécurité maximale exigée. Les deux CRM reprennent la palette du site (ADR-0017, ADR-0018) et la règle « pas de longs traits horizontaux ».

## Décision

Le dépôt devient un **monorepo Nx** :

```
apps/
  site/            Astro, le site actuel (statique), déplacé sans changement visible
  admin/           Angular, PWA : CRM d'Amandine (admin.amgdecorationdinterieur.com)
  espace-client/   Angular, PWA : clients (espace.amgdecorationdinterieur.com)
  api/             NestJS : API unique des deux CRM et source de contenu du site
libs/
  shared/schemas   schémas Zod partagés (front + API), types TypeScript dérivés
  shared/tokens    tokens de design communs (couleurs, typo, espacements) aux trois apps
  ui/              composants Angular partagés par admin et espace-client
  data-access/     clients HTTP typés des apps Angular
  api/db           schéma Prisma et migrations versionnées
```

Principes :

- **Le site reste 100 % statique.** « Publier » dans l'admin déclenche une reconstruction du site, qui lit les contenus publiés (réalisations, formules, options) via l'API ; la nouvelle version remplace l'ancienne de façon atomique. Les pages légales restent dans le dépôt (relecture obligatoire).
- **Zod partout** : chaque entrée de l'API est validée par un schéma de `libs/shared/schemas`, les formulaires Angular utilisent les mêmes schémas ; champs inconnus refusés.
- **Prisma** seul accès à PostgreSQL (requêtes paramétrées) ; migrations versionnées, jamais modifiées à la main en production.
- **Modules NestJS** : `auth`, `catalogue`, `realisations`, `projets`, `fichiers`, `messagerie`, `notifications`, `pilotage`, `publication`, `audit`. Redis pour les sessions, la limitation de débit et les tâches de fond (BullMQ : emails, conversion d'images, reconstruction du site).
- **Authentification** (décisions de l'humain) : email + mot de passe ; à l'invitation, **lien d'activation à usage unique** envoyé au client, jamais vu par Amandine, valable 7 jours, avec lequel le client choisit lui-même son mot de passe ; Amandine peut en renvoyer un (72 h), y compris pour un mot de passe oublié (révision du 2026-11-26, [ADR-0023](0023-outillage-api.md) : remplace le mot de passe provisoire initialement prévu). Vérification en deux étapes TOTP **obligatoire pour l'admin**, facultative pour les clients (pas de SMS). Argon2id, sessions en cookies `HttpOnly` `Secure` `SameSite=Strict`, CSRF, blocage progressif, alertes de connexion, journal de sécurité.
- **Autorisation** : rôle (admin / client) et propriété vérifiés à chaque requête ; un client n'accède qu'à son projet. Tests automatiques de tentatives d'accès croisé.
- **Catalogue** : formules et options modifiables, supprimées par archivage ; chaque devis garde une copie figée des prix et contenus signés.
- **Notifications** : PWA installables, Web Push (VAPID), emails automatiques envoyés par l'API HTTPS de **Resend** depuis le worker seul, réponses dirigées vers le Gmail d'Amandine (révision du 2026-11-26, [ADR-0023](0023-outillage-api.md) ; remplace le relais SMTP Gmail initialement prévu).
- **Pilotage** : CA, Urssaf et revenu net par mois et par année ; taux de cotisation, formation professionnelle, versement libératoire et dépenses réglables par Amandine (estimation indicative).

Hébergement, déploiement et sauvegardes : [ADR-0020](0020-hebergement-vps-ovh.md).

## Conséquences

- Étape 1 : déplacer le site dans `apps/site` sans aucun changement visible (CI, tests, Lighthouse et garde-fous identiques).
- `CLAUDE.md`, `docs/ARCHITECTURE.md` et la CI sont réécrits pour le monorepo à l'étape 1.
- Nouveaux agents : `backend`, `frontend`, `securite`, `devops` (`.claude/agents/`). Le circuit reste : implémentation, audits (QA, sécurité, accessibilité), `reviewer`, push sur `dev` ; merge sur `main` par l'humain.
- Les dernières versions stables (Nx, Angular, NestJS, Prisma, Zod) sont vérifiées dans leur documentation (Context7) au moment de l'installation, jamais de mémoire.
