#!/usr/bin/env bash
# Modèle de configuration Redis du serveur (deploy/env/redis.conf.example) éprouvé sur l'image du
# serveur, au digest de deploy/compose.yaml, lancée comme sur le serveur (configuration lue sur
# l'entrée standard après setpriv, racine en lecture seule, capacités réduites). Lancé par ci.yml
# (job « Budget mémoire AMG ») ; jamais sur le poste (Docker requis) ni sur le serveur.
# Vérifie : le fichier rempli est accepté par Redis ; `default` désactivé (NOAUTH sans
# authentification, connexion refusée sous default) ; amg_api authentifié par l'empreinte SHA-256
# de son mot de passe, limité aux clés amg:<env>:* (y compris dans un script), sans commande
# d'administration ; aucun fichier de persistance écrit dans /data.
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
MODEL=$ROOT/deploy/env/redis.conf.example
IMAGE=$(grep -Eo 'redis:[0-9A-Za-z._-]+@sha256:[0-9a-f]{64}' "$ROOT/deploy/compose.yaml" | sort -u)
[ "$(wc -l <<<"$IMAGE")" = 1 ] || { echo "::error::image redis introuvable ou multiple dans deploy/compose.yaml" >&2; exit 1; }
ENV_NAME=staging
NAME=amg-redis-conf-check-$$
WORK=$(mktemp -d)
cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf -- "$WORK"
}
trap cleanup EXIT

fail() {
  echo "::error::redis.conf.example : $*" >&2
  docker logs "$NAME" >&2 2>&1 || true
  exit 1
}

# Mot de passe jetable, propre à ce contrôle (jamais réutilisé) ; seule son empreinte va dans le fichier.
password=$(openssl rand -base64 32 | tr -d '\n')
hash=$(printf '%s' "$password" | sha256sum | cut -d' ' -f1)
sed -e "s/<ENV>/$ENV_NAME/g" -e "s/<EMPREINTE_SHA256>/$hash/" -e "s/<MAXMEMORY>/48mb/" "$MODEL" >"$WORK/redis.conf"
! grep -v '^#' "$WORK/redis.conf" | grep -q '<' || fail "repère non remplacé après remplissage"
chmod 644 "$WORK/redis.conf"

docker run -d --name "$NAME" --read-only --cap-drop ALL --cap-add SETGID --cap-add SETUID --cap-add DAC_OVERRIDE \
  --security-opt no-new-privileges:true --memory 64m --memory-swap 64m --network none \
  --tmpfs /data:size=8m,mode=0777 -v "$WORK/redis.conf:/run/secrets/redis_conf:ro" \
  --entrypoint /bin/sh "$IMAGE" \
  -c 'exec /bin/setpriv --reuid redis --regid redis --clear-groups redis-server - < /run/secrets/redis_conf' >/dev/null

anon() { docker exec "$NAME" redis-cli -h 127.0.0.1 "$@" 2>&1 || true; }
api() { docker exec -e REDISCLI_AUTH="$password" "$NAME" redis-cli -h 127.0.0.1 --user amg_api "$@" 2>&1 || true; }

for _ in $(seq 30); do
  [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = true ] || fail "Redis s'est arrêté (configuration refusée ?)"
  grep -q NOAUTH <<<"$(anon ping)" && break
  sleep 1
done
grep -q NOAUTH <<<"$(anon ping)" || fail "PING sans authentification : NOAUTH attendu ($(anon ping))"
out=$(docker exec -e REDISCLI_AUTH=x "$NAME" redis-cli -h 127.0.0.1 --user default ping 2>&1 || true)
! grep -q PONG <<<"$out" || fail "connexion acceptée sous default"
[ "$(api ping)" != PONG ] || fail "PING permis à amg_api (hors de sa liste de commandes)"

[ "$(api set "amg:$ENV_NAME:once:x" 1 PX 60000 NX)" = OK ] || fail "SET dans le préfixe refusé à amg_api"
[ "$(api get "amg:$ENV_NAME:once:x")" = 1 ] || fail "GET dans le préfixe refusé à amg_api"
[ "$(api eval "return redis.call('INCR', KEYS[1])" 1 "amg:$ENV_NAME:rl:x")" = 1 ] || fail "EVAL (INCR) dans le préfixe refusé"
for denied in "get amg:prod:x" "set autre:x 1" "config get maxmemory" "keys *" "info" "flushall" "acl list" \
  "client list" "select 1" "scan 0" "debug sleep 0" "module list"; do
  read -r -a args <<<"$denied" # découpage sans expansion de motifs (« keys * »)
  # NOPERM (ACL), ou « not allowed » pour DEBUG et MODULE (enable-*-command no, contrôlé avant l'ACL).
  grep -qE 'NOPERM|not allowed' <<<"$(api "${args[@]}")" || fail "« $denied » permis à amg_api"
done
grep -q NOPERM <<<"$(api eval "return redis.call('GET', KEYS[1])" 1 "amg:prod:x")" \
  || fail "clé hors du préfixe lue par un script"
grep -q NOPERM <<<"$(api eval "return redis.call('KEYS', '*')" 0)" || fail "KEYS permis dans un script"
grep -q NOPERM <<<"$(api publish amg:$ENV_NAME:c 1)" || fail "canal permis à amg_api"

files=$(docker exec "$NAME" ls -A /data)
[ -z "$files" ] || fail "fichiers de persistance écrits dans /data : $files"
echo "redis.conf.example accepté par $IMAGE : default désactivé, amg_api limité à amg:$ENV_NAME:*, sans persistance"
