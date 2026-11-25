#!/usr/bin/env bash
# Commande forcée des clés de déploiement GitHub Actions (authorized_keys de <UTILISATEUR_DEPLOY>) :
#   restrict,command="/opt/amg/bin/deploy-gate.sh staging" ssh-ed25519 AAAA… github-actions-staging
#   restrict,command="/opt/amg/bin/deploy-gate.sh prod"    ssh-ed25519 AAAA… github-actions-prod
# L'environnement est fixé par la clé (la clé de préproduction ne peut pas toucher la production).
# Seules trois commandes sont acceptées, avec un digest d'image au format strict :
#   ssh … "deploy sha256:<64 hex>"   |   ssh … "rollback"   |   ssh … "status"
# La clé ne transmet jamais de fichier : les fichiers Compose et les scripts sont installés par
# l'humain après relecture (docs/EXPLOITATION.md, 3.3). Un digest ne peut désigner qu'une image du
# dépôt GHCR fixé dans amg.env (SITE_IMAGE), lancée avec les contraintes de compose.yaml.
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

case "${ARGS[0]:-}" in
  deploy)
    [[ "${#ARGS[@]}" -eq 2 && "${ARGS[1]}" =~ ^sha256:[0-9a-f]{64}$ ]] || {
      echo "refusé" >&2
      exit 2
    }
    run "$ENV_NAME" deploy "${ARGS[1]}"
    ;;
  rollback | status)
    [[ "${#ARGS[@]}" -eq 1 ]] || {
      echo "refusé" >&2
      exit 2
    }
    run "$ENV_NAME" "${ARGS[0]}"
    ;;
  *)
    echo "commande refusée" >&2
    exit 2
    ;;
esac
