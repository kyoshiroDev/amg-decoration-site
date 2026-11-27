#!/usr/bin/env bash
# Contrôle des images de l'API en CI (deploy.yml, job `build-api`), avant toute publication :
#   - API : sans shell, utilisateur 65532, sonde de santé déclarée, sans le CLI Prisma ni son arbre
#     (prisma, effect, @prisma/{config,dev,engines,studio-core} : ADR-0023), client Prisma présent ;
#   - migrations : sans shell, moteur de schéma présent, label org.amg.roles-sql.sha256 égal à
#     l'empreinte de libs/api/db/sql/roles.sql (deploy.sh le compare au fichier installé) ;
#   - sur un PostgreSQL réel (service du job, même digest que la production) : rôles, `prisma migrate
#     deploy` par l'image des migrations sous amg_migrator (secret 640 groupe 65532, racine en
#     lecture seule, aucune capacité, 192 Mio), rejeu sans effet, journal conforme ; puis l'API sous
#     amg_app avec les contraintes de production : saine, /api/health en 200, HSTS posé (200 et
#     404), drainage effectif.
# Variables : API_IMAGE_REF, MIGRATE_IMAGE_REF (image:tag chargées localement), PG_CONTAINER (id du
# service postgres), PG_DB (base du service).
set -Eeuo pipefail

: "${API_IMAGE_REF:?}" "${MIGRATE_IMAGE_REF:?}" "${PG_CONTAINER:?}" "${PG_DB:?}"
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
for absent in prisma effect @prisma/config @prisma/dev @prisma/engines @prisma/studio-core .bin; do
  ! grep -q "^app/node_modules/$absent/" "$WORK/api.files" || fail "image de l'API : node_modules/$absent présent"
done
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
# Comme sur le serveur : propriétaire le compte courant, groupe 65532 (utilisateur des images), 640.
sudo chown "$(id -u):65532" "$WORK/pg_migrator_password" "$WORK/pg_app_password"
chmod 640 "$WORK/pg_migrator_password" "$WORK/pg_app_password"
migrate() {
  docker run --rm --network host --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
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

echo "== API (amg_app, contraintes de production)"
docker run -d --name "$API_CONTAINER" --network host --read-only --tmpfs /tmp:size=8m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true --memory 160m --memory-swap 160m \
  --pids-limit 128 --user 65532:65532 \
  -e NODE_ENV=production -e AMG_ENV=staging -e HOST=127.0.0.1 -e PORT=3000 \
  -e DB_HOST=127.0.0.1 -e DB_PORT=5432 -e DB_NAME="$PG_DB" -e DB_USER=amg_app \
  -e DB_PASSWORD_FILE=/run/secrets/pg_app_password \
  -v "$WORK/pg_app_password:/run/secrets/pg_app_password:ro" "$API_IMAGE_REF" >/dev/null
health() { docker inspect -f '{{.State.Health.Status}}' "$API_CONTAINER"; }
for _ in $(seq 60); do [ "$(health)" = healthy ] && break; sleep 1; done
[ "$(health)" = healthy ] || { docker logs "$API_CONTAINER" >&2; fail "API : pas saine en 60 s"; }
body=$(curl -fsS http://127.0.0.1:3000/api/health)
[ "$body" = '{"status":"ok"}' ] || fail "API : /api/health a répondu $body"
# HSTS posé par l'API elle-même (rien ne le pose devant elle, ADR-0020), succès comme erreurs.
for path in /api/health /api/inconnue; do
  curl -sS -o /dev/null -D - "http://127.0.0.1:3000$path" | tr -d '\r' \
    | grep -qix 'strict-transport-security: max-age=63072000; includeSubDomains' \
    || fail "API : $path sans Strict-Transport-Security"
done
! docker exec "$API_CONTAINER" sh -c true 2>/dev/null || fail "API : un shell est disponible dans le conteneur"
docker stats --no-stream --format 'mémoire de l’API au repos : {{.MemUsage}}' "$API_CONTAINER"
docker exec "$API_CONTAINER" /nodejs/bin/node /app/apps/api/dist/healthcheck.js drain
for _ in $(seq 30); do [ "$(health)" = unhealthy ] && break; sleep 1; done
[ "$(health)" = unhealthy ] || fail "API : drainage sans effet sur la sonde"
echo "images de l'API conformes"
