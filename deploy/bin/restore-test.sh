#!/usr/bin/env bash
# Test de restauration MENSUEL, sur le POSTE de l'humain (Linux, ou une VM jetable), jamais sur le
# VPS : la clé privée age et le mot de passe restic ne passent jamais par le serveur, et un serveur
# compromis ne peut pas falsifier le résultat du test.
#   deploy/bin/restore-test.sh [id_snapshot|latest] 2>&1 | tee -a ~/amg-restauration/restore-test.log
# Prérequis du poste : docker, jq, age, curl ; fichier d'accès en lecture seule au dépôt restic
# (AMG_RESTORE_ENV, défaut ~/.config/amg/restic-restore.env, droits 600) :
#   RESTIC_REPOSITORY=s3:<ENDPOINT_B2>/<BUCKET>/<PREFIXE>
#   AWS_ACCESS_KEY_ID=…  AWS_SECRET_ACCESS_KEY=…   (clé B2 listBuckets,listFiles,readFiles seulement)
#   HC_RESTORE_URL=https://hc-ping.com/<uuid>     (facultatif)
# La clé privée age et le mot de passe restic sont saisis au clavier (invites masquées) ou lus sur
# l'entrée standard (ligne 1 : clé age ; ligne 2 : mot de passe restic). Ils restent en mémoire.
#
# 1. Choisit le dernier snapshot nocturne de la production (ou celui demandé) et vérifie son âge
#    (alerte au-delà de 36 h : la sauvegarde nocturne ne tourne plus).
# 2. Démarre un Postgres jetable, SANS réseau, volume anonyme supprimé à la fin, mémoire bornée.
# 3. restic dump | age -d | pg_restore --exit-on-error : aucun dump en clair sur le disque.
# 4. Vérifie : restauration sans erreur, tables présentes, dernière migration Prisma, nombre de
#    lignes par table ; fichiers (si sauvegardés) restaurés dans un volume jetable avec --verify.
# 5. Nettoie tout (piège EXIT), signale à Healthchecks.io (période 31 jours : pas de test ce
#    mois-ci = alerte). Le résultat est à recopier dans le registre de docs/EXPLOITATION.md (5.2).
set -Eeuo pipefail

SOURCE_HOST=amg-prod
SNAPSHOT=${1:-latest}
RESTIC_ENV=${AMG_RESTORE_ENV:-$HOME/.config/amg/restic-restore.env}
RESTIC_IMAGE=restic/restic:0.20.0@sha256:93999df80d4ac6cb148e82d2ef1fe6a81996f17ff535e772723538211b31555a
# Même version que la production (deploy/compose.yaml).
PG_IMAGE=postgres:18.7-alpine3.24@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
MAX_AGE_HOURS=36
MIN_TABLES=${MIN_TABLES:-0} # à relever à CRM 3 (schéma Prisma initial) : 0 tant que la base est vide
RUN_ID=amg-restore-test-$(date +%Y%m%d-%H%M%S)
PG_CONTAINER=$RUN_ID-pg
FILES_VOLUME=$RUN_ID-files

[[ "$SNAPSHOT" =~ ^(latest|[0-9a-f]{8,64})$ ]] || {
  echo "snapshot refusé : $SNAPSHOT" >&2
  exit 2
}
if [ -d /opt/amg/secrets ]; then
  echo "ce test tourne sur le poste de l'humain, pas sur le VPS (voir restore-prod.sh pour un incident)" >&2
  exit 2
fi
[ -r "$RESTIC_ENV" ] || {
  echo "$RESTIC_ENV illisible (AMG_RESTORE_ENV)" >&2
  exit 2
}
for tool in docker jq age curl; do
  command -v "$tool" >/dev/null || {
    echo "$tool n'est pas installé sur ce poste" >&2
    exit 2
  }
done
HC_RESTORE_URL=$(sed -n 's/^HC_RESTORE_URL=//p' "$RESTIC_ENV" | tail -n 1)

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
ping_hc() {
  [ -n "$HC_RESTORE_URL" ] || return 0
  curl -fsS -m 10 --retry 3 --data-binary @- "$HC_RESTORE_URL$1" >/dev/null || true
}

cleanup() {
  docker rm -f -v "$PG_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$FILES_VOLUME" >/dev/null 2>&1 || true
  AGE_IDENTITY=''
  RESTIC_PASSWORD=''
}
failed() {
  log "ÉCHEC du test de restauration (ligne $1)"
  printf 'échec ligne %s\n' "$1" | ping_hc /fail
}
trap cleanup EXIT
trap 'failed $LINENO' ERR

# restic sans aucune capacité, racine en lecture seule, sans cache disque ; le mot de passe passe
# par l'environnement du client Docker (`-e RESTIC_PASSWORD`), jamais par la ligne de commande.
# --no-lock : la clé B2 du poste est en lecture seule (pas de writeFiles), restic ne peut donc pas
# poser de verrou ; snapshots, dump, ls et restore n'en ont pas besoin.
RESTIC_EXTRA=()
restic() {
  docker run --rm -i --env-file "$RESTIC_ENV" -e RESTIC_PASSWORD --hostname "$RUN_ID" \
    --memory 512m --memory-swap 512m --cpus 1 --pids-limit 100 \
    --security-opt no-new-privileges:true --cap-drop ALL --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=192m \
    "${RESTIC_EXTRA[@]}" "$RESTIC_IMAGE" --no-cache --no-lock "$@"
}

# Clé privée age, puis mot de passe restic (sauf s'il est dans le fichier d'accès).
if [ -t 0 ]; then
  read -r -s -p "Clé privée age (AGE-SECRET-KEY-1…, non affichée) : " AGE_IDENTITY
  echo
else
  read -r AGE_IDENTITY
fi
[[ "$AGE_IDENTITY" =~ ^AGE-SECRET-KEY-1[0-9A-Z]+$ ]] || {
  echo "clé age invalide" >&2
  exit 2
}
if ! grep -q '^RESTIC_PASSWORD=' "$RESTIC_ENV"; then
  if [ -t 0 ]; then
    read -r -s -p "Mot de passe du dépôt restic (non affiché) : " RESTIC_PASSWORD
    echo
  else
    read -r RESTIC_PASSWORD
  fi
  [ -n "$RESTIC_PASSWORD" ] || {
    echo "mot de passe restic vide" >&2
    exit 2
  }
  export RESTIC_PASSWORD
fi

ping_hc /start </dev/null
log "snapshot $SNAPSHOT de $SOURCE_HOST"
if [ "$SNAPSHOT" = latest ]; then
  selector=(--host "$SOURCE_HOST" --tag nightly --latest 1)
else
  selector=("$SNAPSHOT")
fi
snap_json=$(restic snapshots --json "${selector[@]}" </dev/null | jq -c '.[-1] // {}')
snap_id=$(jq -r '.short_id // empty' <<<"$snap_json")
snap_time=$(jq -r '.time // empty' <<<"$snap_json")
[ -n "$snap_id" ] || {
  log "aucun snapshot trouvé"
  false
}
age_hours=$((($(date +%s) - $(date -d "$snap_time" +%s)) / 3600))
log "snapshot $snap_id du $snap_time (il y a $age_hours h)"
if [ "$SNAPSHOT" = latest ] && [ "$age_hours" -gt "$MAX_AGE_HOURS" ]; then
  log "ALERTE : dernière sauvegarde de plus de $MAX_AGE_HOURS h, la sauvegarde nocturne ne tourne plus"
  false
fi

log "Postgres jetable (sans réseau)"
# Mêmes droits que la production (deploy/compose.yaml) : aucune capacité sauf celles dont
# l'entrypoint officiel a besoin pour préparer PGDATA puis passer à l'utilisateur postgres.
docker run -d --name "$PG_CONTAINER" --network none \
  --memory 512m --memory-swap 512m --cpus 1 --pids-limit 200 \
  --security-opt no-new-privileges:true --label org.amg.role=restore-test \
  --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --cap-add SETGID --cap-add SETUID \
  --mount type=volume,dst=/var/lib/postgresql \
  -e POSTGRES_USER=amg -e POSTGRES_DB=amg -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$PG_IMAGE" >/dev/null
# 127.0.0.1 : ne répond qu'au serveur définitif (celui d'initialisation écoute le socket seul).
for _ in $(seq 60); do
  docker exec "$PG_CONTAINER" pg_isready -q -U amg -d amg -h 127.0.0.1 && break
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -q -U amg -d amg -h 127.0.0.1

log "restauration de la base (flux chiffré, déchiffré en mémoire)"
restic dump "$snap_id" /backup/db/amg-prod.dump.age </dev/null \
  | age -d -i <(printf '%s\n' "$AGE_IDENTITY") \
  | docker exec -i "$PG_CONTAINER" pg_restore -U amg -d amg --no-owner --no-privileges --exit-on-error
AGE_IDENTITY=''

psql_q() { docker exec "$PG_CONTAINER" psql -U amg -d amg -At -v ON_ERROR_STOP=1 -c "$1"; }
tables=$(psql_q "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")
log "tables restaurées : $tables (minimum attendu : $MIN_TABLES)"
[ "$tables" -ge "$MIN_TABLES" ] || {
  log "trop peu de tables"
  false
}
if [ "$tables" -gt 0 ]; then
  if [ "$(psql_q "select to_regclass('public._prisma_migrations') is not null")" = t ]; then
    log "dernière migration Prisma : $(psql_q "select migration_name || ' (' || finished_at || ')' from _prisma_migrations where finished_at is not null order by finished_at desc limit 1")"
    unfinished=$(psql_q "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null")
    [ "$unfinished" = 0 ] || {
      log "migration Prisma inachevée dans la sauvegarde"
      false
    }
  fi
  log "lignes par table :"
  psql_q "analyze" >/dev/null
  psql_q "select schemaname || '.' || relname || ' : ' || n_live_tup from pg_stat_user_tables order by 1" \
    | sed 's/^/  /'
fi

expected=$(restic ls --json "$snap_id" /backup/files </dev/null \
  | jq -s '[.[] | select(.type == "file" and (.path | startswith("/backup/files/")))] | length')
if [ "$expected" -gt 0 ]; then
  log "restauration des fichiers dans un volume jetable (--verify)"
  docker volume create --label org.amg.role=restore-test "$FILES_VOLUME" >/dev/null
  # Restaurer propriétaires et droits d'origine : seules capacités ajoutées, pour cette étape.
  RESTIC_EXTRA=(--cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE -v "$FILES_VOLUME:/restore")
  restic restore "$snap_id" --include /backup/files --target /restore --verify </dev/null
  RESTIC_EXTRA=()
  restored=$(docker run --rm --network none --cap-drop ALL --cap-add DAC_READ_SEARCH --read-only \
    -v "$FILES_VOLUME:/restore:ro" "$PG_IMAGE" find /restore/backup/files -type f | wc -l)
  log "fichiers : $restored restaurés / $expected dans le snapshot"
  [ "$restored" = "$expected" ] || {
    log "nombre de fichiers différent"
    false
  }
else
  log "pas de fichiers dans ce snapshot (volume de fichiers prévu à CRM 5)"
fi

log "RÉUSSI : snapshot $snap_id restauré et vérifié, environnement jetable supprimé"
printf 'snapshot %s du %s, %s tables\n' "$snap_id" "$snap_time" "$tables" | ping_hc ""
