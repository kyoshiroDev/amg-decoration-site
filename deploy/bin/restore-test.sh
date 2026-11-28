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
# 3. Rejoue la procédure de restauration de production (EXPLOITATION.md §11, restore-gate.sh) :
#    base neuve, roles.sql du dépôt, déclencheurs d'événement du journal désactivés, fenêtre
#    d'amg_migrator, liste filtrée (premier passage du flux : pg_restore -l), restauration connectée
#    directement en amg_migrator (second passage : restic dump | age -d | pg_restore -L, une seule
#    transaction ; aucun dump en clair sur le disque), fenêtre refermée, rejeu de roles.sql,
#    journal vérifié, bascule par renommage.
# 4. Vérifie : restauration sans erreur, tables présentes, dernière migration Prisma, nombre de
#    lignes par table (sous amg_migrator), journal de sécurité conforme, droits d'amg_app et
#    d'amg_journal (catalogues, sous amg), empreinte du journal (sous amg_app, qui garde SELECT) ;
#    fichiers (si sauvegardés) restaurés dans un volume jetable avec --verify. Le superutilisateur
#    amg ne lit aucune table : catalogues seulement.
# 5. Nettoie tout (piège EXIT), signale à Healthchecks.io (période 31 jours : pas de test ce
#    mois-ci = alerte). Le résultat est à recopier dans le registre de docs/EXPLOITATION.md (5.2).
set -Eeuo pipefail

HERE=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
# Constantes et filtre de la liste de restauration, communs avec le serveur.
# shellcheck source=deploy/bin/amg-common.sh
source "$HERE/amg-common.sh"
# roles.sql du dépôt : celui du commit installé en production (git pull sur main).
ROLES_SQL=${AMG_ROLES_SQL:-$HERE/../../libs/api/db/sql/roles.sql}
NEW_DB=amg_restore
SOURCE_HOST=amg-prod
SNAPSHOT=${1:-latest}
RESTIC_ENV=${AMG_RESTORE_ENV:-$HOME/.config/amg/restic-restore.env}
RESTIC_IMAGE=restic/restic:0.20.0@sha256:93999df80d4ac6cb148e82d2ef1fe6a81996f17ff535e772723538211b31555a
# Même version que la production (deploy/compose.yaml).
PG_IMAGE=postgres:18.7-alpine3.24@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
MAX_AGE_HOURS=36
# Tables attendues au moins dans public (7 depuis la migration initiale du CRM 3, _prisma_migrations
# comprise) : 0 tant que l'API n'est pas en production (la base sauvegardée est vide). À RELEVER
# (MIN_TABLES=7 à chaque test) dès que l'API est en production : sinon une sauvegarde vide passe.
MIN_TABLES=${MIN_TABLES:-0}
# Migration qui crée le journal de sécurité : si la sauvegarde l'a appliquée, le journal restauré
# doit être présent et scellé (lu sous amg_migrator, jamais sous amg).
JOURNAL_MIGRATION=20261126120000_init
# Migration qui fait d'amg_journal le seul écrivain du journal (CRM 3, lot 3) : si la sauvegarde
# l'a appliquée, amg_app ne doit plus avoir INSERT sur le journal, et amg_journal doit l'avoir.
JOURNAL_ROLE_MIGRATION=20261127120000_journal_role
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
[ -r "$ROLES_SQL" ] || {
  echo "$ROLES_SQL illisible (AMG_ROLES_SQL)" >&2
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

WORK=$(mktemp -d) # table des matières et empreintes du flux (aucune donnée)
cleanup() {
  rm -rf "$WORK"
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

# Même procédure que la restauration de production (restore-gate.sh, EXPLOITATION.md §11) :
# base neuve, roles.sql, déclencheurs d'événement du journal désactivés dans cette base, fenêtre
# d'amg_migrator, pg_restore connecté directement en amg_migrator avec la liste filtrée, fenêtre
# refermée, rejeu de roles.sql, vérification du journal, puis bascule par renommage. Toutes les
# lectures de tables se font sous amg_migrator (propriétaire) ou amg_app, jamais sous amg, qui ne
# lit que des catalogues (chemin épinglé, psql -X).
as_role() { # $1 rôle, $2 base, puis arguments de psql (entrée : fichier SQL ou /dev/null)
  local role=$1 db=$2
  shift 2
  docker exec -i -e PGOPTIONS="$AMG_PG_ADMIN_OPTIONS" "$PG_CONTAINER" \
    psql -X -v ON_ERROR_STOP=1 -U "$role" -d "$db" -At "$@"
}
admin_q() { as_role amg "$1" -c "$2" </dev/null; }
migrator_q() { as_role amg_migrator "$NEW_DB" -c "$1" </dev/null; }
stream() { # flux pg_dump du snapshot, déchiffré en mémoire (lu deux fois : aucune copie en clair)
  restic dump "$snap_id" /backup/db/amg-prod.dump.age </dev/null | age -d -i <(printf '%s\n' "$AGE_IDENTITY")
}
close_window() {
  admin_q postgres 'ALTER ROLE amg_migrator NOLOGIN' >/dev/null
  admin_q postgres "select pg_catalog.count(pg_catalog.pg_terminate_backend(a.pid)) from pg_catalog.pg_stat_activity a where a.usename OPERATOR(pg_catalog.=) 'amg_migrator'" >/dev/null
}

log "base neuve $NEW_DB, rôles et garde du journal ($ROLES_SQL)"
admin_q postgres "CREATE DATABASE $NEW_DB TEMPLATE template0" >/dev/null
as_role amg "$NEW_DB" <"$ROLES_SQL" >/dev/null
admin_q "$NEW_DB" 'ALTER EVENT TRIGGER amg_guard_security_events DISABLE' >/dev/null
admin_q "$NEW_DB" 'ALTER EVENT TRIGGER amg_guard_security_events_drop DISABLE' >/dev/null

log "table des matières (premier passage du flux) et liste filtrée"
stream | tee -p >(sha256sum | cut -d' ' -f1 >"$WORK/list.sum") \
  | docker exec -i "$PG_CONTAINER" pg_restore -l >"$WORK/list.raw"
amg_restore_list_filter <"$WORK/list.raw" >"$WORK/list" 2> >(sed 's/^/  /' >&2)
docker exec -i "$PG_CONTAINER" tee /tmp/amg-restore.list <"$WORK/list" >/dev/null
log "objets à restaurer : $(grep -c '^[0-9]' "$WORK/list")"

log "restauration en amg_migrator (second passage du flux, une seule transaction)"
admin_q postgres 'ALTER ROLE amg_migrator LOGIN' >/dev/null
stream | tee >(sha256sum | cut -d' ' -f1 >"$WORK/restore.sum") \
  | docker exec -i -e PGOPTIONS="$AMG_PG_ADMIN_OPTIONS -c idle_in_transaction_session_timeout=10min -c statement_timeout=30min" \
    "$PG_CONTAINER" pg_restore -U amg_migrator -d "$NEW_DB" --no-owner --single-transaction --exit-on-error \
    -L /tmp/amg-restore.list
for _ in 1 2 3 4 5; do [ -s "$WORK/restore.sum" ] && [ -s "$WORK/list.sum" ] && break; sleep 1; done
[ "$(cat "$WORK/restore.sum")" = "$(cat "$WORK/list.sum")" ] || {
  log "les deux passages du flux diffèrent"
  false
}
AGE_IDENTITY=''

# Contrôles sous amg_migrator, fenêtre encore ouverte : tables, dernière migration, lignes.
tables=$(migrator_q "select pg_catalog.count(*) from pg_catalog.pg_tables where schemaname OPERATOR(pg_catalog.=) 'public'")
log "tables restaurées dans public : $tables (minimum attendu : $MIN_TABLES)"
[ "$tables" -ge "$MIN_TABLES" ] || {
  log "trop peu de tables"
  false
}
if [ "$(migrator_q "select pg_catalog.to_regclass('public._prisma_migrations') is not null")" = t ]; then
  log "dernière migration Prisma : $(migrator_q "select pg_catalog.concat(m.migration_name, ' (', m.finished_at, ')') from public._prisma_migrations m where m.finished_at is not null order by m.finished_at desc limit 1")"
  unfinished=$(migrator_q "select pg_catalog.count(*) from public._prisma_migrations m where m.finished_at is null and m.rolled_back_at is null")
  [ "$unfinished" = 0 ] || {
    log "migration Prisma inachevée dans la sauvegarde"
    false
  }
  journal_expected=$(migrator_q "select exists (select from public._prisma_migrations m where m.migration_name OPERATOR(pg_catalog.=) '$JOURNAL_MIGRATION' and m.finished_at is not null)")
  journal_role_expected=$(migrator_q "select exists (select from public._prisma_migrations m where m.migration_name OPERATOR(pg_catalog.=) '$JOURNAL_ROLE_MIGRATION' and m.finished_at is not null)")
else
  journal_expected=f
  journal_role_expected=f
fi
if [ "$tables" -gt 0 ]; then
  migrator_q 'analyze' >/dev/null
  log "lignes par table :"
  migrator_q "select pg_catalog.concat(s.schemaname, '.', s.relname, ' : ', s.n_live_tup) from pg_catalog.pg_stat_user_tables s order by s.schemaname, s.relname" \
    | sed 's/^/  /'
fi

log "fenêtre refermée, rejeu de roles.sql (déclencheurs réactivés, journal vérifié et scellé)"
close_window
as_role amg "$NEW_DB" <"$ROLES_SQL" >/dev/null
violation=$(admin_q "$NEW_DB" "$AMG_JOURNAL_CHECK_SQL")
[ -z "$violation" ] || {
  log "journal de sécurité restauré non conforme : $violation"
  false
}
if [ "$journal_expected" = t ]; then
  sealed=$(admin_q "$NEW_DB" "select pg_catalog.to_regclass('public.security_events') is not null and exists (select from amg_guard.journal_sealed)")
  [ "$sealed" = t ] || {
    log "journal de sécurité absent ou non scellé alors que la sauvegarde a appliqué $JOURNAL_MIGRATION"
    false
  }
  log "journal de sécurité présent et scellé"
fi
# Droits d'amg_app : catalogues seulement (has_table_privilege ne lit aucune table).
bad_grants=$(admin_q "$NEW_DB" "select pg_catalog.count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid OPERATOR(pg_catalog.=) c.relnamespace where n.nspname OPERATOR(pg_catalog.=) 'public' and c.relkind OPERATOR(pg_catalog.=) ANY (ARRAY['r','p','v','m']::\"char\"[]) and (pg_catalog.has_table_privilege('amg_app', c.oid, 'TRUNCATE, REFERENCES, TRIGGER') or (c.relname OPERATOR(pg_catalog.=) '_prisma_migrations' and pg_catalog.has_table_privilege('amg_app', c.oid, 'SELECT, INSERT, UPDATE, DELETE')))")
[ "$bad_grants" = 0 ] || {
  log "amg_app a des droits en trop sur $bad_grants table(s) restaurée(s)"
  false
}
# Droits d'amg_journal (CRM 3, lot 3), catalogues seulement : rien sur les autres relations de public,
# et sur le journal ni UPDATE, ni DELETE, ni TRUNCATE, ni REFERENCES, ni TRIGGER (SELECT et INSERT
# seuls, accordés par la migration 20261127120000_journal_role ; aucun droit avant elle).
bad_journal_grants=$(admin_q "$NEW_DB" "select pg_catalog.count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid OPERATOR(pg_catalog.=) c.relnamespace where n.nspname OPERATOR(pg_catalog.=) 'public' and c.relkind OPERATOR(pg_catalog.=) ANY (ARRAY['r','p','v','m','S','f']::\"char\"[]) and case when c.relkind OPERATOR(pg_catalog.=) 'S' then pg_catalog.has_sequence_privilege('amg_journal', c.oid, 'USAGE, SELECT, UPDATE') when c.relname OPERATOR(pg_catalog.=) 'security_events' then pg_catalog.has_table_privilege('amg_journal', c.oid, 'UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') else pg_catalog.has_table_privilege('amg_journal', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') end")
[ "$bad_journal_grants" = 0 ] || {
  log "amg_journal a des droits en trop sur $bad_journal_grants relation(s) restaurée(s)"
  false
}
# Écrivain du journal, lu explicitement (en plus de l'état stabilisé ci-dessus) : après la migration
# du rôle du journal, amg_app n'écrit plus le journal et amg_journal l'écrit.
if [ "$journal_role_expected" = t ]; then
  writers=$(admin_q "$NEW_DB" "select pg_catalog.concat(pg_catalog.has_table_privilege('amg_app', 'public.security_events', 'INSERT'), ' ', pg_catalog.has_table_privilege('amg_journal', 'public.security_events', 'INSERT'))")
  [ "$writers" = 'f t' ] || {
    log "écrivain du journal faux après $JOURNAL_ROLE_MIGRATION (INSERT amg_app, amg_journal : $writers ; attendu f t)"
    false
  }
  log "journal : amg_journal seul écrivain, amg_app en lecture seule"
fi
if [ "$(admin_q "$NEW_DB" "select pg_catalog.to_regclass('public.security_events') is not null")" = t ]; then
  # Empreinte du journal sous amg_app (jamais sous amg) : à comparer, lors d'un incident, à celle de
  # la base d'origine (EXPLOITATION.md §11).
  log "empreinte du journal (amg_app) : $(as_role amg_app "$NEW_DB" -c "select pg_catalog.concat(pg_catalog.count(*), ' ', (pg_catalog.array_agg(e.id order by e.id desc))[1], ' ', pg_catalog.md5(pg_catalog.string_agg(pg_catalog.format('%s', e), E'\n' order by e.id))) from public.security_events e" </dev/null)"
fi

log "bascule par renommage (comme en production)"
admin_q postgres "ALTER DATABASE amg RENAME TO amg_vide; ALTER DATABASE $NEW_DB RENAME TO amg" >/dev/null
violation=$(admin_q amg "$AMG_JOURNAL_CHECK_SQL")
[ -z "$violation" ] || {
  log "journal non conforme après la bascule : $violation"
  false
}

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
