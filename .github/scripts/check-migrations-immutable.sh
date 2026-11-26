#!/usr/bin/env bash
# Migrations Prisma immuables (ADR-0023, docs/EXPLOITATION.md §3.1) : un fichier de
# libs/api/db/prisma/migrations/ déjà présent sur la référence de base (main) ne peut être ni
# modifié, ni supprimé, ni renommé. Une migration fusionnée a peut-être déjà été appliquée en
# production : la changer désynchroniserait la base et l'historique `_prisma_migrations`. Tout
# changement de schéma passe par une NOUVELLE migration.
#
# Usage : check-migrations-immutable.sh <référence de base>   (ex. FETCH_HEAD après `git fetch origin main`)
# Compare les empreintes Git (blobs) de chaque fichier de la base à celles de HEAD.
set -Eeuo pipefail

readonly MIGRATIONS_DIR='libs/api/db/prisma/migrations'
base_ref="${1:?référence de base attendue (ex. FETCH_HEAD)}"

base_commit=$(git rev-parse --verify --quiet "${base_ref}^{commit}") || {
  echo "::error::référence de base introuvable : ${base_ref}"
  exit 1
}

mapfile -t base_files < <(git ls-tree -r --name-only "$base_commit" -- "$MIGRATIONS_DIR/")
if [ "${#base_files[@]}" -eq 0 ]; then
  echo "Aucune migration sur la base (${base_commit:0:12}) : rien à protéger."
  exit 0
fi

failures=0
for path in "${base_files[@]}"; do
  base_blob=$(git rev-parse "${base_commit}:${path}")
  if ! head_blob=$(git rev-parse --verify --quiet "HEAD:${path}"); then
    echo "::error file=${path}::migration déjà fusionnée supprimée ou renommée"
    failures=$((failures + 1))
  elif [ "$head_blob" != "$base_blob" ]; then
    echo "::error file=${path}::migration déjà fusionnée modifiée (créer une nouvelle migration)"
    failures=$((failures + 1))
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "${failures} fichier(s) de migration déjà fusionné(s) altéré(s)."
  exit 1
fi
echo "${#base_files[@]} fichier(s) de migration de la base inchangé(s)."
