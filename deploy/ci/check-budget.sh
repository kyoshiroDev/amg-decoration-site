#!/usr/bin/env bash
# Garde-fou du budget mémoire AMG (ADR-0020 : 4 Gio au plus, tous conteneurs AMG confondus).
# Lancé par le job `build` de .github/workflows/deploy.yml, et à la main depuis la racine du dépôt :
#   deploy/ci/check-budget.sh [prod.env] [staging.env]   (défaut : modèles deploy/env/*.env.example)
# Pas installé sur le serveur (deploy/bin/ seul l'est) : il lit les fichiers du dépôt.
#
# Échoue si :
#   - un service Compose (tous profils actifs) n'a pas cgroup_parent: amg.slice, pas de mem_limit,
#     ou un memswap_limit différent de mem_limit (swap interdit) ;
#   - un `docker run` / `docker create` d'un script du serveur (deploy/bin/) n'a pas
#     --cgroup-parent amg.slice, --memory et --memory-swap égal ;
#   - la slice deploy/systemd/amg.slice ne fixe pas MemoryMax=4G et MemorySwapMax=0 ;
#   - le pire cas dépasse 4 Gio moins la marge (BUDGET_MARGIN_MIB, 512 Mio par défaut) :
#       somme des mem_limit de la production et de la préproduction
#     + par environnement, une réplique de plus du plus gros service routé par Traefik (bascule de
#       deploy.sh : deux réplicas le temps du healthcheck ; un seul service à la fois sous le verrou
#       de l'environnement, mais prod et préproduction peuvent basculer en même temps)
#     + le plus gros conteneur ponctuel des scripts du serveur (sauvegarde restic).
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DEPLOY=$ROOT/deploy
PROD_ENV=${1:-$DEPLOY/env/prod.env.example}
STAGING_ENV=${2:-$DEPLOY/env/staging.env.example}
SLICE=amg.slice
SLICE_RE='amg\.slice'
SLICE_FILE=$DEPLOY/systemd/$SLICE
MIB=$((1024 * 1024))
BUDGET_BYTES=$((4 * 1024 * MIB))
MARGIN_MIB=${BUDGET_MARGIN_MIB:-512}
[[ "$MARGIN_MIB" =~ ^[0-9]+$ ]] || { echo "BUDGET_MARGIN_MIB invalide : $MARGIN_MIB" >&2; exit 2; }
MAX_BYTES=$((BUDGET_BYTES - MARGIN_MIB * MIB))
# Scripts du POSTE de l'humain (ils refusent de tourner sur le serveur) : hors budget du VPS.
WORKSTATION_SCRIPTS=(restore-test.sh restore-prod.sh)

errors=()
error() { errors+=("$*"); }
mib() { echo $(($1 / MIB)); }

to_bytes() { # 512m, 1g, 64M, 1024k, 1048576 ou 1048576b → octets (base 1024, comme Docker)
  local v=${1,,} n unit
  [[ "$v" =~ ^([0-9]+)([bkmg]?)$ ]] || return 1
  n=${BASH_REMATCH[1]}
  unit=${BASH_REMATCH[2]}
  case "$unit" in
    '' | b) echo "$n" ;;
    k) echo $((n * 1024)) ;;
    m) echo $((n * MIB)) ;;
    g) echo $((n * 1024 * MIB)) ;;
  esac
}

# 1. La slice : plafond dur de 4 Gio, sans swap.
slice_value() { sed -n "s/^[[:space:]]*$1=//p" "$SLICE_FILE" | tail -n 1; }
if [ -r "$SLICE_FILE" ]; then
  [ "$(slice_value MemoryMax)" = 4G ] || error "$SLICE_FILE : MemoryMax=$(slice_value MemoryMax) (attendu 4G)"
  [ "$(slice_value MemorySwapMax)" = 0 ] || error "$SLICE_FILE : MemorySwapMax=$(slice_value MemorySwapMax) (attendu 0)"
else
  error "$SLICE_FILE introuvable"
fi

# 2. Services Compose, tous profils actifs (le site de production est derrière un profil).
total=0
printf '%-10s %-24s %10s\n' environnement service limite
check_env() { # $1 nom, $2 fichier d'environnement, $3… fichiers Compose
  local env_name=$1 env_file=$2 json name svc parent mem swap routed mem_b swap_b rollout=0 rollout_svc=-
  shift 2
  local -a files=()
  for f in "$@"; do files+=(-f "$f"); done
  json=$(docker compose -p "amg-$env_name" --env-file "$env_file" "${files[@]}" --profile '*' \
    config --format json) || { error "$env_name : docker compose config a échoué"; return 0; }
  name=$(jq -r '.name' <<<"$json")
  [ "$name" = "amg-$env_name" ] || error "$env_name : projet Compose $name (attendu amg-$env_name)"
  [ "$(jq '.services | length' <<<"$json")" -gt 0 ] || error "$env_name : aucun service"
  while IFS=$'\t' read -r svc parent mem swap routed; do
    [ "$parent" = "$SLICE" ] || error "$env_name/$svc : cgroup_parent « $parent » (attendu $SLICE)"
    if ! mem_b=$(to_bytes "$mem") || [ "$mem_b" -le 0 ]; then
      error "$env_name/$svc : mem_limit absent ou illisible (« $mem »)"
      continue
    fi
    swap_b=$(to_bytes "$swap") || swap_b=-1
    [ "$swap_b" = "$mem_b" ] || error "$env_name/$svc : memswap_limit « $swap » différent de mem_limit « $mem » (swap interdit)"
    if [ "$routed" = true ] && [ "$mem_b" -gt "$rollout" ]; then
      rollout=$mem_b
      rollout_svc=$svc
    fi
    total=$((total + mem_b))
    printf '%-10s %-24s %6s Mio\n' "$env_name" "$svc" "$(mib "$mem_b")"
  done < <(jq -r '.services | to_entries[] | [
      .key,
      (.value.cgroup_parent // "-"),
      (.value.mem_limit // "-" | tostring),
      (.value.memswap_limit // "-" | tostring),
      ((.value.labels // {}) | if type == "array" then any(. == "traefik.enable=true") else .["traefik.enable"] == "true" end | tostring)
    ] | @tsv' <<<"$json")
  total=$((total + rollout))
  printf '%-10s %-24s %6s Mio\n' "$env_name" "bascule (+1 $rollout_svc)" "$(mib "$rollout")"
}
check_env prod "$PROD_ENV" "$DEPLOY/compose.yaml"
check_env staging "$STAGING_ENV" "$DEPLOY/compose.yaml" "$DEPLOY/compose.staging.yaml"

# 3. Conteneurs ponctuels des scripts du serveur : lignes de continuation (\) rassemblées.
oneoff=0 oneoff_where=-
for script in "$DEPLOY"/bin/*.sh; do
  base=${script##*/}
  [[ " ${WORKSTATION_SCRIPTS[*]} " == *" $base "* ]] && continue
  while IFS= read -r cmd; do
    [[ "$cmd" =~ docker[[:space:]]+(run|create)[[:space:]] ]] || continue
    [[ "$cmd" =~ ^[[:space:]]*# ]] && continue
    [[ "$cmd" =~ --cgroup-parent[=[:space:]]+$SLICE_RE([[:space:]]|$) ]] \
      || error "$base : docker run/create sans --cgroup-parent $SLICE : ${cmd:0:80}…"
    mem='' swap=''
    [[ "$cmd" =~ --memory[=[:space:]]+([0-9]+[bkmgBKMG]?)([[:space:]]|$) ]] && mem=${BASH_REMATCH[1]}
    [[ "$cmd" =~ --memory-swap[=[:space:]]+([0-9]+[bkmgBKMG]?)([[:space:]]|$) ]] && swap=${BASH_REMATCH[1]}
    if [ -z "$mem" ]; then
      error "$base : docker run sans --memory : ${cmd:0:80}…"
      continue
    fi
    mem_b=$(to_bytes "$mem")
    if [ -z "$swap" ] || [ "$(to_bytes "$swap")" != "$mem_b" ]; then
      error "$base : --memory-swap absent ou différent de --memory (swap interdit)"
    fi
    if [ "$mem_b" -gt "$oneoff" ]; then
      oneoff=$mem_b
      oneoff_where=$base
    fi
  done < <(sed -e ':a' -e '/\\$/N; s/\\\n//; ta' "$script")
done
printf '%-10s %-24s %6s Mio\n' ponctuel "$oneoff_where" "$(mib "$oneoff")"
total=$((total + oneoff))

echo
echo "pire cas : $(mib "$total") Mio ; seuil : $(mib "$MAX_BYTES") Mio (4096 Mio - marge $MARGIN_MIB Mio) ;" \
  "reste avant le seuil : $(((MAX_BYTES - total) / MIB)) Mio"
[ "$total" -le "$MAX_BYTES" ] || error "budget dépassé : $(mib "$total") Mio > $(mib "$MAX_BYTES") Mio"

if [ "${#errors[@]}" -gt 0 ]; then
  printf 'ERREUR : %s\n' "${errors[@]}" >&2
  exit 1
fi
echo "budget mémoire AMG respecté"
