#!/usr/bin/env bash
# Déploiement sans coupure d'un service web AMG. Une version = un digest d'image immuable
# (sha256:<64 hex>) publié sur GHCR par la CI ; jamais un tag, qui peut être republié.
#   deploy.sh <prod|staging> deploy sha256:<64 hex> : met en ligne la version demandée
#   deploy.sh <prod|staging> rollback               : revient à la version précédente (une commande)
#   deploy.sh <prod|staging> status                 : version en ligne, historique, état des conteneurs
# Principe (même idée que docker-rollout) : démarrer une 2e réplique sur la nouvelle image, attendre
# qu'elle soit « healthy » (Traefik ignore les conteneurs non sains), drainer l'ancienne, la retirer.
# En cas d'échec, la nouvelle réplique est supprimée et l'ancienne n'a jamais cessé de servir.
# Refus de déployer si la slice systemd amg.slice (plafond mémoire commun de tout AMG, 4 Gio,
# deploy/systemd/amg.slice) n'est pas installée avec ses limites, ou si la nouvelle réplique n'y est pas.
# Lancé par deploy-gate.sh (environnement vidé) ou par l'humain avec le compte de déploiement.
set -euo pipefail

ENV_NAME=${1:?environnement (prod|staging)}
ACTION=${2:?action (deploy|rollback|status)}
SERVICE=site
case "$ENV_NAME" in
  prod | staging) ;;
  *)
    echo "environnement inconnu : $ENV_NAME" >&2
    exit 2
    ;;
esac

AMG_ROOT=${AMG_ROOT:-/opt/amg}
AMG_DIR=$AMG_ROOT/$ENV_NAME
COMPOSE_DIR=$AMG_DIR/compose # installé par l'humain après relecture (EXPLOITATION.md, 3.3), jamais de secret
ENV_FILE=$AMG_DIR/amg.env
HISTORY=$AMG_DIR/releases.log # une ligne par mise en ligne : date digest commit
FILES=(-f "$COMPOSE_DIR/compose.yaml")
if [ "$ENV_NAME" = staging ]; then FILES+=(-f "$COMPOSE_DIR/compose.staging.yaml"); fi
compose() { docker compose -p "amg-$ENV_NAME" --env-file "$ENV_FILE" "${FILES[@]}" "$@"; }

HEALTH_TIMEOUT=90 # s, attente de « healthy » de la nouvelle réplique
DRAIN_WAIT=15     # s, > intervalle × essais du HEALTHCHECK (5 s × 2) + requêtes en cours
DIGEST_RE='^sha256:[0-9a-f]{64}$'
SLICE=amg.slice
SLICE_MAX_BYTES=$((4 * 1024 * 1024 * 1024)) # budget AMG (ADR-0020) : jamais plus de 4 Gio

log() { printf '%s [%s] %s\n' "$(date -Is)" "$ENV_NAME" "$*"; }

env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }
current_digest() { env_value SITE_DIGEST; }

set_digest() { # écrit le digest dans amg.env : un redémarrage du serveur relance la même version
  local tmp
  tmp=$(mktemp "$AMG_DIR/.amg.env.XXXXXX")
  sed "s/^SITE_DIGEST=.*/SITE_DIGEST=$1/" "$ENV_FILE" >"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

wait_healthy() { # $1 identifiant de conteneur
  local status deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ $SECONDS -lt $deadline ]; do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo absent)
    [ "$status" = healthy ] && return 0
    [ "$status" = unhealthy ] && return 1
    sleep 2
  done
  return 1
}

# La slice doit venir de son fichier d'unité (sans lui, systemd la créerait à la volée SANS limite),
# avec MemoryMax <= 4 Gio et sans swap. Lecture seule, sans sudo.
check_slice() {
  local props load fragment max swap
  props=$(systemctl show "$SLICE" -p LoadState -p FragmentPath -p MemoryMax -p MemorySwapMax 2>/dev/null) || props=''
  load=$(sed -n 's/^LoadState=//p' <<<"$props")
  fragment=$(sed -n 's/^FragmentPath=//p' <<<"$props")
  max=$(sed -n 's/^MemoryMax=//p' <<<"$props")
  swap=$(sed -n 's/^MemorySwapMax=//p' <<<"$props")
  if [ "$load" != loaded ] || [ -z "$fragment" ]; then
    log "REFUS : slice $SLICE absente ou sans fichier d'unité (LoadState=${load:-?}, FragmentPath=${fragment:-aucun}) : l'installer d'abord (EXPLOITATION.md, 9, étape 1)"
    return 1
  fi
  if ! [[ "$max" =~ ^[0-9]+$ ]] || [ "$max" -gt "$SLICE_MAX_BYTES" ]; then
    log "REFUS : $SLICE MemoryMax=${max:-?} (attendu <= $SLICE_MAX_BYTES octets)"
    return 1
  fi
  if [ "$swap" != 0 ]; then
    log "REFUS : $SLICE MemorySwapMax=${swap:-?} (attendu 0)"
    return 1
  fi
}

in_slice() { # $1 identifiant de conteneur
  [ "$(docker inspect -f '{{.HostConfig.CgroupParent}}' "$1" 2>/dev/null)" = "$SLICE" ]
}

image_labels_safe() { # $1 image@digest ; clés sorties en chaînes Go (%q) : une ligne par label
  local keys
  keys=$(docker image inspect -f '{{range $k, $v := .Config.Labels}}{{printf "%q\n" $k}}{{end}}' "$1") \
    || return 1
  # Insensible à la casse, espaces de tête ignorés : aucune variante d'écriture ne passe.
  ! grep -qiE '^"[[:space:]]*traefik' <<<"$keys"
}

rollout() { # $1 digest cible
  local target=$1 previous old new image revision
  previous=$(current_digest)
  image=$(env_value SITE_IMAGE)
  log "pull $image@$target (en ligne : $previous)"
  set_digest "$target"
  if ! compose pull --quiet "$SERVICE"; then
    set_digest "$previous"
    log "ÉCHEC pull"
    return 1
  fi
  # Les labels d'une image sont recopiés sur ses conteneurs, et Traefik lit ceux de tous les
  # conteneurs du serveur : une image qui porte un label traefik.* pourrait ajouter un routeur
  # (hôte du voisin, api@internal…) à côté de ceux de compose.yaml. Nos images n'en portent
  # aucun (les labels Traefik viennent du seul fichier Compose) : refus avant tout démarrage.
  # Inspection impossible = refus. watch.sh contrôle aussi les labels en marche (seconde ligne).
  if ! image_labels_safe "$image@$target"; then
    set_digest "$previous"
    log "REFUS : l'image $image@$target porte des labels Traefik ou n'a pas pu être inspectée, $previous reste en ligne"
    return 1
  fi
  # Commit d'origine (label posé par la CI), pour l'historique seulement : jamais utilisé pour choisir.
  revision=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$image@$target" 2>/dev/null || true)
  [[ "$revision" =~ ^[0-9a-f]{40}$ ]] || revision=-

  old=$(compose ps -q "$SERVICE")
  if [ -z "$old" ]; then # premier démarrage : rien à remplacer
    compose up -d --wait --wait-timeout "$HEALTH_TIMEOUT" "$SERVICE" || {
      set_digest "$previous"
      return 1
    }
    new=$(compose ps -q "$SERVICE")
    if [ -z "$new" ] || ! in_slice "$new"; then
      log "REFUS : conteneur hors de $SLICE (cgroup_parent absent du fichier Compose installé ?), arrêté"
      compose rm -s -f "$SERVICE" >/dev/null || true
      set_digest "$previous"
      return 1
    fi
  else
    if ! compose up -d --no-deps --no-recreate --scale "$SERVICE=2" "$SERVICE"; then
      log "ÉCHEC : impossible de démarrer la nouvelle réplique, retour à $previous (aucune coupure)"
      partial=$(comm -13 <(sort <<<"$old") <(compose ps -aq "$SERVICE" | sort))
      [ -z "$partial" ] || xargs -r docker rm -f <<<"$partial" >/dev/null || true
      set_digest "$previous"
      return 1
    fi
    new=$(comm -13 <(sort <<<"$old") <(compose ps -q "$SERVICE" | sort))
    if [ -n "$new" ] && ! in_slice "$new"; then
      log "REFUS : nouvelle réplique hors de $SLICE (cgroup_parent absent du fichier Compose installé ?), retour à $previous"
      docker rm -f "$new" >/dev/null
      set_digest "$previous"
      return 1
    fi
    if [ -z "$new" ] || ! wait_healthy "$new"; then
      log "ÉCHEC : la nouvelle version n'est pas saine, retour à $previous (aucune coupure)"
      if [ -n "$new" ]; then
        docker logs --tail 50 "$new" >&2 || true
        docker rm -f "$new" >/dev/null
      fi
      set_digest "$previous"
      return 1
    fi
    sleep 3 # laisse Traefik enregistrer la nouvelle réplique
    local -a old_ids
    mapfile -t old_ids <<<"$old"
    for c in "${old_ids[@]}"; do docker exec "$c" touch /tmp/drain || true; done
    sleep "$DRAIN_WAIT"
    docker stop --time 10 "${old_ids[@]}" >/dev/null
    docker rm "${old_ids[@]}" >/dev/null
  fi
  printf '%s %s %s\n' "$(date -Is)" "$target" "$revision" >>"$HISTORY"
  log "en ligne : $target (commit $revision)"
}

# Un seul déploiement à la fois par environnement, donc une seule réplique en surplus : hypothèse
# du budget mémoire (deploy/ci/check-budget.sh). Un futur déploiement de plusieurs services les
# basculera l'un après l'autre sous ce même verrou.
lock() {
  exec 9>"$AMG_DIR/.deploy.lock"
  flock -n 9 || {
    echo "déploiement déjà en cours" >&2
    exit 3
  }
}

case "$ACTION" in
  deploy)
    DIGEST=${3:?digest (sha256:<64 caractères hexadécimaux>)}
    [[ "$DIGEST" =~ $DIGEST_RE ]] || {
      echo "digest refusé : $DIGEST" >&2
      exit 2
    }
    check_slice || exit 5
    lock
    rollout "$DIGEST"
    ;;
  rollback)
    check_slice || exit 5
    lock
    cur=$(current_digest)
    prev=$(awk -v cur="$cur" '$2 != cur { d = $2 } END { print d }' "$HISTORY" 2>/dev/null || true)
    [[ "$prev" =~ $DIGEST_RE ]] || {
      echo "aucune version précédente valide dans $HISTORY" >&2
      exit 4
    }
    log "retour arrière : $cur → $prev"
    rollout "$prev"
    ;;
  status)
    echo "en ligne : $(current_digest)"
    systemctl show "$SLICE" -p LoadState -p MemoryMax -p MemorySwapMax -p MemoryCurrent 2>/dev/null || true
    tail -n 5 "$HISTORY" 2>/dev/null || true
    compose ps --format '{{.Name}}\t{{.Image}}\t{{.Status}}'
    ;;
  *)
    echo "action inconnue : $ACTION" >&2
    exit 2
    ;;
esac
