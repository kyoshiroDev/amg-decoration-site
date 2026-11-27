#!/usr/bin/env bash
# Contrôle des images de l'API en CI (deploy.yml, job `build-api`), avant toute publication :
#   - API : sans shell, utilisateur 65532, sonde de santé déclarée, sans le CLI Prisma ni son arbre
#     (prisma, effect, @prisma/{config,dev,engines,studio-core} : ADR-0023), client Prisma présent ;
#   - migrations : sans shell, moteur de schéma présent, label org.amg.roles-sql.sha256 égal à
#     l'empreinte de libs/api/db/sql/roles.sql (deploy.sh le compare au fichier installé) ;
#   - sur un PostgreSQL réel (service du job, même digest que la production) : rôles, `prisma migrate
#     deploy` par l'image des migrations sous amg_migrator (secret 640 groupe 65532, racine en
#     lecture seule, aucune capacité, 192 Mio), rejeu sans effet, journal conforme ; puis la base
#     migrée passe le filtre de restauration ; puis l'API sous amg_app et amg_journal, sur Redis
#     (utilisateur ACL de l'API), avec les contraintes de production : saine, /api/health en 200,
#     404 et 401 génériques, HSTS posé (200, 404 et 401), drainage effectif.
# Variables : API_IMAGE_REF, MIGRATE_IMAGE_REF (image:tag chargées localement), PG_CONTAINER (id du
# service postgres), PG_DB (base du service), REDIS_CONTAINER (id du service redis).
set -Eeuo pipefail

: "${API_IMAGE_REF:?}" "${MIGRATE_IMAGE_REF:?}" "${PG_CONTAINER:?}" "${PG_DB:?}" "${REDIS_CONTAINER:?}"
ROLES_SQL=libs/api/db/sql/roles.sql
WORK=$(mktemp -d)
API_CONTAINER=amg-api-check
cleanup() {
  docker rm -f "$API_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
  echo "::error::$*"
  exit 1
}

# Fichiers d'une image (sans la démarrer).
image_files() { # $1 image, $2 fichier de sortie
  local id
  id=$(docker create "$1")
  docker export "$id" | tar -t >"$2"
  docker rm "$id" >/dev/null
}

echo "== image de l'API : contenu"
image_files "$API_IMAGE_REF" "$WORK/api.files"
# /bin peut être un lien vers usr/bin (usr fusionné) : les deux emplacements sont cherchés.
for forbidden in bin/sh bin/bash bin/dash bin/busybox usr/bin/sh usr/bin/bash usr/bin/dash usr/bin/busybox usr/bin/apt; do
  ! grep -qx "$forbidden" "$WORK/api.files" || fail "image de l'API : $forbidden présent"
done
# Copies imbriquées comprises (node_modules/<paquet>/node_modules/…).
if grep -E '(^|/)node_modules/(prisma|effect|@prisma/(config|dev|engines|studio-core)|\.bin)/' "$WORK/api.files" >"$WORK/forbidden"; then
  head -n 5 "$WORK/forbidden" >&2
  fail "image de l'API : CLI Prisma, effect ou .bin présents"
fi
for present in app/apps/api/dist/main.js app/apps/api/dist/healthcheck.js \
  app/libs/api/db/dist/generated/prisma/client.js app/node_modules/@prisma/client/package.json \
  app/node_modules/@prisma/adapter-pg/package.json; do
  grep -qx "$present" "$WORK/api.files" || fail "image de l'API : $present absent"
done
[ "$(docker image inspect -f '{{.Config.User}}' "$API_IMAGE_REF")" = 65532:65532 ] || fail "image de l'API : utilisateur non 65532"
[ -n "$(docker image inspect -f '{{if .Config.Healthcheck}}{{.Config.Healthcheck.Test}}{{end}}' "$API_IMAGE_REF")" ] \
  || fail "image de l'API : HEALTHCHECK absent"
echo "$(grep -c '^app/node_modules/.*/package.json$' "$WORK/api.files") package.json sous node_modules"

echo "== image des migrations : contenu et label"
image_files "$MIGRATE_IMAGE_REF" "$WORK/migrate.files"
! grep -qxE '(usr/)?bin/(sh|bash|dash|busybox)' "$WORK/migrate.files" || fail "image des migrations : shell présent"
grep -qx 'app/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x' "$WORK/migrate.files" \
  || fail "image des migrations : moteur de schéma absent"
want=$(sha256sum "$ROLES_SQL" | cut -d' ' -f1)
have=$(docker image inspect -f '{{index .Config.Labels "org.amg.roles-sql.sha256"}}' "$MIGRATE_IMAGE_REF")
[ "$have" = "$want" ] || fail "label org.amg.roles-sql.sha256 ($have) différent de $ROLES_SQL ($want)"

echo "== migrations sur PostgreSQL réel"
admin() { docker exec -i -e PGOPTIONS='-c search_path=pg_catalog,pg_temp' "$PG_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U amg -d "$PG_DB" -At "$@"; }
admin <"$ROLES_SQL" >/dev/null
# Mots de passe publics de développement (fenêtre ouverte, comme en CI d'intégration).
admin <libs/api/db/sql/dev/passwords.sql >/dev/null
printf '%s' dev-only-amg-migrator-password-public >"$WORK/pg_migrator_password"
printf '%s' dev-only-amg-app-password-not-secret >"$WORK/pg_app_password"
printf '%s' dev-only-amg-journal-password-public >"$WORK/pg_journal_password"
# Utilisateur ACL Redis de l'API (mot de passe public de ce service jetable), environnement staging.
printf '%s' ci-only-redis-password-public-0123456789 >"$WORK/redis_password"
.github/scripts/redis-acl-ci.sh "$REDIS_CONTAINER" staging amg_api "$(cat "$WORK/redis_password")"
# Comme sur le serveur : propriétaire le compte courant, groupe 65532 (utilisateur des images), 640.
SECRETS=("$WORK/pg_migrator_password" "$WORK/pg_app_password" "$WORK/pg_journal_password" "$WORK/redis_password")
sudo chown "$(id -u):65532" "${SECRETS[@]}"
chmod 640 "${SECRETS[@]}"
migrate() {
  docker run --rm --network host --read-only --tmpfs /tmp:rw,noexec,nosuid,nodev,size=32m \
    --cap-drop ALL --security-opt no-new-privileges:true --memory 192m --memory-swap 192m \
    --pids-limit 64 --user 65532:65532 \
    -e DB_HOST=127.0.0.1 -e DB_PORT=5432 -e DB_NAME="$PG_DB" -e DB_USER=amg_migrator \
    -e DB_PASSWORD_FILE=/run/secrets/pg_migrator_password \
    -v "$WORK/pg_migrator_password:/run/secrets/pg_migrator_password:ro" "$MIGRATE_IMAGE_REF"
}
migrate
migrate # rejeu : aucune migration en attente
admin -c 'ALTER ROLE amg_migrator NOLOGIN' </dev/null >/dev/null
admin <"$ROLES_SQL" >/dev/null
violation=$(admin -c 'select amg_guard.security_events_violation()' </dev/null)
[ -z "$violation" ] || fail "journal de sécurité non conforme après migration : $violation"
tables=$(admin -c "select pg_catalog.count(*) from pg_catalog.pg_tables where schemaname OPERATOR(pg_catalog.=) 'public'" </dev/null)
[ "$tables" -ge 7 ] || fail "migrations : $tables tables dans public (7 attendues au moins)"
# La base migrée doit passer le filtre de restauration (mêmes options de pg_dump que backup.sh) :
# un type d'objet refusé se découvre ici, pas en pleine restauration d'incident.
docker exec "$PG_CONTAINER" pg_dump -U amg -d "$PG_DB" --format=custom --no-owner \
  | docker exec -i "$PG_CONTAINER" pg_restore -l >"$WORK/restore.list"
# shellcheck source=deploy/bin/amg-common.sh
(source deploy/bin/amg-common.sh && amg_restore_list_filter <"$WORK/restore.list" >"$WORK/restore.kept" 2>"$WORK/restore.err") \
  || { cat "$WORK/restore.err" >&2; fail "la base migrée ne passe pas le filtre de restauration (amg_restore_list_filter)"; }
echo "liste de restauration : $(grep -c '^[0-9]' "$WORK/restore.kept") objets gardés"

echo "== API (amg_app, amg_journal, Redis, contraintes de production)"
docker run -d --name "$API_CONTAINER" --network host --read-only --tmpfs /tmp:size=8m,mode=1777,noexec,nosuid,nodev \
  --cap-drop ALL --security-opt no-new-privileges:true --memory 160m --memory-swap 160m \
  --pids-limit 128 --user 65532:65532 \
  -e NODE_ENV=production -e AMG_ENV=staging -e HOST=127.0.0.1 -e PORT=3000 \
  -e DB_HOST=127.0.0.1 -e DB_PORT=5432 -e DB_NAME="$PG_DB" -e DB_USER=amg_app \
  -e DB_PASSWORD_FILE=/run/secrets/pg_app_password \
  -e DB_JOURNAL_USER=amg_journal -e DB_JOURNAL_PASSWORD_FILE=/run/secrets/pg_journal_password \
  -e ADMIN_ORIGIN=https://admin.example.test -e CLIENT_ORIGIN=https://espace.example.test \
  -e TRUSTED_PROXY=127.0.0.1 \
  -e REDIS_HOST=127.0.0.1 -e REDIS_PORT=6379 -e REDIS_USER=amg_api \
  -e REDIS_PASSWORD_FILE=/run/secrets/redis_password \
  -v "$WORK/pg_app_password:/run/secrets/pg_app_password:ro" \
  -v "$WORK/pg_journal_password:/run/secrets/pg_journal_password:ro" \
  -v "$WORK/redis_password:/run/secrets/redis_password:ro" "$API_IMAGE_REF" >/dev/null
health() { docker inspect -f '{{.State.Health.Status}}' "$API_CONTAINER"; }
for _ in $(seq 60); do [ "$(health)" = healthy ] && break; sleep 1; done
[ "$(health)" = healthy ] || { docker logs "$API_CONTAINER" >&2; fail "API : pas saine en 60 s"; }
body=$(curl -fsS http://127.0.0.1:3000/api/health)
[ "$body" = '{"status":"ok"}' ] || fail "API : /api/health a répondu $body"
# Gardes et Redis en service : route inconnue 404, route admin sans session 401 (et non 503 :
# Redis joint sous l'utilisateur ACL, limitation de débit comprise). Connexion à Redis lancée en
# arrière-plan au démarrage : quelques secondes au plus.
status() { curl -sS -o /dev/null -w '%{http_code}' -H "Host: $1" "http://127.0.0.1:3000$2"; }
for _ in $(seq 20); do [ "$(status admin.example.test /api/inconnue)" = 404 ] && break; sleep 1; done
[ "$(status admin.example.test /api/inconnue)" = 404 ] || { docker logs "$API_CONTAINER" >&2; fail "API : /api/inconnue n'a pas répondu 404 (Redis ?)"; }
[ "$(status admin.example.test /api/admin/session)" = 401 ] || fail "API : /api/admin/session sans session n'a pas répondu 401"
[ "$(status espace.example.test /api/admin/session)" = 404 ] || fail "API : route admin servie sur l'hôte espace"
# HSTS posé par l'API elle-même (rien ne le pose devant elle, ADR-0020), succès comme erreurs.
for path in /api/health /api/inconnue /api/admin/session; do
  curl -sS -o /dev/null -D - -H 'Host: admin.example.test' "http://127.0.0.1:3000$path" | tr -d '\r' \
    | grep -qix 'strict-transport-security: max-age=63072000; includeSubDomains' \
    || fail "API : $path sans Strict-Transport-Security"
done
! docker exec "$API_CONTAINER" sh -c true 2>/dev/null || fail "API : un shell est disponible dans le conteneur"
docker stats --no-stream --format 'mémoire de l’API au repos : {{.MemUsage}}' "$API_CONTAINER"
docker exec "$API_CONTAINER" /nodejs/bin/node /app/apps/api/dist/healthcheck.js drain
for _ in $(seq 30); do [ "$(health)" = unhealthy ] && break; sleep 1; done
[ "$(health)" = unhealthy ] || fail "API : drainage sans effet sur la sonde"
echo "images de l'API conformes"
