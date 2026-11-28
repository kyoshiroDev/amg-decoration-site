#!/usr/bin/env bash
# Même image Redis, au même digest, en production (deploy/compose.yaml), en développement local
# (compose.dev.yaml), dans le job CI d'intégration (.github/workflows/ci.yml) et dans le contrôle
# des images de l'API (.github/workflows/deploy.yml) : scripts Lua du magasin de sessions et règles
# ACL sont éprouvés sur la version exacte qui tournera sur le serveur.
set -Eeuo pipefail

readonly FILES=(deploy/compose.yaml compose.dev.yaml .github/workflows/ci.yml .github/workflows/deploy.yml)
# Référence complète : redis:<tag>@sha256:<64 hexadécimaux>.
readonly PATTERN='redis:[0-9A-Za-z._-]+@sha256:[0-9a-f]{64}'

declare -A refs=()
for file in "${FILES[@]}"; do
  mapfile -t found < <(grep -Eo "image: *${PATTERN}" "$file" | sed -E 's/^image: *//' | sort -u)
  if [ "${#found[@]}" -ne 1 ]; then
    echo "::error file=${file}::une seule image redis épinglée par digest attendue (trouvé : ${#found[@]})"
    exit 1
  fi
  refs["${found[0]}"]+="${file} "
  echo "${file} : ${found[0]}"
done

if [ "${#refs[@]}" -ne 1 ]; then
  echo "::error::images redis différentes entre ${FILES[*]}"
  exit 1
fi
echo "Image redis identique dans les ${#FILES[@]} fichiers."
