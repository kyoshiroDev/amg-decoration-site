#!/usr/bin/env bash
# Restauration de la base de PRODUCTION après incident, lancée depuis le POSTE de l'humain
# (docs/EXPLOITATION.md, 5.4). Jamais automatique, jamais pour un test (test mensuel : restore-test.sh).
# Aucune clé ni aucun mot de passe de sauvegarde sur le VPS : le snapshot est lu et déchiffré ici,
# puis le flux pg_dump passe par SSH jusqu'à restore-gate.sh, qui contrôle le serveur et le
# branche sur pg_restore. Aucun dump en clair écrit, ni ici ni sur le serveur.
#   restic dump (clé B2 lecture seule) | age -d (clé saisie ici) | ssh <clé d'incident> "restore …"
#   deploy/bin/restore-prod.sh <id_snapshot> 2>&1 | tee -a ~/amg-restauration/restore-prod.log
# Prérequis du poste : ceux de restore-test.sh (docker, jq, age, ssh ; AMG_RESTORE_ENV) et, dans ce
# même fichier d'accès (600) :
#   RESTORE_SSH_TARGET=<UTILISATEUR_DEPLOY>@<VPS>
#   RESTORE_SSH_KEY=~/.ssh/amg-restauration-prod     (clé d'incident, protégée par phrase de passe)
#   RESTORE_SSH_KNOWN_HOSTS=~/.config/amg/known_hosts (empreinte du VPS vérifiée)
# La clé privée age et le mot de passe restic sont saisis au clavier (invites masquées) et restent
# en mémoire ; la clé age passe à age par un tube, le mot de passe à Docker par l'environnement.
set -Eeuo pipefail

SOURCE_HOST=amg-prod
SNAPSHOT=${1:-}
RESTIC_ENV=${AMG_RESTORE_ENV:-$HOME/.config/amg/restic-restore.env}
RESTIC_IMAGE=restic/restic:0.20.0@sha256:93999df80d4ac6cb148e82d2ef1fe6a81996f17ff535e772723538211b31555a

[[ "$SNAPSHOT" =~ ^[0-9a-f]{8,64}$ ]] || {
  echo "usage : restore-prod.sh <id_snapshot> (identifiant explicite, jamais « latest »)" >&2
  exit 2
}
CONFIRMATION="RESTAURER $SOURCE_HOST $SNAPSHOT"
if [ -d /opt/amg/secrets ]; then
  echo "à lancer sur le poste de l'humain, pas sur le VPS : aucune clé de sauvegarde n'y est admise" >&2
  exit 2
fi
[ -t 0 ] || {
  echo "à lancer dans un terminal (confirmation et secrets saisis au clavier)" >&2
  exit 2
}
[ -r "$RESTIC_ENV" ] || {
  echo "$RESTIC_ENV illisible (AMG_RESTORE_ENV)" >&2
  exit 2
}
for tool in docker jq age ssh; do
  command -v "$tool" >/dev/null || {
    echo "$tool n'est pas installé sur ce poste" >&2
    exit 2
  }
done
conf() { sed -n "s/^$1=//p" "$RESTIC_ENV" | tail -n 1; }
SSH_TARGET=$(conf RESTORE_SSH_TARGET)
SSH_KEY=$(conf RESTORE_SSH_KEY)
SSH_KEY=${SSH_KEY/#\~/$HOME}
KNOWN_HOSTS=$(conf RESTORE_SSH_KNOWN_HOSTS)
KNOWN_HOSTS=${KNOWN_HOSTS/#\~/$HOME}
[[ "$SSH_TARGET" =~ ^[a-z_][a-z0-9_-]*@[A-Za-z0-9.-]+$ ]] && [ -r "$SSH_KEY" ] && [ -r "$KNOWN_HOSTS" ] || {
  echo "RESTORE_SSH_TARGET, RESTORE_SSH_KEY ou RESTORE_SSH_KNOWN_HOSTS absent ou illisible dans $RESTIC_ENV" >&2
  exit 2
}

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
AGE_IDENTITY=''
RESTIC_PASSWORD=''
trap 'AGE_IDENTITY=""; RESTIC_PASSWORD=""' EXIT

# Commande forcée côté serveur (restore-gate.sh) : la clé d'incident ne peut rien faire d'autre.
gate() {
  ssh -T -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$KNOWN_HOSTS" -i "$SSH_KEY" "$SSH_TARGET" "$@"
}
# Mêmes contraintes que restore-test.sh ; --no-lock : clé B2 du poste en lecture seule.
restic() {
  docker run --rm -i --env-file "$RESTIC_ENV" -e RESTIC_PASSWORD --hostname amg-prod-restore \
    --memory 512m --memory-swap 512m --cpus 1 --pids-limit 100 \
    --security-opt no-new-privileges:true --cap-drop ALL --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=192m \
    "$RESTIC_IMAGE" --no-cache --no-lock "$@"
}

log "contrôles du serveur (clé d'incident chargée dans ssh-agent)"
gate check </dev/null

if ! grep -q '^RESTIC_PASSWORD=' "$RESTIC_ENV"; then
  read -r -s -p "Mot de passe du dépôt restic (non affiché) : " RESTIC_PASSWORD
  echo
  [ -n "$RESTIC_PASSWORD" ] || {
    echo "mot de passe restic vide" >&2
    exit 2
  }
  export RESTIC_PASSWORD
fi
snap_json=$(restic snapshots --json "$SNAPSHOT" </dev/null | jq -c '.[-1] // {}')
[ "$(jq -r '.hostname // empty' <<<"$snap_json")" = "$SOURCE_HOST" ] || {
  echo "snapshot $SNAPSHOT introuvable ou pas issu de $SOURCE_HOST" >&2
  exit 3
}
jq -r '"snapshot \(.short_id) du \(.time), étiquettes \(.tags // [] | join(","))"' <<<"$snap_json"
echo
echo "La base de PRODUCTION va être REMPLACÉE par ce snapshot (validé au préalable par restore-test.sh ?)."
read -r -p "Taper exactement « $CONFIRMATION » pour continuer : " answer
[ "$answer" = "$CONFIRMATION" ] || {
  echo "abandon" >&2
  exit 4
}
read -r -s -p "Clé privée age (AGE-SECRET-KEY-1…, non affichée) : " AGE_IDENTITY
echo
[[ "$AGE_IDENTITY" =~ ^AGE-SECRET-KEY-1[0-9A-Z]+$ ]] || {
  echo "clé age invalide" >&2
  exit 2
}

log "restauration du snapshot $SNAPSHOT : flux déchiffré en mémoire, envoyé par SSH (une seule transaction)"
restic dump "$SNAPSHOT" /backup/db/amg-prod.dump.age </dev/null \
  | age -d -i <(printf '%s\n' "$AGE_IDENTITY") \
  | gate restore "$SNAPSHOT" "RESTAURER-$SOURCE_HOST-$SNAPSHOT"
AGE_IDENTITY=''
log "restauration terminée : redémarrer les services, vérifier, retirer la clé d'incident du serveur, consigner (EXPLOITATION.md, 5.2)"
