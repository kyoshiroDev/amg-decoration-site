#!/usr/bin/env bash
# Contrôle quotidien des sauvegardes, HORS du VPS (workflow backup-watch.yml) : un serveur
# compromis ne peut ni masquer ses sauvegardes en silence (la rétention des versions masquées est
# de 14 jours), ni falsifier ce contrôle. Lit seulement la LISTE des objets du dépôt restic sur
# Backblaze B2, avec une clé listBuckets,listFiles : aucun contenu lu, donc ni restic ni age.
#
# Alerte (code de sortie ≠ 0) si :
#   - la clé a d'autres capacités que listBuckets et listFiles, ou n'est pas limitée à un bucket
#     et à un préfixe (une clé trop puissante n'a rien à faire dans GitHub) ;
#   - le fichier `config` ou toute clé `keys/` du dépôt restic n'est plus visible (dépôt masqué) ;
#   - aucun objet `snapshots/` n'a été téléversé depuis MAX_AGE_HOURS (sauvegarde arrêtée) ;
#   - moins de MIN_SNAPSHOTS snapshots sont visibles (masquage massif) ;
#   - plus de MAX_HIDES snapshots ont été masqués en 48 h (en régime normal : un par nuit, le plus
#     ancien, retiré par `restic forget`).
# API B2 native v4 (b2_authorize_account, b2_list_file_names, b2_list_file_versions) :
# b2_list_file_names ne renvoie que les fichiers visibles ; b2_list_file_versions renvoie aussi
# les marqueurs de masquage (action « hide »).
# Entrées (environnement) : B2_KEY_ID, B2_KEY (obligatoires) ; MIN_SNAPSHOTS (défaut 1),
# MAX_AGE_HOURS (36), MAX_HIDES (5) ; HC_URL (facultatif, ping Healthchecks.io).
set -Eeuo pipefail
shopt -s inherit_errexit # un échec dans $(…) arrête aussi le contrôle

: "${B2_KEY_ID:?B2_KEY_ID manquant}" "${B2_KEY:?B2_KEY manquant}"
MIN_SNAPSHOTS=${MIN_SNAPSHOTS:-1}
MAX_AGE_HOURS=${MAX_AGE_HOURS:-36}
MAX_HIDES=${MAX_HIDES:-5}
HC_URL=${HC_URL:-}
AUTH_URL=https://api.backblazeb2.com/b2api/v4/b2_authorize_account

for n in "$MIN_SNAPSHOTS" "$MAX_AGE_HOURS" "$MAX_HIDES"; do
  [[ "$n" =~ ^[0-9]+$ ]] || {
    echo "seuil non numérique : $n" >&2
    exit 2
  }
done

problems=()
problem() { problems+=("$*"); }
ping_hc() { # $1 suffixe (vide ou /fail), message sur l'entrée standard
  if [ -z "$HC_URL" ]; then
    cat >/dev/null
    return 0
  fi
  curl -fsS -m 10 --retry 3 --data-binary @- "$HC_URL$1" >/dev/null || true
}
# Erreur imprévue (API injoignable, réponse invalide) : alerte, une seule fois (pas par sous-shell).
trap '[ "$BASH_SUBSHELL" -gt 0 ] || printf "erreur du contrôle (API B2 injoignable ou réponse invalide), ligne %s\n" "$LINENO" | tee /dev/stderr | ping_hc /fail' ERR

# Identifiants passés à curl par son entrée standard, jamais dans la ligne de commande.
auth=$(printf 'user = "%s:%s"\n' "$B2_KEY_ID" "$B2_KEY" | curl -K - -fsS -m 30 --retry 3 "$AUTH_URL")
TOKEN=$(jq -r '.authorizationToken // empty' <<<"$auth")
API_URL=$(jq -r '.apiInfo.storageApi.apiUrl // empty' <<<"$auth")
caps=$(jq -r '.apiInfo.storageApi.allowed.capabilities // [] | sort | join(",")' <<<"$auth")
bucket_ids=$(jq -r '.apiInfo.storageApi.allowed.buckets // [] | map(.id // empty) | join(",")' <<<"$auth")
name_prefix=$(jq -r '.apiInfo.storageApi.allowed.namePrefix // empty' <<<"$auth")
auth=''
[ -n "$TOKEN" ] && [[ "$API_URL" =~ ^https:// ]] || {
  echo "réponse d'autorisation B2 inattendue" >&2
  false
}
[ "$caps" = listBuckets,listFiles ] \
  || problem "clé B2 de contrôle avec les capacités « $caps » (attendu : listBuckets,listFiles seulement) : la remplacer"
[[ "$bucket_ids" =~ ^[A-Za-z0-9]+$ ]] || problem "clé B2 de contrôle non limitée à un seul bucket"
[ -n "$name_prefix" ] || problem "clé B2 de contrôle non limitée au préfixe du dépôt restic"
if [ "${#problems[@]}" -gt 0 ]; then
  printf '%s\n' "${problems[@]}" | tee /dev/stderr | ping_hc /fail
  exit 1
fi
REPO=${name_prefix%/} # préfixe de la clé = chemin du dépôt restic dans le bucket (<PREFIXE>)

b2_list() { # $1 appel (b2_list_file_names|b2_list_file_versions), $2 préfixe ; sortie : une ligne JSON par objet
  local call=$1 prefix=$2 page start_name='' start_id=''
  local -a query
  while :; do
    query=(--data-urlencode "bucketId=$bucket_ids" --data-urlencode "prefix=$prefix"
      --data-urlencode "maxFileCount=1000")
    [ -z "$start_name" ] || query+=(--data-urlencode "startFileName=$start_name")
    [ -z "$start_id" ] || query+=(--data-urlencode "startFileId=$start_id")
    page=$(printf 'header = "Authorization: %s"\n' "$TOKEN" \
      | curl -K - -fsS -m 60 --retry 3 -G "$API_URL/b2api/v4/$call" "${query[@]}") || return 1
    jq -c '.files[] | {fileName, action, uploadTimestamp}' <<<"$page"
    start_name=$(jq -r '.nextFileName // empty' <<<"$page")
    start_id=$(jq -r '.nextFileId // empty' <<<"$page")
    [ -n "$start_name" ] || break
  done
}

now_ms=$(($(date +%s) * 1000))

# Chaque liste est lue dans une variable : un échec de l'API arrête le contrôle (alerte).
config_files=$(b2_list b2_list_file_names "$REPO/config")
key_files=$(b2_list b2_list_file_names "$REPO/keys/")
snapshot_files=$(b2_list b2_list_file_names "$REPO/snapshots/")
snapshot_versions=$(b2_list b2_list_file_versions "$REPO/snapshots/")
SNAP_RE='/snapshots/[0-9a-f]{64}$'

# Structure du dépôt : sans `config` ni clé, restic ne peut plus rien ouvrir.
n=$(jq -s --arg f "$REPO/config" 'map(select(.action == "upload" and .fileName == $f)) | length' <<<"$config_files")
[ "$n" -ge 1 ] || problem "fichier config du dépôt restic invisible (masqué ou supprimé)"
n=$(jq -s 'map(select(.action == "upload")) | length' <<<"$key_files")
[ "$n" -ge 1 ] || problem "aucune clé keys/ visible dans le dépôt restic (masquée ou supprimée)"

# Snapshots visibles : nombre et date du plus récent.
count=$(jq -s --arg re "$SNAP_RE" 'map(select(.action == "upload" and (.fileName | test($re)))) | length' <<<"$snapshot_files")
newest=$(jq -s --arg re "$SNAP_RE" \
  'map(select(.action == "upload" and (.fileName | test($re))) | .uploadTimestamp) | max // 0' <<<"$snapshot_files")
age_h=$(((now_ms - newest) / 3600000))
if [ "$count" -eq 0 ]; then
  problem "aucun snapshot visible dans le dépôt restic"
elif [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
  problem "dernier snapshot téléversé il y a $age_h h (seuil $MAX_AGE_HOURS h) : la sauvegarde nocturne ne tourne plus"
fi
[ "$count" -ge "$MIN_SNAPSHOTS" ] \
  || problem "$count snapshots visibles, minimum attendu $MIN_SNAPSHOTS : masquage massif possible"

# Masquages récents de snapshots (marqueurs « hide », visibles seulement dans les versions).
hides=$(jq -s --arg re "$SNAP_RE" --argjson since $((now_ms - 48 * 3600000)) \
  'map(select(.action == "hide" and .uploadTimestamp >= $since and (.fileName | test($re)))) | length' \
  <<<"$snapshot_versions")
[ "$hides" -le "$MAX_HIDES" ] \
  || problem "$hides snapshots masqués en 48 h (seuil $MAX_HIDES) : masquage anormal, voir EXPLOITATION.md 5.1"

summary="$count snapshots visibles, dernier il y a $age_h h, $hides masqués en 48 h"
if [ "${#problems[@]}" -eq 0 ]; then
  echo "OK : $summary"
  echo "OK : $summary" | ping_hc ""
  exit 0
fi
printf '%s\n' "ALERTE sauvegardes ($summary)" "${problems[@]}" | tee /dev/stderr | ping_hc /fail
exit 1
