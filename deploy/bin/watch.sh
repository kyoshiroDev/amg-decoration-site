#!/usr/bin/env bash
# Surveillance des conteneurs AMG (et d'eux seuls).
# cron (compte de déploiement) : */5 * * * * /opt/amg/bin/watch.sh >> /opt/amg/logs/watch.log 2>&1
#
# Contrôle, pour chaque environnement installé (prod, staging) :
#   - chaque service attendu par Compose (profils compris) a au moins un conteneur en marche, sain,
#     sans redémarrage depuis le passage précédent (plantage, manque de mémoire) ;
#   - les labels Traefik des conteneurs AMG (labels de l'image compris) sont dans une liste blanche
#     stricte (voir traefik_label_problem) : objets préfixés par le projet, routeurs HTTP sur
#     l'entrée websecure, notre émetteur, des hôtes AMG attendus, nos middlewares et notre service.
#     Seconde ligne de défense : deploy.sh refuse déjà toute image qui porte un label traefik.* ;
#   - les adresses publiques listées répondent le code attendu (Traefik → réseau d'entrée → site) ;
#   - l'espace disque et les inodes de la racine et du dossier Docker restent sous le seuil ;
#   - les slices AMG (amg.slice : plafond commun de tout AMG, 3 800 Mio ; amg-prod.slice ;
#     amg-staging.slice : 1 Gio ; deploy/systemd/) sont chargées depuis leur fichier, avec MemoryMax
#     <= plafond et sans swap, ET le noyau applique bien ces limites (memory.max, memory.swap.max) ;
#     la mémoire non récupérable (memory.stat : anon + shmem + kernel + sock) de amg.slice et de
#     amg-staging.slice reste sous SLICE_MAX_PCT % de memory.max ; la pression mémoire (PSI, full
#     avg300) de amg.slice reste sous MEM_PRESSURE_PCT % ; aucun nouvel oom_kill dans memory.events
#     (hiérarchique : un conteneur AMG à sa propre limite compte aussi) ;
#   - chaque conteneur AMG (projets amg-prod, amg-staging, label org.amg.role) ET tout conteneur
#     branché sur un réseau ou un volume AMG (amg_edge_*, amg-*), sauf le Traefik partagé, est dans
#     la slice attendue (amg-<env>.slice pour un projet, une slice AMG pour un ponctuel) et porte un
#     label AMG.
# Puis signale à Healthchecks.io : succès, ou /fail avec la liste des problèmes. Healthchecks.io
# n'alerte qu'au changement d'état (pas de rafale) et alerte aussi si le signal n'arrive plus
# (serveur arrêté, cron cassé). Un environnement en cours de déploiement (verrou de deploy.sh) est
# ignoré : sa réplique en cours de drainage est volontairement « unhealthy ».
#
# Configuration : /opt/amg/secrets/watch.env (600), lue sans être exécutée :
#   HC_WATCH_URL=https://hc-ping.com/<uuid>              (obligatoire)
#   DISK_MAX_PCT=80                                       (facultatif, défaut 80)
#   SLICE_MAX_PCT=85                                      (facultatif, défaut 85)
#   MEM_PRESSURE_PCT=5                                    (facultatif, défaut 5)
#   TRAEFIK_CONTAINER=<nom>     (facultatif : Traefik partagé ; défaut : le conteneur qui publie
#                                les ports 80 et 443 de l'hôte)
#   WATCH_URLS=https://exemple.fr/healthz=200 https://staging.exemple.fr/healthz=200   (facultatif)
# Identifiants de la préproduction (basic auth) : /opt/amg/secrets/watch.netrc (600, format netrc).
set -euo pipefail

AMG_ROOT=${AMG_ROOT:-/opt/amg}
# shellcheck source=deploy/bin/amg-common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/amg-common.sh"
WATCH_ENV=$AMG_ROOT/secrets/watch.env
WATCH_NETRC=$AMG_ROOT/secrets/watch.netrc
RESTARTS_STATE=$AMG_ROOT/logs/.watch-restarts # « id nombre_de_redémarrages » du passage précédent
OOM_STATE=$AMG_ROOT/logs/.watch-oom           # compteur oom_kill de la slice au passage précédent
SLICE_CGROUP=$(amg_slice_cgroup "$AMG_SLICE")
ENVIRONMENTS=(prod staging)

conf() { sed -n "s/^$1=//p" "$WATCH_ENV" | tail -n 1; }
[ -r "$WATCH_ENV" ] || { echo "$(date -Is) $WATCH_ENV illisible" >&2; exit 2; }
HC_WATCH_URL=$(conf HC_WATCH_URL)
[[ "$HC_WATCH_URL" =~ ^https:// ]] || { echo "$(date -Is) HC_WATCH_URL absent ou invalide" >&2; exit 2; }
DISK_MAX_PCT=$(conf DISK_MAX_PCT)
DISK_MAX_PCT=${DISK_MAX_PCT:-80}
SLICE_MAX_PCT=$(conf SLICE_MAX_PCT)
SLICE_MAX_PCT=${SLICE_MAX_PCT:-85}
[[ "$SLICE_MAX_PCT" =~ ^[0-9]{1,2}$ ]] || SLICE_MAX_PCT=85
MEM_PRESSURE_PCT=$(conf MEM_PRESSURE_PCT)
[[ "$MEM_PRESSURE_PCT" =~ ^[0-9]{1,2}$ ]] || MEM_PRESSURE_PCT=5
TRAEFIK_CONTAINER=$(conf TRAEFIK_CONTAINER)
[[ "$TRAEFIK_CONTAINER" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || TRAEFIK_CONTAINER=''
WATCH_URLS=$(conf WATCH_URLS)

problems=()
notes=()
problem() { problems+=("$*"); }

declare -A previous_restarts=()
current_restarts=()
if [ -r "$RESTARTS_STATE" ]; then
  while read -r id count; do
    if [ -n "$id" ]; then previous_restarts[$id]=${count:-0}; fi
  done <"$RESTARTS_STATE"
fi

# Hôtes autorisés par environnement (domaine public du site, ADR-0020).
allowed_hosts() {
  case "$1" in
    prod) echo '^((www|admin|espace)\.)?amgdecorationdinterieur\.com$' ;;
    staging) echo '^((admin|espace)\.)?staging\.amgdecorationdinterieur\.com$' ;;
  esac
}

# Règle de routeur : uniquement des Host(`…`) autorisés, combinés par `||` (parenthèses admises).
check_rule() { # $1 env, $2 conteneur, $3 règle
  local env_name=$1 short=$2 rest=$3 matched host host_re count=0
  local bt=$'\x60' # accent grave, délimiteur des valeurs dans la syntaxe Traefik
  local matcher_re="Host\\(${bt}([^${bt}]*)${bt}\\)" leftover_re='^[[:space:]|()]*$'
  host_re=$(allowed_hosts "$env_name")
  while [[ "$rest" =~ $matcher_re ]]; do
    matched=${BASH_REMATCH[0]}
    host=${BASH_REMATCH[1]}
    rest=${rest/"$matched"/}
    [[ "$host" =~ $host_re ]] || problem "$env_name : routeur Traefik du conteneur $short sur un hôte non autorisé : $host"
    count=$((count + 1))
  done
  if [ "$count" -eq 0 ] || ! [[ "$rest" =~ $leftover_re ]]; then
    problem "$env_name : règle de routeur Traefik non reconnue (conteneur $short) : $3"
  fi
}

# Labels Traefik de chaque conteneur du projet (Config.Labels contient aussi ceux de l'image).
# Clés et valeurs sorties en chaînes Go entre guillemets (%q) : un saut de ligne dans une valeur
# ne peut pas fabriquer une fausse ligne.
# LISTE BLANCHE STRICTE : seuls les labels que compose.yaml et compose.staging.yaml savent écrire
# sont admis (p = projet, s = service Compose du conteneur, n = nom libre [a-z0-9-]) :
#   traefik.enable                                     true
#   traefik.docker.network                             le réseau d'entrée de l'environnement
#   traefik.http.routers.<p>-n.rule                    Host(`…`) d'AMG seulement (check_rule)
#   traefik.http.routers.<p>-n.entrypoints             websecure
#   traefik.http.routers.<p>-n.tls.certresolver        notre émetteur
#   traefik.http.routers.<p>-n.middlewares             liste de <p>-n@docker
#   traefik.http.routers.<p>-n.service                 <p>-s ou <p>-s@docker (son propre service)
#   traefik.http.services.<p>-s.loadbalancer.server.port   un numéro de port
#   traefik.http.middlewares.<p>-n.retry.{attempts,initialinterval}
#   traefik.http.middlewares.<p>-n.ratelimit.{average,period,burst}
#   traefik.http.middlewares.<p>-n.basicauth.{users,removeheader}
#   traefik.http.middlewares.<p>-n.headers.customresponseheaders.<en-tête>
# Tout le reste alerte : priority, tls.options, tls.domains, autre entrée, api@internal, service
# d'un autre conteneur, autres sous-clés de loadbalancer (servers.url, passhostheader…), autres
# types de middleware (redirectregex, forwardauth, basicauth.usersfile…), TCP, UDP, majuscules.
traefik_label_problem() { # $1 env, $2 conteneur, $3 projet, $4 service Compose, $5 réseau, $6 émetteur, $7 clé, $8 valeur
  local env_name=$1 short=$2 project=$3 service=$4 edge=$5 resolver=$6 key=$7 value=$8
  local n_re="${project}-[a-z0-9-]+" mw entry # projet : amg-prod ou amg-staging, sans métacaractère
  local -a middlewares
  # Seul le nom d'un en-tête de réponse garde sa casse (X-Robots-Tag) ; tout le reste en minuscules.
  if [[ "$key" =~ ^(traefik\.http\.middlewares\.${n_re}\.headers\.customresponseheaders\.)[A-Za-z0-9-]+$ ]]; then
    return 0
  fi
  if [ "$key" != "${key,,}" ]; then
    problem "$env_name : label Traefik en majuscules $key (conteneur $short)"
    return 0
  fi
  case "$key" in
    traefik.enable)
      [ "$value" = true ] || problem "$env_name : traefik.enable=$value (conteneur $short)"
      return 0
      ;;
    traefik.docker.network)
      [ "$value" = "$edge" ] || problem "$env_name : conteneur $short branché pour Traefik sur $value (attendu $edge)"
      return 0
      ;;
  esac
  if [[ "$key" =~ ^traefik\.http\.routers\.${n_re}\.(rule|entrypoints|tls\.certresolver|middlewares|service)$ ]]; then
    case "${BASH_REMATCH[1]}" in
      rule) check_rule "$env_name" "$short" "$value" ;;
      entrypoints)
        [ "$value" = websecure ] || problem "$env_name : routeur du conteneur $short sur l'entrée $value"
        ;;
      tls.certresolver)
        [ "$value" = "$resolver" ] || problem "$env_name : routeur du conteneur $short avec l'émetteur $value"
        ;;
      middlewares)
        IFS=, read -r -a middlewares <<<"$value"
        [ "${#middlewares[@]}" -gt 0 ] || problem "$env_name : liste de middlewares vide (conteneur $short)"
        for mw in "${middlewares[@]}"; do
          entry=${mw//[[:space:]]/}
          [[ "$entry" =~ ^${n_re}@docker$ ]] \
            || problem "$env_name : middleware « $mw » hors de l'espace $project- ou hors @docker (conteneur $short)"
        done
        ;;
      service)
        [[ "$value" =~ ^${project}-${service}(@docker)?$ ]] \
          || problem "$env_name : routeur du conteneur $short vers le service « $value » (attendu $project-$service)"
        ;;
    esac
    return 0
  fi
  if [[ "$key" =~ ^traefik\.http\.services\.([a-z0-9-]+)\.loadbalancer\.server\.port$ ]]; then
    [ "${BASH_REMATCH[1]}" = "$project-$service" ] \
      || problem "$env_name : service Traefik « ${BASH_REMATCH[1]} » déclaré par le conteneur $short (attendu $project-$service)"
    [[ "$value" =~ ^[0-9]{1,5}$ ]] || problem "$env_name : port Traefik « $value » (conteneur $short)"
    return 0
  fi
  if [[ "$key" =~ ^traefik\.http\.middlewares\.${n_re}\.(retry\.(attempts|initialinterval)|ratelimit\.(average|period|burst)|basicauth\.(users|removeheader))$ ]]; then
    return 0
  fi
  problem "$env_name : label Traefik hors liste blanche $key (conteneur $short)"
}

check_traefik_labels() { # $1 env, $2 projet, $3 réseau d'entrée, $4 émetteur de certificats
  local env_name=$1 project=$2 edge=$3 resolver=$4 id short service key value
  local -a ids
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
  for id in "${ids[@]}"; do
    [ -n "$id" ] || continue
    short=${id:0:12}
    service=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$id" 2>/dev/null || true)
    [[ "$service" =~ ^[a-z0-9-]+$ ]] || service=''
    while IFS=$'\t' read -r key value; do
      key=${key#\"}
      key=${key%\"}
      value=${value#\"}
      value=${value%\"}
      [[ "${key,,}" == *traefik* ]] || continue
      if ! [[ "$key" =~ ^traefik\.[A-Za-z0-9._-]+$ ]]; then
        problem "$env_name : label Traefik illisible sur le conteneur $short : $key"
        continue
      fi
      if [ -z "$service" ]; then
        problem "$env_name : conteneur $short avec des labels Traefik mais sans service Compose"
        continue
      fi
      traefik_label_problem "$env_name" "$short" "$project" "$service" "$edge" "$resolver" "$key" "$value"
    done < <(docker inspect -f '{{range $k, $v := .Config.Labels}}{{printf "%q\t%q\n" $k $v}}{{end}}' "$id" 2>/dev/null || true)
  done
}

check_environment() { # $1 prod|staging
  local env_name=$1 dir=$AMG_ROOT/$1 project=amg-$1
  local -a files services ids
  [ -f "$dir/amg.env" ] || return 0 # environnement pas encore installé
  # Verrou testé puis relâché aussitôt : la surveillance ne doit jamais bloquer un déploiement.
  if ! flock -n "$(amg_env_lock "$env_name")" true; then
    notes+=("$env_name : déploiement, sauvegarde ou restauration en cours, contrôle reporté")
    return 0
  fi

  # Réseau d'entrée : doit exister, être interne et rester branché sur Traefik (s'il disparaît, ou
  # si Traefik est recréé sans son fichier d'override, le site est coupé sans qu'aucun conteneur AMG
  # ne tombe).
  local edge internal
  edge=$(sed -n 's/^AMG_EDGE_NETWORK=//p' "$dir/amg.env" | tail -n 1)
  internal=absent
  if [ -n "$edge" ] && docker network inspect "$edge" >/dev/null 2>&1; then
    internal=$(docker network inspect -f '{{.Internal}}' "$edge")
  fi
  if [ "$internal" = absent ]; then
    problem "$env_name : réseau d'entrée $edge absent (voir EXPLOITATION.md, Traefik partagé)"
  else
    [ "$internal" = true ] || problem "$env_name : réseau d'entrée $edge non interne"
    grep -q '^traefik:' < <(docker ps --filter "network=$edge" --format '{{.Image}}') \
      || problem "$env_name : Traefik n'est plus branché sur $edge"
  fi
  check_traefik_labels "$env_name" "$project" "$edge" "$(sed -n 's/^AMG_CERTRESOLVER=//p' "$dir/amg.env" | tail -n 1)"

  files=(-f "$dir/compose/compose.yaml")
  if [ "$env_name" = staging ]; then files+=(-f "$dir/compose/compose.staging.yaml"); fi
  mapfile -t services < <(docker compose -p "$project" --env-file "$dir/amg.env" "${files[@]}" \
    config --services 2>/dev/null || true)
  if [ "${#services[@]}" -eq 0 ]; then
    problem "$env_name : configuration Compose illisible"
    return 0
  fi

  local service id state health restarts oom healthy
  for service in "${services[@]}"; do
    mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" \
      --filter "label=com.docker.compose.service=$service")
    healthy=0
    for id in "${ids[@]}"; do
      [ -n "$id" ] || continue
      read -r state health restarts oom < <(docker inspect -f \
        '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.RestartCount}} {{.State.OOMKilled}}' \
        "$id" 2>/dev/null || echo "absent none 0 false")
      current_restarts+=("$id $restarts")
      if [ "$restarts" -gt "${previous_restarts[$id]:-$restarts}" ]; then
        problem "$env_name/$service : a redémarré ($restarts fois au total, OOM au dernier arrêt : $oom)"
      fi
      [ "$oom" = true ] && problem "$env_name/$service : arrêté par manque de mémoire (limite atteinte)"
      [ "$state" = restarting ] && problem "$env_name/$service : redémarre en boucle"
      if [ "$state" = running ] && { [ "$health" = healthy ] || [ "$health" = none ]; }; then
        healthy=$((healthy + 1))
      elif [ "$state" = running ] && [ "$health" = starting ]; then
        notes+=("$env_name/$service : démarrage en cours")
        healthy=$((healthy + 1))
      fi
    done
    [ "$healthy" -ge 1 ] || problem "$env_name/$service : aucun conteneur en marche et sain"
  done
}

check_urls() {
  local entry url expected code
  local -a netrc=()
  [ -r "$WATCH_NETRC" ] && netrc=(--netrc-file "$WATCH_NETRC")
  for entry in $WATCH_URLS; do
    url=${entry%=*}
    expected=${entry##*=}
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${netrc[@]}" "$url" || true)
    [ "$code" = "$expected" ] || problem "$url : HTTP $code (attendu $expected)"
  done
}

check_disk() {
  local docker_root path pcent ipcent
  docker_root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
  for path in / "$docker_root"; do
    pcent='' ipcent=''
    read -r pcent ipcent < <(df --output=pcent,ipcent "$path" 2>/dev/null | tail -n 1 | tr -d '%') || true
    if [ -z "${pcent:-}" ]; then
      problem "disque $path : mesure impossible"
      continue
    fi
    [ "$pcent" -lt "$DISK_MAX_PCT" ] || problem "disque $path : $pcent % utilisés (seuil $DISK_MAX_PCT %)"
    [ "${ipcent:-0}" = - ] || [ "${ipcent:-0}" -lt "$DISK_MAX_PCT" ] \
      || problem "disque $path : $ipcent % des inodes utilisés"
  done
}

# Mémoire non récupérable d'un cgroup (memory.stat) : anon + shmem + kernel + sock. Le cache de
# fichiers (file hors shmem) est exclu : le noyau le récupère avant tout OOM, et memory.current,
# qui l'inclut, approche normalement memory.max dès qu'un conteneur lit beaucoup (sauvegarde).
unreclaimable_bytes() { # $1 dossier cgroup
  awk '
    $1 == "anon" || $1 == "shmem" || $1 == "sock" { sum += $2 }
    $1 == "kernel" { kernel = $2; has_kernel = 1 }
    $1 == "slab" || $1 == "kernel_stack" || $1 == "pagetables" || $1 == "percpu" { old += $2 }
    END { if (NR == 0) exit 1; printf "%d\n", sum + (has_kernel ? kernel : old) }
  ' "$1/memory.stat" 2>/dev/null
}

check_memory_use() { # $1 slice
  local slice=$1 dir cg_max used
  dir=$(amg_slice_cgroup "$slice")
  [ -d "$dir" ] || return 0
  cg_max=$(cat "$dir/memory.max" 2>/dev/null || echo '?')
  if ! used=$(unreclaimable_bytes "$dir") || ! [[ "$cg_max" =~ ^[0-9]{1,18}$ ]]; then
    problem "slice $slice : memory.stat ou memory.max illisibles (memory.max=$cg_max)"
    return 0
  fi
  [ $((used * 100)) -lt $((cg_max * SLICE_MAX_PCT)) ] \
    || problem "slice $slice : $((used / AMG_MIB)) Mio non récupérables sur $((cg_max / AMG_MIB)) Mio (seuil $SLICE_MAX_PCT %)"
}

# Traefik partagé : seul conteneur hors AMG admis sur les réseaux d'entrée AMG. Désigné par
# TRAEFIK_CONTAINER (watch.env), sinon reconnu comme le conteneur qui publie les ports 80 et 443.
is_shared_traefik() { # $1 identifiant
  local name ports
  read -r name ports < <(docker inspect -f '{{.Name}} {{range $p, $b := .HostConfig.PortBindings}}{{$p}} {{end}}' "$1" 2>/dev/null \
    || echo '- -')
  if [ -n "$TRAEFIK_CONTAINER" ]; then
    [ "$name" = "/$TRAEFIK_CONTAINER" ]
  else
    [[ " $ports " == *" 80/tcp "* && " $ports " == *" 443/tcp "* ]]
  fi
}

# Plafond mémoire commun (slices systemd) : unités, limites du noyau, consommation, OOM, appartenance.
check_slice() {
  local installed=0 env_name id short parent state project role expected dir line oom previous_oom pressure
  local -a ids=() resources=()
  local -A seen=()
  for env_name in "${ENVIRONMENTS[@]}"; do [ -f "$AMG_ROOT/$env_name/amg.env" ] && installed=1; done
  [ "$installed" = 1 ] || return 0

  while IFS= read -r line; do
    [ -n "$line" ] && problem "$line : AMG n'a plus de plafond mémoire fiable"
  done < <(amg_all_slices_problems)

  check_memory_use "$AMG_SLICE"
  check_memory_use "$(amg_env_slice staging)"
  if [ -d "$SLICE_CGROUP" ]; then
    # Pression mémoire (PSI) : part du temps où tous les processus AMG attendaient de la mémoire.
    pressure=$(sed -n 's/^full .*avg300=\([0-9]*\)\..*/\1/p' "$SLICE_CGROUP/memory.pressure" 2>/dev/null)
    if [[ "$pressure" =~ ^[0-9]+$ ]]; then
      [ "$pressure" -lt "$MEM_PRESSURE_PCT" ] \
        || problem "slice $AMG_SLICE : pression mémoire $pressure % sur 5 min (seuil $MEM_PRESSURE_PCT %), AMG manque de mémoire"
    fi
    oom=$(sed -n 's/^oom_kill //p' "$SLICE_CGROUP/memory.events" 2>/dev/null)
    if [[ "$oom" =~ ^[0-9]+$ ]]; then
      previous_oom=$(cat "$OOM_STATE" 2>/dev/null || echo "$oom")
      [[ "$previous_oom" =~ ^[0-9]+$ ]] || previous_oom=$oom
      [ "$oom" -le "$previous_oom" ] \
        || problem "slice $AMG_SLICE : $((oom - previous_oom)) processus tués par manque de mémoire depuis le passage précédent (conteneur à sa limite ou slice pleine)"
      printf '%s\n' "$oom" >"$OOM_STATE.tmp" && mv "$OOM_STATE.tmp" "$OOM_STATE"
    else
      problem "slice $AMG_SLICE : memory.events illisible"
    fi
  fi

  # Conteneurs AMG : projets Compose, conteneurs ponctuels (label org.amg.role), et tout conteneur
  # branché sur un réseau ou un volume AMG (un `docker run` oublié ou lancé à la main).
  for env_name in "${ENVIRONMENTS[@]}"; do
    mapfile -t -O "${#ids[@]}" ids < <(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=amg-$env_name")
  done
  mapfile -t -O "${#ids[@]}" ids < <(docker ps -aq --no-trunc --filter label=org.amg.role)
  mapfile -t resources < <({
    docker network ls --format 'network={{.Name}}'
    docker volume ls --format 'volume={{.Name}}'
  } 2>/dev/null | grep -E '^(network|volume)=amg[-_]' || true)
  for line in "${resources[@]}"; do
    mapfile -t -O "${#ids[@]}" ids < <(docker ps -aq --no-trunc --filter "$line")
  done
  for id in "${ids[@]}"; do
    [ -n "$id" ] && [ -z "${seen[$id]:-}" ] || continue
    seen[$id]=1
    short=${id:0:12}
    parent='' project='' role=''
    # Séparateur non blanc : un champ vide (label absent) ne décale pas les suivants.
    IFS='|' read -r state parent project role < <(docker inspect -f \
      '{{.State.Status}}|{{.HostConfig.CgroupParent}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "org.amg.role"}}' \
      "$id" 2>/dev/null || echo absent)
    [ "$state" = absent ] && continue
    case "$project" in
      amg-prod | amg-staging) expected="$project.slice" ;;
      *)
        if [ -z "$role" ]; then
          is_shared_traefik "$id" && continue
          problem "conteneur $short sans label AMG branché sur un réseau ou un volume AMG (cgroup parent : ${parent:-défaut})"
          continue
        fi
        expected=$parent
        [[ "$parent" =~ ^amg(-(prod|staging))?\.slice$ ]] || expected=$AMG_SLICE
        ;;
    esac
    if [ "$parent" != "$expected" ]; then
      problem "conteneur AMG $short hors de $expected (cgroup parent : ${parent:-défaut}) : hors du plafond mémoire AMG"
    elif [ "$state" = running ]; then
      dir=$(amg_slice_cgroup "$parent")
      [ -d "$dir/docker-$id.scope" ] \
        || problem "conteneur AMG $short absent de $dir (pilote cgroup de Docker changé ?)"
    fi
  done
}

if docker info >/dev/null 2>&1; then
  for env_name in "${ENVIRONMENTS[@]}"; do check_environment "$env_name"; done
  check_slice
else
  problem "démon Docker injoignable"
fi
check_urls
check_disk
printf '%s\n' "${current_restarts[@]}" >"$RESTARTS_STATE.tmp" && mv "$RESTARTS_STATE.tmp" "$RESTARTS_STATE"

report() { printf '%s\n' "$@"; }
if [ "${#problems[@]}" -eq 0 ]; then
  report "OK $(date -Is)" "${notes[@]}" \
    | curl -fsS -m 10 --retry 3 --data-binary @- "$HC_WATCH_URL" >/dev/null || true
  exit 0
fi
report "PROBLÈMES $(date -Is)" "${problems[@]}" "${notes[@]}" | tee /dev/stderr \
  | curl -fsS -m 10 --retry 3 --data-binary @- "$HC_WATCH_URL/fail" >/dev/null || true
exit 1
