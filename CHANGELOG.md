# Changelog

Toutes les évolutions notables du site, par phase. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### CRM 3 : API et sécurité (en cours)

- Lot 0 « socle » (ADR-0023) : API `apps/api` (`@amg/api`, NestJS 12.6.2 sur Fastify 5, ESM, compilée par `tsc`, sans plugin Nx ni CLI Nest) et lib `libs/shared/schemas` (`@amg/shared-schemas`, Zod 4) ; mode TypeScript « solution » (`tsconfig.base.json` sans `paths`, libs compilées vers `dist/`, références de projet) ; base ESLint typée commune (`strictTypeChecked`, aucune règle désactivée).
- `GET /api/health` (vivacité seule) ; en-têtes de sécurité sur toute réponse (`no-store`, CSP `default-src 'none'`, `nosniff`, `DENY`…), aucun en-tête CORS, corps JSON limité à 64 Kio.
- Configuration validée au démarrage par une fonction pure (liste blanche, erreurs sans valeur, refus de démarrer) ; secrets lus depuis des fichiers `*_FILE`, forme directe interdite en production, valeurs masquées dans toute sérialisation.
- Tests Vitest : configuration et secrets, métadonnées de décorateurs sous Vitest (sans SWC), application complète par `app.inject()` ; `npm run verify` couvre désormais l'API et la lib.
- `compose.dev.yaml` : Postgres et Redis de développement aux digests de production, ports sur `127.0.0.1` seulement.
- Décisions consignées dans l'ADR-0023 : API à la même origine que chaque CRM (cookies `__Host-amg_admin_sid` et `__Host-amg_client_sid`, CSRF en `X-CSRF-Token`), durées de session, 10 codes de secours et commande `reset-mfa`, contact de sécurité facultatif de l'exploitant, emails automatiques par Resend depuis le worker (ADR-0019 révisée).
- Suivi de l'audit de sécurité du lot 0 : rejets du routeur Fastify (URL mal encodée, paramètre trop long) avec les en-têtes de sécurité et un 400 générique qui ne recopie pas le chemin (`frameworkErrors`) ; seul `application/json` est analysé (`text/plain` et `application/x-www-form-urlencoded` : 415) ; délais `requestTimeout` 30 s et `connectionTimeout` 120 s ; lecture des secrets sans suivre les liens, sans blocage sur un tube, bornée à 4 Kio + 1, taille lue égale à la taille annoncée (pseudo-fichiers de /proc refusés), UTF-8 strict. ADR-0023 précisée : CSRF (jeton, `Sec-Fetch-Site: same-origin`, `Origin` exact) et routes admin introuvables sur l'hôte espace, `trustProxy` à un seul saut et limitation de débit IP + compte, sessions (références ASVS corrigées, sessions simultanées, révocations, liste des sessions), `reset-mfa` avec réinitialisation du mot de passe et code d'enrôlement, sortie du worker par mandataire limité à Resend.
- Site inchangé : aucun fichier de `apps/site/` modifié.
- Lot 1 « base » : lib `libs/api/db` (`@amg/api-db`) avec Prisma 7.10.1 épinglé exactement (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg` 8.23.1), `prisma.config.ts` sans URL dans l'environnement (construite depuis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` et `DB_PASSWORD_FILE`), client généré en ESM (ignoré par git).
- Schéma initial et première migration : comptes (email normalisé unique, Argon2id, statut), liens d'activation (SHA-256 d'un jeton de 256 bits, 7 j / 72 h), facteur TOTP chiffré (IV, étiquette, version de clé, dernier pas), codes de secours et d'enrôlement (HMAC), journal de sécurité ; identifiants UUID v7 générés par PostgreSQL 18 ; contraintes CHECK (normalisation, longueurs d'empreintes, durées de vie) ; journal en ajout seul par déclencheur, date fixée par la base.
- Rôles PostgreSQL : `amg_migrator` (propriétaire, migrations) et `amg_app` (API : DML table par table, `INSERT`/`SELECT` seulement sur le journal, aucun DDL), script idempotent `libs/api/db/sql/roles.sql` ; l'API refuse de démarrer sous un rôle réservé.
- API : module de base de données (client Prisma sous `PRISMA_CLIENT`, pool de 5, délais côté serveur, aucune connexion au démarrage, fermeture à l'arrêt), configuration étendue (`DB_*`, secret `DB_PASSWORD`) ; lecteur de fichiers secrets déplacé dans `@amg/api-db` (partagé avec le CLI Prisma).
- CI : job « API (intégration) » (PostgreSQL au digest de production, rôles, `migrate deploy`, absence de dérive, rejeu idempotent, tests d'intégration de la lib et de l'API) ; contrôles « migration déjà fusionnée inchangée » et « même image PostgreSQL partout ».
- Décision de l'humain (point A4 de l'audit) : **lien d'activation à usage unique** au lieu du mot de passe provisoire, pour l'invitation, le renvoi, l'oubli de mot de passe et `reset-mfa` (ADR-0023, ADR-0019 révisées).
- Suivi de l'audit de sécurité du lot 1 : CI corrigée (`DB_HOST`, `DB_PORT`, `DB_NAME` posées aux seules étapes qui parlent à la base, `prisma generate` ne voit plus de configuration partielle) ; liens d'activation et codes d'enrôlement datés par la base (déclencheur : `created_at` forcé, consommation et révocation définitives, lien expiré non consommable), `UPDATE` de l'API limité à `consumed_at` et `revoked_at`, un seul lien et un seul code vivants par compte (index uniques partiels) ; journal : identifiant forcé par la base et déclencheur d'événement du superutilisateur qui interdit au propriétaire de désactiver, remplacer ou supprimer sa protection ; aucune fonction exécutable par `PUBLIC` par défaut, `template1` fermée ; contrôle de chaque connexion de l'API (refus de servir sous un rôle superutilisateur ou propriétaire) ; CLI `prisma` en dépendance de développement, job « Audit des dépendances de production » avec exceptions datées ; nouvelle migration horodatée avant la dernière de `main` refusée ; doc : mot de passe des migrations visible dans `/proc` pendant `migrate deploy` et parades du lot 2, consignes du lot 4 (TOTP, consommation).
- Suivi du contre-audit de sécurité du lot 1 : le déclencheur d'événement du journal vérifie l'état de `security_events` après **toute** commande DDL (`GRANT`/`REVOKE`, `CREATE INDEX`, `ALTER TYPE` compris) : droits exacts d'`amg_app` (un `REVOKE INSERT` ne bâillonne plus le journal), aucun index unique, partiel, sur expression ou d'exclusion (plus de censure par index), valeurs initiales de `security_event_type` préservées dans l'ordre (`RENAME VALUE` refusé, `ADD VALUE` permis), politiques RLS refusées ; même vérification en fin de rejeu de `roles.sql`, désormais atomique ; `amg_migrator` créé `NOLOGIN` (fenêtres de migration explicites), délais côté serveur (verrou 5 s, requête 5 min) ; l'API refuse aussi un rôle `CREATEROLE`, `CREATEDB`, `REPLICATION` ou membre d'un autre rôle ; consommation d'un lien comparée à `statement_timestamp()` ; audit des dépendances en échec si une vulnérabilité élevée n'a aucun avis identifié ; CI : PostgreSQL publié sur `127.0.0.1` seulement. Doc : fenêtres de migration et du journal, règle « le superutilisateur n'exécute jamais le code d'`amg_migrator` » (`SET ROLE` n'est pas une frontière), restauration directe en `amg_migrator` dans une base neuve, exclusion du CLI Prisma de l'image sans `--omit=optional`.
- Suivi de l'audit de sécurité final du lot 1 : `roles.sql` épingle `search_path = pg_catalog, pg_temp` pour toute sa session et qualifie ses appels (une surcharge `public.format(text, name)` d'`amg_migrator` ne s'exécute plus sous le superutilisateur au rejeu), `amg` reçoit ce chemin par défaut et la doc impose `PGOPTIONS` à toute commande sous `amg`, qui ne lit plus aucune table ni vue de `public` ; fonction du déclencheur du journal déplacée dans `amg_guard`, possédée par le superutilisateur ; journal « scellé une fois, scellé toujours » (marqueur `amg_guard.journal_sealed`, table présente non scellée refusée au rejeu) ; contraintes exactes du journal (clé primaire, CHECK des détails figé, NOT NULL de PostgreSQL 17 et 18), clés étrangères vers le journal et déclencheurs internes refusés ; transaction inactive d'`amg_migrator` limitée à 1 min ; doc : empreinte du journal sous `amg_app` autour d'une fenêtre, une seule migration par fenêtre du journal, exigences du lot 2 (`trap` de fermeture de fenêtre dans `deploy.sh`, `restore-test.sh` et `restore-gate.sh` à revoir).

### CRM 2 : socle serveur (en cours)

- Image Docker du site : nginx non root, en lecture seule, configuration des redirections et en-têtes générée depuis `vercel.json` (`apps/site/scripts/nginx-redirects.ts`), 308 et règles sensibles à la casse dans l'ordre de Vercel, `Cache-Control` du HTML identique.
- Tests : 40 tests unitaires du générateur, test de conformité de l'image contre Vercel (`npm run test:conformance -w @amg/site`, image construite au préalable).
- `deploy/` : projets Compose production et préproduction (Postgres 18, Redis 8, réseaux d'entrée internes dédiés), déploiement sans coupure avec retour arrière, commande SSH forcée, sauvegardes chiffrées restic + age vers Backblaze B2 (30 jours, puis 14 jours des versions masquées), surveillance, test de restauration ; workflow `deploy.yml` (image, Trivy, GHCR, préproduction ; production derrière `AMG_PROD_SITE_ON_VPS` et approbation humaine).
- `docs/EXPLOITATION.md` ; ADR-0020 et ADR-0015 révisées (Traefik partagé entre deux projets indépendants, garde-fou légal sur le VPS).
- Suivi de l'audit de sécurité : la CI ne transmet plus de fichier Compose (installation par l'humain après relecture, contrôle `sha256sum`) ; déploiement et retour arrière par digest d'image ; job de publication GHCR séparé du job npm ; actions épinglées par SHA, clé SSH en `ssh-agent`, Trivy en version fixe ; images de base par digest ; restic sans capacités ; clé B2 du serveur sans droit de suppression ; test de restauration mensuel sur le poste de l'humain (`restore-prod.sh` réservé à l'incident) ; contrôle des labels Traefik dans `watch.sh` ; redirection ouverte par barre oblique inverse fermée dans nginx ; préproduction en bcrypt coût 10 et limitée en débit ; modèle `redis.conf`.
- Suivi du contre-audit de sécurité : `deploy.sh` refuse toute image portant un label `traefik.*` (digest précédent conservé) ; `watch.sh` contrôle les labels Traefik par liste blanche stricte ; contrôle quotidien des sauvegardes hors VPS (`backup-watch.yml`, clé B2 limitée à la liste des fichiers : âge du dernier snapshot, nombre de snapshots visibles, masquages récents) ; restauration de production déchiffrée sur le poste et envoyée par SSH à une commande forcée sans clé (`restore-prod.sh` sur le poste, `restore-gate.sh` sur le serveur) ; préproduction limitée à 10 requêtes/s (rafale 60) ; CI en lecture seule avec actions épinglées par SHA ; contrôle du digest publié contre le tag ; test de restauration en `--no-lock` et Postgres jetable sans capacités superflues.
- Budget mémoire AMG de 4 Gio imposé par le noyau (ADR-0020, seconde révision du 2026-11-25 ; valeurs remplacées par la puce suivante : slice à 3 800 Mio, seuil 3 288 Mio) : slice systemd `amg.slice` (`deploy/systemd/amg.slice` : `MemoryMax=4G`, `MemoryHigh=3840M`, sans swap, 3 vCPU au plus, priorité CPU basse) dont tous les conteneurs AMG sont enfants (`cgroup_parent` dans Compose, `--cgroup-parent` sur la sauvegarde) ; garde-fou en CI `deploy/ci/check-budget.sh` (pire cas actuel 1 728 Mio, bascule et sauvegarde comprises, seuil 3 584 Mio) ; `deploy.sh` refuse de déployer sans la slice ; `watch.sh` alerte au-delà de 85 %, sur `oom_kill` et pour tout conteneur hors de la slice ; tableau du budget et réservations (`docs/EXPLOITATION.md`, 10) ; ClamAV retiré au profit de la reconstruction des fichiers (ADR-0022).
- Suivi de l'audit de sécurité du budget mémoire (ADR-0020, troisième révision) : 4 Gio **tout compris** (slice `amg.slice` à 3 800 Mio, ~296 Mio pour les coûts hors slice), sous-slices `amg-prod.slice` et `amg-staging.slice` (préproduction plafonnée à 1 Gio, tuée en premier), constantes uniques dans `deploy/bin/amg-common.sh` ; conteneurs ponctuels uniquement par `amg_run` (slice, sans swap, label, un seul à la fois), la CI refusant toute autre création de conteneur ; répliques Compose > 1 et `tmpfs` sans taille refusés ; sauvegarde sous le verrou de la production ; limites réellement appliquées par le noyau relues par `deploy.sh` et `watch.sh` ; alerte sur la mémoire non récupérable et la pression mémoire ; conteneurs sans label sur une ressource AMG repérés ; job « Budget mémoire AMG » sur chaque PR ; seuil de la CI à 3 288 Mio, pire cas actuel 1 600 Mio, réservations de la préproduction réduites.
- Suivi du contre-audit du plafond mémoire : `amg_run` passe en liste blanche d'options avec contrôle de chaque valeur (réseau `none`/`bridge`, montages limités aux volumes AMG et à `/opt/amg` hors secrets, `DAC_READ_SEARCH` seule capacité ajoutable, image épinglée par digest et sans label Traefik, plafond commun vérifié avant lancement) ; Docker exigé en pilote cgroup systemd v2 ; `deploy.sh` vérifie le scope réel de la nouvelle réplique dans sa slice et refuse un `amg.env` d'un autre environnement ; slices contrôlées aussi sur `FragmentPath`, `CPUQuotaPerSecUSec`, `TasksMax`, `cpu.max`, `pids.max` ; `watch.sh` : Traefik partagé désigné obligatoirement par son nom (`TRAEFIK_CONTAINER`) et excusé seulement sur les réseaux `amg_edge_*`, ponctuels sans aucun label Traefik et un seul à la fois ; la CI refuse `build:`, `--scale` hors de `deploy.sh`, `-f` après `compose`, un `amg_run` en arrière-plan et tout accès direct au démon Docker.

### Monorepo Nx

- Le site est déplacé dans `apps/site` (workspaces npm, paquet `@amg/site`), sans aucun changement visible : le site construit est identique octet pour octet à la référence aux étapes 1 (déplacement) et 2 (Nx), et à l'étape 3 (tokens) au déplacement de la déclaration `--grain-image` près (ADR-0019, ADR-0021).
- Nx 24.0.6 ajouté à la main, sans plugin Astro : tâches inférées des scripts npm, cache sur `build`, `check`, `test` et `lint` (variables du build et `vercel.json` en entrées), `parallel: 1`, sans daemon ni TUI.
- Tokens de design extraits dans `libs/shared/tokens` (`@amg/shared-tokens`), communs au site et aux futures apps du CRM ; la texture de grain, propre au site, reste déclarée dans son CSS.
- `vercel.json` à la racine fixe le build (`buildCommand` du workspace `@amg/site`, `outputDirectory: apps/site/dist`) : le Root Directory Vercel reste vide. CI GitHub Actions alignée sur les nouveaux chemins.
- Commandes `npm run …` inchangées, toujours lancées depuis la racine ; `npx nx show projects` liste les projets.
- Documentation (CLAUDE.md, ARCHITECTURE, DESIGN-SYSTEM, MISE-EN-LIGNE, README, agents) mise à jour pour les nouveaux chemins.

### Projet CRM : cadrage

- Architecture validée par l'humain : monorepo Nx (site Astro, admin et espace client Angular, API NestJS, PostgreSQL + Prisma, Zod), hébergement Docker sur son VPS OVH à côté d'un projet existant et de son Traefik, sauvegardes chiffrées sur Backblaze B2, préproduction (ADR-0019, ADR-0020). Détails d'accès au serveur hors dépôt.
- Nouveaux agents `backend`, `frontend`, `securite` et `devops` ; 8 étapes CRM dans la ROADMAP.

### Pas de longs traits horizontaux

- Préférence de l'humain pour toutes les apps : plus aucun filet horizontal pleine largeur sur le site. Séparation par l'espacement, les aplats existants, les cartes et une ombre douce ; aucune nouvelle couleur.
- En-tête au défilement : ombre douce au lieu du filet. Bandeau de mots : aplat beige au lieu de deux filets. `<hr>` : petite arche terracotta centrée. `Divider` toujours court (variante `full` supprimée).
- Filets retirés dans les listes, sommaires, `<dl>`, cartes de formules et d'offres (prix détaché par l'espace), étapes, bénéfices, témoignages, valeurs, filtres, pager, pied de page et menu mobile. Les traits courts restent (surtitres, soulignés de liens, navigation active).

### Accent terracotta doux

- L'accent camel est remplacé par le terracotta doux choisi par l'humain, commun au site et aux deux futurs CRM (ADR-0018) : boutons `#A4533A`, liens et texte d'accent `#8F4530`, décor `#D79A7C`. Les fonds crème, beige et grège de l'ancien site ne changent pas.
- Tokens renommés `--color-terracotta-300/600/700` ; rôles sémantiques inchangés, composants intacts. Contrastes WCAG AA vérifiés en test sur les cinq fonds (texte d'accent de 4.92 à 6.75:1, bouton 5.33:1), garde-fou : aucun token `camel` ne subsiste.
- Favicon, styleguide, design system et CLAUDE.md alignés.

### Production provisoire sur Vercel

- CGS art. 7 : publication des projets et des photos maintenue, les publications étant totalement anonymes (confirmé par l'humain) ; plus aucun point légal bloquant, `npm run check:prod` vert.
- Prix : formules et options à prix fixe, d'après l'offre officielle d'Amandine (avril 2026) ; formule « Essentielle », modifications incluses (1, 2, 3, illimitées), délais de livraison et prix des 5 options affichés ; planche d'ambiance incluse, sélection de mobilier avec liens en option (shopping-list) ; CGS art. 1, 3 et 5 alignés. 1 point légal reste bloquant (accord des clients pour les photos).
- Médiateur de la consommation : risque accepté par l'humain (adhésion reportée pour raison de coût), le point ne bloque plus la mise en ligne et figure dans la liste d'après bascule ; aucun nom affiché sans adhésion réelle. 2 points légaux restent bloquants (prix, accord des clients pour les photos).
- CGS, article 4 : la prestation démarre à l'expiration du délai de rétractation de 14 jours (pratique d'Amandine) ; plus de démarrage anticipé ni de montant dû en cas de rétractation, remboursement intégral sous 14 jours ; 4 points légaux restent bloquants.
- Confidentialité : durée de conservation (3 ans) et absence de prospection passées en non bloquant (l'obligation d'indiquer une durée est déjà remplie) ; 5 points légaux restent bloquants.
- Pied de page : sur mobile, quand les liens légaux passent sur deux lignes, chaque ligne fait 44 px ; « Mentions légales » retrouve une zone de clic complète (31 px auparavant, recouverte par le lien du dessous). Test e2e de la zone réellement cliquable.
- Pages légales : mention « Amandine Gaury EI » (entrepreneur individuel, imposée par le décret 2022-725) et adresse du siège (24 allée du Pré Lambesc, 91190 Gif-sur-Yvette, nouveau jeton `{legalAddress}` tiré de `site.ts`) dans les mentions légales, les CGS, le formulaire de rétractation et la confidentialité ; 6 points légaux restent bloquants.
- Correctif : le marqueur `{à-préciser}` ne bloque plus que les builds Vercel (production et previews) ; le build de test du mode service (`test:e2e:service`, endpoint factice) refonctionne en CI.
- Pas d'inscription au RCS : Amandine ne vend que des prestations de services (confirmé le 2026-11-22) ; 9 points légaux restent bloquants.
- Pages légales : 7 des 23 points bloquants réglés sans attendre Amandine (« prix nets » au lieu de « TTC », définitions des CGS alignées sur le devis signé, repli `mailto:` assumé, aucune photo Pexels, pas de crédit de conception, hébergeur sans téléphone, messagerie Gmail en simple recommandation) ; 16 restent (`npm run check:prod`).
- Consolidation des pages légales : 6 points de plus levés sans Amandine, décisions tracées en commentaire (immatriculation au RNE affichée avec le SIREN, puisqu'il n'existe pas de numéro RNE distinct ; délais renvoyés au devis, conformes à L111-1 3° ; RC Pro non obligatoire pour une décoratrice ; dates d'entrée en vigueur et de mise à jour sans obligation légale ; clients professionnels) ; durée de conservation et absence de prospection regroupées en un seul point ; il reste **10** `TODO(contenu)` bloquants (adresse ou domiciliation, mention « EI », inscription au RCS à exclure, médiateur, prix, validation de l'art. 4, accord des clients pour les photos, conservation et prospection).
- CGS : clause légale réservée aux clients professionnels dans l'article 5 (pénalités de retard au taux de la BCE majoré de 10 points, exigibles sans rappel, indemnité forfaitaire de 40 € pour frais de recouvrement, Code de commerce L441-10 et D441-5) ; définition « Client » alignée sur le devis signé ; « prix nets : TVA non applicable, article 293 B du CGI » sans doublon.
- Docs de conformité et de mise en ligne alignées : nouveau point « avis clients » (information sur le contrôle des avis, L111-7-2 du Code de la consommation, non bloquant), service de formulaire à nommer avant de définir `PUBLIC_FORM_ENDPOINT`, liste des questions pour Amandine réduite à l'essentiel.
- Chaque build de production écrit l'état du garde-fou légal dans son journal (« Garde-fou légal : actif / inactif »).
- Le garde-fou des pages légales ne bloque plus que le build de production qui sert le vrai domaine (`VERCEL_PROJECT_PRODUCTION_URL`) : la production se déploie sur son adresse `*.vercel.app` (en `noindex`) sans attendre les informations d'Amandine ; rattacher le domaine exige `check:prod` vert puis un redéploiement (ADR-0015 révisée, `docs/MISE-EN-LIGNE.md`).

### Images de l'ancien site

- Plus aucun placeholder sur les pages publiques : portrait d'Amandine (accueil, `/a-propos/`), rendus 3D en 2560 px pour les héros de l'accueil et de `/visualisation-3d/` et pour l'image Open Graph par défaut, vraie paire rendu 3D / photo du résultat pour le comparateur (chambre d'enfant sous combles, points de vue proches mais pas identiques, signalé dans le chapeau).
- 8 anciens projets publiés sans texte sur l'ancien site ajoutés aux réalisations (12 au total) : rendus 3D en 1600 × 900, photos avant et, pour la chambre d'enfant, photos après ; textes rédigés d'après les images, sans prénom de client, à faire confirmer par Amandine (`TODO(contenu)`).
- `/projet-1/` à `/projet-7/` et `/projet-marine/` redirigent vers leur nouvelle fiche au lieu de `/realisations/`.
- Les 4 projets récents restent en 1200 × 600 : c'est la taille des fichiers d'origine sur l'ancien site.
- Image héro (élément LCP) encodée en AVIF qualité 40 au lieu de 50 : 30 → 17 Ko en 720w sur un rendu détaillé, sans perte visible ; les fiches aux sources 1600 × 900 repassent sous les 2 s de LCP.
- CI : délai de démarrage du serveur e2e porté à 10 min, et cache des images optimisées entre les jobs (`actions/cache`), pour éviter de régénérer les ~2 200 variantes à chaque build.

### Palette de l'ancien site

- Palette « pastel + terracotta » remplacée par celle de l'ancien site d'Amandine : fonds crème, beige et grège, camel doré en décor, camel foncé pour les boutons et les liens, vieux rose en touche, texte gris-brun ; erreurs en vieux rose foncé ; favicon assorti (ADR-0017).
- Tokens renommés d'après leur vraie couleur (`camel-*`, `beige`, `greige`, `rose-*`, `ivory`), contrastes AA vérifiés en test sur les cinq fonds de section.

### Après la Phase 8 — Contenus de l'ancien site

- Vraies images des 4 réalisations (31 rendus 3D et photos avant travaux d'Amandine, repris de son ancien site en 1200 × 600) et des couvertures des 2 articles, avec des textes alternatifs descriptifs ; section « chambre des enfants » du chalet décrite d'après les rendus.
- Réponses reprises de l'ancien site : formation, rendez-vous à distance en visio ou par téléphone, WhatsApp comme canal d'accompagnement, chalet en Suisse mené à distance.
- Image Open Graph : la couverture si elle atteint 1200 × 630, sinon l'image par défaut avec son texte alternatif (ADR-0011 révisée) ; `srcset` jusqu'à la largeur de la source.
- Images en arche, cartes et vignettes de galerie recadrées au build à la proportion de leur cadre (`coverCrop`), au lieu de gonfler `sizes` : héro mobile des fiches projet de ~30–38 Kio à 14–19 Kio en AVIF (480 × 600), LCP de `/realisations/espace-de-vie-scandinave/` sous les 2 s, HTML de l'accueil 13,9 Ko gzip.
- Suivi de revue : MJM Design Graphic retiré de `/a-propos/` en attendant qu'Amandine confirme son lien avec la certification de 2010 ; chapeau du comparateur juste aussi sans JavaScript ; règle « une seule image » de la visionneuse testée en unitaire ; coloration Shiki désactivée (aucun bloc de code).

### Phase 8 — Préparation à la mise en ligne

- Garde-fou de mise en production : le build Vercel de production échoue tant qu'un `TODO(contenu)` reste dans les mentions légales, les CGS ou la confidentialité ; `npm run check:prod` donne la même liste en local (ADR-0015).
- Gabarit des corps Markdown : coordonnées et SIRET injectés depuis `site.ts`, paragraphes de la confidentialité affichés selon le mode réel du formulaire (repli `mailto:` ou service) ; jeton ou bloc inconnu = build en échec (ADR-0016).
- Comparateur « Rendu 3D ↔ Réalisé » visible sur `/visualisation-3d/` (paire configurable, images provisoires signalées), dévoilement en `transform` au lieu de `clip-path`.
- Section « Décoratrice d'intérieur à Paris, et à distance partout en France » sur `/contact/`.
- Redirection `www` → domaine nu en un seul saut (aussi pour les anciennes URL), nœud `Service` sur `/visualisation-3d/`, descriptions avec appel à l'action, plus de recouvrement « plan 3D ».
- Passe axe sur les colonnes collantes défilantes ; port du serveur de test surchargeable (`PLAYWRIGHT_PORT`).
- `docs/MISE-EN-LIGNE.md` : informations à obtenir d'Amandine (bloquantes, visuels, faits à confirmer) et checklist de bascule (Vercel, DNS, HTTPS, Search Console, Google Business Profile).

### Phase 7 — Qualité finale

- CSP stricte par empreintes (`security.csp` d'Astro, balise meta), élaguée page par page aux seuls éléments inline présents ; en-têtes Vercel complétés (`frame-ancestors`, `base-uri`, `object-src`, CORP, Permissions-Policy) ; aucune violation CSP sur les 25 pages, testé en e2e et sur le build en mode service (ADR-0012).
- Console propre et ressources vérifiées (liens internes, images, polices) sur toutes les pages, en e2e.
- Apparitions au défilement liées au scroll en CSS (`animation-timeline: view()`), animées par liste plutôt que par élément, repli IntersectionObserver pour Firefox : environ −75 % de recalculs de style sur l'accueil (ADR-0013).
- Icônes en sprite SVG `<use>` à URL versionnée (cache immuable d'un an) : HTML de l'accueil 14,9 → 13,5 Ko gzip, sous la fenêtre TCP initiale de 14 Ko, contrôlé en e2e.
- INP : fermeture de la visionneuse reportée après le rendu, trait du comparateur plus lisible.
- Accessibilité : visionneuse annonçant « Image n sur N : légende », bandeau en pause tant que le focus clavier y est, `scroll-margin` des ancres sous l'en-tête collant, nature des cartes « Pour aller plus loin » lue après leur titre.
- Formulaire : un clic sur « Envoyer » juste après la correction d'une erreur n'est plus perdu (test de régression).
- Audit d'accessibilité complet (0 P1) : les colonnes latérales collantes plus hautes que l'écran (sommaire des pages légales, coordonnées du contact) ne cachent plus de lien atteint au clavier.
- Régression visuelle de référence : 22 captures pleine page (11 pages, mobile et desktop), `npm run test:visual`, hors CI (rendu des polices propre à chaque machine).
- `/audit` global consolidé (`.claude/reports/audit-2026-11-19.md`) : 0 P1 dans le code ; les P1 restants (visuels, mentions légales, médiateur, CGS) attendent les informations d'Amandine et sont reportés en Phase 8.
- Architecture : origine du site exigée par `requireSiteOrigin` (plus de repli silencieux vers `localhost`), JSON-LD des prestations produit hors de la page, garde de type des microcopies du formulaire ; découpage lecteur / modèle de `lib/pages/` documenté (ADR-0014).

### Phase 6 — SEO avancé

- JSON-LD relié par `@id` sur chaque page (`#service`, `#projet`, `#article`, `#page`, `#fil-ariane`), `CollectionPage` des prestations, zone desservie tirée de `site.ts` ; un test valide le graphe de chaque page de `dist/` (références résolues, URL absolues, propriétés requises).
- Image Open Graph 1200 × 630 propre à chaque page (recadrage `getImage`, build en échec si la source est trop petite) ; balises `article:published_time`, `modified_time`, `author`, `section` et `tag`.
- `robots.txt` (sans `Disallow`) et `llms.txt` générés au build depuis `site.ts` et les collections (ADR-0011) ; `lastmod` du sitemap pour le blog, à partir des dates réelles.
- h1 orientés mot-clé sur les 6 fiches prestations (`heroTitle`, le nom passe en surtitre) ; Essentiel recentré sur la petite pièce, Professionnels sur le home staging virtuel.
- Accueil : méthode et avantages en résumé (titres seuls) avec lien vers `/visualisation-3d/`, plus aucun texte dupliqué.
- Maillage : « Pour aller plus loin » sur les fiches prestations et la page 3D, ancres descriptives, signature visible de l'autrice sur les articles, LinkedIn d'Amandine, zone Paris et Île-de-France dans le pied de page.
- Honeypot du formulaire testé sur un build en mode service (`npm run test:e2e:service`, en CI).

### Phase 5 — Effets et interactions

- Apparitions au scroll (texte décalé, révélation des images en arche) préparées en JS pour les seuls éléments sous la ligne de flottaison : le contenu est visible sans JS, en mouvement réduit et dès qu'il reçoit le focus clavier.
- Comparateur « Rendu 3D ↔ Réalisé » accessible : `<input type="range">` natif (clavier complet, `aria-valuetext`), glisser souris, geste tactile horizontal qui laisse défiler la page à la verticale.
- Visionneuse des galeries projet en `<dialog>` natif : focus piégé, Échap, flèches, focus rendu à la vignette ; image grand format chargée à l'ouverture avec un `sizes` adapté au portrait ; sans JS, les vignettes ouvrent l'image.
- Morphing grille → projet en View Transitions natives (ADR-0006), bandeau de mots animé avec bouton pause (WCAG 2.2.2), CTA magnétique léger (pointeur fin seulement).
- Classe `js` posée par un script inline de 170 octets, retirée si un module échoue : retour à la version sans JS (ADR-0010).
- Audit performance : ouverture de la visionneuse 184 → 88 ms (INP), glisser du comparateur sans layout forcé (97 → 5 layouts pour 100 déplacements), scripts communs réunis en un module (3 requêtes et 590 o de moins par page), bandeau hors écran sans calque composité.
- JS par page : 2,7 à 4,0 Ko gzip sur les pages publiques, 4,8 Ko sur le styleguide (budget 30 Ko) ; CSS total 14,1 Ko (budget 35 Ko).

### Phase 4 — Pages

- 25 pages : accueil définitif, prestations (liste + 6 fiches), visualisation 3D, réalisations filtrables + 4 fiches projet, à propos, conseils déco + 2 articles, contact + merci, mentions légales, confidentialité, CGS.
- 30 blocks éditoriaux partagés (Hero, ServicesGrid, ProjectGrid, ProcessSteps, Benefits3D, Testimonials, CtaBanner, Marquee, ContactForm…) ; pages = assemblage, contenu lu via `src/lib/pages/*`.
- Formulaire de contact conforme RGPD (aucune adresse, aucune case de consentement, mention d'information) : `POST` vers `PUBLIC_FORM_ENDPOINT` ou repli `mailto:` expliqué à l'écran ; validation et envoi accessibles avec JS.
- Pages légales rédigées (`docs/CONFORMITE.md` : 18 points ouverts pour Amandine) ; aucun cookie, donc pas de bandeau.
- JSON-LD par type de page : `Service`, `CreativeWork`, `BlogPosting`, `CollectionPage`, `AboutPage`, `ContactPage`, `BreadcrumbList`.
- Garde-fous : liens internes en 200 sans redirection, aucune page orpheline, aucun `TODO` ni brouillon dans `dist/`, débordement à 320 px et espacement WCAG testés sur toutes les pages.
- Lighthouse CI audite désormais les 25 pages (il n'en découvrait que 5), CLS en médiane, budgets JS/CSS bloquants. CLS de `/realisations/` corrigé (0,057 → 0,0002), Fraunces 400 italique retirée.
- Polices de repli ajustées écrites à la main pour Linux et Android (ADR-0009) : CLS de `/contact/` 0,0597 → 0 en CI.
- CI : un seul run par push (PR), actions en v7 (Node 24), Lighthouse sur l'artefact `dist` vérifié, rapports conservés.

### Phase 3 — Contenu

- Re-crawl complet du site actuel : 26 URLs de contenu inventoriées, textes intégraux, meta et avis exacts archivés dans `docs/contenu-source/`. Correction de l'attribution de l'avis « projet de cuisine » (Sébastien T.).
- Collections de contenu (ADR-0007) : `pages`, `prestations` (4 formules + meuble sur mesure + offre professionnels, prix stockés et pilotables par `site.pricing.showPrices`), `projets` (4 réalisations aux slugs descriptifs), `articles`, `temoignages` (4 avis mot pour mot), `faq`, `etapes`, `avantages`. Longueurs SEO, `alt` et liens internes validés au schéma.
- Textes réécrits par le `redacteur` à partir des seuls faits du site actuel ; chaque information manquante est un `TODO(contenu)`.
- Redirections de migration en un seul saut (ADR-0008) : 70 règles permanentes générées depuis `src/lib/redirects.ts` et testées.
- Placeholders d'images documentés dans `src/assets/placeholders/README.md`.

### Phase 2 — Squelette et navigation

- Source de vérité `src/config/site.ts` (NAP, horaires, zone, réseaux, navigation), microcopie d'interface (`config/microcopy.ts`) et textes provisoires des pages (`config/pages.ts`, à migrer en Phase 3).
- SEO au build : `lib/seo.ts` (titre ≤ 60, description 140–160, canonical), `SEO.astro` (Open Graph, Twitter, image OG 1200 × 630 générée), JSON-LD unique par page (`lib/jsonld.ts`, types `schema-dts`) : `WebSite`, `ProfessionalService`, `Person` reliés par `@id`, `BreadcrumbList` ; squelettes `Service`, `CreativeWork`, `BlogPosting`.
- `BaseLayout` et `PageLayout` ; lien d'évitement, header collant qui se compacte sans décalage de mise en page, menu mobile en Popover API (fonctionne sans JS), footer complet, fil d'Ariane.
- View Transitions natives en CSS, sans `ClientRouter` (ADR-0006).
- Page 404 (noindex) ; accueil provisoire et styleguide migrés sur `BaseLayout`.
- Reports de la Phase 1 : convention typographique française (espaces insécables), contrastes comparés sans arrondi, token manquant = build en échec, `--z-grain`, `Button` icône seule avec nom accessible obligatoire, zone de clic de 44 px sur la navigation, icône « externe », liseré du bouton ghost à ≥ 3:1, listes sans puces qui gardent leur sémantique (`list-style-type: ''`), composants découpés sous 150 lignes.
- Lighthouse CI : 404 et styleguide exclus des assertions SEO (noindex) ; en-tête `X-Robots-Tag: noindex` sur les domaines `*.vercel.app`.
- Performance : grain de papier en tuile WebP pré-rendue (2,1 Ko) au lieu d'un SVG `feTurbulence` rasterisé à chaque rendu.

### Phase 1 — Design system

- Tokens « Atelier lumineux » (`src/styles/tokens.css`) : palette pastel et terracotta avec rôles sémantiques, échelle typographique fluide, espacements Utopia, rayons dont l'arche, ombres chaudes, motion, anneau de focus.
- Couches CSS `reset, base, components, utilities`, grain de papier statique (`body::after`), mouvement réduit respecté partout.
- Polices auto-hébergées via la Fonts API : Fraunces 300/400 (normal + italique) et Manrope variable ; préchargement de Fraunces 300 uniquement (environ 84 Ko de polices par page).
- Composants `ui/` : Button, Link, Heading, Eyebrow, Tag, Icon, Container, Section, ArchImage, Divider.
- Page interne `/styleguide/` (noindex, hors sitemap), alimentée directement par `tokens.css` via `src/lib/design-tokens.ts` et `src/lib/color-contrast.ts` (testés).
- Favicon provisoire (arche terracotta) et premier placeholder d'image documenté.
- Audit WCAG 2.2 AA : 0 violation axe ; `Button disabled` rend toujours un `<button>` ; `Link` exige une variante explicite (`draw` ou `inline`).
- Lighthouse CI : budgets complets sur les pages publiques, accessibilité seule sur `/styleguide/`.
- ADR-0005 : arbitrages du design system (Fraunces en graisses fixes, réglages Stylelint, dossier `components/styleguide/`, favicon).

### Phase 0 — Initialisation

- Dépôt GitHub public `kyoshiroDev/amg-decoration-site`, branches `main` (production) et `dev` (intégration).
- Astro 7.4.12 en rendu 100 % statique, `trailingSlash: 'always'`, prefetch au survol, intégrations `@astrojs/sitemap` et `@astrojs/mdx`.
- TypeScript 6 en preset `strictest`, alias `@/…`.
- Outillage qualité : ESLint 10 (TypeScript strict, Astro, `jsx-a11y-x`), Prettier, Stylelint (hexadécimal interdit hors `tokens.css`), Vitest, Playwright + axe-core (mobile et desktop), Lighthouse CI avec les budgets de `CLAUDE.md` §6.
- Script `npm run verify` (types + lint + tests + build).
- Premier utilitaire pur testé : `src/lib/url.ts` (slash final, URL canonique absolue).
- Page d'accueil provisoire en français (Lighthouse : 100 / 100 / 100 / 100).
- En-têtes Vercel : HSTS et `Cross-Origin-Opener-Policy` ajoutés ; la CSP est reportée à la Phase 7 (ADR-0004).
- ADR-0004 : versions de l'outillage (Node 24, TypeScript 6, `jsx-a11y-x`) et nom du dépôt.

### Kit de cadrage

- Kit de cadrage : `CLAUDE.md`, 9 agents spécialisés, commandes `/demarrer`, `/phase`, `/revue`, `/livrer`, `/audit`, hooks Git, documentation (`docs/`), CI GitHub Actions, configuration Vercel initiale.
