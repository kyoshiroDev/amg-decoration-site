# ADR-0020 — Hébergement sur le VPS OVH, à côté du projet existant

- **Statut** : acceptée, révisée le 2026-11-25 (voir « Révision »)
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

## Révision du 2026-11-25 : Traefik partagé entre deux projets indépendants

**Contexte.** Le relevé détaillé du serveur (détails hors dépôt) a montré que la configuration partagée existante ne permettait pas un simple branchement par labels : l'émission des certificats, les en-têtes communs et la répartition de la mémoire devaient être revus. L'humain, qui gère aussi le projet voisin (sans utilisateurs à ce jour), a choisi de partager le VPS en reconfigurant Traefik pour plusieurs projets, chaque écriture sur le serveur étant soumise à son accord.

**Décision.**

- **Deux applications distinctes, seul Traefik est commun.** Dépôts, bases, Redis, réseaux, volumes, sauvegardes et utilisateur de déploiement restent séparés ; aucune mention d'AMG dans le dépôt du projet voisin.
- **Côté projet voisin (fait le 2026-11-25, vérifié : réponses et certificats inchangés)** : sa configuration a été adaptée pour accueillir un second projet ; le détail reste hors dépôt.
- **Côté AMG (réglages présents sur le serveur seulement)** : un second émetteur Let's Encrypt en **TLS-ALPN-01** (aucun identifiant DNS), avec son propre fichier de stockage ; deux réseaux d'entrée **internes** dédiés, un par environnement (`amg_edge_prod`, `amg_edge_staging`), branchés sur Traefik par un fichier d'override local. Nos conteneurs n'utilisent jamais le réseau du voisin. Chaque routeur AMG déclare explicitement son émetteur.
- **En-têtes de sécurité AMG** posés par nos propres conteneurs (nginx du site généré depuis `vercel.json`) : CSP, HSTS et Permissions-Policy identiques à la production Vercel, vérifiés par un test de conformité.
- **Budget mémoire AMG ≈ 3 Gio**, toutes limites comprises ; **aucune image construite sur le VPS** : images publiques sur GHCR, construites et analysées (Trivy) en CI.
- **Déploiement** par un compte dédié (nom hors dépôt) dont les clés SSH, une par environnement, sont restreintes à une commande forcée (`deploy-gate.sh`) qui n'accepte qu'un **digest d'image** (`sha256:…`), un retour arrière ou une lecture d'état ; aucun fichier n'est transmis par la CI. Les fichiers Compose et les scripts sont installés par l'humain après relecture du diff, avec contrôle `sha256sum` contre le commit (`docs/EXPLOITATION.md`, 3.3). Retour arrière en une commande vers le digest précédent. En CI, le job qui exécute npm n'a aucun droit d'écriture ; seul un job sans npm publie l'image vérifiée.
- **Sauvegardes** : `pg_dump` et fichiers chiffrés deux fois (age, puis restic) vers Backblaze B2 ; rétention de 30 jours des sauvegardes, puis **14 jours** des versions masquées (cycle de vie du bucket) ; la clé B2 du serveur n'a pas le droit de suppression (`deleteFiles`) : un serveur compromis peut masquer les sauvegardes, pas les détruire. Un masquage doit donc être vu en moins de 14 jours : un **contrôle quotidien hors VPS** (workflow GitHub planifié, clé B2 limitée à la liste des fichiers) alerte si le dernier snapshot a plus de 36 h, si trop peu de snapshots restent visibles ou si des snapshots sont masqués en masse. **Aucune clé de déchiffrement sur le VPS**, même pour une restauration d'incident : le flux est déchiffré sur le poste de l'humain et envoyé par SSH à une commande forcée qui ne fait que contrôler le serveur et lancer `pg_restore`. **Test de restauration mensuel sur le poste de l'humain, hors VPS** (remplace « en préproduction » ci-dessus) ; le serveur ne sert qu'à la restauration d'incident (`docs/EXPLOITATION.md`, 5).
- **IPv4 uniquement** : aucun enregistrement AAAA pour nos domaines.
- **ClamAV** (≈ 3 Gio de signatures en mémoire) ne tient pas dans le budget : décision à prendre avant CRM 5 (service d'analyse léger, analyse à la demande ou autre option).

**Risques résiduels acceptés.**

- **Espace de labels `@docker` partagé** : le fournisseur Docker de Traefik lit les labels de tous les conteneurs du serveur, ceux d'AMG comme ceux du voisin. Une image ou un fichier Compose AMG malveillant pourrait déclarer un routeur sur un hôte du voisin, ou un nom d'objet en conflit. Atténuations : déploiement par digest seulement, fichiers Compose installés par l'humain ; **refus par `deploy.sh` de toute image qui porte un label `traefik.*`** (contrôlé après le téléchargement, avant tout démarrage : le digest précédent reste en ligne), les labels Traefik ne pouvant venir que du fichier Compose relu ; en seconde ligne, `watch.sh` compare les labels Traefik des conteneurs en marche à une **liste blanche stricte** (routeurs, services et middlewares du projet, hôtes AMG, entrée `websecure`, notre émetteur, nos seuls middlewares `@docker` et notre propre service ; tout autre label alerte).
- **Groupe `docker` = root** : le compte de déploiement, comme le compte habituel de l'humain, est membre du groupe `docker`, donc équivalent à root sur l'hôte partagé. Atténuations : clés de déploiement à commande forcée, sans transfert de fichier ; aucun secret du voisin lisible par la CI ; à réexaminer si un mode Docker sans root ou un hôte dédié devient possible.

**Conséquences.** Toute future règle de routage du voisin doit déclarer ses propres en-têtes ; c'est écrit dans sa documentation. Le premier certificat AMG est émis sur `staging.` d'abord (limite Let's Encrypt de 5 validations ratées par heure). Les réglages AMG du serveur sont appliqués juste avant le premier déploiement de préproduction.
