# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183
# Image du site statique.
# Images de base épinglées par digest (index multi-architecture, relevé avec
# `docker buildx imagetools inspect <image:tag>`) : un tag republié ne change pas l'image construite.
# À la mise à jour, changer le tag ET le digest ensemble.
# Contexte de build : racine du dépôt. `apps/site/dist` est le build déjà vérifié par la CI
# (`npm run verify`, e2e, Lighthouse) : l'image sert exactement ce qui a été testé.
#   docker build -f apps/site/Dockerfile -t amg-site:local .

# Étape 1 : table de redirections nginx (depuis vercel.json) et précompression gzip.
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS prepare
WORKDIR /work
COPY vercel.json ./
COPY apps/site/scripts/nginx-redirects.ts ./
COPY apps/site/dist ./dist
RUN node nginx-redirects.ts vercel.json > redirects.conf \
 && find dist -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' \
      -o -name '*.xml' -o -name '*.txt' -o -name '*.json' -o -name '*.webmanifest' \) \
      -size +1k -exec gzip -k -9 -n {} +

# Étape 2 : nginx non root (UID 101, port 8080), sans Node ni outil de build.
FROM nginx/nginx-unprivileged:1.31.10-alpine3.24-slim@sha256:f4afc48254dc77ea692ec6979d220e5b1176331c636a4d51c502ffdded6789bd
LABEL org.opencontainers.image.source="https://github.com/PROPRIETAIRE/DEPOT" \
      org.opencontainers.image.description="AMG Décoration : site vitrine statique"
COPY apps/site/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=prepare /work/redirects.conf /etc/nginx/amg/redirects.conf
COPY --from=prepare /work/dist /usr/share/nginx/html
# Échoue au build si la configuration est invalide.
RUN nginx -t -c /etc/nginx/nginx.conf
# Utilisateur non root de l'image de base, rendu explicite (deploy/compose.yaml l'impose aussi).
USER 101:101
EXPOSE 8080
# Drain avant arrêt (déploiement sans coupure) : /tmp/drain rend le conteneur « unhealthy »,
# Traefik le retire du routage avant qu'il ne s'arrête.
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=2 \
  CMD test ! -f /tmp/drain && wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
