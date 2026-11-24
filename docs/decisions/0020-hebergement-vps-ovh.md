# ADR-0020 — Hébergement sur le VPS OVH, à côté du projet existant

- **Statut** : acceptée
- **Date** : 2026-11-24

## Contexte

L'humain veut tout déployer sur son VPS OVH en conteneurs Docker : le site, les deux CRM (ADR-0019) et l'API. Une inspection en lecture seule (2026-11-24) a confirmé que la machine a la capacité nécessaire, préproduction comprise. Les détails d'accès et de configuration du serveur ne sont **pas** versionnés (dépôt public) : ils sont dans `.claude/state/infra-vps.md`, ignoré par Git.

**Le VPS héberge déjà un autre projet** (le « projet voisin »), servi par un reverse proxy **Traefik v3** qui occupe les ports 80 et 443.

Décisions de l'humain : fichiers stockés sur le disque du VPS ; sauvegardes chiffrées de la base **et** des fichiers sur **Backblaze B2** ; préproduction sur le même VPS ; emails via le Gmail d'Amandine.

## Décision

- **Un projet Docker Compose séparé** (`amg`), qui ne modifie ni les conteneurs, ni les réseaux, ni la configuration du projet voisin.
- **Traefik existant** comme seule porte d'entrée : nos conteneurs s'y branchent par leurs propres labels (HTTPS Let's Encrypt, redirection HTTP vers HTTPS, en-têtes de sécurité par middleware). Pas de second reverse proxy.
- **Conteneurs** : `site`, `admin`, `espace-client` (statiques, nginx non root), `api` et `worker` (NestJS), `postgres` et `redis` **propres à AMG** (jamais exposés, réseau interne), `clamav` (antivirus des dépôts).
- **Domaines** : `amgdecorationdinterieur.com` (site), `admin.amgdecorationdinterieur.com`, `espace.amgdecorationdinterieur.com` ; préproduction sur `staging.`, `admin.staging.`, `espace.staging.` (accès protégé, `noindex`).
- **Fichiers** : volume Docker dédié sur le disque du VPS, hors de toute racine web ; servis par l'API via des liens temporaires signés après contrôle des droits.
- **Sauvegardes** : chaque nuit, `pg_dump` et archive des fichiers, chiffrés avant envoi sur Backblaze B2, rétention 30 jours ; test de restauration mensuel en préproduction.
- **Déploiement** : GitHub Actions construit et analyse les images à chaque fusion sur `main` (préproduction à chaque push sur `dev`), les publie sur GHCR, puis le VPS les récupère et redémarre sans coupure. Migrations Prisma appliquées au démarrage de l'API.
- **Serveur** : SSH par clé uniquement, pare-feu n'ouvrant que SSH, HTTP et HTTPS, fail2ban, mises à jour de sécurité automatiques ; conteneurs non root, système de fichiers en lecture seule quand c'est possible, ressources limitées pour ne jamais affamer le projet voisin. La configuration du serveur est contrôlée avec l'humain à l'étape CRM 2.
- **Secrets** (mot de passe Postgres, clés VAPID, clés B2, mot de passe d'application Gmail) dans des fichiers d'environnement sur le VPS, hors de Git, saisis par l'humain.

## Conséquences

- Le site quitte Vercel à la bascule : **l'offre Vercel Pro devient inutile**. Les redirections (`vercel.json`), les en-têtes de sécurité et le garde-fou légal (aujourd'hui liés à `VERCEL_ENV`, ADR-0015) sont transposés dans Traefik et la CI.
- Toute intervention sur le VPS qui touche Traefik ou les réseaux partagés est soumise à l'humain avant exécution.
- `docs/MISE-EN-LIGNE.md` est réécrit pour la bascule vers le VPS au moment venu.
