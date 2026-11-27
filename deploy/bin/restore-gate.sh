#!/usr/bin/env bash
# Garde côté SERVEUR de la restauration de la base de production après incident
# (docs/EXPLOITATION.md, 5.4 et §11). Aucune clé sur le VPS : le flux arrive DÉJÀ DÉCHIFFRÉ du poste
# de l'humain (restore-prod.sh : restic dump | age -d | ssh), ce script ne fait que contrôler puis
# brancher l'entrée standard sur pg_restore.
# Commande forcée d'une clé SSH réservée à l'incident, ajoutée par l'humain dans l'authorized_keys
# de <UTILISATEUR_DEPLOY> le temps de la restauration, puis retirée :
#   restrict,command="/opt/amg/bin/restore-gate.sh" ssh-ed25519 AAAA… amg-restauration-prod
# Commandes acceptées (rien d'autre) :
#   ssh … "check"                                        contrôles seuls, aucune écriture
#   ssh … "list <id_snapshot>" < flux pg_dump            table des matières filtrée, gardée sur le serveur
#   ssh … "restore <id_snapshot> RESTAURER-amg-prod-<id_snapshot>" < même flux
# Contrôles, refaits à chaque commande : Postgres de production en marche et sain ; api et worker
# arrêtés (aucun écrivain) ; sauvegarde de l'état actuel faite il y a moins de 3 h (backup.sh) ;
# aucun déploiement en cours (le verrou de deploy.sh est tenu jusqu'à la fin de la restauration).
#
# Restauration (règles du §11 : jamais sur la base en service, jamais sous le superutilisateur) :
#   1. base NEUVE amg_restore (template0), roles.sql installé (rôles, droits, garde du journal),
#      déclencheurs d'événement du journal désactivés dans cette base seulement (le troisième, qui
#      refuse CONCURRENTLY, reste actif) ;
#   2. fenêtre : ALTER ROLE amg_migrator LOGIN, refermée (NOLOGIN, pg_terminate_backend) par un
#      piège EXIT posé avant l'ouverture ;
#   3. pg_restore connecté DIRECTEMENT en amg_migrator (jamais --role, ni --clean, ni --data-only),
#      une seule transaction, liste filtrée (sans déclencheurs d'événement ni amg_guard) ;
#   4. fenêtre refermée, rejeu de roles.sql dans amg_restore (déclencheurs réactivés, journal vérifié
#      et scellé), vérification explicite, même flux qu'au `list` (empreinte SHA-256) ;
#   5. bascule : amg → amg_avant_<date> (conservée), amg_restore → amg, en une transaction.
# Tout échec avant la bascule laisse la base en service intacte (et supprime amg_restore).
set -euo pipefail
export PATH=/usr/bin:/bin LANG=C.UTF-8

AMG_ROOT=/opt/amg
# shellcheck source=deploy/bin/amg-common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/amg-common.sh"
PROJECT=amg-prod
LOCK=$AMG_ROOT/prod/.deploy.lock
LAST_DUMP=$AMG_ROOT/backups/prod/amg-prod.dump.age # écrit par backup.sh
ROLES_SQL=$AMG_ROOT/prod/compose/roles.sql         # installé par l'humain avec les fichiers Compose (3.3)
STATE=$AMG_ROOT/prod/restore                       # listes filtrées et empreintes (aucun secret)
LOG=$AMG_ROOT/logs/restore.log
MAX_DUMP_AGE_MIN=180
MAX_LIST_AGE_MIN=120
NEW_DB=amg_restore
LIST_IN_PG=/tmp/amg-restore.list
# Session de restauration d'amg_migrator : chemin épinglé, délais de son rôle allongés (le flux vient
# du poste par SSH : une transaction peut attendre l'entrée plusieurs minutes).
RESTORE_PG_OPTIONS='-c search_path=pg_catalog,pg_temp -c idle_in_transaction_session_timeout=10min -c statement_timeout=30min'

log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG" >&2; }
refuse() {
  log "REFUS : $*"
  exit 3
}

read -r -a ARGS <<<"${SSH_ORIGINAL_COMMAND:-}"
case "${ARGS[0]:-}" in
  check) [ "${#ARGS[@]}" -eq 1 ] || refuse "commande mal formée" ;;
  list)
    [[ "${#ARGS[@]}" -eq 2 && "${ARGS[1]}" =~ ^[0-9a-f]{8,64}$ ]] || refuse "commande mal formée"
    ;;
  restore)
    [[ "${#ARGS[@]}" -eq 3 && "${ARGS[1]}" =~ ^[0-9a-f]{8,64}$ ]] || refuse "commande mal formée"
    [ "${ARGS[2]}" = "RESTAURER-$PROJECT-${ARGS[1]}" ] || refuse "confirmation absente ou fausse"
    ;;
  *) refuse "commande inconnue" ;;
esac
SNAPSHOT=${ARGS[1]:-}

service_ids() { # $1 service Compose
  docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=$1"
}

exec 9>"$LOCK"
flock -n 9 || refuse "déploiement ou sauvegarde en cours"

PG=$(service_ids postgres)
[ -n "$PG" ] && [ "$(wc -l <<<"$PG")" -eq 1 ] || refuse "conteneur postgres de production introuvable ou multiple"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$PG")" = healthy ] || refuse "postgres de production pas sain"
[ -z "$(service_ids api)$(service_ids worker)" ] || refuse "api ou worker encore démarrés : les arrêter d'abord"
[ -f "$LAST_DUMP" ] && [ -n "$(find "$LAST_DUMP" -mmin -"$MAX_DUMP_AGE_MIN")" ] \
  || refuse "aucune sauvegarde de l'état actuel depuis $MAX_DUMP_AGE_MIN min : lancer backup.sh d'abord"
[ -f "$ROLES_SQL" ] && [ ! -L "$ROLES_SQL" ] || refuse "$ROLES_SQL absent (EXPLOITATION.md, 3.3)"

if [ "${ARGS[0]}" = check ]; then
  log "contrôles avant restauration : OK (postgres ${PG:0:12} sain, aucun écrivain, sauvegarde récente)"
  exit 0
fi

# psql sous amg (administration seulement : rôles, bases, déclencheurs d'événement, catalogues),
# -X, chemin épinglé. $1 base ; entrée standard : fichier SQL, ou /dev/null pour une commande -c.
pg_admin() {
  local db=$1
  shift
  docker exec -i -e PGOPTIONS="$AMG_PG_ADMIN_OPTIONS" "$PG" psql -X -v ON_ERROR_STOP=1 -U amg -d "$db" -At "$@"
}

install -d -m 700 "$STATE"
LIST=$STATE/$SNAPSHOT.list
SUM=$STATE/$SNAPSHOT.sha256

# Empreinte du flux reçu, calculée pendant qu'il passe (aucune copie du dump n'est écrite).
stream_sum() { # $1 fichier de sortie
  sha256sum | cut -d' ' -f1 >"$1"
}

if [ "${ARGS[0]}" = list ]; then
  raw=$(mktemp "$STATE/.list.XXXXXX")
  trap 'rm -f "$raw" "$raw.sum"' EXIT
  # pg_restore -l ne lit que la table des matières : tee -p continue d'alimenter l'empreinte
  # jusqu'à la fin du flux, quand pg_restore a déjà rendu la main (empreinte écrite d'un bloc,
  # attendue quelques secondes au plus).
  tee -p >(stream_sum "$raw.sum") | docker exec -i "$PG" pg_restore -l >"$raw" \
    || refuse "table des matières illisible (flux pg_dump attendu)"
  cat >/dev/null || true
  for _ in 1 2 3 4 5; do [ -s "$raw.sum" ] && break; sleep 1; done
  amg_restore_list_filter <"$raw" >"$LIST.tmp" 2> >(tee -a "$LOG" >&2) || {
    rm -f "$LIST.tmp"
    refuse "liste de restauration refusée (objets hors du schéma public, voir ci-dessus)"
  }
  mv "$LIST.tmp" "$LIST"
  mv "$raw.sum" "$SUM"
  log "liste du snapshot $SNAPSHOT prête : $(grep -c '^[0-9]' "$LIST") objets à restaurer, empreinte $(cat "$SUM")"
  exit 0
fi

# --- restore ------------------------------------------------------------------------------------
[ -f "$LIST" ] && [ -n "$(find "$LIST" -mmin -"$MAX_LIST_AGE_MIN")" ] && [ -s "$SUM" ] \
  || refuse "liste du snapshot $SNAPSHOT absente ou de plus de $MAX_LIST_AGE_MIN min : relancer restore-prod.sh"

WINDOW_OPEN=0
SWITCHED=0
close_window() {
  pg_admin postgres -c 'ALTER ROLE amg_migrator NOLOGIN' \
    -c "select pg_catalog.count(pg_catalog.pg_terminate_backend(a.pid)) from pg_catalog.pg_stat_activity a where a.usename OPERATOR(pg_catalog.=) 'amg_migrator'" \
    </dev/null >/dev/null
}
on_exit() {
  local rc=$?
  if [ "$WINDOW_OPEN" = 1 ]; then
    if close_window; then
      log "fenêtre de restauration refermée (sortie, code $rc)"
    else
      log "INCIDENT : fenêtre restée OUVERTE (amg_migrator LOGIN) : la refermer à la main (EXPLOITATION.md §11)"
      [ "$rc" -ne 0 ] || rc=6
    fi
  fi
  if [ "$SWITCHED" = 0 ]; then
    pg_admin postgres -c "DROP DATABASE IF EXISTS $NEW_DB WITH (FORCE)" </dev/null >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap on_exit EXIT
trap '' PIPE
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

log "restauration du snapshot $SNAPSHOT dans une base neuve ($NEW_DB) : début (flux reçu du poste)"
pg_admin postgres -c "DROP DATABASE IF EXISTS $NEW_DB WITH (FORCE)" \
  -c "CREATE DATABASE $NEW_DB TEMPLATE template0" </dev/null >/dev/null
pg_admin "$NEW_DB" <"$ROLES_SQL" >/dev/null
pg_admin "$NEW_DB" -c 'ALTER EVENT TRIGGER amg_guard_security_events DISABLE' \
  -c 'ALTER EVENT TRIGGER amg_guard_security_events_drop DISABLE' </dev/null >/dev/null
docker exec -i "$PG" tee "$LIST_IN_PG" <"$LIST" >/dev/null
rm -f "$STATE/.restore.sum"

WINDOW_OPEN=1 # avant LOGIN : le piège EXIT refermera la fenêtre quoi qu'il arrive
pg_admin postgres -c 'ALTER ROLE amg_migrator LOGIN' </dev/null >/dev/null
log "fenêtre de restauration ouverte : pg_restore en amg_migrator dans $NEW_DB"
if ! tee >(stream_sum "$STATE/.restore.sum") | docker exec -i -e PGOPTIONS="$RESTORE_PG_OPTIONS" "$PG" \
  pg_restore -U amg_migrator -d "$NEW_DB" --no-owner --single-transaction --exit-on-error -L "$LIST_IN_PG"; then
  log "ÉCHEC de pg_restore : transaction annulée, $NEW_DB supprimée, base en service inchangée"
  exit 3
fi
close_window
WINDOW_OPEN=0
log "fenêtre refermée ; rejeu de roles.sql dans $NEW_DB (déclencheurs réactivés, journal vérifié)"
pg_admin "$NEW_DB" <"$ROLES_SQL" >/dev/null || refuse "rejeu de roles.sql en échec : journal restauré non conforme, base en service inchangée"
violation=$(pg_admin "$NEW_DB" -c "$AMG_JOURNAL_CHECK_SQL" </dev/null)
[ -z "$violation" ] || refuse "journal restauré non conforme : $violation"
for _ in 1 2 3 4 5; do [ -s "$STATE/.restore.sum" ] && break; sleep 1; done
[ "$(cat "$STATE/.restore.sum" 2>/dev/null)" = "$(cat "$SUM")" ] \
  || refuse "le flux restauré n'est pas celui de la liste (empreinte différente) : base en service inchangée"

# Bascule : l'ancienne base est conservée sous un autre nom (à supprimer par l'humain après contrôle).
OLD_DB=amg_avant_$(date +%Y%m%d%H%M)
pg_admin postgres -c "select pg_catalog.count(pg_catalog.pg_terminate_backend(a.pid)) from pg_catalog.pg_stat_activity a where a.datname OPERATOR(pg_catalog.=) ANY (ARRAY['amg', '$NEW_DB']::name[]) and a.pid OPERATOR(pg_catalog.<>) pg_catalog.pg_backend_pid()" \
  -c "ALTER DATABASE amg RENAME TO $OLD_DB; ALTER DATABASE $NEW_DB RENAME TO amg" </dev/null >/dev/null
SWITCHED=1
rm -f "$LIST" "$SUM" "$STATE/.restore.sum"
log "restauration du snapshot $SNAPSHOT : terminée, base en service remplacée (ancienne : $OLD_DB)"
