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
# Marge interne de la slice, sous laquelle la CI garde le pire cas : noyau, pics, imprévu.
AMG_BUDGET_MARGIN_MIB=512
# Score OOM des conteneurs ponctuels (sauvegarde, futures migrations) : tués avant la production
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

# Problèmes de la slice $1 (une ligne chacun ; aucune sortie = conforme), $2 plafond en octets.
# Lecture seule, sans sudo : l'unité doit venir de son fichier (sans lui, systemd la créerait à la
# volée SANS limite), avec MemoryMax <= plafond et sans swap ; si son cgroup existe (au moins un
# conteneur dedans), la limite RÉELLEMENT appliquée par le noyau est relue elle aussi.
amg_slice_problems() {
  local slice=$1 limit=$2 props load fragment max swap dir cg_max cg_swap cg_zswap
  props=$(systemctl show "$slice" -p LoadState -p FragmentPath -p MemoryMax -p MemorySwapMax 2>/dev/null) || props=''
  load=$(sed -n 's/^LoadState=//p' <<<"$props")
  fragment=$(sed -n 's/^FragmentPath=//p' <<<"$props")
  max=$(sed -n 's/^MemoryMax=//p' <<<"$props")
  swap=$(sed -n 's/^MemorySwapMax=//p' <<<"$props")
  if [ "$load" != loaded ] || [ -z "$fragment" ]; then
    echo "slice $slice absente ou sans fichier d'unité (LoadState=${load:-?}, FragmentPath=${fragment:-aucun})"
    return 0
  fi
  amg_bytes_le "$max" "$limit" || echo "slice $slice : MemoryMax=${max:-?} (attendu <= $limit octets)"
  [ "$swap" = 0 ] || echo "slice $slice : MemorySwapMax=${swap:-?} (attendu 0)"
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
}

# Problèmes de toutes les slices AMG (amg.slice, puis celles des environnements).
amg_all_slices_problems() {
  amg_slice_problems "$AMG_SLICE" "$AMG_SLICE_MAX_BYTES"
  amg_slice_problems "$(amg_env_slice prod)" "$AMG_SLICE_MAX_BYTES"
  amg_slice_problems "$(amg_env_slice staging)" "$AMG_STAGING_MAX_BYTES"
}

# SEULE façon de lancer un conteneur ponctuel depuis un script du serveur (contrôlé par
# deploy/ci/check-budget.sh, qui refuse tout autre `docker run`, `docker create`, `docker container`
# ou `docker compose run`) :
#   amg_run <prod|staging> <rôle> <NNNm> [options docker run…] -- <image> [commande…]
# Toujours : slice de l'environnement, mémoire = mémoire + swap (aucun swap), label org.amg.role
# (repéré par watch.sh), score OOM des ponctuels, --rm, et UN SEUL conteneur ponctuel à la fois sur
# tout le serveur (verrou commun, attente bornée) : le budget n'en compte qu'un. Les options qui
# modifieraient ces garanties sont refusées, et les valeurs imposées sont placées APRÈS celles de
# l'appelant (pour docker, la dernière valeur d'une option l'emporte).
amg_run() {
  local env_name=${1:-} role=${2:-} mem=${3:-} opt
  local -a opts=()
  shift 3 || { echo "amg_run : arguments manquants" >&2; return 2; }
  case "$env_name" in prod | staging) ;; *) echo "amg_run : environnement refusé : $env_name" >&2; return 2 ;; esac
  [[ "$role" =~ ^[a-z][a-z0-9-]{0,30}$ ]] || { echo "amg_run : rôle refusé : $role" >&2; return 2; }
  [[ "$mem" =~ ^[1-9][0-9]{0,4}m$ ]] || { echo "amg_run : mémoire refusée (NNNm) : $mem" >&2; return 2; }
  while [ "$#" -gt 0 ] && [ "$1" != -- ]; do
    opt=$1
    case "$opt" in
      --cgroup-parent* | --memory* | --kernel-memory* | --oom-* | --label* | --detach* \
        | --rm | --rm=* | --privileged* | --pid* | --cgroupns* | --userns* | --publish*)
        echo "amg_run : option réservée ou interdite : $opt" >&2
        return 2
        ;;
      -[!-]?*)
        echo "amg_run : options courtes groupées interdites : $opt" >&2
        return 2
        ;;
      -m | -l | -d | -p | -P)
        echo "amg_run : option réservée ou interdite : $opt" >&2
        return 2
        ;;
    esac
    opts+=("$opt")
    shift
  done
  [ "${1:-}" = -- ] && [ "$#" -ge 2 ] || { echo "amg_run : « -- <image> » manquant" >&2; return 2; }
  shift
  flock -w "$AMG_ONEOFF_WAIT" "${AMG_ROOT:-/opt/amg}/.oneoff.lock" \
    docker run "${opts[@]}" --rm --cgroup-parent "amg-$env_name.slice" --memory "$mem" --memory-swap "$mem" \
    --oom-score-adj "$AMG_ONEOFF_OOM_SCORE_ADJ" --label "org.amg.role=$role" -- "$@"
}
