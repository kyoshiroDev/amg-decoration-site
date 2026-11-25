#!/usr/bin/env bash
# Garde côté SERVEUR de la restauration de la base de production après incident
# (docs/EXPLOITATION.md, 5.4). Aucune clé sur le VPS : le flux arrive DÉJÀ DÉCHIFFRÉ du poste de
# l'humain (restore-prod.sh : restic dump | age -d | ssh), ce script ne fait que contrôler puis
# brancher l'entrée standard sur pg_restore.
# Commande forcée d'une clé SSH réservée à l'incident, ajoutée par l'humain dans l'authorized_keys
# de <UTILISATEUR_DEPLOY> le temps de la restauration, puis retirée :
#   restrict,command="/opt/amg/bin/restore-gate.sh" ssh-ed25519 AAAA… amg-restauration-prod
# Commandes acceptées (rien d'autre) :
#   ssh … "check"                                       contrôles seuls, aucune écriture
#   ssh … "restore <id_snapshot> RESTAURER-amg-prod-<id_snapshot>" < flux pg_dump (format custom)
# Contrôles, refaits à chaque commande : Postgres de production en marche et sain ; api et worker
# arrêtés (aucun écrivain) ; sauvegarde de l'état actuel faite il y a moins de 3 h (backup.sh) ;
# aucun déploiement en cours (le verrou de deploy.sh est tenu jusqu'à la fin de la restauration).
# pg_restore --single-transaction --exit-on-error : une erreur annule tout, la base reste intacte.
set -euo pipefail
export PATH=/usr/bin:/bin LANG=C.UTF-8

AMG_ROOT=/opt/amg
PROJECT=amg-prod
LOCK=$AMG_ROOT/prod/.deploy.lock
LAST_DUMP=$AMG_ROOT/backups/prod/amg-prod.dump.age # écrit par backup.sh
LOG=$AMG_ROOT/logs/restore.log
MAX_DUMP_AGE_MIN=180

log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG" >&2; }
refuse() {
  log "REFUS : $*"
  exit 3
}

read -r -a ARGS <<<"${SSH_ORIGINAL_COMMAND:-}"
case "${ARGS[0]:-}" in
  check) [ "${#ARGS[@]}" -eq 1 ] || refuse "commande mal formée" ;;
  restore)
    [[ "${#ARGS[@]}" -eq 3 && "${ARGS[1]}" =~ ^[0-9a-f]{8,64}$ ]] || refuse "commande mal formée"
    [ "${ARGS[2]}" = "RESTAURER-$PROJECT-${ARGS[1]}" ] || refuse "confirmation absente ou fausse"
    ;;
  *) refuse "commande inconnue" ;;
esac

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

if [ "${ARGS[0]}" = check ]; then
  log "contrôles avant restauration : OK (postgres ${PG:0:12} sain, aucun écrivain, sauvegarde récente)"
  exit 0
fi

log "restauration du snapshot ${ARGS[1]} dans $PROJECT : début (flux reçu du poste)"
if docker exec -i "$PG" pg_restore -U amg -d amg --clean --if-exists --no-owner \
  --single-transaction --exit-on-error; then
  log "restauration du snapshot ${ARGS[1]} : terminée"
else
  status=$?
  log "ÉCHEC de la restauration du snapshot ${ARGS[1]} (code $status) : transaction annulée, base inchangée"
  exit "$status"
fi
