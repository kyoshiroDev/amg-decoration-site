#!/usr/bin/env bash
# Tests hors ligne des scripts du serveur (deploy/bin), SANS Docker : `docker`, `systemctl` et
# `sleep` sont remplacés par des doubles (dossier temporaire en tête du PATH) qui journalisent leurs
# appels et rejouent des réponses choisies par chaque cas. Lancé par ci.yml (job « Budget mémoire
# AMG ») et deploy.yml (job `build`), et à la main depuis la racine du dépôt :
#   deploy/ci/test-scripts.sh
# Couvre : liste blanche de amg_run (règles du rôle migrate, mode et groupe du secret), règles de
# routeur Traefik admises par watch.sh, filtre de la liste de restauration, alerte de watch.sh sur
# un LOGIN d'amg_migrator hors fenêtre, et la fenêtre de migration de deploy.sh (ouverture seulement
# si roles.sql rejoué, journal conforme et roles.sql à jour, fermeture même en cas d'échec, d'erreur
# de fermeture, d'interruption ou de second signal, aucune bascule sans migrations réussies et
# journal vérifié, amg.env écrit seulement après la bascule, détail gardé dans le journal du
# serveur et seule une ligne de statut sur la sortie renvoyée par SSH).
set -uo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
BIN=$ROOT/deploy/bin
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
T=$(readlink -f "$T")
failures=0
passed=0

ok() { passed=$((passed + 1)); }
ko() {
  failures=$((failures + 1))
  printf 'ÉCHEC : %s\n' "$*" >&2
}
check() { # $1 description, puis la commande à évaluer
  local what=$1
  shift
  if "$@"; then ok; else ko "$what"; fi
}
refute() { # $1 description, puis une commande qui doit échouer
  local what=$1
  shift
  if "$@"; then ko "$what"; else ok; fi
}

# Double de `stat` : mode et groupe du secret des migrations simulés (le groupe 65532 de l'image
# n'existe pas sur le poste ni sur le runner) ; tout autre appel va au vrai stat.
STUB=$T/stub
mkdir -p "$STUB/bin"
cat >"$STUB/bin/stat" <<'EOF'
#!/usr/bin/env bash
case "${*: -1}" in
  *pg_migrator_password) echo "${STUB_STAT:-640 65532}" ;;
  *) exec /usr/bin/stat "$@" ;;
esac
EOF
chmod +x "$STUB/bin/stat"
export PATH="$STUB/bin:$PATH"

# --- amg_run : liste blanche des options -------------------------------------------------------
(
  # shellcheck source=deploy/bin/amg-common.sh
  source "$BIN/amg-common.sh"
  export AMG_ROOT=$T/root
  mkdir -p "$AMG_ROOT/staging/secrets" "$AMG_ROOT/prod/secrets" "$AMG_ROOT/backups/prod"
  secret=$AMG_ROOT/staging/secrets/pg_migrator_password
  printf 'x%.0s' {1..44} >"$secret"
  chmod 640 "$secret"
  mount_ok="$secret:/run/secrets/pg_migrator_password:ro"

  as() { # $1 rôle, $2 env, $3 option, $4 valeur
    local AMG_RUN_ROLE=$1 AMG_RUN_ENV=$2
    amg_run_value_ok "$3" "$4"
  }
  check "réseau de données admis pour migrate" as migrate staging --network amg-staging_data
  refute "réseau de données refusé hors migrate" as backup staging --network amg-staging_data
  refute "réseau de données d'un autre environnement refusé" as migrate staging --network amg-prod_data
  refute "réseau host refusé" as migrate staging --network host
  check "réseau none toujours admis" as backup prod --network none
  check "secret des migrations admis pour migrate" as migrate staging -v "$mount_ok"
  refute "secret refusé hors migrate" as backup staging -v "$mount_ok"
  refute "secret refusé en écriture" as migrate staging -v "$secret:/run/secrets/pg_migrator_password"
  refute "secret refusé ailleurs dans le conteneur" as migrate staging -v "$secret:/tmp/p:ro"
  refute "secret d'un autre environnement refusé" as migrate prod -v "$mount_ok"
  refute "autre fichier de secrets refusé" as migrate staging \
    -v "$AMG_ROOT/staging/secrets/pg_app_password:/run/secrets/pg_migrator_password:ro"
  check "secret 440 groupe 65532 admis" env STUB_STAT='440 65532' bash -c "source '$BIN/amg-common.sh'; AMG_ROOT='$AMG_ROOT' AMG_RUN_ROLE=migrate AMG_RUN_ENV=staging amg_run_value_ok -v '$mount_ok'"
  for bad in '644 65532' '600 65532' '660 65532' '640 0' '640 1000'; do
    refute "secret « $bad » refusé" env STUB_STAT="$bad" bash -c "source '$BIN/amg-common.sh'; AMG_ROOT='$AMG_ROOT' AMG_RUN_ROLE=migrate AMG_RUN_ENV=staging amg_run_value_ok -v '$mount_ok'"
  done
  mv "$secret" "$secret.real"
  ln -s "$secret.real" "$secret"
  refute "secret par lien symbolique refusé" as migrate staging -v "$mount_ok"
  refute "dossier secrets toujours refusé en montage ordinaire" as backup prod \
    -v "$AMG_ROOT/prod/secrets:/s:ro"
  check "dossier des sauvegardes admis" as backup prod -v "$AMG_ROOT/backups/prod:/backup/db:ro"
  echo "$passed" >>"$T/passed"
  exit "$failures"
) || failures=$((failures + $?))

# --- watch.sh : règles de routeur Traefik ------------------------------------------------------
(
  # shellcheck source=deploy/bin/amg-common.sh
  source "$BIN/amg-common.sh"
  bt=$'\x60'
  h() { printf 'Host(%s%s%s)' "$bt" "$1" "$bt"; }
  # $1 env, $2 règle, $3 routeur (défaut : <projet>-api)
  clean() { [ -z "$(amg_traefik_rule_problems "$1" "$2" "${3:-amg-$1-api}" "amg-$1")" ]; }
  api="($(h admin.staging.amgdecorationdinterieur.com) || $(h espace.staging.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  check "règle du site admise" clean prod "$(h amgdecorationdinterieur.com) || $(h www.amgdecorationdinterieur.com)" amg-prod-site
  check "règle de l'API admise" clean staging "$api"
  refute "forme API refusée hors du routeur <projet>-api" clean staging "$api" amg-staging-site
  refute "forme API refusée pour le routeur api d'un autre projet" clean staging "$api" amg-prod-api
  refute "règle piège (Host(www)) || (Host(admin)) && PathPrefix(/api/) refusée" clean prod \
    "($(h www.amgdecorationdinterieur.com)) || ($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  refute "parenthèses internes du groupe API refusées" clean prod \
    "(($(h admin.amgdecorationdinterieur.com))) && PathPrefix(${bt}/api/${bt})"
  refute "&& interne au groupe API refusé" clean prod \
    "($(h admin.amgdecorationdinterieur.com) && $(h espace.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  refute "hôte du voisin refusé" clean prod "$(h exemple.org)"
  refute "PathPrefix seul refusé" clean prod "PathPrefix(${bt}/api/${bt})"
  refute "PathPrefix joint par || refusé" clean prod "$(h admin.amgdecorationdinterieur.com) || PathPrefix(${bt}/api/${bt})"
  refute "PathPrefix sans parenthèses refusé" clean prod "$(h admin.amgdecorationdinterieur.com) && PathPrefix(${bt}/api/${bt})"
  refute "autre préfixe refusé" clean prod "($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/${bt})"
  check "groupe API d'un seul hôte admis" clean prod "($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  refute "hôte de production refusé en préproduction" clean staging "($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  refute "HostRegexp refusé" clean prod "HostRegexp(${bt}.*${bt})"
  refute "hôte admin. refusé pour le routeur du site" clean prod "$(h admin.amgdecorationdinterieur.com)" amg-prod-site
  refute "hôte espace. refusé pour le routeur du site" clean staging "$(h espace.staging.amgdecorationdinterieur.com)" amg-staging-site
  check "hôte admin. admis pour le routeur admin (CRM 4)" clean prod "$(h admin.amgdecorationdinterieur.com)" amg-prod-admin
  refute "hôte espace. refusé pour le routeur admin" clean prod "$(h espace.amgdecorationdinterieur.com)" amg-prod-admin
  check "hôte espace. admis pour le routeur espace-client (CRM 5)" clean prod "$(h espace.amgdecorationdinterieur.com)" amg-prod-espace-client
  echo "$passed" >>"$T/passed"
  exit "$failures"
) || failures=$((failures + $?))

# --- Liste de restauration filtrée -------------------------------------------------------------
(
  # shellcheck source=deploy/bin/amg-common.sh
  source "$BIN/amg-common.sh"
  cat >"$T/list.raw" <<'EOF'
;
; Archive created at 2026-11-27 04:15:00 UTC
;
6; 2615 2200 SCHEMA - public pg_database_owner
3600; 0 0 COMMENT - SCHEMA public pg_database_owner
7; 2615 16390 SCHEMA - amg_guard amg
230; 1255 16391 FUNCTION amg_guard security_events_append_only() amg
240; 1259 16392 TABLE amg_guard journal_sealed amg
3601; 0 16392 TABLE DATA amg_guard journal_sealed amg
3602; 0 0 ACL - SCHEMA public pg_database_owner
3603; 0 0 ACL amg_guard FUNCTION security_events_violation() amg
2100; 826 16420 DEFAULT ACL - DEFAULT PRIVILEGES FOR FUNCTIONS amg_migrator
250; 1247 16430 TYPE public security_event_type amg_migrator
260; 1259 16440 TABLE public security_events amg_migrator
3604; 0 16440 TABLE DATA public security_events amg_migrator
3605; 2606 16450 CONSTRAINT public security_events security_events_pkey amg_migrator
3606; 2620 16460 TRIGGER public security_events security_events_append_only amg_migrator
3607; 0 0 ACL public TABLE security_events amg_migrator
3608; 3466 16470 EVENT TRIGGER - amg_guard_security_events amg
EOF
  kept=$(amg_restore_list_filter <"$T/list.raw" 2>"$T/list.err")
  check "liste acceptée" test "$?" = 0
  check "objets de public gardés" test "$(grep -c '^[0-9]' <<<"$kept")" = 6
  refute "aucun objet amg_guard gardé" grep -q amg_guard <<<"$kept"
  refute "aucun déclencheur d'événement gardé" grep -q 'EVENT TRIGGER' <<<"$kept"
  refute "droits par défaut retirés" grep -q 'DEFAULT ACL' <<<"$kept"
  refute "schéma public et ses droits retirés" grep -qE ' (SCHEMA|ACL|COMMENT) - (SCHEMA )?public' <<<"$kept"
  check "lignes retirées journalisées" test "$(grep -c 'retiré' "$T/list.err")" = 10
  printf '300; 1259 16500 TABLE autre_schema t amg_migrator\n' >"$T/list.bad"
  refute "objet hors de public refusé" amg_restore_list_filter <"$T/list.bad" >/dev/null 2>&1
  printf 'pas une ligne de liste\n' >"$T/list.bad"
  refute "ligne illisible refusée" amg_restore_list_filter <"$T/list.bad" >/dev/null 2>&1
  for bad in '301; 1259 16510 VIEW public v amg_migrator' '302; 2605 16520 CAST - CAST (text AS public.t) amg_migrator' \
    '303; 3079 16530 EXTENSION - pgcrypto amg_migrator' '304; 1255 16540 PROCEDURE public p() amg_migrator' \
    '305; 3600 16550 TEXT SEARCH DICTIONARY public d amg_migrator'; do
    printf '%s\n' "$bad" >"$T/list.bad"
    refute "type d'entrée hors liste blanche refusé : ${bad#*; }" amg_restore_list_filter <"$T/list.bad" >/dev/null 2>&1
  done
  echo "$passed" >>"$T/passed"
  exit "$failures"
) || failures=$((failures + $?))

# --- check-budget.sh : tmpfs et secret des migrations (double de docker compose config) --------
CSTUB=$T/cstub
mkdir -p "$CSTUB"
cat >"$CSTUB/docker" <<'EOF'
#!/usr/bin/env bash
# Double de `docker compose -p amg-<env> … config --format json` : AMG au complet, variantes par
# STUB_API_TMPFS, STUB_API_EXTRA (champs JSON ajoutés au service api) et STUB_REDIS_EXTRA.
env=${3#amg-}
svc() { # nom mémoire oom exposé [champs en plus]
  local lab='{}' tmpfs='"/tmp:size=8m,mode=1777,noexec,nosuid,nodev"'
  [ "$4" = 1 ] && lab='{"traefik.enable":"true"}'
  [ "$1" = api ] && [ -n "${STUB_API_TMPFS:-}" ] && tmpfs="\"$STUB_API_TMPFS\""
  printf '"%s":{"cgroup_parent":"amg-%s.slice","mem_limit":"%s","memswap_limit":"%s","oom_score_adj":%s,"labels":%s,"tmpfs":[%s]%s}' \
    "$1" "$env" "$2" "$2" "$3" "$lab" "$tmpfs" "${5:-}"
}
if [ "$env" = prod ]; then o=(200 500); m=(536870912 134217728 67108864 268435456); else o=(900 900); m=(201326592 67108864 33554432 167772160); fi
printf '{"name":"amg-%s","services":{%s,%s,%s,%s}}\n' "$env" "$(svc postgres "${m[0]}" "${o[0]}" 0)" \
  "$(svc redis "${m[1]}" "${o[1]}" 0 "${STUB_REDIS_EXTRA:-}")" "$(svc site "${m[2]}" "${o[1]}" 1)" \
  "$(svc api "${m[3]}" "${o[1]}" 1 "${STUB_API_EXTRA:-}")"
EOF
chmod +x "$CSTUB/docker"
budget() { env PATH="$CSTUB:$PATH" "$@" "$ROOT/deploy/ci/check-budget.sh" >"$T/budget.log" 2>&1; }
check "check-budget : configuration conforme acceptée" budget
refute "check-budget : exec après noexec refusé" budget STUB_API_TMPFS='/tmp:size=8m,noexec,nosuid,nodev,exec'
refute "check-budget : tmpfs sans nodev refusé" budget STUB_API_TMPFS='/tmp:size=8m,noexec,nosuid'
refute "check-budget : volume tmpfs sur un service exposé refusé" \
  budget STUB_API_EXTRA=',"volumes":[{"type":"tmpfs","target":"/x","tmpfs":{"size":1048576}}]'
refute "check-budget : volume tmpfs sans taille refusé" \
  budget STUB_REDIS_EXTRA=',"volumes":[{"type":"tmpfs","target":"/x"}]'
check "check-budget : volume tmpfs borné admis hors service exposé" \
  budget STUB_REDIS_EXTRA=',"volumes":[{"type":"tmpfs","target":"/x","tmpfs":{"size":1048576}}]'
refute "check-budget : montage du secret des migrations refusé" \
  budget STUB_REDIS_EXTRA=',"volumes":[{"type":"bind","source":"/opt/amg/prod/secrets/pg_migrator_password","target":"/s"}]'

# --- deploy.sh : déploiement de l'API et fenêtre de migration ----------------------------------
cat >"$STUB/bin/flock" <<'EOF'
#!/usr/bin/env bash
# Double de flock : journalise ses arguments, puis le vrai flock.
[ -z "${STUB_STATE:-}" ] || printf 'flock %s\n' "$*" >>"$STUB_STATE/calls.log"
exec /usr/bin/flock "$@"
EOF
cat >"$STUB/bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$STUB/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
# Double de `systemctl show <slice> -p …` : slices installées depuis leur fichier, limites attendues.
slice=$2
max=3984588800
[ "$slice" = amg-staging.slice ] && max=1073741824
printf 'LoadState=loaded\nFragmentPath=/etc/systemd/system/%s\nMemoryMax=%s\nMemorySwapMax=0\n' "$slice" "$max"
printf 'CPUQuotaPerSecUSec=3s\nTasksMax=2048\n'
EOF
cat >"$STUB/bin/docker" <<'EOF'
#!/usr/bin/env bash
# Double de test du CLI docker : journalise chaque appel (une ligne) et rejoue l'état de $STUB_STATE.
S=$STUB_STATE
printf '%s\n' "$*" >>"$S/calls.log"
fail_on() { [ -n "${STUB_PSQL_FAIL:-}" ] && [[ "$1" == *"$STUB_PSQL_FAIL"* ]]; }
case "$1" in
  info) echo 'systemd 2' ;;
  pull) exit 0 ;;
  compose)
    shift
    while [ "$#" -gt 0 ]; do case "$1" in -p | --env-file | -f) shift 2 ;; *) break ;; esac; done
    sub=$1
    shift
    svc=${*: -1}
    case "$sub" in
      config) printf '%s\n' postgres redis site api ;;
      # Comme Compose : le digest vient de l'environnement du processus s'il y est, sinon de
      # amg.env (ici : l'ancien). Pull et up échouent s'il n'est pas la cible.
      pull)
        [ "${API_DIGEST:-}" = "$STUB_TARGET" ] || { echo "pull : API_DIGEST=${API_DIGEST:-absent}" >&2; exit 1; }
        exit "${STUB_PULL_RC:-0}"
        ;;
      ps) [ -f "$S/ps-$svc" ] && cat "$S/ps-$svc" ;;
      up)
        printf '%s\n' "$STUB_NEW_ID" >>"$S/ps-$svc"
        mkdir -p "$STUB_SCOPE_DIR/docker-$STUB_NEW_ID.scope"
        printf '%s\n' "${STUB_RUNNING_IMAGE:-ghcr.io/proprietaire/amg-api@${API_DIGEST:-$STUB_OLD_DIGEST}}" >"$S/image-$STUB_NEW_ID"
        ;;
    esac
    ;;
  inspect)
    case "$3" in
      *Health*) echo healthy ;;
      *CgroupParent*) printf 'amg-staging.slice|%s\n' "$4" ;;
      *Config.Image*) cat "$S/image-$4" 2>/dev/null ;;
    esac
    ;;
  stop)
    # Interruption pendant l'arrêt de l'ancienne réplique (fin de bascule).
    if [ -n "${STUB_STOP_SIGNAL:-}" ]; then kill "-$STUB_STOP_SIGNAL" "$PPID"; fi
    ;;
  image)
    case "$4" in
      *'.Id'*) echo sha256:0 ;;
      *range*) echo '"org.opencontainers.image.revision"' ;;
      *roles-sql*) echo "$STUB_ROLES_SHA" ;;
      *revision*) echo 0123456789abcdef0123456789abcdef01234567 ;;
    esac
    ;;
  exec)
    shift
    while [ "$#" -gt 0 ]; do case "$1" in -i) shift ;; -e) shift 2 ;; *) break ;; esac; done
    shift # conteneur
    [ "$1" = psql ] || exit 0
    sqls=()
    while [ "$#" -gt 0 ]; do
      if [ "$1" = -c ]; then sqls+=("$2"); shift 2; else shift; fi
    done
    if [ "${#sqls[@]}" -eq 0 ]; then
      cat >/dev/null
      echo 'psql < fichier' >>"$S/sql.log"
      fail_on 'roles.sql' && exit 3
      exit 0
    fi
    for q in "${sqls[@]}"; do
      printf '%s\n' "$q" >>"$S/sql.log"
      if [[ "$q" == *'NOLOGIN'* ]] && [ -n "${STUB_NOLOGIN_SIGNAL:-}" ]; then
        # Second signal pendant la fermeture, première fermeture en échec.
        kill -TERM "$PPID"
        n=$(($(cat "$S/nologin" 2>/dev/null || echo 0) + 1))
        echo "$n" >"$S/nologin"
        [ "$n" -gt 1 ] || exit 3
      fi
      fail_on "$q" && exit 3
      if [[ "$q" == *rolcanlogin* ]]; then echo "${STUB_LOGIN:-f}"; fi
      if [[ "$q" == *pg_stat_activity* && "$q" != *pg_terminate_backend* ]]; then echo "${STUB_SESSIONS:-0}"; fi
      if [[ "$q" == *security_events_violation* ]]; then
        n=$(($(cat "$S/violations" 2>/dev/null || echo 0) + 1))
        echo "$n" >"$S/violations"
        var=STUB_VIOLATION_$n
        [ -z "${!var:-}" ] || echo "${!var}"
      fi
    done
    ;;
  run)
    echo 'docker run' >>"$S/sql.log"
    if [ -n "${STUB_MIGRATE_KILL:-}" ]; then
      kill -TERM "$(ps -o ppid= -p "$PPID" | tr -d ' ')"
      exit 143
    fi
    exit "${STUB_MIGRATE_RC:-0}"
    ;;
esac
exit 0
EOF
chmod +x "$STUB/bin/"*

OLD_ID=$(printf 'a%.0s' {1..64})
NEW_ID=$(printf 'b%.0s' {1..64})
PG_ID=$(printf 'c%.0s' {1..64})
ZERO=sha256:$(printf '0%.0s' {1..64})
API_D=sha256:$(printf '1%.0s' {1..64})
MIG_D=sha256:$(printf '2%.0s' {1..64})

# Environnement de préproduction simulé ; $@ : variables du double (VAR=valeur).
run_deploy() {
  local case_dir=$T/case-$1
  shift
  rm -rf "$case_dir"
  mkdir -p "$case_dir/amg/staging/compose" "$case_dir/amg/staging/secrets" "$case_dir/state"
  local amg=$case_dir/amg cg=$case_dir/cg
  mkdir -p "$cg/amg.slice/amg-staging.slice"
  echo 3984588800 >"$cg/amg.slice/memory.max"
  echo 0 >"$cg/amg.slice/memory.swap.max"
  echo '300000 100000' >"$cg/amg.slice/cpu.max"
  echo 2048 >"$cg/amg.slice/pids.max"
  echo 1073741824 >"$cg/amg.slice/amg-staging.slice/memory.max"
  echo 0 >"$cg/amg.slice/amg-staging.slice/memory.swap.max"
  cat >"$amg/staging/amg.env" <<EOF2
AMG_PROJECT=amg-staging
AMG_ENV=staging
API_IMAGE=ghcr.io/proprietaire/amg-api
API_DIGEST=$ZERO
MIGRATE_IMAGE=ghcr.io/proprietaire/amg-api-migrate
EOF2
  echo '-- roles' >"$amg/staging/compose/roles.sql"
  # Journal des déploiements déjà présent : un bloc de plus de 30 jours (à retirer), un récent.
  mkdir -p "$amg/logs"
  printf '%s [staging] ancien bloc\nsortie de l ancien bloc\n%s [staging] bloc récent\n' \
    "$(date -d '40 days ago' -Is)" "$(date -d '2 days ago' -Is)" >"$amg/logs/deploy-staging.log"
  printf 'x%.0s' {1..44} >"$amg/staging/secrets/pg_migrator_password"
  chmod 640 "$amg/staging/secrets/pg_migrator_password"
  echo "$PG_ID" >"$case_dir/state/ps-postgres"
  echo "$OLD_ID" >"$case_dir/state/ps-api"
  local sha
  sha=$(sha256sum "$amg/staging/compose/roles.sql" | cut -d' ' -f1)
  CASE_DIR=$case_dir
  # Sous-shell : un arrêt par SIGKILL (cas de test) ne fait pas écrire de message au shell.
  (
    env -i PATH="$STUB/bin:/usr/bin:/bin" HOME="$T" AMG_ROOT="$amg" AMG_CGROUP_ROOT="$cg" \
      STUB_STATE="$case_dir/state" STUB_NEW_ID="$NEW_ID" STUB_ROLES_SHA="$sha" \
      STUB_TARGET="$API_D" STUB_OLD_DIGEST="$ZERO" \
      STUB_SCOPE_DIR="$cg/amg.slice/amg-staging.slice" "$@" \
      bash "$BIN/deploy.sh" staging deploy api "$API_D" "$MIG_D" >"$case_dir/ssh.log" 2>&1
    rc=$? # seconde commande : le sous-shell ne se remplace pas par bash (exec), il survit au SIGKILL
    exit "$rc"
  ) 2>/dev/null
  CASE_RC=$?
  LOG=$amg/logs/deploy-staging.log
}
sql_has() { grep -sqF -- "$1" "$CASE_DIR/state/sql.log"; }
calls_has() { grep -qF -- "$1" "$CASE_DIR/state/calls.log"; }
# Ordre des événements de la fenêtre dans sql.log (« LOGIN », « docker run », « NOLOGIN »…).
sql_order() { grep -oE 'amg_migrator NOLOGIN|amg_migrator LOGIN|docker run|psql < fichier' "$CASE_DIR/state/sql.log" | tr '\n' ' '; }
no_env_temp() { ! compgen -G "$CASE_DIR/amg/staging/.amg.env.*" >/dev/null; }
ssh_is_status_only() { [ "$(wc -l <"$CASE_DIR/ssh.log")" = 1 ] && grep -q '^deploy.sh staging deploy : ' "$CASE_DIR/ssh.log"; }
api_digest() { sed -n 's/^API_DIGEST=//p' "$CASE_DIR/amg/staging/amg.env"; }

run_deploy succes
check "déploiement de l'API réussi" test "$CASE_RC" = 0
check "ordre : roles.sql rejoué, LOGIN, migrations, NOLOGIN, roles.sql rejoué" \
  test "$(sql_order)" = 'psql < fichier amg_migrator LOGIN docker run amg_migrator NOLOGIN psql < fichier '
check "migrations : verrou des ponctuels attendu 30 s au plus, fenêtre ouverte" calls_has 'flock -w 30 '
check "sortie SSH : une seule ligne de statut" ssh_is_status_only
check "sortie SSH : réussite annoncée" grep -q 'réussi' "$CASE_DIR/ssh.log"
check "journal détaillé du serveur en 600" test "$(stat -c '%a' "$LOG")" = 600
check "journal détaillé : fenêtre et bascule" grep -q 'en ligne : api' "$LOG"
refute "aucun INCIDENT quand LOGIN était fermé" grep -q 'INCIDENT' "$LOG"
check "sessions d'amg_migrator terminées à la fermeture" sql_has 'pg_terminate_backend'
check "journal vérifié avant le rejeu, après le rejeu et après la fenêtre" test "$(cat "$CASE_DIR/state/violations")" = 3
check "nouvelle réplique vérifiée sur l'image cible" calls_has '{{.Config.Image}}'
check "journal des déploiements : bloc de plus de 30 jours retiré" bash -c "! grep -q 'ancien bloc' '$LOG'"
check "journal des déploiements : bloc récent gardé" grep -q 'bloc récent' "$LOG"
check "migrations : réseau de données, secret en lecture seule, rôle migrate" \
  calls_has "--network amg-staging_data --user 65532:65532"
check "migrations : secret monté en lecture seule" calls_has ':/run/secrets/pg_migrator_password:ro'
check "migrations : dans la slice, sans swap, label du rôle" \
  calls_has '--cgroup-parent amg-staging.slice --memory 192m --memory-swap 192m'
check "bascule de l'API après les migrations" calls_has '--scale api=2 api'
check "ancienne réplique drainée par la sonde" calls_has 'healthcheck.js drain'
check "digest de l'API écrit dans amg.env" test "$(api_digest)" = "$API_D"
check "historique de l'API avec le digest des migrations" \
  grep -q "$API_D 0123456789abcdef0123456789abcdef01234567 migrations=$MIG_D" "$CASE_DIR/amg/staging/releases-api.log"

run_deploy migration-en-echec STUB_MIGRATE_RC=1
check "migrations en échec : déploiement en échec" test "$CASE_RC" != 0
check "migrations en échec : fenêtre refermée puis roles.sql rejoué" \
  test "$(sql_order)" = 'psql < fichier amg_migrator LOGIN docker run amg_migrator NOLOGIN psql < fichier '
refute "migrations en échec : aucune bascule" calls_has '--scale api=2'
check "migrations en échec : amg.env jamais modifié" test "$(api_digest)" = "$ZERO"
check "migrations en échec : aucun fichier temporaire d'amg.env" no_env_temp
check "migrations en échec : sortie SSH réduite au statut" ssh_is_status_only

run_deploy login-deja-ouvert STUB_LOGIN=t
check "LOGIN déjà ouvert : refus, code 7" test "$CASE_RC" = 7
check "LOGIN déjà ouvert : INCIDENT journalisé" grep -q 'INCIDENT : amg_migrator a déjà LOGIN' "$LOG"
check "LOGIN déjà ouvert : statut SSH explicite" grep -q 'REFUS (code 7), fenêtre de migration déjà ouverte' "$CASE_DIR/ssh.log"
refute "LOGIN déjà ouvert : aucune ouverture" sql_has 'ALTER ROLE amg_migrator LOGIN'
refute "LOGIN déjà ouvert : aucune migration ni bascule" calls_has 'run '

run_deploy session-active STUB_SESSIONS=1
check "session d'amg_migrator active : refus, code 7" test "$CASE_RC" = 7
refute "session active : aucune ouverture" sql_has 'ALTER ROLE amg_migrator LOGIN'

run_deploy journal-avant STUB_VIOLATION_1='déclencheur désactivé'
check "journal non conforme avant : refus" test "$CASE_RC" != 0
refute "journal non conforme avant : aucune ouverture de LOGIN" sql_has 'amg_migrator LOGIN'
refute "journal non conforme avant : aucune migration" calls_has 'run '

run_deploy journal-apres-rejeu STUB_VIOLATION_2='écart après rejeu'
check "journal non conforme après le rejeu (avant la fenêtre) : refus" test "$CASE_RC" != 0
refute "journal non conforme après le rejeu : aucune ouverture" sql_has 'ALTER ROLE amg_migrator LOGIN'

run_deploy journal-avant-rejeu STUB_VIOLATION_1='écart initial'
check "écart initial journalisé, pas réparé en silence par le rejeu" grep -q 'écart initial' "$LOG"
refute "écart initial : aucun rejeu de roles.sql" sql_has 'psql < fichier'

run_deploy journal-apres STUB_VIOLATION_3='droits modifiés'
check "journal non conforme après : échec" test "$CASE_RC" != 0
check "journal non conforme après : écart dans le journal du serveur" grep -q 'droits modifiés' "$LOG"
refute "journal non conforme après : écart absent de la sortie SSH" grep -q 'droits modifiés' "$CASE_DIR/ssh.log"
check "journal non conforme après : fenêtre refermée" sql_has 'amg_migrator NOLOGIN'
refute "journal non conforme après : aucune bascule" calls_has '--scale api=2'

run_deploy roles-different STUB_ROLES_SHA="$(printf 'f%.0s' {1..64})"
check "roles.sql différent de l'image : refus" test "$CASE_RC" != 0
refute "roles.sql différent : aucune ouverture de LOGIN" sql_has 'amg_migrator LOGIN'

run_deploy rejeu-en-echec STUB_PSQL_FAIL=roles.sql
check "rejeu de roles.sql en échec (avant la fenêtre) : refus" test "$CASE_RC" != 0
refute "rejeu de roles.sql en échec : aucune ouverture de LOGIN" sql_has 'amg_migrator LOGIN'
refute "rejeu de roles.sql en échec : aucune migration" calls_has 'run '

run_deploy fermeture-en-echec STUB_PSQL_FAIL=NOLOGIN
check "fermeture impossible : échec" test "$CASE_RC" != 0
check "fermeture impossible : cinq nouveaux essais à la sortie" \
  test "$(grep -c 'amg_migrator NOLOGIN' "$CASE_DIR/state/sql.log")" = 6
check "fermeture impossible : incident journalisé" grep -q 'INCIDENT : fenêtre de migration restée OUVERTE' "$LOG"
refute "fermeture impossible : aucune bascule" calls_has '--scale api=2'

run_deploy interruption STUB_MIGRATE_KILL=1
check "interruption pendant les migrations : sortie en échec" test "$CASE_RC" != 0
check "interruption : fenêtre refermée par le piège EXIT" sql_has 'amg_migrator NOLOGIN'
refute "interruption : aucune bascule" calls_has '--scale api=2'

run_deploy double-signal STUB_MIGRATE_KILL=1 STUB_NOLOGIN_SIGNAL=1
check "second signal pendant la fermeture : nouvel essai malgré le signal" \
  test "$(grep -c 'amg_migrator NOLOGIN' "$CASE_DIR/state/sql.log")" -ge 2
check "second signal : fenêtre finalement refermée" grep -q 'fenêtre de migration refermée (sortie' "$LOG"
refute "second signal : aucun INCIDENT" grep -q 'INCIDENT' "$LOG"

run_deploy mauvaise-image STUB_RUNNING_IMAGE="ghcr.io/proprietaire/amg-api@$ZERO"
check "réplique sur une autre image que la cible : échec" test "$CASE_RC" != 0
check "réplique sur une autre image : retirée" calls_has "rm -f $NEW_ID"
check "réplique sur une autre image : amg.env inchangé" test "$(api_digest)" = "$ZERO"
refute "réplique sur une autre image : ancienne réplique jamais arrêtée" calls_has "stop --time 10 $OLD_ID"

run_deploy kill-fin-de-bascule STUB_STOP_SIGNAL=KILL
check "arrêt brutal en fin de bascule : amg.env déjà sur la cible" test "$(api_digest)" = "$API_D"
check "arrêt brutal en fin de bascule : historique déjà sur la cible" grep -q "$API_D" "$CASE_DIR/amg/staging/releases-api.log"

run_deploy term-fin-de-bascule STUB_STOP_SIGNAL=TERM
check "SIGTERM en fin de bascule ignoré : ancienne réplique retirée" calls_has "rm $OLD_ID"
check "SIGTERM en fin de bascule : déploiement réussi" test "$CASE_RC" = 0

run_deploy pull-en-echec STUB_PULL_RC=1
check "image de l'API introuvable : échec" test "$CASE_RC" != 0
refute "image de l'API introuvable : aucune fenêtre" sql_has 'LOGIN'

# --- watch.sh : LOGIN d'amg_migrator hors fenêtre ---------------------------------------------
WSTUB=$T/wstub
mkdir -p "$WSTUB"
cat >"$WSTUB/docker" <<'EOF'
#!/usr/bin/env bash
# Double de docker pour watch.sh : un environnement de préproduction avec un seul postgres sain.
case "$1" in
  info) case "$*" in *DockerRootDir*) echo /var/lib/docker ;; *) echo 'systemd 2' ;; esac ;;
  ps) case "$*" in *service=postgres*) echo "$STUB_PG" ;; *service=api*) echo "$STUB_API_ID" ;; esac ;;
  network) [ "$2" = inspect ] && case "$*" in *Internal*) echo true ;; esac ;;
  compose) printf '%s\n' postgres api ;;
  inspect)
    case "$*" in
      *State.Status*) echo 'running healthy 0 false' ;;
      *Config.Image*) echo "$STUB_RUNNING" ;;
    esac
    ;;
  exec)
    case "$*" in
      *rolcanlogin*) echo "${STUB_LOGIN:-f}" ;;
      *to_regprocedure*) echo t ;;
    esac
    ;;
esac
exit 0
EOF
printf '#!/usr/bin/env bash\ncat >/dev/null\nexit 0\n' >"$WSTUB/curl"
chmod +x "$WSTUB/docker" "$WSTUB/curl"
run_watch() { # $1 1 pour tenir le verrou de l'environnement (fenêtre en cours), puis variables du double
  local w=$T/watch hold=$1 locker=''
  shift
  rm -rf "$w"
  mkdir -p "$w/amg/secrets" "$w/amg/logs" "$w/amg/staging/compose" "$w/cg"
  printf 'HC_WATCH_URL=https://hc.invalid/x\nTRAEFIK_CONTAINER=traefik\n' >"$w/amg/secrets/watch.env"
  printf 'AMG_PROJECT=amg-staging\nAMG_ENV=staging\nAMG_EDGE_NETWORK=amg_edge_staging\nAPI_IMAGE=ghcr.io/p/amg-api\nAPI_DIGEST=%s\n' \
    "$API_D" >"$w/amg/staging/amg.env"
  if [ "$hold" = 1 ]; then
    # Le processus qui tient le verrou devient `sleep` (exec) : le tuer libère le verrou, et il ne
    # garde ouverte aucune sortie du script.
    (
      exec 9>"$w/amg/staging/.deploy.lock"
      /usr/bin/flock 9
      exec /bin/sleep 30
    ) </dev/null >/dev/null 2>&1 &
    locker=$!
    for _ in $(seq 50); do /usr/bin/flock -n "$w/amg/staging/.deploy.lock" true || break; /bin/sleep 0.1; done
  fi
  env -i PATH="$WSTUB:$STUB/bin:/usr/bin:/bin" HOME="$T" AMG_ROOT="$w/amg" AMG_CGROUP_ROOT="$w/cg" \
    STUB_PG="$PG_ID" STUB_API_ID="$NEW_ID" STUB_RUNNING="ghcr.io/p/amg-api@$API_D" "$@" bash "$BIN/watch.sh" >"$w/out.log" 2>&1
  if [ -n "$locker" ]; then kill "$locker" 2>/dev/null; wait "$locker" 2>/dev/null; fi
  WATCH_OUT=$w/out.log
}
run_watch 0 STUB_LOGIN=t
check "watch : LOGIN d'amg_migrator hors fenêtre signalé" grep -q 'amg_migrator a LOGIN hors de toute fenêtre' "$WATCH_OUT"
run_watch 0 STUB_LOGIN=f
refute "watch : aucun signalement si NOLOGIN" grep -q 'amg_migrator a LOGIN' "$WATCH_OUT"
refute "watch : image de l'API conforme à amg.env, aucun signalement" grep -q 'amg.env annonce' "$WATCH_OUT"
run_watch 1 STUB_LOGIN=t
refute "watch : aucun signalement pendant une fenêtre (verrou tenu)" grep -q 'amg_migrator a LOGIN' "$WATCH_OUT"
run_watch 0 STUB_RUNNING="ghcr.io/p/amg-api@$ZERO"
check "watch : API en marche sur un autre digest que amg.env signalée" grep -q 'amg.env annonce' "$WATCH_OUT"

while read -r n; do passed=$((passed + n)); done <"$T/passed"
printf 'tests des scripts du serveur : %d réussis, %d en échec\n' "$passed" "$failures"
[ "$failures" = 0 ]
