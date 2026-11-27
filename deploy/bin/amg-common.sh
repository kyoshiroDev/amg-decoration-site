# shellcheck shell=bash
# Bibliothèque commune des scripts du serveur AMG, SOURCÉE (jamais exécutée) par deploy.sh,
# watch.sh et backup.sh. Installée avec eux dans /opt/amg/bin (docs/EXPLOITATION.md, 3.3).
# Source unique des constantes du budget mémoire (ADR-0020, docs/EXPLOITATION.md, 10), relue aussi
# par deploy/ci/check-budget.sh.
#
# Budget : 4 Gio (4 096 Mio) pour TOUT AMG, coûts hors slice compris. La slice amg.slice est
# plafonnée à 3 800 Mio ; les ~296 Mio restants couvrent ce que le noyau compte hors de la slice
# (shims containerd des conteneurs AMG, part AMG de dockerd et containerd, CLI docker et scripts,
# age pendant la sauvegarde, décompression des images au pull).

# Valeurs attendues des fichiers deploy/systemd/*.slice (contrôlées par la CI, deploy.sh, watch.sh).
AMG_SLICE=amg.slice
AMG_TOTAL_MIB=4096          # exigence de l'humain : jamais plus, tout compris
AMG_OUTSIDE_RESERVE_MIB=296 # coûts AMG comptés hors de la slice (voir plus haut)
AMG_SLICE_MAX_MIB=3800  # MemoryMax de amg.slice : plafond dur
AMG_SLICE_HIGH_MIB=3584 # MemoryHigh de amg.slice : freinage avant le plafond
AMG_STAGING_MAX_MIB=1024 # MemoryMax de amg-staging.slice : la préproduction ne peut pas affamer la production
AMG_STAGING_HIGH_MIB=896 # MemoryHigh de amg-staging.slice
AMG_SLICE_CPUS=3          # CPUQuota de amg.slice : 300 % (3 vCPU) pour tout AMG
AMG_SLICE_TASKS_MAX=2048  # TasksMax de amg.slice
AMG_SYSTEMD_DIR=/etc/systemd/system # seul emplacement admis des fichiers de slice (installés par root)
# Marge interne de la slice, sous laquelle la CI garde le pire cas : noyau, pics, imprévu.
AMG_BUDGET_MARGIN_MIB=512
# Score OOM des conteneurs ponctuels (sauvegarde, migrations) : tués avant la production
# (500, postgres 200), après la préproduction (900).
AMG_ONEOFF_OOM_SCORE_ADJ=700
# Attente maximale du verrou des conteneurs ponctuels (un seul à la fois sur tout le serveur).
AMG_ONEOFF_WAIT=3600

AMG_MIB=$((1024 * 1024))
AMG_SLICE_MAX_BYTES=$((AMG_SLICE_MAX_MIB * AMG_MIB))
AMG_STAGING_MAX_BYTES=$((AMG_STAGING_MAX_MIB * AMG_MIB))
AMG_CGROUP_ROOT=${AMG_CGROUP_ROOT:-/sys/fs/cgroup}

# Résumé du budget (deploy.sh status).
amg_budget_summary() {
  echo "budget AMG : $AMG_TOTAL_MIB Mio au total = slice $AMG_SLICE_MAX_MIB Mio (freinage $AMG_SLICE_HIGH_MIB)" \
    "+ ~$AMG_OUTSIDE_RESERVE_MIB Mio hors slice ; préproduction $AMG_STAGING_MAX_MIB Mio (freinage" \
    "$AMG_STAGING_HIGH_MIB) ; marge interne de la CI $AMG_BUDGET_MARGIN_MIB Mio"
}

# Slice d'un environnement : amg-prod.slice, amg-staging.slice. Un tiret dans un nom de slice
# systemd marque un niveau : les deux sont enfants de amg.slice (systemd.slice(5)), et Docker
# (pilote cgroup systemd) place chaque conteneur en amg.slice/amg-<env>.slice/docker-<id>.scope.
amg_env_slice() { printf 'amg-%s.slice\n' "$1"; }

# Dossier cgroup v2 d'une slice AMG (amg.slice ou amg-<env>.slice).
amg_slice_cgroup() {
  case "$1" in
    "$AMG_SLICE") printf '%s/%s\n' "$AMG_CGROUP_ROOT" "$AMG_SLICE" ;;
    amg-*.slice) printf '%s/%s/%s\n' "$AMG_CGROUP_ROOT" "$AMG_SLICE" "$1" ;;
    *) return 1 ;;
  esac
}

# Verrou d'un environnement : un déploiement, une sauvegarde ou une restauration à la fois.
amg_env_lock() { printf '%s/%s/.deploy.lock\n' "${AMG_ROOT:-/opt/amg}" "$1"; }

# Nombre entier d'octets <= plafond, refus par défaut (vide, « infinity », trop long, non décimal).
# 18 chiffres au plus : jamais de dépassement de l'arithmétique 64 bits de bash.
amg_bytes_le() { [[ "$1" =~ ^[0-9]{1,18}$ ]] && ((10#$1 <= $2)); }

# Docker doit placer les conteneurs par systemd, en cgroup v2 : avec le pilote cgroupfs,
# --cgroup-parent amg-<env>.slice créerait un dossier cgroup HORS de la slice systemd, donc sans
# ses limites. Une ligne si ce n'est pas le cas (aucune sortie = conforme).
amg_docker_problems() {
  local driver
  driver=$(docker info --format '{{.CgroupDriver}} {{.CgroupVersion}}' 2>/dev/null) || driver=''
  [ "$driver" = 'systemd 2' ] \
    || echo "Docker : pilote cgroup « ${driver:-illisible} » (attendu « systemd 2 ») : les conteneurs AMG échapperaient à la slice"
}

# Dossier cgroup du conteneur $2 (identifiant COMPLET, 64 caractères) placé dans la slice $1.
amg_scope_dir() { printf '%s/docker-%s.scope\n' "$(amg_slice_cgroup "$1")" "$2"; }

# Problèmes de la slice $1 (une ligne chacun ; aucune sortie = conforme), $2 plafond en octets ;
# pour amg.slice seulement, $3 CPUQuotaPerSecUSec attendu (« 3s ») et $4 TasksMax attendu.
# Lecture seule, sans sudo : l'unité doit venir de SON fichier dans /etc/systemd/system (sans lui,
# systemd la créerait à la volée SANS limite ; un fichier ailleurs, /run/systemd/system par exemple,
# n'est pas celui installé par root à l'étape 1 du §9), avec MemoryMax <= plafond et sans swap ; si
# son cgroup existe (au moins un conteneur dedans), les limites RÉELLEMENT appliquées par le noyau
# sont relues elles aussi.
amg_slice_problems() {
  local slice=$1 limit=$2 cpu_want=${3:-} tasks_want=${4:-}
  local props load fragment max swap cpu tasks dir cg_max cg_swap cg_zswap cg_cpu cg_pids
  props=$(systemctl show "$slice" -p LoadState -p FragmentPath -p MemoryMax -p MemorySwapMax \
    -p CPUQuotaPerSecUSec -p TasksMax 2>/dev/null) || props=''
  load=$(sed -n 's/^LoadState=//p' <<<"$props")
  fragment=$(sed -n 's/^FragmentPath=//p' <<<"$props")
  max=$(sed -n 's/^MemoryMax=//p' <<<"$props")
  swap=$(sed -n 's/^MemorySwapMax=//p' <<<"$props")
  cpu=$(sed -n 's/^CPUQuotaPerSecUSec=//p' <<<"$props")
  tasks=$(sed -n 's/^TasksMax=//p' <<<"$props")
  if [ "$load" != loaded ] || [ -z "$fragment" ]; then
    echo "slice $slice absente ou sans fichier d'unité (LoadState=${load:-?}, FragmentPath=${fragment:-aucun})"
    return 0
  fi
  [ "$fragment" = "$AMG_SYSTEMD_DIR/$slice" ] \
    || echo "slice $slice chargée depuis $fragment (attendu $AMG_SYSTEMD_DIR/$slice)"
  amg_bytes_le "$max" "$limit" || echo "slice $slice : MemoryMax=${max:-?} (attendu <= $limit octets)"
  [ "$swap" = 0 ] || echo "slice $slice : MemorySwapMax=${swap:-?} (attendu 0)"
  if [ -n "$cpu_want" ]; then
    [ "$cpu" = "$cpu_want" ] || echo "slice $slice : CPUQuotaPerSecUSec=${cpu:-?} (attendu $cpu_want)"
  fi
  if [ -n "$tasks_want" ]; then
    [ "$tasks" = "$tasks_want" ] || echo "slice $slice : TasksMax=${tasks:-?} (attendu $tasks_want)"
  fi
  dir=$(amg_slice_cgroup "$slice") || return 0
  [ -d "$dir" ] || return 0
  cg_max=$(cat "$dir/memory.max" 2>/dev/null || echo absent)
  cg_swap=$(cat "$dir/memory.swap.max" 2>/dev/null || echo absent)
  amg_bytes_le "$cg_max" "$limit" || echo "slice $slice : limite appliquée par le noyau memory.max=$cg_max (attendu <= $limit octets)"
  [ "$cg_swap" = 0 ] || echo "slice $slice : memory.swap.max=$cg_swap (attendu 0, fichier présent)"
  if [ -e "$dir/memory.zswap.max" ]; then
    cg_zswap=$(cat "$dir/memory.zswap.max" 2>/dev/null || echo illisible)
    [ "$cg_zswap" = 0 ] || echo "slice $slice : memory.zswap.max=$cg_zswap (attendu 0)"
  fi
  if [ -n "$cpu_want" ]; then
    # systemd écrit le quota par période de 100 ms (CPUQuotaPeriodSec par défaut).
    cg_cpu=$(cat "$dir/cpu.max" 2>/dev/null || echo absent)
    [ "$cg_cpu" = "$((AMG_SLICE_CPUS * 100000)) 100000" ] \
      || echo "slice $slice : cpu.max=$cg_cpu (attendu $((AMG_SLICE_CPUS * 100000)) 100000)"
  fi
  if [ -n "$tasks_want" ]; then
    cg_pids=$(cat "$dir/pids.max" 2>/dev/null || echo absent)
    [ "$cg_pids" = "$tasks_want" ] || echo "slice $slice : pids.max=$cg_pids (attendu $tasks_want)"
  fi
}

# Problèmes du plafond commun : pilote cgroup de Docker, puis amg.slice et ses deux enfants.
amg_all_slices_problems() {
  amg_docker_problems
  amg_slice_problems "$AMG_SLICE" "$AMG_SLICE_MAX_BYTES" "${AMG_SLICE_CPUS}s" "$AMG_SLICE_TASKS_MAX"
  amg_slice_problems "$(amg_env_slice prod)" "$AMG_SLICE_MAX_BYTES"
  amg_slice_problems "$(amg_env_slice staging)" "$AMG_STAGING_MAX_BYTES"
}

# Image sans aucun label Traefik ($1 image@digest, présente localement ; inspection impossible =
# refus). Les labels d'une image sont recopiés sur ses conteneurs, et Traefik lit ceux de tous les
# conteneurs du serveur : une image qui en porte pourrait ajouter un routeur (hôte du voisin,
# api@internal…). Clés sorties en chaînes Go (%q) : une ligne par label, quel que soit son contenu ;
# insensible à la casse, espaces de tête ignorés.
image_labels_safe() {
  local keys
  keys=$(docker image inspect -f '{{range $k, $v := .Config.Labels}}{{printf "%q\n" $k}}{{end}}' "$1") \
    || return 1
  ! grep -qiE '^"[[:space:]]*traefik' <<<"$keys"
}

# Chemin absolu propre : composants [A-Za-z0-9_.-], ni « . », ni « .. », ni « // », jamais « / » seul.
amg_clean_path() {
  [[ "$1" =~ ^(/[A-Za-z0-9_.-]+)+$ ]] && [[ "$1/" != */./* && "$1/" != */../* ]]
}

# Source d'un montage -v : volume nommé AMG (amg-…, amg_…), ou dossier de travail des sauvegardes
# (AMG_ROOT/backups/…) qui y reste une fois les liens résolus, ne contient aucun composant secrets
# et n'est pas une socket. Tout le reste est refusé (liste blanche) : secrets/ de chaque
# environnement, amg.env, bin/, compose/, le socket Docker, la racine et les chemins du système.
amg_run_source_ok() {
  local src=$1 root=${AMG_ROOT:-/opt/amg} real
  if [[ "$src" =~ ^amg[-_][A-Za-z0-9_.-]{1,100}$ ]]; then return 0; fi
  # Liste blanche de dossiers : seuls les dossiers de travail des sauvegardes (<racine>/backups/…),
  # demandés comme résolus. Jamais secrets/ (d'aucun environnement), amg.env, bin/ ni compose/.
  amg_clean_path "$root" && amg_clean_path "$src" || return 1
  [[ "$src" == "$root"/backups || "$src" == "$root"/backups/* ]] || return 1
  real=$(readlink -m -- "$src") || return 1
  [[ "$real" == "$root"/backups || "$real" == "$root"/backups/* ]] || return 1
  [[ "/$real/" != */secrets/* ]] || return 1
  [ ! -S "$real" ]
}

# Secret des migrations ($1 = valeur de -v), admis pour le seul rôle `migrate` (amg_run) : exactement
# <racine>/<env>/secrets/pg_migrator_password, fichier régulier (ni lien, ni composant lien), sans
# aucun droit pour « les autres » (640 attendu : groupe 65532, l'utilisateur de l'image), monté en
# lecture seule sur /run/secrets/pg_migrator_password. Aucun autre fichier de secrets/ n'est jamais
# monté par un ponctuel. AMG_RUN_ROLE et AMG_RUN_ENV sont posés par amg_run (portée dynamique).
amg_run_secret_ok() {
  local v=$1 root=${AMG_ROOT:-/opt/amg} want mode
  [ "${AMG_RUN_ROLE:-}" = migrate ] || return 1
  case "${AMG_RUN_ENV:-}" in prod | staging) ;; *) return 1 ;; esac
  want=$root/$AMG_RUN_ENV/secrets/pg_migrator_password
  amg_clean_path "$want" || return 1
  [ "$v" = "$want:/run/secrets/pg_migrator_password:ro" ] || return 1
  [ -f "$want" ] && [ ! -L "$want" ] && [ "$(readlink -f -- "$want")" = "$want" ] || return 1
  mode=$(stat -c '%a' -- "$want") || return 1
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] && (((8#$mode & 8#007) == 0))
}

# Valeur $2 admise pour l'option $1 de amg_run (liste blanche, une règle par option).
amg_run_value_ok() {
  local opt=$1 v=$2 root=${AMG_ROOT:-/opt/amg} src dst mode
  case "$opt" in
    --env-file) amg_clean_path "$v" && [[ "$v" == "$root"/* ]] && [ -f "$v" ] ;;
    -e) [[ "$v" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]] ;;
    --hostname) [[ "$v" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] ;;
    --cpus)
      local whole frac
      [[ "$v" =~ ^([0-9])(\.([0-9]{1,2}))?$ ]] || return 1
      whole=${BASH_REMATCH[1]} frac=${BASH_REMATCH[3]:-0}
      [[ "$v" =~ [1-9] ]] || return 1
      [ "${#frac}" -eq 1 ] && frac="${frac}0"
      ((10#$whole * 100 + 10#$frac <= AMG_SLICE_CPUS * 100))
      ;;
    --pids-limit) [[ "$v" =~ ^[1-9][0-9]{0,3}$ ]] ;;
    --cap-drop) [ "$v" = ALL ] ;;
    --cap-add) [[ " $AMG_RUN_CAPS " == *" $v "* ]] ;;
    --security-opt) [ "$v" = no-new-privileges:true ] ;;
    --tmpfs)
      dst=${v%%:*}
      mode=${v#*:}
      [ "$dst" != "$v" ] && amg_clean_path "$dst" && [[ "$mode" =~ ^[a-z0-9=,]+$ ]] \
        && [[ ",$mode," =~ ,size=[1-9][0-9]{0,5}[kmg]?, ]]
      ;;
    -v)
      amg_run_secret_ok "$v" && return 0
      IFS=: read -r src dst mode <<<"$v"
      [[ "$v" =~ ^[^:]+:[^:]+(:ro)?$ ]] && amg_run_source_ok "$src" && amg_clean_path "$dst"
      ;;
    # Réseau de données du projet (Postgres, interne, sans sortie) : rôle `migrate` seulement.
    --network)
      [ "$v" = none ] || [ "$v" = bridge ] \
        || { [ "${AMG_RUN_ROLE:-}" = migrate ] && [[ "${AMG_RUN_ENV:-}" =~ ^(prod|staging)$ ]] \
          && [ "$v" = "amg-${AMG_RUN_ENV}_data" ]; }
      ;;
    --name) [[ "$v" =~ ^amg-[a-z0-9-]{1,50}$ ]] ;;
    --entrypoint) [[ "$v" =~ ^/?[A-Za-z0-9_][A-Za-z0-9_./-]{0,200}$ && "/$v/" != */../* ]] ;;
    -w) [ "$v" = / ] || amg_clean_path "$v" ;;
    --user) [[ "$v" =~ ^([0-9]{1,6}|[a-z_][a-z0-9_-]{0,31})(:([0-9]{1,6}|[a-z_][a-z0-9_-]{0,31}))?$ ]] ;;
    *) return 1 ;;
  esac
}

# Capacités admises (--cap-add) : seulement celles dont un appel existant a besoin
# (DAC_READ_SEARCH : restic lit les fichiers de l'API, backup.sh).
AMG_RUN_CAPS='DAC_READ_SEARCH'

# SEULE façon de lancer un conteneur ponctuel depuis un script du serveur (contrôlé par
# deploy/ci/check-budget.sh, qui refuse tout autre `docker run`, `docker create`, `docker container`
# ou `docker compose run`) :
#   amg_run <prod|staging> <rôle> <NNNm> [options] -- <image>@sha256:<digest> [commande…]
# Toujours : slice de l'environnement, mémoire = mémoire + swap (aucun swap), label org.amg.role
# (repéré par watch.sh), score OOM des ponctuels, --rm, et UN SEUL conteneur ponctuel à la fois sur
# tout le serveur (verrou commun, attente bornée) : le budget n'en compte qu'un.
# Options : LISTE BLANCHE, forme séparée uniquement (« --cpus 1 », jamais « --cpus=1 »), chaque
# valeur contrôlée par amg_run_value_ok ; tout le reste est refusé (--network host, container:…,
# --volumes-from, --ipc, --uts, --runtime, --restart, --device, --security-opt autre que
# no-new-privileges, --cap-add hors AMG_RUN_CAPS, options courtes groupées…). Une option qui attend
# une valeur et n'en a pas est refusée (elle ne peut pas « avaler » l'option suivante).
#   sans valeur : --read-only, -i
#   une valeur  : --env-file, -e, --hostname, --cpus, --pids-limit, --cap-drop, --cap-add,
#                 --security-opt, --tmpfs, -v, --network, --name, --entrypoint, -w, --user
# Règles propres au rôle `migrate` (deploy.sh, fenêtre de migration), et à lui seul : réseau de
# données du projet (--network amg-<env>_data) et montage du seul secret des migrations
# (amg_run_secret_ok). Espace de PID propre dans tous les cas (--pid refusé) : le mot de passe que
# le CLI Prisma passe en argument au moteur de schéma n'est visible d'aucun autre conteneur.
# Avant le lancement : plafond commun en place (amg_all_slices_problems), image épinglée par digest
# et sans label Traefik (image_labels_safe). Les valeurs imposées sont placées APRÈS celles de
# l'appelant (pour docker, la dernière valeur d'une option l'emporte).
amg_run() {
  local env_name=${1:-} role=${2:-} mem=${3:-} opt image problems
  local -a opts=()
  shift 3 || { echo "amg_run : arguments manquants" >&2; return 2; }
  case "$env_name" in prod | staging) ;; *) echo "amg_run : environnement refusé : $env_name" >&2; return 2 ;; esac
  [[ "$role" =~ ^[a-z][a-z0-9-]{0,30}$ ]] || { echo "amg_run : rôle refusé : $role" >&2; return 2; }
  # Contexte des règles propres à un rôle (amg_run_value_ok, amg_run_secret_ok).
  local AMG_RUN_ENV=$env_name AMG_RUN_ROLE=$role
  [[ "$mem" =~ ^[1-9][0-9]{0,4}m$ ]] || { echo "amg_run : mémoire refusée (NNNm) : $mem" >&2; return 2; }
  while [ "$#" -gt 0 ] && [ "$1" != -- ]; do
    opt=$1
    case "$opt" in
      --read-only | -i)
        opts+=("$opt")
        shift
        ;;
      --env-file | -e | --hostname | --cpus | --pids-limit | --cap-drop | --cap-add | --security-opt \
        | --tmpfs | -v | --network | --name | --entrypoint | -w | --user)
        if [ "$#" -lt 2 ] || [ "$2" = -- ]; then
          echo "amg_run : valeur manquante pour $opt" >&2
          return 2
        fi
        amg_run_value_ok "$opt" "$2" || { echo "amg_run : valeur refusée pour $opt : $2" >&2; return 2; }
        opts+=("$opt" "$2")
        shift 2
        ;;
      *)
        echo "amg_run : option hors liste blanche : $opt" >&2
        return 2
        ;;
    esac
  done
  [ "${1:-}" = -- ] && [ "$#" -ge 2 ] || { echo "amg_run : « -- <image> » manquant" >&2; return 2; }
  shift
  image=$1
  [[ "$image" =~ ^[a-z0-9][a-z0-9._/-]{0,200}(:[A-Za-z0-9._-]{1,128})?@sha256:[0-9a-f]{64}$ ]] \
    || { echo "amg_run : image non épinglée par digest : $image" >&2; return 2; }
  problems=$(amg_all_slices_problems)
  if [ -n "$problems" ]; then
    printf 'amg_run : REFUS : %s\n' "$problems" >&2
    return 5
  fi
  if ! docker image inspect -f '{{.Id}}' "$image" >/dev/null 2>&1; then
    docker pull --quiet "$image" >/dev/null || { echo "amg_run : image $image introuvable" >&2; return 2; }
  fi
  image_labels_safe "$image" || { echo "amg_run : REFUS : l'image $image porte des labels Traefik ou n'a pas pu être inspectée" >&2; return 2; }
  flock -w "$AMG_ONEOFF_WAIT" "${AMG_ROOT:-/opt/amg}/.oneoff.lock" \
    docker run "${opts[@]}" --rm --cgroup-parent "amg-$env_name.slice" --memory "$mem" --memory-swap "$mem" \
    --oom-score-adj "$AMG_ONEOFF_OOM_SCORE_ADJ" --label "org.amg.role=$role" -- "$@"
}

# Options de session de toute commande psql sous le superutilisateur `amg` (EXPLOITATION.md §11) :
# chemin de recherche sans `public` (une fonction ou un opérateur d'amg_migrator n'y est jamais
# résolu). Toujours avec `psql -X` (aucun ~/.psqlrc lu).
AMG_PG_ADMIN_OPTIONS='-c search_path=pg_catalog,pg_temp'
# Vérification du journal de sécurité (roles.sql) : NULL (sortie vide avec psql -At) si conforme,
# sinon l'écart en clair. Ne lit que des catalogues, chemin épinglé : aucun code d'amg_migrator.
AMG_JOURNAL_CHECK_SQL='select amg_guard.security_events_violation()'

# Hôtes autorisés par environnement (domaine public du site, ADR-0020).
amg_allowed_hosts() {
  case "$1" in
    prod) echo '^((www|admin|espace)\.)?amgdecorationdinterieur\.com$' ;;
    staging) echo '^((admin|espace)\.)?staging\.amgdecorationdinterieur\.com$' ;;
    *) echo '^$' ;;
  esac
}

# Problèmes d'une règle de routeur Traefik ($1 env, $2 règle ; une ligne par problème, aucune sortie
# = conforme), utilisé par watch.sh. Deux formes seulement :
#   Host(`a`) || Host(`b`) …                          hôtes d'AMG (parenthèses admises)
#   (Host(`a`) || Host(`b`)) && PathPrefix(`/api/`)     l'API, à la même origine que chaque CRM
# PathPrefix n'est admis que joint par && à un groupe d'hôtes AMG : jamais seul ni par ||, ce qui
# capterait les chemins /api/ de tous les hôtes du Traefik partagé (ceux du voisin compris).
amg_traefik_rule_problems() {
  local env_name=$1 rule=$2 rest host_re matched host count=0
  local bt=$'\x60' # accent grave, délimiteur des valeurs dans la syntaxe Traefik
  local matcher_re="Host\\(${bt}([^${bt}]*)${bt}\\)" leftover_re='^[[:space:]|()]*$'
  local api_re="^\\((.*)\\)[[:space:]]*&&[[:space:]]*PathPrefix\\(${bt}/api/${bt}\\)\$"
  rest=$rule
  if [[ "$rest" =~ $api_re ]]; then rest=${BASH_REMATCH[1]}; fi
  host_re=$(amg_allowed_hosts "$env_name")
  while [[ "$rest" =~ $matcher_re ]]; do
    matched=${BASH_REMATCH[0]}
    host=${BASH_REMATCH[1]}
    rest=${rest/"$matched"/}
    [[ "$host" =~ $host_re ]] || echo "hôte non autorisé : $host"
    count=$((count + 1))
  done
  if [ "$count" -eq 0 ] || ! [[ "$rest" =~ $leftover_re ]]; then
    echo "règle non reconnue : $rule"
  fi
}

# Liste de restauration filtrée (EXPLOITATION.md §11, restauration) : lit la sortie de
# `pg_restore -l` sur l'entrée standard, écrit sur la sortie la liste à restaurer sous amg_migrator
# (`pg_restore -L`), et chaque ligne retirée sur la sortie d'erreur. Retirés : déclencheurs
# d'événement, schéma amg_guard et tous ses objets (réservés au superutilisateur, recréés par
# roles.sql), schéma public lui-même, ses droits et son commentaire, droits par défaut (posés par
# roles.sql), extension plpgsql (fournie par le serveur). Tout autre objet doit être dans le schéma
# public ou sans schéma, sinon refus (code 1) : la liste n'est pas utilisable.
amg_restore_list_filter() {
  local line body status=0
  local entry_re='^[0-9]+; [0-9]+ [0-9]+ (.+)$'
  local drop_re='^(EVENT TRIGGER |DEFAULT ACL |SCHEMA - (public|amg_guard)( |$)|(ACL|COMMENT) - SCHEMA (public|amg_guard)( |$)|EXTENSION - plpgsql( |$)|COMMENT - EXTENSION plpgsql( |$)|[A-Z]+( [A-Z]+)* amg_guard )'
  local keep_re='^[A-Z]+( [A-Z]+)* (public|-) '
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -z "$line" ] || [[ "$line" == ';'* ]]; then
      printf '%s\n' "$line"
      continue
    fi
    if ! [[ "$line" =~ $entry_re ]]; then
      printf 'liste : REFUS : ligne illisible : %s\n' "$line" >&2
      status=1
      continue
    fi
    body=${BASH_REMATCH[1]}
    if [[ "$body" =~ $drop_re ]]; then
      printf 'liste : retiré : %s\n' "$line" >&2
    elif [[ "$body" =~ $keep_re ]]; then
      printf '%s\n' "$line"
    else
      printf 'liste : REFUS : objet hors du schéma public : %s\n' "$line" >&2
      status=1
    fi
  done
  return "$status"
}
