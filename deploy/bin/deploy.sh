#!/usr/bin/env bash
# Déploiement sans coupure d'un service web AMG (site, api). Une version = un digest d'image immuable
# (sha256:<64 hex>) publié sur GHCR par la CI ; jamais un tag, qui peut être republié.
#   deploy.sh <prod|staging> deploy site sha256:<site>                 : met en ligne le site
#   deploy.sh <prod|staging> deploy api sha256:<api> sha256:<migrations> : migrations, puis l'API
#   deploy.sh <prod|staging> rollback <site|api>                        : version précédente (sans migration)
#   deploy.sh <prod|staging> status                                     : versions, historique, conteneurs
# Principe (même idée que docker-rollout) : démarrer une 2e réplique sur la nouvelle image, attendre
# qu'elle soit « healthy » (Traefik ignore les conteneurs non sains), drainer l'ancienne, la retirer.
# En cas d'échec, la nouvelle réplique est supprimée et l'ancienne n'a jamais cessé de servir.
# API : avant toute bascule, fenêtre de migration (docs/EXPLOITATION.md §11) :
#   journal de sécurité conforme (sinon aucune ouverture), roles.sql installé = celui de l'image des
#   migrations (label org.amg.roles-sql.sha256), puis ALTER ROLE amg_migrator LOGIN, `prisma migrate
#   deploy` dans un conteneur ponctuel (amg_run, rôle migrate : réseau de données, secret
#   d'amg_migrator, espace de PID propre), NOLOGIN et pg_terminate_backend (fenêtre refermée par un
#   piège EXIT posé AVANT l'ouverture : même en cas d'échec ou d'interruption), rejeu de roles.sql et
#   vérification du journal sous amg (psql -X, chemin épinglé). Le moindre échec : aucune bascule.
# Refus de déployer si amg.env n'est pas celui de l'environnement (AMG_ENV, AMG_PROJECT), si le
# service n'est pas activé (COMPOSE_PROFILES), si Docker n'utilise pas le pilote cgroup systemd en
# cgroup v2, si les slices systemd AMG (amg.slice : plafond mémoire commun de tout AMG, 3 800 Mio ;
# amg-prod.slice, amg-staging.slice ; deploy/systemd/) ne sont pas installées depuis
# /etc/systemd/system avec leurs limites, ou si la nouvelle réplique n'est pas réellement dans la
# slice de son environnement (scope docker-<id>.scope sous la slice).
# Lancé par deploy-gate.sh (environnement vidé) ou par l'humain avec le compte de déploiement.
set -euo pipefail

ENV_NAME=${1:?environnement (prod|staging)}
ACTION=${2:?action (deploy|rollback|status)}
case "$ENV_NAME" in
  prod | staging) ;;
  *)
    echo "environnement inconnu : $ENV_NAME" >&2
    exit 2
    ;;
esac

AMG_ROOT=${AMG_ROOT:-/opt/amg}
# shellcheck source=deploy/bin/amg-common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/amg-common.sh"
AMG_DIR=$AMG_ROOT/$ENV_NAME
COMPOSE_DIR=$AMG_DIR/compose # installé par l'humain après relecture (EXPLOITATION.md, 3.3), jamais de secret
ENV_FILE=$AMG_DIR/amg.env
ROLES_SQL=$COMPOSE_DIR/roles.sql # rôles et garde du journal, installé avec les fichiers Compose (3.3)
FILES=(-f "$COMPOSE_DIR/compose.yaml")
if [ "$ENV_NAME" = staging ]; then FILES+=(-f "$COMPOSE_DIR/compose.staging.yaml"); fi
compose() { docker compose -p "amg-$ENV_NAME" --env-file "$ENV_FILE" "${FILES[@]}" "$@"; }

HEALTH_TIMEOUT=90 # s, attente de « healthy » de la nouvelle réplique
DRAIN_WAIT=15     # s, > intervalle × essais du HEALTHCHECK (5 s × 2) + requêtes en cours
DIGEST_RE='^sha256:[0-9a-f]{64}$'
SLICE=$(amg_env_slice "$ENV_NAME") # amg-prod.slice ou amg-staging.slice, enfant de amg.slice

log() { printf '%s [%s] %s\n' "$(date -Is)" "$ENV_NAME" "$*"; }

env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }

# Le fichier d'environnement doit être celui de cet environnement : AMG_ENV choisit la slice
# (cgroup_parent: amg-${AMG_ENV}.slice) et AMG_PROJECT le projet Compose. Un amg.env de production
# copié en préproduction (ou l'inverse) placerait les conteneurs dans la mauvaise slice.
[ -r "$ENV_FILE" ] || { echo "REFUS : $ENV_FILE illisible" >&2; exit 2; }
if [ "$(env_value AMG_ENV)" != "$ENV_NAME" ] || [ "$(env_value AMG_PROJECT)" != "amg-$ENV_NAME" ]; then
  echo "REFUS : $ENV_FILE annonce AMG_ENV=$(env_value AMG_ENV) AMG_PROJECT=$(env_value AMG_PROJECT)" \
    "(attendu AMG_ENV=$ENV_NAME AMG_PROJECT=amg-$ENV_NAME)" >&2
  exit 2
fi

# Journal détaillé sur le serveur seulement (sortie de Compose, de Docker, du conteneur des
# migrations, écarts du journal de sécurité) : la sortie standard part par SSH dans les journaux
# PUBLICS de GitHub Actions. Par SSH, seule une ligne de statut est renvoyée (piège de sortie) ;
# dans un terminal (humain), le détail s'affiche aussi. `status` garde sa sortie.
LOG_FILE=$AMG_ROOT/logs/deploy-$ENV_NAME.log
if [ "$ACTION" != status ]; then
  mkdir -p "$AMG_ROOT/logs"
  (umask 077 && : >>"$LOG_FILE")
  chmod 600 "$LOG_FILE"
  # Rétention de 30 jours (données d'exploitation, adresses d'images et écarts du journal ; RGPD :
  # EXPLOITATION.md, 3.1) : les blocs datés de plus de 30 jours sont retirés à chaque lancement.
  LOG_CUTOFF=$(date -d '30 days ago' +%F)
  LOG_TMP=$(mktemp "$AMG_ROOT/logs/.deploy.XXXXXX")
  if awk -v c="$LOG_CUTOFF" 'match($0, /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T/) { keep = (substr($0, 1, 10) >= c) } keep' \
    "$LOG_FILE" >"$LOG_TMP" && chmod 600 "$LOG_TMP"; then
    mv "$LOG_TMP" "$LOG_FILE"
  else
    rm -f "$LOG_TMP"
  fi
  exec 3>&1
  if [ -t 1 ]; then exec > >(tee -a "$LOG_FILE") 2>&1; else exec >>"$LOG_FILE" 2>&1; fi
  log "début : $*"
fi

# Service déployable : variables de son image dans amg.env et historique propre.
SERVICE='' DIGEST_VAR='' IMAGE_VAR='' HISTORY=''
select_service() { # $1 site|api
  case "$1" in
    site) SERVICE=site DIGEST_VAR=SITE_DIGEST IMAGE_VAR=SITE_IMAGE HISTORY=$AMG_DIR/releases.log ;;
    api) SERVICE=api DIGEST_VAR=API_DIGEST IMAGE_VAR=API_IMAGE HISTORY=$AMG_DIR/releases-api.log ;;
    *)
      echo "service inconnu : ${1:-}" >&2
      exit 2
      ;;
  esac
  grep -q "^$DIGEST_VAR=" "$ENV_FILE" && [ -n "$(env_value "$IMAGE_VAR")" ] || {
    echo "REFUS : $ENV_FILE sans $IMAGE_VAR ou $DIGEST_VAR (EXPLOITATION.md, 9)" >&2
    exit 2
  }
}

current_digest() { env_value "$DIGEST_VAR"; }

# Écrit le digest dans amg.env (un redémarrage du serveur relance la même version), seulement après
# une bascule réussie. Chaque étape est vérifiée (appelée en contexte `||`, où `set -e` est
# inopérant) : un échec laisse amg.env intact et ne le remplace jamais par une copie tronquée.
set_digest() {
  local tmp
  tmp=$(mktemp "$AMG_DIR/.amg.env.XXXXXX") || return 1
  if sed "s/^$DIGEST_VAR=.*/$DIGEST_VAR=$1/" "$ENV_FILE" >"$tmp" && grep -qx "$DIGEST_VAR=$1" "$tmp" \
    && [ "$(wc -l <"$tmp")" = "$(wc -l <"$ENV_FILE")" ] && chmod 600 "$tmp" && mv "$tmp" "$ENV_FILE"; then
    return 0
  fi
  rm -f "$tmp"
  return 1
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

# Drainage avant arrêt : le HEALTHCHECK de l'image échoue dès que /tmp/drain existe. L'image de
# l'API n'a pas de shell (ni touch) : sa sonde pose elle-même le fichier.
drain() { # $1 identifiant de conteneur
  case "$SERVICE" in
    site) docker exec "$1" touch /tmp/drain ;;
    api) docker exec "$1" /nodejs/bin/node /app/apps/api/dist/healthcheck.js drain ;;
  esac
}

# Slices AMG (amg-common.sh) : chargées depuis leur fichier d'unité (sans lui, systemd les créerait
# à la volée SANS limite), MemoryMax <= plafond, sans swap, et limites réellement appliquées par le
# noyau (memory.max, memory.swap.max) si leur cgroup existe. Lecture seule, sans sudo.
check_slice() {
  local problems p
  problems=$(amg_all_slices_problems)
  [ -z "$problems" ] && return 0
  while IFS= read -r p; do log "REFUS : $p (EXPLOITATION.md, 9, étape 1)"; done <<<"$problems"
  return 1
}

# Nouvelle réplique dans la slice de son environnement : cgroup parent déclaré ET dossier cgroup
# réellement créé sous la slice (amg.slice/amg-<env>.slice/docker-<id complet>.scope, comme
# watch.sh). Le cgroup parent seul ne suffit pas : avec un autre pilote cgroup, Docker le
# recopierait sans placer le conteneur dans la slice systemd.
in_slice() { # $1 identifiant de conteneur
  local parent id
  IFS='|' read -r parent id < <(docker inspect -f '{{.HostConfig.CgroupParent}}|{{.Id}}' "$1" 2>/dev/null || echo '|')
  [ "$parent" = "$SLICE" ] && [[ "$id" =~ ^[0-9a-f]{64}$ ]] && [ -d "$(amg_scope_dir "$SLICE" "$id")" ]
}

# Service activé dans cet environnement (COMPOSE_PROFILES de amg.env) : sans cela, Compose le
# démarrerait quand même (service nommé), mais watch.sh ne le surveillerait pas.
service_enabled() { compose config --services 2>/dev/null | grep -x "$SERVICE" >/dev/null; }

PREVIOUS='' TARGET='' REVISION=- IMAGE_REF=''
# Téléchargement et contrôles de la nouvelle image. Le digest cible n'est PAS écrit dans amg.env :
# il est passé à Compose par l'environnement du processus (prioritaire sur --env-file pour
# l'interpolation), et n'est écrit qu'après la bascule réussie. Aucun conteneur n'est démarré.
prepare() { # $1 digest cible
  local image
  TARGET=$1
  PREVIOUS=$(current_digest)
  image=$(env_value "$IMAGE_VAR")
  IMAGE_REF=$image@$TARGET
  service_enabled || {
    log "REFUS : service $SERVICE inactif dans $ENV_FILE (COMPOSE_PROFILES)"
    return 1
  }
  log "pull $SERVICE $image@$TARGET (en ligne : $PREVIOUS)"
  export "$DIGEST_VAR=$TARGET"
  if ! compose pull --quiet "$SERVICE"; then
    log "ÉCHEC pull"
    return 1
  fi
  # Nos images ne portent aucun label Traefik (ils viennent du seul fichier Compose) : refus avant
  # tout démarrage (image_labels_safe, amg-common.sh). watch.sh contrôle aussi les labels en marche.
  if ! image_labels_safe "$image@$TARGET"; then
    log "REFUS : l'image $image@$TARGET porte des labels Traefik ou n'a pas pu être inspectée, $PREVIOUS reste en ligne"
    return 1
  fi
  # Commit d'origine (label posé par la CI), pour l'historique seulement : jamais utilisé pour choisir.
  REVISION=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$image@$TARGET" 2>/dev/null || true)
  [[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || REVISION=-
}

# Bascule vers l'image préparée ; $1 : informations ajoutées à l'historique (digest des migrations).
switch() {
  local extra=${1:-} old new partial
  old=$(compose ps -q "$SERVICE")
  if [ -z "$old" ]; then # premier démarrage : rien à remplacer
    compose up -d --wait --wait-timeout "$HEALTH_TIMEOUT" "$SERVICE" || return 1
    new=$(compose ps -q "$SERVICE")
    if [ -z "$new" ] || ! in_slice "$new"; then
      log "REFUS : conteneur hors de $SLICE (cgroup_parent absent du fichier Compose installé, ou scope absent de la slice), arrêté"
      compose rm -s -f "$SERVICE" >/dev/null || true
      return 1
    fi
    if ! runs_target "$new"; then
      compose rm -s -f "$SERVICE" >/dev/null || true
      return 1
    fi
    commit_release "$extra" || return 1
  else
    if ! compose up -d --no-deps --no-recreate --scale "$SERVICE=2" "$SERVICE"; then
      log "ÉCHEC : impossible de démarrer la nouvelle réplique, retour à $PREVIOUS (aucune coupure)"
      partial=$(comm -13 <(sort <<<"$old") <(compose ps -aq "$SERVICE" | sort))
      [ -z "$partial" ] || xargs -r docker rm -f <<<"$partial" >/dev/null || true
      return 1
    fi
    new=$(comm -13 <(sort <<<"$old") <(compose ps -q "$SERVICE" | sort))
    if [ -n "$new" ] && ! in_slice "$new"; then
      log "REFUS : nouvelle réplique hors de $SLICE (cgroup_parent absent du fichier Compose installé, ou scope absent de la slice), retour à $PREVIOUS"
      docker rm -f "$new" >/dev/null
      return 1
    fi
    if [ -z "$new" ] || ! wait_healthy "$new"; then
      log "ÉCHEC : la nouvelle version n'est pas saine, retour à $PREVIOUS (aucune coupure)"
      if [ -n "$new" ]; then
        docker logs --tail 50 "$new" >&2 || true
        docker rm -f "$new" >/dev/null
      fi
      return 1
    fi
    if ! runs_target "$new"; then
      docker rm -f "$new" >/dev/null
      return 1
    fi
    # La nouvelle réplique sert : amg.env et l'historique sont écrits AVANT le drainage (une
    # interruption ensuite ne laisse jamais amg.env sur l'ancien digest, ni un retour arrière qui
    # reculerait de deux versions), et les signaux sont ignorés jusqu'à la fin de la bascule.
    trap '' HUP INT TERM
    commit_release "$extra" || {
      restore_signal_traps
      return 1
    }
    sleep 3 # laisse Traefik enregistrer la nouvelle réplique
    local -a old_ids
    local c
    mapfile -t old_ids <<<"$old"
    for c in "${old_ids[@]}"; do drain "$c" || true; done
    sleep "$DRAIN_WAIT"
    docker stop --time 10 "${old_ids[@]}" >/dev/null
    docker rm "${old_ids[@]}" >/dev/null
    restore_signal_traps
  fi
  log "en ligne : $SERVICE $TARGET (commit $REVISION)"
}

# La réplique $1 tourne bien sur l'image préparée (le digest cible passé à Compose par
# l'environnement) : sinon, Compose aurait démarré l'image de amg.env, c'est-à-dire l'ancienne.
runs_target() { # $1 identifiant de conteneur
  local running
  running=$(docker inspect -f '{{.Config.Image}}' "$1" 2>/dev/null || true)
  [ "$running" = "$IMAGE_REF" ] && return 0
  log "REFUS : la nouvelle réplique tourne sur « ${running:-?} », pas sur $IMAGE_REF : retirée, $PREVIOUS reste en ligne"
  return 1
}

# Version en ligne : amg.env (redémarrage du serveur) puis historique (retour arrière).
commit_release() { # $1 informations ajoutées à l'historique
  set_digest "$TARGET" || {
    log "INCIDENT : $SERVICE $TARGET en ligne, mais $ENV_FILE n'a pas pu être mis à jour ($DIGEST_VAR) : le corriger à la main"
    return 1
  }
  printf '%s %s %s%s\n' "$(date -Is)" "$TARGET" "$REVISION" "${1:+ $1}" >>"$HISTORY"
}

restore_signal_traps() {
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

rollout() { # $1 digest cible (site, ou retour arrière : aucune migration)
  prepare "$1" && switch
}

# --- Fenêtre de migration (API) -------------------------------------------------------------------
PG=''
WINDOW_OPEN=0

# psql sous le superutilisateur `amg`, dans le conteneur postgres du projet : -X (aucun ~/.psqlrc),
# chemin de recherche épinglé (AMG_PG_ADMIN_OPTIONS), arrêt à la première erreur, sortie brute.
# Entrée standard : celle de l'appelant (fichier SQL), ou /dev/null pour une commande -c.
pg_admin() { docker exec -i -e PGOPTIONS="$AMG_PG_ADMIN_OPTIONS" "$PG" psql -X -v ON_ERROR_STOP=1 -U amg -d amg -At "$@"; }

postgres_container() {
  local ids
  ids=$(compose ps -q postgres)
  [ -n "$ids" ] && [ "$(wc -l <<<"$ids")" -eq 1 ] || return 1
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$ids" 2>/dev/null)" = healthy ] || return 1
  printf '%s\n' "$ids"
}

# Journal de sécurité conforme : la fonction rend NULL (sortie vide). Sinon, l'écart est journalisé.
journal_ok() {
  local violation
  violation=$(pg_admin -c "$AMG_JOURNAL_CHECK_SQL" </dev/null) || {
    log "ÉCHEC : vérification du journal de sécurité impossible (roles.sql joué ? EXPLOITATION.md §11)"
    return 1
  }
  [ -z "$violation" ] && return 0
  log "JOURNAL DE SÉCURITÉ NON CONFORME : $(tr '\n' ' ' <<<"$violation" | cut -c1-300)"
  return 1
}

close_window() {
  pg_admin -c 'ALTER ROLE amg_migrator NOLOGIN' \
    -c "select pg_catalog.count(pg_catalog.pg_terminate_backend(a.pid)) from pg_catalog.pg_stat_activity a where a.usename OPERATOR(pg_catalog.=) 'amg_migrator'" \
    </dev/null >/dev/null
}

# Piège de sortie : une fenêtre encore ouverte est refermée quoi qu'il arrive ; le code de sortie
# reste celui de l'échec (6 si tout avait réussi mais que la fenêtre n'a pas pu être refermée).
# Non réentrant : les signaux sont ignorés dès l'entrée (un second SIGTERM ou la coupure SSH ne
# l'interrompt pas), et la fermeture est retentée cinq fois avant de déclarer l'incident.
on_exit() {
  local rc=$? attempt
  trap '' HUP INT TERM
  if [ "$WINDOW_OPEN" = 1 ]; then
    for attempt in 1 2 3 4 5; do
      if close_window; then
        WINDOW_OPEN=0
        break
      fi
      sleep 2
    done
    if [ "$WINDOW_OPEN" = 0 ]; then
      log "fenêtre de migration refermée (sortie, code $rc, essai $attempt)"
    else
      log "INCIDENT : fenêtre de migration restée OUVERTE (amg_migrator LOGIN) : la refermer à la main (EXPLOITATION.md §11)"
      [ "$rc" -ne 0 ] || rc=6
    fi
  fi
  if [ "$ACTION" != status ]; then
    log "fin : code $rc"
    if [ "$rc" = 0 ]; then
      printf 'deploy.sh %s %s : réussi\n' "$ENV_NAME" "$ACTION" >&3 2>/dev/null || true
    elif [ "$rc" = 7 ]; then
      printf 'deploy.sh %s %s : REFUS (code 7), fenêtre de migration déjà ouverte ou session amg_migrator active : incident, aucune ouverture\n' \
        "$ENV_NAME" "$ACTION" >&3 2>/dev/null || true
    else
      printf 'deploy.sh %s %s : ÉCHEC (code %s), détail dans %s sur le serveur\n' \
        "$ENV_NAME" "$ACTION" "$rc" "$LOG_FILE" >&3 2>/dev/null || true
    fi
  fi
  exit "$rc"
}

# Image des migrations ($1 image@digest) : téléchargée et contrôlée AVANT d'ouvrir la fenêtre.
check_migrate_image() {
  local image=$1 want have
  if ! docker image inspect -f '{{.Id}}' "$image" >/dev/null 2>&1; then
    docker pull --quiet "$image" >/dev/null || { log "ÉCHEC pull $image"; return 1; }
  fi
  image_labels_safe "$image" || { log "REFUS : l'image des migrations porte des labels Traefik"; return 1; }
  [ -f "$ROLES_SQL" ] && [ ! -L "$ROLES_SQL" ] || { log "REFUS : $ROLES_SQL absent (EXPLOITATION.md, 3.3)"; return 1; }
  want=$(docker image inspect -f '{{index .Config.Labels "org.amg.roles-sql.sha256"}}' "$image" 2>/dev/null || true)
  have=$(sha256sum "$ROLES_SQL" | cut -d' ' -f1)
  [[ "$want" =~ ^[0-9a-f]{64}$ ]] && [ "$want" = "$have" ] || {
    log "REFUS : roles.sql installé ($have) différent de celui des migrations (${want:-absent}) : installer les fichiers du commit (EXPLOITATION.md, 3.3)"
    return 1
  }
}

# Conteneur ponctuel des migrations : connexion propre d'amg_migrator par le réseau de données,
# mot de passe en fichier monté en lecture seule, espace de PID propre, aucune capacité ; 192 Mio
# sans swap (budget : EXPLOITATION.md, 10).
migrate_container() { # $1 image@digest
  # Verrou des ponctuels déjà attendu avant l'ouverture : ici, 30 s au plus, fenêtre ouverte.
  local AMG_ONEOFF_WAIT=$AMG_MIGRATE_ONEOFF_WAIT
  amg_run "$ENV_NAME" migrate 192m --read-only --cap-drop ALL --security-opt no-new-privileges:true \
    --cpus 1 --pids-limit 64 --tmpfs /tmp:rw,noexec,nosuid,nodev,size=32m \
    --network "amg-${ENV_NAME}_data" --user 65532:65532 \
    -e DB_HOST=postgres -e DB_PORT=5432 -e DB_NAME=amg -e DB_USER=amg_migrator \
    -e DB_PASSWORD_FILE=/run/secrets/pg_migrator_password \
    -v "$AMG_DIR/secrets/pg_migrator_password:/run/secrets/pg_migrator_password:ro" \
    -- "$1"
}

run_migrations() { # $1 image@digest des migrations
  local image=$1 rc=0
  PG=$(postgres_container) || { log "REFUS : conteneur postgres introuvable, multiple ou pas sain"; return 1; }
  check_migrate_image "$image" || return 1
  # Un seul conteneur ponctuel à la fois : attendre ici (sauvegarde en cours…), pas une fois la
  # fenêtre ouverte (le conteneur des migrations n'attend ensuite que 30 s).
  flock -w "$AMG_ONEOFF_WAIT" "$AMG_ROOT/.oneoff.lock" true || { log "ÉCHEC : verrou des ponctuels"; return 1; }
  # Avant l'ouverture : journal vérifié tel quel (un écart est journalisé, jamais réparé en silence
  # par le rejeu), puis rejeu de roles.sql (rôles, droits, déclencheurs d'événement) et nouvelle
  # vérification ; le moindre écart, aucune ouverture.
  journal_ok || {
    log "REFUS : aucune ouverture de LOGIN d'amg_migrator tant que le journal n'est pas conforme (fenêtre corrective : EXPLOITATION.md §11)"
    return 1
  }
  pg_admin <"$ROLES_SQL" >/dev/null || {
    log "REFUS : rejeu de roles.sql en échec avant la fenêtre (journal non conforme ?) : aucune ouverture (EXPLOITATION.md §11)"
    return 1
  }
  journal_ok || {
    log "REFUS : aucune ouverture de LOGIN d'amg_migrator tant que le journal n'est pas conforme (fenêtre corrective : EXPLOITATION.md §11)"
    return 1
  }
  # Fenêtre déjà ouverte (LOGIN) ou session d'amg_migrator active : incident, refus (code 7), aucune
  # ouverture ni fermeture par ce déploiement (la fenêtre est examinée et refermée par l'humain).
  local login sessions
  login=$(pg_admin -c "select r.rolcanlogin from pg_catalog.pg_roles r where r.rolname OPERATOR(pg_catalog.=) 'amg_migrator'" </dev/null) || {
    log "ÉCHEC : lecture de l'attribut LOGIN d'amg_migrator"
    return 1
  }
  sessions=$(pg_admin -c "select pg_catalog.count(*) from pg_catalog.pg_stat_activity a where a.usename OPERATOR(pg_catalog.=) 'amg_migrator'" </dev/null) || {
    log "ÉCHEC : lecture des sessions d'amg_migrator"
    return 1
  }
  if [ "$login" = t ] || [ "$sessions" != 0 ]; then
    log "INCIDENT : amg_migrator a déjà LOGIN ($login) ou des sessions actives ($sessions) avant l'ouverture : REFUS, examiner pg_stat_activity, refermer la fenêtre, changer son mot de passe (EXPLOITATION.md §11)"
    exit 7
  fi
  WINDOW_OPEN=1 # avant LOGIN : le piège EXIT refermera la fenêtre quoi qu'il arrive
  pg_admin -c 'ALTER ROLE amg_migrator LOGIN' </dev/null >/dev/null || {
    log "ÉCHEC : ouverture de la fenêtre de migration"
    return 1
  }
  log "fenêtre de migration ouverte : prisma migrate deploy ($image)"
  migrate_container "$image" || rc=$?
  close_window || {
    log "INCIDENT : fenêtre de migration non refermée (nouvel essai à la sortie)"
    return 1
  }
  WINDOW_OPEN=0
  log "fenêtre de migration refermée (NOLOGIN, sessions d'amg_migrator terminées)"
  # Rejeu de roles.sql (rôles, droits, déclencheurs d'événement réactivés) et vérification finale,
  # y compris après une migration en échec : un journal altéré est un incident.
  pg_admin <"$ROLES_SQL" >/dev/null || {
    log "ÉCHEC du rejeu de roles.sql (journal non conforme ?) : aucune bascule, incident à examiner (EXPLOITATION.md §11)"
    return 1
  }
  journal_ok || { log "aucune bascule : incident à examiner (EXPLOITATION.md §11)"; return 1; }
  [ "$rc" = 0 ] || {
    log "ÉCHEC des migrations (code $rc) : aucune bascule, l'ancienne version reste en ligne"
    return 1
  }
  log "migrations appliquées, journal de sécurité conforme"
}

# Proxy de confiance de l'API (EXPLOITATION.md §11, « Proxy de confiance ») : TRUSTED_PROXY de amg.env
# doit être exactement un sous-réseau du réseau d'entrée, celui d'où Traefik se connecte. Sinon
# l'API ignorerait X-Forwarded-For (toutes les requêtes viendraient de Traefik : une seule limite de
# débit pour tout le monde) ou ferait confiance à d'autres adresses que celles de ce réseau.
trusted_proxy_ok() {
  local want edge subnets
  want=$(env_value TRUSTED_PROXY)
  edge=$(env_value AMG_EDGE_NETWORK)
  [ -n "$want" ] && [ -n "$edge" ] || return 1
  subnets=$(docker network inspect -f '{{range .IPAM.Config}}{{println .Subnet}}{{end}}' "$edge" 2>/dev/null) || return 1
  grep -qxF -- "$want" <<<"$subnets"
}

deploy_api() { # $1 digest de l'API, $2 digest des migrations
  local migrate_image
  migrate_image=$(env_value MIGRATE_IMAGE)
  [ -n "$migrate_image" ] || { log "REFUS : $ENV_FILE sans MIGRATE_IMAGE (EXPLOITATION.md, 9)"; return 1; }
  trusted_proxy_ok || {
    log "REFUS : TRUSTED_PROXY=$(env_value TRUSTED_PROXY) n'est pas le sous-réseau du réseau d'entrée $(env_value AMG_EDGE_NETWORK) (EXPLOITATION.md §11)"
    return 1
  }
  prepare "$1" || return 1
  run_migrations "$migrate_image@$2" || return 1
  switch "migrations=$2"
}

# Un seul déploiement à la fois par environnement, donc une seule réplique en surplus : hypothèse
# du budget mémoire (deploy/ci/check-budget.sh) ; les services basculent l'un après l'autre.
# Même verrou que backup.sh et restore-gate.sh : jamais de bascule ni de migration pendant une sauvegarde.
lock() {
  exec 9>"$(amg_env_lock "$ENV_NAME")"
  flock -n 9 || {
    echo "déploiement, sauvegarde ou restauration déjà en cours, réessayer plus tard" >&2
    exit 3
  }
}

trap on_exit EXIT
# Session SSH coupée en pleine fenêtre : SIGPIPE ignoré (une écriture sur la sortie fermée échoue au
# lieu de tuer le script sans passer par le piège EXIT), signaux convertis en sortie (piège EXIT).
trap '' PIPE
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

case "$ACTION" in
  deploy)
    select_service "${3:-}"
    DIGEST=${4:?digest (sha256:<64 caractères hexadécimaux>)}
    [[ "$DIGEST" =~ $DIGEST_RE ]] || {
      echo "digest refusé : $DIGEST" >&2
      exit 2
    }
    if [ "$SERVICE" = api ]; then
      MIGRATE_DIGEST=${5:?digest des migrations (sha256:<64 caractères hexadécimaux>)}
      [[ "$MIGRATE_DIGEST" =~ $DIGEST_RE ]] || {
        echo "digest des migrations refusé : $MIGRATE_DIGEST" >&2
        exit 2
      }
      [ "$#" -eq 5 ] || {
        echo "arguments en trop" >&2
        exit 2
      }
    elif [ "$#" -ne 4 ]; then
      echo "arguments en trop" >&2
      exit 2
    fi
    check_slice || exit 5
    lock
    if [ "$SERVICE" = api ]; then deploy_api "$DIGEST" "$MIGRATE_DIGEST"; else rollout "$DIGEST"; fi
    ;;
  rollback)
    select_service "${3:-}"
    [ "$#" -eq 3 ] || {
      echo "arguments en trop" >&2
      exit 2
    }
    check_slice || exit 5
    lock
    cur=$(current_digest)
    prev=$(awk -v cur="$cur" '$2 != cur { d = $2 } END { print d }' "$HISTORY" 2>/dev/null || true)
    [[ "$prev" =~ $DIGEST_RE ]] || {
      echo "aucune version précédente valide dans $HISTORY" >&2
      exit 4
    }
    # Sans migration : le schéma reste celui de la version courante, compatible avec la précédente
    # (règle d'expansion puis contraction, EXPLOITATION.md, 3.1).
    log "retour arrière $SERVICE : $cur → $prev"
    rollout "$prev"
    ;;
  status)
    for s in site api; do
      d=$(sed -n "s/^${s^^}_DIGEST=//p" "$ENV_FILE" | tail -n 1)
      echo "en ligne : $s ${d:-absent}"
    done
    systemctl show "$AMG_SLICE" "$SLICE" -p Id -p LoadState -p MemoryMax -p MemorySwapMax -p MemoryCurrent 2>/dev/null || true
    amg_budget_summary
    amg_all_slices_problems
    tail -n 5 "$AMG_DIR/releases.log" "$AMG_DIR/releases-api.log" 2>/dev/null || true
    compose ps --format '{{.Name}}\t{{.Image}}\t{{.Status}}'
    ;;
  *)
    echo "action inconnue : $ACTION" >&2
    exit 2
    ;;
esac
