#!/usr/bin/env bash
# Garde-fou du budget mémoire AMG (ADR-0020 : 4 Gio au total pour tout AMG, dont 3 800 Mio dans la
# slice amg.slice et le reste pour les coûts hors slice ; docs/EXPLOITATION.md, 10).
# Lancé par .github/workflows/ci.yml (job « Budget mémoire AMG », chaque PR) et deploy.yml (job
# `build`), et à la main depuis la racine du dépôt :
#   deploy/ci/check-budget.sh [prod.env] [staging.env]   (défaut : modèles deploy/env/*.env.example)
# Pas installé sur le serveur : il lit les fichiers du dépôt. Constantes : deploy/bin/amg-common.sh.
#
# Échoue si :
#   - les slices deploy/systemd/{amg,amg-prod,amg-staging}.slice ne portent pas les plafonds de
#     amg-common.sh (mémoire, CPUQuota, TasksMax), sans swap ;
#   - un service Compose (tous profils actifs) a une clé build: (jamais de construction sur le
#     serveur : hors de toute slice), n'a pas cgroup_parent: amg-<env>.slice, pas de
#     mem_limit, un memswap_limit différent (swap interdit), plus d'une réplique (deploy.replicas ou
#     scale : la réplique de bascule est comptée à part), un tmpfs sans size=, ou, en préproduction,
#     un oom_score_adj autre que 900 (en production : au plus 500) ;
#   - un script du serveur (deploy/bin/, hors scripts du poste) lance un conteneur autrement que par
#     amg_run (amg-common.sh) : `docker run|create`, `docker container …`, `docker compose run|create`,
#     options avant la sous-commande, sous-commande non littérale, docker appelé par une variable ou
#     un chemin, transmission d'arguments à docker hors d'une fonction d'enrobage de `docker compose`,
#     eval, `sh -c`, source d'un autre fichier que amg-common.sh ; un amg_run sans mémoire littérale,
#     ou en arrière-plan (`&` sur sa ligne ou sur celle d'une fonction qui l'appelle) ; `--scale`
#     hors de deploy.sh ; `-f`, `--file` ou `--project-directory` entre `compose` et sa
#     sous-commande, COMPOSE_FILE ; docker.sock, `--unix-socket`, DOCKER_HOST ou DOCKER_CONTEXT
#     (l'API Docker appelée sans le CLI) ;
#   - amg-common.sh appelle docker autrement que par un seul `docker run` (celui de amg_run) et
#     `docker info`, `docker pull`, `docker image inspect` ;
#   - le pire cas dépasse le plafond de amg.slice moins la marge interne (AMG_BUDGET_MARGIN_MIB) :
#       production + préproduction (somme des mem_limit, plus une réplique du plus gros service
#       routé par Traefik pour la bascule : un service à la fois sous le verrou de l'environnement ;
#       production et préproduction peuvent basculer en même temps)
#     + le plus gros conteneur ponctuel (amg_run : un seul à la fois sur tout le serveur, verrou
#       commun /opt/amg/.oneoff.lock) ;
#   - le pire cas de la préproduction (avec son plus gros ponctuel) dépasse le plafond de
#     amg-staging.slice ;
#   - Compose déclare le secret pg_migrator_password (réservé au conteneur ponctuel des migrations).
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DEPLOY=$ROOT/deploy
PROD_ENV=${1:-$DEPLOY/env/prod.env.example}
STAGING_ENV=${2:-$DEPLOY/env/staging.env.example}
COMMON=$DEPLOY/bin/amg-common.sh
# shellcheck source=deploy/bin/amg-common.sh
source "$COMMON"
MIB=$AMG_MIB
MAX_BYTES=$(((AMG_SLICE_MAX_MIB - AMG_BUDGET_MARGIN_MIB) * MIB))
# Scripts du POSTE de l'humain (ils refusent de tourner sur le serveur) : hors budget du VPS.
WORKSTATION_SCRIPTS=(restore-test.sh restore-prod.sh)
# Sous-commandes docker admises dans les scripts du serveur (refus par défaut : aucune ne crée de
# conteneur). Groupes : seconde sous-commande admise.
LEAF_SUBS=' ps exec inspect logs rm stop info stats pull '
declare -A GROUP_SUBS=([image]=' inspect ls ' [network]=' inspect ls ' [volume]=' inspect ls ' [system]=' df ')
COMPOSE_SUBS=' config ps pull up rm stop exec logs restart '
# Mentions de « docker » qui ne sont pas des appels (chemins de données).
NOT_A_CALL_RE='^/var/lib/docker$'
COMPOSE_CALL_RE='(^|[^A-Za-z0-9_.@/-])docker[[:space:]]+compose([[:space:]]|$)'
# Accès à l'API Docker sans le CLI, ou redirection du CLI vers un autre démon.
DAEMON_ACCESS_RE='docker\.sock|--unix-socket|DOCKER_HOST|DOCKER_CONTEXT|COMPOSE_FILE'
FN_END_RE='^}|;[[:space:]]*}[[:space:]]*$'
FN_DEF_RE='^[[:space:]]*(function[[:space:]]+)?([A-Za-z_][A-Za-z0-9_-]*)[[:space:]]*\(\)'
DOCKER_WORD_RE='(^|[^A-Za-z0-9_.@-])docker($|[^A-Za-z0-9_.-])'
# Appel littéral : docker, $(docker, <(docker, VAR=$(docker… (rien d'autre autour du mot).
DOCKER_CALL_RE="^([A-Za-z_][A-Za-z0-9_]*=)?[\"'\$(<\`{!]*docker[\"'\`})]*\$"
SOURCE_COMMON_RE='^[[:space:]]*source[[:space:]]+"\$\(dirname "\$\(readlink -f "\$\{BASH_SOURCE\[0\]\}"\)"\)/amg-common\.sh"[[:space:]]*$'

errors=()
error() { errors+=("$*"); }
mib() { echo $(($1 / MIB)); }

to_bytes() { # 512m, 1g, 64M, 1024k, 1048576 ou 1048576b → octets (base 1024, comme Docker)
  local v=${1,,} n unit
  [[ "$v" =~ ^([0-9]{1,12})([bkmg]?)$ ]] || return 1
  n=${BASH_REMATCH[1]}
  unit=${BASH_REMATCH[2]}
  case "$unit" in
    '' | b) echo "$((10#$n))" ;;
    k) echo $((10#$n * 1024)) ;;
    m) echo $((10#$n * MIB)) ;;
    g) echo $((10#$n * 1024 * MIB)) ;;
  esac
}

# 0. Constantes cohérentes : la slice plus la réserve hors slice tiennent dans le total.
((AMG_SLICE_MAX_MIB + AMG_OUTSIDE_RESERVE_MIB <= AMG_TOTAL_MIB)) \
  || error "amg-common.sh : AMG_SLICE_MAX_MIB ($AMG_SLICE_MAX_MIB) + réserve hors slice ($AMG_OUTSIDE_RESERVE_MIB) > $AMG_TOTAL_MIB Mio"
((AMG_OUTSIDE_RESERVE_MIB >= 200)) || error "amg-common.sh : réserve hors slice < 200 Mio"
((AMG_SLICE_HIGH_MIB < AMG_SLICE_MAX_MIB && AMG_STAGING_HIGH_MIB < AMG_STAGING_MAX_MIB)) \
  || error "amg-common.sh : MemoryHigh doit rester sous MemoryMax"
((AMG_STAGING_MAX_MIB < AMG_SLICE_MAX_MIB)) || error "amg-common.sh : plafond de préproduction >= plafond AMG"
((AMG_BUDGET_MARGIN_MIB >= 384)) || error "amg-common.sh : marge interne < 384 Mio"

# 1. Les slices : plafonds de amg-common.sh, sans swap.
check_slice_file() { # $1 fichier, puis paires Clé=valeur attendues
  local file=$DEPLOY/systemd/$1 pair key want got
  shift
  if [ ! -r "$file" ]; then
    error "$file introuvable"
    return 0
  fi
  for pair in "$@"; do
    key=${pair%%=*}
    want=${pair#*=}
    got=$(sed -n "s/^[[:space:]]*$key=//p" "$file" | tail -n 1)
    [ "$got" = "$want" ] || error "$file : $key=$got (attendu $want)"
  done
}
check_slice_file amg.slice "MemoryMax=${AMG_SLICE_MAX_MIB}M" "MemoryHigh=${AMG_SLICE_HIGH_MIB}M" \
  MemorySwapMax=0 MemoryZSwapMax=0 "CPUQuota=$((AMG_SLICE_CPUS * 100))%" "TasksMax=$AMG_SLICE_TASKS_MAX"
check_slice_file amg-prod.slice "MemoryMax=${AMG_SLICE_MAX_MIB}M" MemorySwapMax=0 MemoryZSwapMax=0
check_slice_file amg-staging.slice "MemoryMax=${AMG_STAGING_MAX_MIB}M" "MemoryHigh=${AMG_STAGING_HIGH_MIB}M" \
  MemorySwapMax=0 MemoryZSwapMax=0

# 2. Services Compose, tous profils actifs (le site de production est derrière un profil).
declare -A env_total=()
printf '%-10s %-28s %10s\n' environnement service limite
check_env() { # $1 nom, $2 fichier d'environnement, $3… fichiers Compose
  local env_name=$1 env_file=$2 json name svc parent mem swap routed replicas scale oom tmpfs_bad build tmpfs_exec tmpfs_vol_nosize
  local mem_b swap_b sum=0 rollout=0 rollout_svc=- slice
  slice=$(amg_env_slice "$env_name")
  shift 2
  local -a files=()
  for f in "$@"; do files+=(-f "$f"); done
  json=$(docker compose -p "amg-$env_name" --env-file "$env_file" "${files[@]}" --profile '*' \
    config --format json) || { error "$env_name : docker compose config a échoué"; return 0; }
  name=$(jq -r '.name' <<<"$json")
  [ "$name" = "amg-$env_name" ] || error "$env_name : projet Compose $name (attendu amg-$env_name)"
  [ "$(jq '.services | length' <<<"$json")" -gt 0 ] || error "$env_name : aucun service"
  # Le secret d'amg_migrator ne va qu'au conteneur ponctuel des migrations (amg_run, rôle migrate) :
  # jamais déclaré ni monté par Compose (EXPLOITATION.md, §11).
  [ "$(jq '[(.secrets // {}) | to_entries[] | select((.key + " " + (.value.file // "")) | test("pg_migrator_password"))] | length' <<<"$json")" = 0 ] \
    || error "$env_name : secret pg_migrator_password déclaré dans Compose (réservé au conteneur des migrations)"
  [ "$(jq '[.services[] | (.volumes // [])[] | select((if type == "string" then . else (.source // "") end) | test("pg_migrator_password"))] | length' <<<"$json")" = 0 ] \
    || error "$env_name : un service Compose monte pg_migrator_password (réservé au conteneur des migrations)"
  local rows=0
  while IFS=$'\t' read -r svc parent mem swap routed replicas scale oom tmpfs_bad build tmpfs_exec tmpfs_vol_nosize; do
    rows=$((rows + 1))
    [ "$build" = false ] || error "$env_name/$svc : build: interdit (images construites en CI, jamais sur le serveur)"
    [ "$parent" = "$slice" ] || error "$env_name/$svc : cgroup_parent « $parent » (attendu $slice)"
    { [ "$replicas" = - ] || [ "$replicas" -le 1 ]; } \
      || error "$env_name/$svc : deploy.replicas=$replicas (au plus 1 : la bascule est comptée à part)"
    { [ "$scale" = - ] || [ "$scale" -le 1 ]; } \
      || error "$env_name/$svc : scale=$scale (au plus 1 : la bascule est comptée à part)"
    [ "$tmpfs_bad" = 0 ] || error "$env_name/$svc : tmpfs sans size= (mémoire non bornée dans le conteneur)"
    [ "$tmpfs_vol_nosize" = 0 ] || error "$env_name/$svc : volume tmpfs sans taille (mémoire non bornée dans le conteneur)"
    # Services exposés (site, API) : /tmp jamais exécutable (noexec, nosuid, nodev).
    [ "$routed" != true ] || [ "$tmpfs_exec" = 0 ] \
      || error "$env_name/$svc : tmpfs sans noexec,nosuid,nodev (ou rétabli par exec, suid, dev, ou volume tmpfs, sans ces options) sur un service exposé par Traefik"
    if [ "$env_name" = staging ]; then
      [ "$oom" = 900 ] || error "$env_name/$svc : oom_score_adj=$oom (attendu 900 : préproduction tuée en premier)"
    else
      { [[ "$oom" =~ ^-?[0-9]+$ ]] && [ "$oom" -le 500 ]; } \
        || error "$env_name/$svc : oom_score_adj=$oom (attendu <= 500 en production)"
    fi
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
    sum=$((sum + mem_b))
    printf '%-10s %-28s %6s Mio\n' "$env_name" "$svc" "$(mib "$mem_b")"
  done < <(jq -r '.services | to_entries[] | [
      .key,
      (.value.cgroup_parent // "-"),
      (.value.mem_limit // "-" | tostring),
      (.value.memswap_limit // "-" | tostring),
      ((.value.labels // {}) | if type == "array" then any(. == "traefik.enable=true") else .["traefik.enable"] == "true" end | tostring),
      (.value.deploy.replicas // "-" | tostring),
      (.value.scale // "-" | tostring),
      (.value.oom_score_adj // "-" | tostring),
      ([(.value.tmpfs // []) | if type == "string" then [.] else . end | .[] | select(test("(^|[:,])size=") | not)] | length | tostring),
      (.value | has("build") | tostring),
      ((([(.value.tmpfs // []) | if type == "string" then [.] else . end | .[] | select((test("(^|[:,])noexec(,|$)") and test("(^|[:,])nosuid(,|$)") and test("(^|[:,])nodev(,|$)") and (test("(^|[:,])(exec|suid|dev)(,|$)") | not)) | not)] | length)
        + ([(.value.volumes // [])[] | select(type == "object" and .type == "tmpfs")] | length)) | tostring),
      ([(.value.volumes // [])[] | select(type == "object" and .type == "tmpfs" and ((.tmpfs.size // 0) | tostring | test("^[1-9]") | not))] | length | tostring)
    ] | @tsv' <<<"$json")
  # Une expression jq en échec ne doit jamais donner une liste de services vide, donc un budget nul.
  [ "$rows" = "$(jq '.services | length' <<<"$json")" ] \
    || error "$env_name : lecture des services incomplète ($rows lus) : contrôle invalide"
  printf '%-10s %-28s %6s Mio\n' "$env_name" "bascule (+1 $rollout_svc)" "$(mib "$rollout")"
  env_total[$env_name]=$((sum + rollout))
}
check_env prod "$PROD_ENV" "$DEPLOY/compose.yaml"
check_env staging "$STAGING_ENV" "$DEPLOY/compose.yaml" "$DEPLOY/compose.staging.yaml"

# 3. Appels docker des scripts du serveur. Lignes de continuation (\) rassemblées, lignes de
# commentaire ignorées, découpage en mots naïf (refus par défaut : au moindre doute, erreur).
norm() { # mot sans ponctuation de tête ni de queue, dans REPLY (sans sous-shell : rapide)
  REPLY=$1
  REPLY=${REPLY#"${REPLY%%[A-Za-z0-9_/]*}"}
  REPLY=${REPLY%%[^A-Za-z0-9_/.-]*}
}
logical_lines() { sed -e ':a' -e '/\\$/N; s/\\\n//; ta' "$1" | grep -v '^[[:space:]]*#' || true; }
is_literal() { [[ "$1" =~ ^[a-z][a-z0-9-]*$ ]]; }
forwards() { [[ "$1" == *"\$@"* || "$1" == *"\$*"* || "$1" == *"\${@"* || "$1" == *"\${*"* ]]; }

oneoff=0 oneoff_where=- oneoff_staging=0
record_oneoff() { # $1 script, $2 environnement littéral ou -, $3 rôle, $4 mémoire
  local base=$1 env_tok=$2 role=$3 mem=$4 mem_b
  if ! [[ "$mem" =~ ^[1-9][0-9]{0,4}m$ ]]; then
    error "$base : amg_run sans mémoire littérale NNNm (« $mem »)"
    return 0
  fi
  is_literal "$role" || error "$base : amg_run sans rôle littéral (« $role »)"
  mem_b=$(to_bytes "$mem")
  if [ "$mem_b" -gt "$oneoff" ]; then
    oneoff=$mem_b
    oneoff_where="$base ($role)"
  fi
  # Environnement non littéral : le conteneur peut tourner dans les deux.
  if [ "$env_tok" != prod ] && [ "$mem_b" -gt "$oneoff_staging" ]; then oneoff_staging=$mem_b; fi
  printf '%-10s %-28s %6s Mio\n' ponctuel "$base ($role, ${env_tok/-/prod|staging})" "$(mib "$mem_b")"
}

scan_script() { # $1 chemin
  local file=$1 base=${1##*/} line fn='' i n t prev sub sub2 j has_sub is_call bare
  local -a w
  local -A wrappers=() oneoff_wrappers=()
  # Passe 1 : fonctions qui enrobent `docker compose` en transmettant leurs arguments, et fonctions
  # qui appellent amg_run (leur appel en arrière-plan contournerait le verrou des ponctuels).
  while IFS= read -r line; do
    read -r -a w <<<"$line"
    [ "${#w[@]}" -gt 0 ] || continue
    if [[ "$line" =~ $FN_DEF_RE ]]; then
      fn=${BASH_REMATCH[2]}
    fi
    if [[ "$line" =~ $COMPOSE_CALL_RE ]] && forwards "$line"; then
      if [ -n "$fn" ]; then wrappers[$fn]=1; fi
    fi
    if [ -n "$fn" ] && [ "$fn" != amg_run ] && [[ "$line" =~ (^|[^A-Za-z0-9_-])amg_run([[:space:]]|$) ]]; then
      oneoff_wrappers[$fn]=1
    fi
    if [[ "$line" =~ $FN_END_RE ]]; then fn=''; fi
  done < <(logical_lines "$file")

  fn=''
  while IFS= read -r line; do
    read -r -a w <<<"$line"
    n=${#w[@]}
    [ "$n" -gt 0 ] || continue
    if [[ "$line" =~ $FN_DEF_RE ]]; then
      fn=${BASH_REMATCH[2]}
      [ "$fn" != amg_run ] || error "$base : redéfinit amg_run"
    fi
    [[ ! "$line" =~ $DAEMON_ACCESS_RE ]] \
      || error "$base : accès direct au démon Docker ou fichier Compose imposé (${BASH_REMATCH[0]}) : ${line:0:80}"
    # « & » isolé (hors &&, >&, &>) : commande en arrière-plan.
    bare=${line//&&/}
    bare=${bare//>&/}
    bare=${bare//&>/}
    for ((i = 0; i < n; i++)); do
      norm "${w[i]}"
      t=$REPLY
      case "$t" in
        eval) error "$base : eval interdit : ${line:0:80}" ;;
        sh | bash | dash)
          [ "${w[i + 1]:-}" != -c ] || error "$base : $t -c interdit : ${line:0:80}"
          ;;
        source)
          [[ "$line" =~ $SOURCE_COMMON_RE ]] || error "$base : source d'autre chose que amg-common.sh : ${line:0:80}"
          ;;
      esac
      if [ "${w[i]}" = . ] && [ "$i" -eq 0 ]; then error "$base : « . » interdit (utiliser source amg-common.sh)"; fi
      if [[ "${w[i]}" == --scale || "${w[i]}" == --scale=* ]] && [ "$base" != deploy.sh ]; then
        error "$base : --scale hors de deploy.sh (seule la bascule ajoute une réplique, comptée au budget)"
      fi
      # Mentions de docker : appel littéral `docker <sous-commande>`, ou erreur.
      if [[ "${w[i]}" =~ $DOCKER_CALL_RE ]]; then
        is_call=1
      else
        is_call=0
        if [[ "${w[i]}" =~ $DOCKER_WORD_RE ]] && ! [[ "$t" =~ $NOT_A_CALL_RE ]]; then
          error "$base : docker appelé indirectement (variable, chemin, chaîne) : ${w[i]}"
          continue
        fi
      fi
      if [ "$is_call" = 1 ]; then
        sub=${w[i + 1]:-}
        if ! is_literal "$sub"; then
          error "$base : sous-commande docker absente, non littérale ou précédée d'options : docker $sub"
          continue
        fi
        case "$sub" in
          run | create | container)
            error "$base : docker $sub interdit, passer par amg_run (amg-common.sh) : ${line:0:80}"
            ;;
          compose)
            has_sub=0
            for ((j = i + 2; j < n; j++)); do
              case "${w[j]}" in
                run | create) error "$base : docker compose ${w[j]} interdit : ${line:0:80}" ;;
              esac
              # Options globales avant la sous-commande : jamais un autre fichier Compose.
              if [ "$has_sub" = 0 ]; then
                case "${w[j]}" in
                  -f | -f?* | --file | --file=* | --project-directory | --project-directory=*)
                    error "$base : ${w[j]} après docker compose interdit (fichiers Compose fixés par la fonction d'enrobage) : ${line:0:80}"
                    ;;
                esac
              fi
              [[ "$COMPOSE_SUBS" == *" ${w[j]} "* ]] && has_sub=1
            done
            if [ "$has_sub" = 0 ]; then
              if ! forwards "$line"; then
                error "$base : sous-commande docker compose introuvable : ${line:0:80}"
              elif [ -z "$fn" ]; then
                error "$base : arguments transmis à docker compose hors d'une fonction : ${line:0:80}"
              fi
            fi
            ;;
          *)
            if [ -n "${GROUP_SUBS[$sub]:-}" ]; then
              sub2=${w[i + 2]:-}
              [[ "${GROUP_SUBS[$sub]}" == *" $sub2 "* ]] \
                || error "$base : docker $sub $sub2 non admis (liste dans check-budget.sh)"
            elif [[ "$LEAF_SUBS" != *" $sub "* ]]; then
              error "$base : docker $sub non admis (liste dans check-budget.sh : ajouter seulement une sous-commande qui ne crée aucun conteneur)"
            fi
            ;;
        esac
        continue
      fi
      # Appel d'une fonction d'enrobage de `docker compose` : sous-commande littérale admise.
      prev=''
      if [ "$i" -gt 0 ]; then prev=${w[i - 1]}; fi
      if [ -n "$t" ] && [ -n "${wrappers[$t]:-}" ] && [[ "${w[i]}" != *'()'* ]] && ! [[ "$prev" =~ $DOCKER_CALL_RE ]]; then
        [[ "$COMPOSE_SUBS" == *" ${w[i + 1]:-} "* ]] \
          || error "$base : $t ${w[i + 1]:-} non admis (sous-commande compose littérale : $COMPOSE_SUBS)"
        continue
      fi
      if [ -n "$t" ] && [ -n "${oneoff_wrappers[$t]:-}" ] && [[ "${w[i]}" != *'()'* ]] && [[ "$bare" == *'&'* ]]; then
        error "$base : $t (appelle amg_run) en arrière-plan interdit : ${line:0:80}"
      fi
      if [ "$t" = amg_run ] && [[ "${w[i]}" != *'()'* ]]; then
        if [[ "$bare" == *'&'* ]]; then error "$base : amg_run en arrière-plan interdit"; fi
        case "${w[i + 1]:-}" in
          prod | staging) record_oneoff "$base" "${w[i + 1]}" "${w[i + 2]:-}" "${w[i + 3]:-}" ;;
          *) record_oneoff "$base" - "${w[i + 2]:-}" "${w[i + 3]:-}" ;;
        esac
      fi
    done
    if [[ "$line" =~ $FN_END_RE ]]; then fn=''; fi
  done < <(logical_lines "$file")
}

# amg_run lui-même : un seul `docker run`, verrou commun, valeurs imposées après celles de l'appelant.
# Ailleurs dans amg-common.sh : seulement docker info, docker pull, docker image inspect (un appel
# par ligne, sous-commande littérale).
common_runs=0
run_line=''
while IFS= read -r line; do
  [[ ! "$line" =~ $DAEMON_ACCESS_RE ]] || error "amg-common.sh : accès direct au démon Docker : ${line:0:80}"
  [[ "$line" =~ $DOCKER_WORD_RE ]] || continue
  if [[ "$line" =~ (^|[[:space:]])docker[[:space:]]+run[[:space:]] ]]; then
    common_runs=$((common_runs + 1))
    run_line=$line
  elif [ "$(grep -oE '(^|[^A-Za-z0-9_.@/-])docker($|[^A-Za-z0-9_.-])' <<<"$line" | wc -l)" != 1 ] \
    || ! [[ "$line" =~ (^|[[:space:]\(!])docker[[:space:]]+(info|pull|image[[:space:]]+inspect)[[:space:]] ]]; then
    error "amg-common.sh : appel docker non admis (seuls run dans amg_run, info, pull, image inspect) : ${line:0:80}"
  fi
done < <(logical_lines "$COMMON")
[ "$common_runs" = 1 ] || error "amg-common.sh : $common_runs appels docker run (attendu un seul, celui de amg_run)"
while IFS= read -r want; do
  [[ "$run_line" == *"$want"* ]] || error "amg-common.sh : amg_run ne contient plus : $want"
done <<'EOF2'
flock -w "$AMG_ONEOFF_WAIT" "${AMG_ROOT:-/opt/amg}/.oneoff.lock"
docker run "${opts[@]}" --rm --cgroup-parent "amg-$env_name.slice" --memory "$mem" --memory-swap "$mem"
--oom-score-adj "$AMG_ONEOFF_OOM_SCORE_ADJ" --label "org.amg.role=$role" -- "$@"
EOF2

for script in "$DEPLOY"/bin/*.sh; do
  base=${script##*/}
  [ "$base" != amg-common.sh ] || continue
  [[ " ${WORKSTATION_SCRIPTS[*]} " == *" $base "* ]] && continue
  scan_script "$script"
done
printf '%-10s %-28s %6s Mio\n' ponctuel "un à la fois : $oneoff_where" "$(mib "$oneoff")"

staging_worst=$((${env_total[staging]:-0} + oneoff_staging))
[ "$staging_worst" -le "$AMG_STAGING_MAX_BYTES" ] \
  || error "préproduction : pire cas $(mib "$staging_worst") Mio > plafond de amg-staging.slice ($AMG_STAGING_MAX_MIB Mio)"
total=$((${env_total[prod]:-0} + ${env_total[staging]:-0} + oneoff))

echo
echo "production : $(mib "${env_total[prod]:-0}") Mio ; préproduction : $(mib "${env_total[staging]:-0}") Mio" \
  "(avec son ponctuel : $(mib "$staging_worst") Mio, plafond $AMG_STAGING_MAX_MIB Mio)"
echo "pire cas : $(mib "$total") Mio ; seuil : $(mib "$MAX_BYTES") Mio (slice $AMG_SLICE_MAX_MIB Mio - marge" \
  "$AMG_BUDGET_MARGIN_MIB Mio ; total AMG $AMG_TOTAL_MIB Mio dont $AMG_OUTSIDE_RESERVE_MIB hors slice) ;" \
  "reste avant le seuil : $(((MAX_BYTES - total) / MIB)) Mio"
[ "$total" -le "$MAX_BYTES" ] || error "budget dépassé : $(mib "$total") Mio > $(mib "$MAX_BYTES") Mio"

if [ "${#errors[@]}" -gt 0 ]; then
  printf 'ERREUR : %s\n' "${errors[@]}" >&2
  exit 1
fi
echo "budget mémoire AMG respecté"
