#!/usr/bin/env bash
# Utilisateur ACL Redis de l'API dans un service Redis jetable de la CI (jobs « API (intégration) »
# et contrôle des images), à l'image des règles attendues sur le serveur (ADR-0023, « Magasin de
# sessions » ; à reprendre par `devops` dans deploy/env/redis.conf) : préfixe de clés de
# l'environnement seulement, aucun canal, et les seules commandes dont l'API a besoin (scripts Lua
# du magasin de sessions et de @fastify/rate-limit compris : l'ACL s'applique aussi dans les
# scripts). L'utilisateur `default` est ensuite désactivé : toute connexion doit s'authentifier.
# Les tests d'intégration éprouvent ces règles (commande manquante : échec ; clé hors préfixe ou
# commande d'administration : NOPERM).
#
# Usage : redis-acl-ci.sh <conteneur redis> <environnement> <utilisateur> <mot de passe public de CI>
set -Eeuo pipefail

container="${1:?conteneur redis attendu}"
env="${2:?environnement attendu (test, staging, prod)}"
user="${3:?utilisateur ACL attendu}"
password="${4:?mot de passe attendu}"

# Commandes de l'API (lot 3) : EVAL/EVALSHA (scripts), commandes appelées par les scripts, SET (anti-
# répétition du journal). Aucune de INFO, CLIENT, PING, SELECT, KEYS, SCAN, CONFIG, FLUSH*.
readonly API_REDIS_COMMANDS=(
  +eval +evalsha
  +hmget +hset +hget +del +exists +pexpireat
  +zadd +zrange +zrem +zcard
  +incr +pexpire +pttl +get +set
)

# Mot de passe PUBLIC, propre à ce service jetable : il peut figurer dans la ligne de commande. Sur
# le serveur, l'utilisateur est déclaré dans le fichier de configuration secret (jamais en argument).
reply=$(docker exec "$container" redis-cli ACL SETUSER "$user" reset on ">${password}" resetkeys \
  resetchannels "~amg:${env}:*" -@all "${API_REDIS_COMMANDS[@]}")
[ "$reply" = OK ] || {
  echo "::error::utilisateur ACL ${user} non créé : ${reply}" >&2
  exit 1
}
docker exec "$container" redis-cli ACL SETUSER default off >/dev/null
echo "Utilisateur ACL ${user} : ~amg:${env}:* et ${#API_REDIS_COMMANDS[@]} commandes ; default désactivé."
