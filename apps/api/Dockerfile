# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183
# Images de l'API (ADR-0023, docs/EXPLOITATION.md §3.1 et §11). Deux cibles, construites en CI depuis
# la racine du dépôt (contexte filtré par apps/api/Dockerfile.dockerignore, liste blanche) :
#   docker build -f apps/api/Dockerfile --target api     -t amg-api:local .
#   docker build -f apps/api/Dockerfile --target migrate -t amg-api-migrate:local .
# - `api` : l'API seule, sans shell (distroless), non root (65532), sans le CLI Prisma ni son arbre
#   (`effect` compris) : dépendances de production uniquement, client Prisma généré inclus.
# - `migrate` : CLI Prisma, migrations et prisma.config.ts, lancée en conteneur ponctuel par
#   deploy.sh (amg_run, rôle `migrate`) pendant une fenêtre de migration. Porte le label
#   org.amg.roles-sql.sha256 (posé par la CI) : deploy.sh refuse de migrer si le roles.sql installé
#   sur le serveur (relu par l'humain, §3.3) n'est pas celui de cette version.
# Images de base épinglées par digest (index multi-architecture) ; à la mise à jour, changer le tag
# ET le digest ensemble. Étapes de construction en Debian 13 (glibc), comme l'image finale : les
# binaires natifs installés (moteur de schéma Prisma, futurs modules natifs) sont ceux de l'exécution.

# Étape 1 : manifestes des workspaces (npm ci exige tous les package.json du fichier de verrouillage).
FROM node:24.22.3-trixie@sha256:770709aad57b8fdddbad76e76ce88139b9f8411eff7339bb0d923558498550b4 AS manifests
WORKDIR /app
ENV npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/site/package.json apps/site/
COPY libs/api/db/package.json libs/api/db/
COPY libs/shared/schemas/package.json libs/shared/schemas/
COPY libs/shared/tokens/package.json libs/shared/tokens/

# Étape 2 : build (TypeScript de la racine, client Prisma généré), dans l'ordre de Nx (dependsOn).
FROM manifests AS build
RUN npm ci --include-workspace-root -w @amg/api -w @amg/api-db -w @amg/shared-schemas
COPY tsconfig.base.json ./
COPY libs/shared/schemas/tsconfig.lib.json libs/shared/schemas/
COPY libs/shared/schemas/src libs/shared/schemas/src
COPY libs/api/db/tsconfig.lib.json libs/api/db/prisma.config.ts libs/api/db/
COPY libs/api/db/prisma libs/api/db/prisma
COPY libs/api/db/src libs/api/db/src
COPY apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run generate -w @amg/api-db \
 && npm run build -w @amg/shared-schemas \
 && npm run build -w @amg/api-db \
 && npm run build -w @amg/api \
 && test -f apps/api/dist/main.js && test -f apps/api/dist/healthcheck.js \
 && test -f libs/api/db/dist/generated/prisma/client.js

# Étape 3 : dépendances de production de l'API, sans scripts d'installation. Le CLI `prisma` est un
# pair optionnel de @prisma/client et une dépendance de développement de @amg/api-db : npm le marque
# `devOptional` (paquet requis à la fois par une dépendance de développement et par une dépendance
# optionnelle, pair optionnel compris, d'un paquet de production ; aucune dépendance de production
# obligatoire n'en a besoin) et `--omit=dev` l'installe encore, avec tout son arbre. Pas de
# `--omit=optional` (il retirerait aussi les binaires natifs optionnels de production) : chaque
# paquet marqué `devOptional` dans le fichier de verrouillage est retiré, chaque nom retiré doit
# figurer dans apps/api/docker/dev-optional.txt (sinon la construction échoue : relire le
# changement du verrouillage), puis on vérifie que le CLI et `effect` ont bien disparu (ADR-0023).
# npm n'installe pas tout à la racine : une version qui entre en conflit avec un pair d'un autre
# workspace est imbriquée sous le workspace (ioredis 6 de l'API sous apps/api/node_modules, à cause
# du pair ioredis 5 d'unstorage, dépendance du site). Les node_modules des workspaces embarqués
# sont donc copiés dans l'image comme celui de la racine (créés vides au besoin : COPY exige la
# source), aucun paquet marqué `dev` ne doit y être installé, et check-deps.mjs fait échouer la
# construction si une dépendance de production n'est pas résolvable depuis son workspace.
FROM manifests AS prod-deps
RUN npm ci --omit=dev --ignore-scripts -w @amg/api -w @amg/api-db -w @amg/shared-schemas
COPY apps/api/docker/dev-optional.txt /tmp/dev-optional.txt
COPY apps/api/docker/check-deps.mjs /tmp/check-deps.mjs
RUN node --input-type=module <<'EOF'
import { existsSync, readFileSync, rmSync } from 'node:fs';
const { packages } = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const allowed = new Set(
  readFileSync('/tmp/dev-optional.txt', 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#')),
);
const removed = [];
const dev = [];
for (const [path, meta] of Object.entries(packages)) {
  if (!path.includes('node_modules/') || !existsSync(path)) continue;
  if (meta.dev === true) dev.push(path);
  if (meta.devOptional === true) {
    rmSync(path, { recursive: true, force: true });
    removed.push(path.replace(/^.*node_modules\//, ''));
  }
}
const unexpected = removed.filter((name) => !allowed.has(name));
process.stdout.write(`paquets devOptional retirés (${removed.length}) : ${removed.sort().join(' ')}\n`);
if (unexpected.length > 0) {
  process.stderr.write(`ERREUR : retirés hors de dev-optional.txt : ${unexpected.join(' ')}\n`);
  process.exit(1);
}
if (dev.length > 0) {
  process.stderr.write(`ERREUR : dépendances de développement installées : ${dev.join(' ')}\n`);
  process.exit(1);
}
EOF
RUN rm -rf node_modules/prisma node_modules/effect node_modules/@prisma/config node_modules/@prisma/dev \
      node_modules/@prisma/engines node_modules/@prisma/studio-core node_modules/.bin \
      apps/api/node_modules/.bin libs/api/db/node_modules/.bin libs/shared/schemas/node_modules/.bin \
 && for p in node_modules/prisma node_modules/effect node_modules/@prisma/config node_modules/@prisma/dev \
      node_modules/@prisma/engines node_modules/@prisma/studio-core node_modules/.bin \
      apps/api/node_modules/.bin libs/api/db/node_modules/.bin libs/shared/schemas/node_modules/.bin; do \
      test ! -e "$p" || { echo "ERREUR : $p présent dans l'image de l'API" >&2; exit 1; }; \
    done \
 && test -d node_modules/@prisma/client && test -d node_modules/@prisma/adapter-pg && test -d node_modules/pg \
 && mkdir -p apps/api/node_modules libs/api/db/node_modules libs/shared/schemas/node_modules \
 && node /tmp/check-deps.mjs apps/api libs/api/db libs/shared/schemas

# Étape 4 : dépendances des migrations (CLI Prisma compris). Les scripts d'installation tournent :
# celui de @prisma/engines télécharge le moteur de schéma de la plateforme (Debian, OpenSSL 3).
# Comme pour l'API : node_modules du workspace copié aussi (imbrications de npm), résolution des
# dépendances de la lib et du CLI vérifiée ici puis dans l'image finale.
FROM manifests AS migrate-deps
RUN npm ci -w @amg/api-db \
 && test -x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
 && rm -rf node_modules/.bin libs/api/db/node_modules/.bin \
 && mkdir -p libs/api/db/node_modules
COPY apps/api/docker/check-deps.mjs /tmp/check-deps.mjs
RUN node /tmp/check-deps.mjs libs/api/db node_modules/prisma

# Image de l'API : Node 24 sans shell ni gestionnaire de paquets, utilisateur non root 65532.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:675c532423b908f9e56f9d60a4e62309b63cd2a3175acb90a46b96f7ee68e121 AS api
# Valeur d'exemple : la CI la remplace par l'adresse réelle du dépôt (deploy.yml, labels de build-push).
LABEL org.opencontainers.image.source="https://github.com/PROPRIETAIRE/DEPOT" \
      org.opencontainers.image.description="AMG Décoration : API des CRM (NestJS)"
WORKDIR /app
ENV NODE_ENV=production
# Fichiers à root, en lecture seule pour l'utilisateur de l'API (en plus de read_only: true dans Compose).
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
# node_modules imbriqués par npm sous les workspaces (ioredis sous apps/api/node_modules).
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /app/libs/api/db/node_modules libs/api/db/node_modules
COPY --from=prod-deps /app/libs/shared/schemas/node_modules libs/shared/schemas/node_modules
COPY --from=build /app/libs/shared/schemas/package.json libs/shared/schemas/
COPY --from=build /app/libs/shared/schemas/dist libs/shared/schemas/dist
COPY --from=build /app/libs/api/db/package.json libs/api/db/
COPY --from=build /app/libs/api/db/dist libs/api/db/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
# Même contrôle sur l'arborescence finale (sans shell : forme exec, script monté, absent de l'image).
RUN --mount=type=bind,from=prod-deps,source=/tmp/check-deps.mjs,target=/tmp/check-deps.mjs \
    ["/nodejs/bin/node", "/tmp/check-deps.mjs", "apps/api", "libs/api/db", "libs/shared/schemas"]
USER 65532:65532
EXPOSE 3000
# Sonde sans shell : second processus Node minimal (apps/api/src/healthcheck.ts). Drainage avant
# arrêt (deploy.sh) : `healthcheck.js drain` pose /tmp/drain, la sonde échoue, Traefik retire le
# conteneur. Intervalle × essais (5 s × 2) sous l'attente de drainage de deploy.sh (15 s).
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=2 \
  CMD ["/nodejs/bin/node", "/app/apps/api/dist/healthcheck.js"]
CMD ["--enable-source-maps", "apps/api/dist/main.js"]

# Image des migrations : même base, CLI Prisma, schéma, migrations et configuration du CLI.
# Le moteur de schéma est désigné explicitement : sans shell, Prisma ne peut pas sonder la version
# d'OpenSSL de l'image. Aucun accès réseau sortant (réseau `data` interne), télémétrie coupée.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:675c532423b908f9e56f9d60a4e62309b63cd2a3175acb90a46b96f7ee68e121 AS migrate
LABEL org.opencontainers.image.source="https://github.com/PROPRIETAIRE/DEPOT" \
      org.opencontainers.image.description="AMG Décoration : migrations Prisma de l'API (conteneur ponctuel)"
ENV NODE_ENV=production \
    HOME=/tmp \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    JITI_FS_CACHE=false \
    PRISMA_SCHEMA_ENGINE_BINARY=/app/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
COPY --from=migrate-deps /app/package.json /app/
COPY --from=migrate-deps /app/node_modules /app/node_modules
COPY --from=migrate-deps /app/libs/api/db/node_modules /app/libs/api/db/node_modules
WORKDIR /app/libs/api/db
COPY libs/api/db/package.json libs/api/db/prisma.config.ts ./
COPY libs/api/db/prisma ./prisma
COPY libs/api/db/src/database-config.ts libs/api/db/src/secret-file.ts ./src/
# Copie de référence (son empreinte est le label org.amg.roles-sql.sha256) : deploy.sh rejoue le
# roles.sql installé par l'humain, jamais celui de l'image.
COPY libs/api/db/sql/roles.sql ./sql/roles.sql
RUN --mount=type=bind,from=migrate-deps,source=/tmp/check-deps.mjs,target=/tmp/check-deps.mjs \
    ["/nodejs/bin/node", "/tmp/check-deps.mjs", ".", "/app/node_modules/prisma"]
USER 65532:65532
CMD ["/app/node_modules/prisma/build/index.js", "migrate", "deploy"]
