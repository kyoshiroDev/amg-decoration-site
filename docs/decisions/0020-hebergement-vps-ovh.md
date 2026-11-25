# ADR-0020 — Hébergement sur le VPS OVH, à côté du projet existant

- **Statut** : acceptée, révisée deux fois le 2026-11-25 (voir les sections « Révision »)
- **Date** : 2026-11-24

## Contexte

L'humain veut tout déployer sur son VPS OVH en conteneurs Docker : le site, les deux CRM (ADR-0019) et l'API. Une inspection en lecture seule (2026-11-24) a confirmé que la machine a la capacité nécessaire, préproduction comprise. Les détails d'accès et de configuration du serveur ne sont **pas** versionnés (dépôt public) : ils sont dans `.claude/state/infra-vps.md`, ignoré par Git.

**Le VPS héberge déjà un autre projet** (le « projet voisin »), servi par un reverse proxy **Traefik v3** qui occupe les ports 80 et 443.

Décisions de l'humain : fichiers stockés sur le disque du VPS ; sauvegardes chiffrées de la base **et** des fichiers sur **Backblaze B2** ; préproduction sur le même VPS ; emails via le Gmail d'Amandine.

## Décision

- **Un projet Docker Compose séparé** (`amg`), qui ne modifie ni les conteneurs, ni les réseaux, ni la configuration du projet voisin.
- **Traefik existant** comme seule porte d'entrée : nos conteneurs s'y branchent par leurs propres labels (HTTPS Let's Encrypt, redirection HTTP vers HTTPS, en-têtes de sécurité par middleware). Pas de second reverse proxy.
- **Conteneurs** : `site`, `admin`, `espace-client` (statiques, nginx non root), `api` et `worker` (NestJS), `postgres` et `redis` **propres à AMG** (jamais exposés, réseau interne). Pas d'antivirus : les fichiers déposés sont reconstruits (ADR-0022).
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
- **Budget mémoire AMG ≈ 3 Gio** (porté à **4 Gio** avec plafond dur, révision suivante), toutes limites comprises ; **aucune image construite sur le VPS** : images publiques sur GHCR, construites et analysées (Trivy) en CI.
- **Déploiement** par un compte dédié (nom hors dépôt) dont les clés SSH, une par environnement, sont restreintes à une commande forcée (`deploy-gate.sh`) qui n'accepte qu'un **digest d'image** (`sha256:…`), un retour arrière ou une lecture d'état ; aucun fichier n'est transmis par la CI. Les fichiers Compose et les scripts sont installés par l'humain après relecture du diff, avec contrôle `sha256sum` contre le commit (`docs/EXPLOITATION.md`, 3.3). Retour arrière en une commande vers le digest précédent. En CI, le job qui exécute npm n'a aucun droit d'écriture ; seul un job sans npm publie l'image vérifiée.
- **Sauvegardes** : `pg_dump` et fichiers chiffrés deux fois (age, puis restic) vers Backblaze B2 ; rétention de 30 jours des sauvegardes, puis **14 jours** des versions masquées (cycle de vie du bucket) ; la clé B2 du serveur n'a pas le droit de suppression (`deleteFiles`) : un serveur compromis peut masquer les sauvegardes, pas les détruire. Un masquage doit donc être vu en moins de 14 jours : un **contrôle quotidien hors VPS** (workflow GitHub planifié, clé B2 limitée à la liste des fichiers) alerte si le dernier snapshot a plus de 36 h, si trop peu de snapshots restent visibles ou si des snapshots sont masqués en masse. **Aucune clé de déchiffrement sur le VPS**, même pour une restauration d'incident : le flux est déchiffré sur le poste de l'humain et envoyé par SSH à une commande forcée qui ne fait que contrôler le serveur et lancer `pg_restore`. **Test de restauration mensuel sur le poste de l'humain, hors VPS** (remplace « en préproduction » ci-dessus) ; le serveur ne sert qu'à la restauration d'incident (`docs/EXPLOITATION.md`, 5).
- **IPv4 uniquement** : aucun enregistrement AAAA pour nos domaines.
- **ClamAV** (≈ 3 Gio de signatures en mémoire) ne tient pas dans le budget : abandonné au profit de la reconstruction du contenu des fichiers déposés (ADR-0022).

**Risques résiduels acceptés.**

- **Espace de labels `@docker` partagé** : le fournisseur Docker de Traefik lit les labels de tous les conteneurs du serveur, ceux d'AMG comme ceux du voisin. Une image ou un fichier Compose AMG malveillant pourrait déclarer un routeur sur un hôte du voisin, ou un nom d'objet en conflit. Atténuations : déploiement par digest seulement, fichiers Compose installés par l'humain ; **refus par `deploy.sh` de toute image qui porte un label `traefik.*`** (contrôlé après le téléchargement, avant tout démarrage : le digest précédent reste en ligne), les labels Traefik ne pouvant venir que du fichier Compose relu ; en seconde ligne, `watch.sh` compare les labels Traefik des conteneurs en marche à une **liste blanche stricte** (routeurs, services et middlewares du projet, hôtes AMG, entrée `websecure`, notre émetteur, nos seuls middlewares `@docker` et notre propre service ; tout autre label alerte).
- **Groupe `docker` = root** : le compte de déploiement, comme le compte habituel de l'humain, est membre du groupe `docker`, donc équivalent à root sur l'hôte partagé. Atténuations : clés de déploiement à commande forcée, sans transfert de fichier ; aucun secret du voisin lisible par la CI ; à réexaminer si un mode Docker sans root ou un hôte dédié devient possible.

**Conséquences.** Toute future règle de routage du voisin doit déclarer ses propres en-têtes ; c'est écrit dans sa documentation. Le premier certificat AMG est émis sur `staging.` d'abord (limite Let's Encrypt de 5 validations ratées par heure). Les réglages AMG du serveur sont appliqués juste avant le premier déploiement de préproduction.

## Révision du 2026-11-25 (2) : budget AMG de 4 Gio, plafond dur par slice systemd

**Contexte.** Le projet voisin libère 4 Gio de mémoire pour AMG. Exigence absolue de l'humain : AMG ne dépasse **jamais 4 Gio**, tous conteneurs AMG confondus (production, préproduction, conteneurs ponctuels de sauvegarde, y compris pendant une bascule à deux réplicas). Les `mem_limit` par conteneur bornent chaque conteneur, pas leur somme : un service ajouté, une limite relevée ou un `docker run` oublié pourraient la dépasser sans que rien ne l'arrête. Le serveur utilise Docker avec le pilote cgroup systemd, en cgroup v2 (vérifié).

**Décision.**

- **Plafond imposé par le noyau** : une slice systemd `amg.slice` (`deploy/systemd/amg.slice`, installée par l'humain avant le premier conteneur AMG) avec `MemoryMax=4G`, `MemoryHigh=3840M` (freinage avant le plafond), `MemorySwapMax=0` et `MemoryZSwapMax=0` (pas de débordement sur le disque partagé), `CPUQuota=300%` (3 vCPU au plus) et `CPUWeight=50` (priorité moitié de celle de `system.slice` en cas de contention). Au-delà de 4 Gio, l'OOM killer agit **dans la slice**, jamais chez le voisin.
- **Tous les conteneurs AMG sont enfants de la slice** : `cgroup_parent: amg.slice` sur chaque service Compose (ancre commune), `--cgroup-parent amg.slice` sur chaque `docker run` des scripts du serveur. Avec le pilote systemd, la valeur est un nom de slice (documentation de `dockerd`, `--cgroup-parent`).
- **Garde-fou en CI** (`deploy/ci/check-budget.sh`, job `build`) : somme des `mem_limit` de la production et de la préproduction, plus, par environnement, une réplique du plus gros service routé par Traefik (bascule : `deploy.sh` ne bascule qu'un service à la fois sous le verrou de l'environnement), plus le plus gros conteneur ponctuel ; échec au-delà de **3,5 Gio** (marge de 512 Mio sous le plafond), ou si un service n'a pas `cgroup_parent: amg.slice` et `mem_limit` = `memswap_limit`, ou si un `docker run` du serveur n'est pas dans la slice.
- **Sur le serveur** : `deploy.sh` refuse de déployer si la slice n'est pas chargée avec `MemoryMax` ≤ 4 Gio et `MemorySwapMax=0`, ou si la nouvelle réplique n'est pas dans la slice ; `watch.sh` alerte au-delà de 85 % de `memory.max`, à chaque nouvel `oom_kill` de la slice, et si un conteneur AMG est hors de la slice.
- **ClamAV exclu de fait** (≈ 3 Gio) : remplacé par la reconstruction du contenu (ADR-0022), dont le traitement (images, PDF, vidéos) est provisionné à environ 512 Mio dans la marge (`docs/EXPLOITATION.md`, 10).

**Conséquences.** Le tableau du budget (`docs/EXPLOITATION.md`, 10) est tenu à jour à chaque service ajouté ; un service qui ne tient pas dans la marge impose de réduire une autre limite (préproduction d'abord) ou une nouvelle décision avec l'humain. Une slice absente ou sans limite est un incident : systemd la créerait à la volée sans plafond.
