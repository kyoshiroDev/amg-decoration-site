#!/usr/bin/env bash
# Sauvegarde nocturne de la PRODUCTION AMG.
# cron (compte de déploiement) : 15 4 * * * /opt/amg/bin/backup.sh >> /opt/amg/logs/backup.log 2>&1
#
# 1. pg_dump (format custom) chiffré à la volée avec age vers une CLÉ PUBLIQUE : la clé privée n'est
#    jamais sur le VPS (gestionnaire de mots de passe de l'humain). Aucun dump en clair sur le disque.
# 2. restic (image officielle épinglée) envoie le dump chiffré et le volume de fichiers vers
#    Backblaze B2 par son API compatible S3 (recommandation de la doc restic), chiffrement restic en
#    plus (mot de passe du dépôt sur le VPS, copie hors VPS), déduplication, rétention 30 jours.
#    La clé B2 du VPS n'a PAS la capacité deleteFiles (docs/EXPLOITATION.md, 5.1) : le backend S3
#    de restic ne supprime pas, il MASQUE (marqueur de suppression B2). `forget --prune` ne détruit
#    donc rien : les fichiers masqués restent récupérables 14 jours, puis la règle de cycle de vie
#    du bucket (daysFromHidingToDeleting: 14) les efface. Un serveur compromis ne peut pas effacer
#    l'historique des sauvegardes, seulement le masquer.
#    restic tourne sans aucune capacité sauf DAC_READ_SEARCH (lecture des fichiers de l'API),
#    racine en lecture seule, cache dans un volume nommé, fichiers temporaires en tmpfs, lancé par
#    amg_run (amg-common.sh) : slice amg-prod.slice (plafond mémoire commun de tout AMG), 512 Mio
#    sans swap, un seul conteneur ponctuel à la fois sur le serveur (compté par
#    deploy/ci/check-budget.sh).
# 3. Signal « vivant » à Healthchecks.io : succès, ou échec avec la fin du journal. Pas de signal =
#    alerte au bout de 25 h (ping manquant).
#
# Verrou de la production (le même que deploy.sh et restore-gate.sh) tenu de bout en bout : pas de
# déploiement (donc pas de réplique de bascule ni de migration) pendant la sauvegarde, et
# inversement. Attente bornée (30 min), puis échec signalé.
# pg_dump tourne DANS le conteneur postgres (limite PG_MEM_LIMIT, 512 Mio en production) : il
# garde en mémoire le catalogue (quelques Mio pour le schéma du CRM), pas les données, qui sont
# envoyées en flux vers age sur l'hôte ; les fichiers clients ne sont pas dans la base (ADR-0020).
# Besoin estimé : shared_buffers (128 Mio) + connexions de l'API + pg_dump et son processus serveur
# (quelques dizaines de Mio) : < 300 Mio. Un manque de mémoire ferait échouer la sauvegarde (alerte
# Healthchecks.io) et apparaîtrait dans watch.sh (oom_kill), sans toucher au voisin.
set -Eeuo pipefail

AMG_ROOT=${AMG_ROOT:-/opt/amg}
# shellcheck source=deploy/bin/amg-common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/amg-common.sh"
ENV_NAME=prod
WORK=$AMG_ROOT/backups/$ENV_NAME
RESTIC_ENV=$AMG_ROOT/secrets/restic.env      # 600 : RESTIC_REPOSITORY, RESTIC_PASSWORD, AWS_* (clé B2), HC_BACKUP_URL
AGE_RECIPIENTS=$AMG_ROOT/secrets/age-recipients.txt  # clé PUBLIQUE age (non secrète)
RESTIC_IMAGE=restic/restic:0.20.0@sha256:93999df80d4ac6cb148e82d2ef1fe6a81996f17ff535e772723538211b31555a
RESTIC_CACHE_VOLUME=amg-backup-restic-cache
LOG_TAIL=$(mktemp)
trap 'rm -f "$LOG_TAIL"' EXIT

HC_BACKUP_URL=$(sed -n 's/^HC_BACKUP_URL=//p' "$RESTIC_ENV")
ping_hc() { curl -fsS -m 10 --retry 3 --data-binary @- "$HC_BACKUP_URL$1" >/dev/null || true; }
fail() { tail -n 40 "$LOG_TAIL" | ping_hc /fail; echo "$(date -Is) ÉCHEC : $*" >&2; exit 1; }
trap 'fail "ligne $LINENO"' ERR
exec > >(tee -a "$LOG_TAIL") 2>&1

ping_hc /start </dev/null
exec 8>"$(amg_env_lock "$ENV_NAME")"
flock -w 1800 8 || fail "verrou de $ENV_NAME tenu depuis 30 min (déploiement ou restauration en cours)"
mkdir -p "$WORK"; chmod 700 "$WORK"
DUMP=$WORK/amg-$ENV_NAME.dump.age

echo "$(date -Is) pg_dump chiffré"
PG=$(docker ps -q --filter "label=com.docker.compose.project=amg-$ENV_NAME" \
  --filter label=com.docker.compose.service=postgres)
[ -n "$PG" ] || fail "conteneur postgres introuvable"
docker exec "$PG" pg_dump -U amg -d amg --format=custom --compress=6 --no-owner \
  | age -R "$AGE_RECIPIENTS" > "$DUMP.tmp"
# Un dump vide ou tronqué ne doit jamais remplacer le précédent.
[ "$(stat -c %s "$DUMP.tmp")" -gt 400 ] || fail "dump vide ou tronqué"  # chiffré vide ≈ 200 o, base vide ≈ 1 Ko
mv "$DUMP.tmp" "$DUMP"

# Volume de fichiers (CRM 5) : monté seulement s'il existe, jamais créé par ce script.
FILES_MOUNT=()
docker volume inspect "amg-${ENV_NAME}_files" >/dev/null 2>&1 \
  && FILES_MOUNT=(-v "amg-${ENV_NAME}_files:/backup/files:ro")

restic() {
  amg_run prod backup 512m --env-file "$RESTIC_ENV" --hostname "amg-$ENV_NAME" \
    --cpus 1 --pids-limit 100 \
    --security-opt no-new-privileges:true --cap-drop ALL --cap-add DAC_READ_SEARCH \
    --read-only --tmpfs /tmp:rw,noexec,nosuid,size=192m \
    -v "$WORK:/backup/db:ro" \
    "${FILES_MOUNT[@]}" \
    -v "$RESTIC_CACHE_VOLUME:/cache" -e RESTIC_CACHE_DIR=/cache \
    -- "$RESTIC_IMAGE" "$@"
}

echo "$(date -Is) restic backup"
restic backup --tag nightly --host "amg-$ENV_NAME" /backup
echo "$(date -Is) rétention 30 jours (masquage B2, effacement réel par le cycle de vie du bucket)"
restic forget --host "amg-$ENV_NAME" --tag nightly --keep-daily 30 --prune
# Contrôle d'intégrité : structure chaque nuit, 5 % des données relues chaque dimanche.
if [ "$(date +%u)" = 7 ]; then restic check --read-data-subset=5%; else restic check; fi

echo "$(date -Is) terminé"
tail -n 20 "$LOG_TAIL" | ping_hc ""
