#!/usr/bin/env bash
# Commande forcée des clés de déploiement GitHub Actions (authorized_keys de <UTILISATEUR_DEPLOY>) :
#   restrict,command="/opt/amg/bin/deploy-gate.sh staging" ssh-ed25519 AAAA… github-actions-staging
#   restrict,command="/opt/amg/bin/deploy-gate.sh prod"    ssh-ed25519 AAAA… github-actions-prod
# L'environnement est fixé par la clé (la clé de préproduction ne peut pas toucher la production).
# Seules ces commandes sont acceptées, avec des digests d'image au format strict :
#   ssh … "deploy site sha256:<64 hex>"
#   ssh … "deploy api sha256:<64 hex de l'API> sha256:<64 hex des migrations>"
#   ssh … "rollback site"   |   ssh … "rollback api"   |   ssh … "status"
# La clé ne transmet jamais de fichier : les fichiers Compose, roles.sql et les scripts sont
# installés par l'humain après relecture (docs/EXPLOITATION.md, 3.3). Un digest ne peut désigner
# qu'une image des dépôts GHCR fixés dans amg.env (SITE_IMAGE, API_IMAGE, MIGRATE_IMAGE), lancée
# avec les contraintes de compose.yaml (ou de amg_run pour les migrations).
set -euo pipefail

ENV_NAME=${1:-}
case "$ENV_NAME" in
  prod | staging) ;;
  *)
    echo "environnement refusé" >&2
    exit 2
    ;;
esac

read -r -a ARGS <<<"${SSH_ORIGINAL_COMMAND:-}"

# Environnement minimal : rien de la session SSH (variables, PATH) n'atteint deploy.sh.
run() { exec env -i PATH=/usr/bin:/bin HOME="${HOME:-/nonexistent}" LANG=C.UTF-8 /opt/amg/bin/deploy.sh "$@"; }

DIGEST_RE='^sha256:[0-9a-f]{64}$'
refuse() {
  echo "refusé" >&2
  exit 2
}

case "${ARGS[0]:-}" in
  deploy)
    case "${ARGS[1]:-}" in
      site)
        [[ "${#ARGS[@]}" -eq 3 && "${ARGS[2]}" =~ $DIGEST_RE ]] || refuse
        run "$ENV_NAME" deploy site "${ARGS[2]}"
        ;;
      api)
        [[ "${#ARGS[@]}" -eq 4 && "${ARGS[2]}" =~ $DIGEST_RE && "${ARGS[3]}" =~ $DIGEST_RE ]] || refuse
        run "$ENV_NAME" deploy api "${ARGS[2]}" "${ARGS[3]}"
        ;;
      *) refuse ;;
    esac
    ;;
  rollback)
    [[ "${#ARGS[@]}" -eq 2 && "${ARGS[1]}" =~ ^(site|api)$ ]] || refuse
    run "$ENV_NAME" rollback "${ARGS[1]}"
    ;;
  status)
    [[ "${#ARGS[@]}" -eq 1 ]] || refuse
    run "$ENV_NAME" status
    ;;
  *)
    echo "commande refusée" >&2
    exit 2
    ;;
esac
