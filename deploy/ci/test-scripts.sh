#!/usr/bin/env bash
# Tests hors ligne des scripts du serveur (deploy/bin), SANS Docker : `docker`, `systemctl` et
# `sleep` sont remplacés par des doubles (dossier temporaire en tête du PATH) qui journalisent leurs
# appels et rejouent des réponses choisies par chaque cas. Lancé par ci.yml (job « Budget mémoire
# AMG ») et deploy.yml (job `build`), et à la main depuis la racine du dépôt :
#   deploy/ci/test-scripts.sh
# Couvre : liste blanche de amg_run (règles du rôle migrate), règles de routeur Traefik admises par
# watch.sh, filtre de la liste de restauration, et la fenêtre de migration de deploy.sh (ouverture
# seulement si le journal est conforme et roles.sql à jour, fermeture même en cas d'échec, d'erreur
# de fermeture ou d'interruption, aucune bascule sans migrations réussies et journal vérifié).
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
  chmod 644 "$secret"
  refute "secret lisible par tous refusé" as migrate staging -v "$mount_ok"
  chmod 640 "$secret"
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
  clean() { [ -z "$(amg_traefik_rule_problems "$1" "$2")" ]; }
  api="($(h admin.staging.amgdecorationdinterieur.com) || $(h espace.staging.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  check "règle du site admise" clean prod "$(h amgdecorationdinterieur.com) || $(h www.amgdecorationdinterieur.com)"
  check "règle de l'API admise" clean staging "$api"
  refute "hôte du voisin refusé" clean prod "$(h exemple.org)"
  refute "PathPrefix seul refusé" clean prod "PathPrefix(${bt}/api/${bt})"
  refute "PathPrefix joint par || refusé" clean prod "$(h admin.amgdecorationdinterieur.com) || PathPrefix(${bt}/api/${bt})"
  refute "PathPrefix sans parenthèses refusé" clean prod "$(h admin.amgdecorationdinterieur.com) && PathPrefix(${bt}/api/${bt})"
  refute "autre préfixe refusé" clean prod "($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/${bt})"
  refute "hôte de production refusé en préproduction" clean staging "($(h admin.amgdecorationdinterieur.com)) && PathPrefix(${bt}/api/${bt})"
  refute "HostRegexp refusé" clean prod "HostRegexp(${bt}.*${bt})"
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
  echo "$passed" >>"$T/passed"
  exit "$failures"
) || failures=$((failures + $?))

# --- deploy.sh : déploiement de l'API et fenêtre de migration ----------------------------------
STUB=$T/stub
mkdir -p "$STUB/bin"
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
      pull) exit "${STUB_PULL_RC:-0}" ;;
      ps) [ -f "$S/ps-$svc" ] && cat "$S/ps-$svc" ;;
      up) printf '%s\n' "$STUB_NEW_ID" >>"$S/ps-$svc"; mkdir -p "$STUB_SCOPE_DIR/docker-$STUB_NEW_ID.scope" ;;
    esac
    ;;
  inspect)
    case "$3" in
      *Health*) echo healthy ;;
      *CgroupParent*) printf 'amg-staging.slice|%s\n' "$4" ;;
    esac
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
      fail_on "$q" && exit 3
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
  printf 'x%.0s' {1..44} >"$amg/staging/secrets/pg_migrator_password"
  chmod 640 "$amg/staging/secrets/pg_migrator_password"
  echo "$PG_ID" >"$case_dir/state/ps-postgres"
  echo "$OLD_ID" >"$case_dir/state/ps-api"
  local sha
  sha=$(sha256sum "$amg/staging/compose/roles.sql" | cut -d' ' -f1)
  CASE_DIR=$case_dir
  env -i PATH="$STUB/bin:/usr/bin:/bin" HOME="$T" AMG_ROOT="$amg" AMG_CGROUP_ROOT="$cg" \
    STUB_STATE="$case_dir/state" STUB_NEW_ID="$NEW_ID" STUB_ROLES_SHA="$sha" \
    STUB_SCOPE_DIR="$cg/amg.slice/amg-staging.slice" "$@" \
    bash "$BIN/deploy.sh" staging deploy api "$API_D" "$MIG_D" >"$case_dir/out.log" 2>&1
  CASE_RC=$?
}
sql_has() { grep -sqF -- "$1" "$CASE_DIR/state/sql.log"; }
calls_has() { grep -qF -- "$1" "$CASE_DIR/state/calls.log"; }
# Ordre des événements de la fenêtre dans sql.log (« LOGIN », « docker run », « NOLOGIN »…).
sql_order() { grep -oE 'amg_migrator NOLOGIN|amg_migrator LOGIN|docker run|psql < fichier' "$CASE_DIR/state/sql.log" | tr '\n' ' '; }
api_digest() { sed -n 's/^API_DIGEST=//p' "$CASE_DIR/amg/staging/amg.env"; }

run_deploy succes
check "déploiement de l'API réussi" test "$CASE_RC" = 0
check "ordre de la fenêtre : LOGIN, migrations, NOLOGIN, rejeu de roles.sql" \
  test "$(sql_order)" = 'amg_migrator LOGIN docker run amg_migrator NOLOGIN psql < fichier '
check "sessions d'amg_migrator terminées à la fermeture" sql_has 'pg_terminate_backend'
check "journal vérifié avant et après la fenêtre" test "$(cat "$CASE_DIR/state/violations")" = 2
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
  test "$(sql_order)" = 'amg_migrator LOGIN docker run amg_migrator NOLOGIN psql < fichier '
refute "migrations en échec : aucune bascule" calls_has '--scale api=2'
check "migrations en échec : digest précédent remis" test "$(api_digest)" = "$ZERO"

run_deploy journal-avant STUB_VIOLATION_1='déclencheur désactivé'
check "journal non conforme avant : refus" test "$CASE_RC" != 0
refute "journal non conforme avant : aucune ouverture de LOGIN" sql_has 'amg_migrator LOGIN'
refute "journal non conforme avant : aucune migration" calls_has 'run '

run_deploy journal-apres STUB_VIOLATION_2='droits modifiés'
check "journal non conforme après : échec" test "$CASE_RC" != 0
check "journal non conforme après : fenêtre refermée" sql_has 'amg_migrator NOLOGIN'
refute "journal non conforme après : aucune bascule" calls_has '--scale api=2'

run_deploy roles-different STUB_ROLES_SHA="$(printf 'f%.0s' {1..64})"
check "roles.sql différent de l'image : refus" test "$CASE_RC" != 0
refute "roles.sql différent : aucune ouverture de LOGIN" sql_has 'amg_migrator LOGIN'

run_deploy rejeu-en-echec STUB_PSQL_FAIL=roles.sql
check "rejeu de roles.sql en échec : échec" test "$CASE_RC" != 0
check "rejeu de roles.sql en échec : fenêtre refermée avant" sql_has 'amg_migrator NOLOGIN'
refute "rejeu de roles.sql en échec : aucune bascule" calls_has '--scale api=2'

run_deploy fermeture-en-echec STUB_PSQL_FAIL=NOLOGIN
check "fermeture impossible : échec" test "$CASE_RC" != 0
check "fermeture impossible : nouvel essai à la sortie" \
  test "$(grep -c 'amg_migrator NOLOGIN' "$CASE_DIR/state/sql.log")" = 2
check "fermeture impossible : incident journalisé" grep -q 'INCIDENT' "$CASE_DIR/out.log"
refute "fermeture impossible : aucune bascule" calls_has '--scale api=2'

run_deploy interruption STUB_MIGRATE_KILL=1
check "interruption pendant les migrations : sortie en échec" test "$CASE_RC" != 0
check "interruption : fenêtre refermée par le piège EXIT" sql_has 'amg_migrator NOLOGIN'
refute "interruption : aucune bascule" calls_has '--scale api=2'

run_deploy pull-en-echec STUB_PULL_RC=1
check "image de l'API introuvable : échec" test "$CASE_RC" != 0
refute "image de l'API introuvable : aucune fenêtre" sql_has 'LOGIN'

while read -r n; do passed=$((passed + n)); done <"$T/passed"
printf 'tests des scripts du serveur : %d réussis, %d en échec\n' "$passed" "$failures"
[ "$failures" = 0 ]
