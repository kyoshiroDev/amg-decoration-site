# ADR-0023 — API des CRM : outillage, configuration et principes de sécurité

- **Statut** : acceptée
- **Date** : 2026-11-26

## Contexte

L'API NestJS est la première application serveur du monorepo (ADR-0019). L'ADR-0021 laissait ouverts le mode TypeScript (alias `paths` ou références de projet) et la place des plugins Nx. Le plan de l'agent `architecte` (CRM 3) a relevé plusieurs contraintes, revérifiées le 2026-11-26 avec `npm view` et la documentation à jour (Context7 : NestJS 12, Vite 8, typescript-eslint 8, Zod 4) :

- **NestJS 12.6.2 est ESM pur** (`"type": "module"`) ; le guide de migration v12 fait de Vitest le lanceur de tests par défaut des projets ESM.
- **`@nx/nest` 24 exige `@nestjs/core` < 12** : incompatible.
- **Le dist-tag `latest` de `prisma` pointe sur une RC** (`8.0.0-rc.35`) alors que `@prisma/client` `latest` est `7.10.1` : `npm i prisma` installerait une préversion.
- **TypeScript `latest` est 7.0.2** (compilateur natif) ; le dépôt est sur `~6.0.3`, et l'injection de Nest repose sur `emitDecoratorMetadata`.
- **Vite 8** (utilisé par Vitest 5) émet nativement les métadonnées de décorateurs (`emitDecoratorMetadata` lu dans `tsconfig.json`, transformeur Oxc), sans plugin SWC.
- Les réseaux Docker `edge` et `data` du serveur sont internes (sans sortie Internet, ADR-0020).

Trois décisions de sécurité ont été tranchées par le `reviewer` sur délégation explicite de l'humain, et une par l'humain (emails) ; elles sont consignées ici pour que le code des lots suivants s'y réfère.

## Options envisagées

1. **Plugins Nx (`@nx/nest`, `@nx/node`, `@nx/js`)** : incompatibles avec Nest 12, cibles en double des scripts npm. Écarté.
2. **Alias `paths` dans `tsconfig.base.json`** : `tsc` ne réécrit pas les alias, l'API compilée échouerait à l'exécution sans bundler ni `tsc-alias`. Écarté.
3. **Bundler (webpack, esbuild, SWC) pour le build** : aucun gain sur quelques dizaines de fichiers, complique les binaires natifs (`@node-rs/argon2`) et le client Prisma. Écarté.
4. **Jest** : ESM fragile, Nest 12 n'y charge que sur Node ≥ 24.9. Écarté au profit de Vitest, déjà à la racine.
5. **`unplugin-swc` + `@swc/core` sous Vitest** (recette de la doc NestJS) : inutile, Vite 8 émet `design:paramtypes` (vérifié par un test, voir plus bas). Écarté tant que ce test passe.
6. **`nestjs-zod`, `@nestjs/config`, `@nestjs/cli`** : le natif suffit (`StandardSchemaValidationPipe` de Nest 12, une fonction pure de configuration, `tsc`). Écartés.
7. **Testcontainers** : dépendance, conteneur Ryuk, démarrages répétés (mémoire locale limitée). Écarté : Postgres et Redis réels par `compose.dev.yaml` en local et `services:` en CI.
8. **Emails par SMTP Gmail (`nodemailer`)** : mot de passe d'application du compte personnel d'Amandine sur le serveur, délivrabilité non maîtrisée, ports SMTP sortants. Remplacé par Resend (décision de l'humain).

## Décision

### Projets et outillage

| Sujet         | Choix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projets       | `apps/api` (`@amg/api`), `libs/shared/schemas` (`@amg/shared-schemas`), puis `libs/api/db` (`@amg/api-db`, lot 1). Paquets de workspace npm, **projets Nx à scripts npm sans plugin** (comme le site, ADR-0021), configuration dans la propriété `nx` du `package.json`.                                                                                                                                                                                                                                                     |
| Framework     | **NestJS 12.6.2** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify`, versions exactes, toutes identiques) sur **Fastify 5.12.8** (mémoire et débit, budget de 256 Mio ; `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/multipart` officiels aux lots suivants).                                                                                                                                                                                                                                             |
| Modules       | **ESM** partout (`"type": "module"`, `module`/`moduleResolution: nodenext`, imports relatifs en `.js`).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| TypeScript    | **Mode « TS solution »** : `tsconfig.base.json` racine **sans `paths`** (options du `nest new` ESM durcies au niveau strictest : `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`…), libs compilées vers `dist/` (`composite`), résolues par leurs `exports`, **références de projet** depuis l'API. L'ordre de build est assuré par Nx (`dependsOn: ["^build"]` sur `build`, `check`, `lint`, `test` de l'API). Le site garde `astro/tsconfigs/strictest` et n'en dépend pas. |
| Version de TS | **TypeScript ~6.0.3 conservé** (racine). TypeScript 7 (natif) sera évalué avant toute montée : `emitDecoratorMetadata` est indispensable à l'injection de Nest.                                                                                                                                                                                                                                                                                                                                                              |
| Build         | **`tsc -p`** (`tsconfig.build.json` → `dist/`, `node dist/main.js`), ni bundler ni `@nestjs/cli`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Tests         | **Vitest 5** (racine) : unitaires et HTTP (`app.inject()` de Fastify, sans supertest ni réseau) dans `npm run test`, donc dans `verify` ; intégration contre Postgres/Redis réels dans une cible séparée `test:integration` (lot 1). Les métadonnées de décorateurs sous Vitest sont émises par Vite 8 : `tests/unit/decorator-metadata.test.ts` échoue si elles disparaissent (contre-épreuve faite : un `import type` sur la classe injectée le fait échouer), et l'amorçage complet d'`AppModule` est testé.              |
| Lint          | Base typée commune `typedTsConfigs()` (`eslint.config.js` racine) : `sharedConfigs` + `sharedRules` + `strictTypeChecked` + `stylisticTypeChecked`, aucune règle désactivée. `consistent-type-imports` : avec `experimentalDecorators` et `emitDecoratorMetadata`, la règle ne signale rien dans les fichiers à décorateurs (elle ne peut donc pas transformer une classe injectée en `import type`) et reste appliquée ailleurs. Seul réglage : `no-extraneous-class` avec `allowWithDecorator` (modules Nest).             |
| Validation    | **Zod 4.6.7**, schémas dans `@amg/shared-schemas`, `z.strictObject` (champs inconnus refusés) ; dans les contrôleurs, `StandardSchemaValidationPipe` natif de Nest 12 (Zod 4 implémente Standard Schema), pas de `nestjs-zod`.                                                                                                                                                                                                                                                                                               |
| Base          | **Prisma 7.10.1 épinglé exactement** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, jamais `latest`), `prisma.config.ts`, générateur `prisma-client` ESM, driver adapter `PrismaPg` (lot 1). Migrations par un conteneur ponctuel avant la bascule de l'API (même image), pas au démarrage : l'ADR-0020 sera révisée au lot 2.                                                                                                                                                                                           |
| Sessions      | **Redis** (sessions, limitation de débit, files BullMQ au lot 5), magasin de sessions maison (jeton opaque, rotation, audience liée à l'hôte), détaillé dans l'ADR-0024 au lot 6.                                                                                                                                                                                                                                                                                                                                            |
| Dev local     | `compose.dev.yaml` à la racine : Postgres et Redis **aux mêmes digests** que `deploy/compose.yaml`, ports sur `127.0.0.1` seulement, 192 + 64 Mio, identifiants de développement publics et propres à ce fichier.                                                                                                                                                                                                                                                                                                            |

### Configuration et secrets

- Variables validées au démarrage par une **fonction pure** (`loadEnv`, lecteur de fichier injecté, testée sans disque) sur une **liste blanche** de clés (`env.schema.ts`) ; une configuration invalide arrête le processus (code 1) avec la liste des erreurs, **qui ne citent que des noms de variables, jamais de valeur**.
- `NODE_ENV` et `AMG_ENV` obligatoires et cohérents (`production` ↔ `prod`/`staging`, `development` ↔ `dev`, `test` ↔ `test`).
- **Secrets en `X_FILE`** (fichier monté par Compose) : la forme directe `X` est **refusée hors développement et test** (refus par défaut si `NODE_ENV` est absent ou inconnu), `X` et `X_FILE` ensemble sont refusés, le chemin doit être absolu, le fichier régulier et ≤ 4 Kio, un seul saut de ligne final est retiré, longueur bornée et caractères de contrôle refusés. Chaque secret est enveloppé (`SecretValue`) : il ne sort que par `reveal()`, toute sérialisation affiche `[secret]`. Les secrets sont déclarés lot par lot dans `src/config/secrets.ts`.
- Aucune URL contenant un mot de passe dans l'environnement : l'URL de la base sera construite depuis un fichier secret (lot 1).

### Exposition HTTP : même origine, aucun CORS

- L'API est servie sous **`admin.amgdecorationdinterieur.com/api/`** et **`espace.amgdecorationdinterieur.com/api/`** (préfixe global `api`, routage Traefik `Host(…) && PathPrefix(/api)`), à la **même origine** que chaque CRM : **aucun CORS**, aucun en-tête `Access-Control-*` (testé, y compris en pré-vérification `OPTIONS` et sur les erreurs).
- Cookies de session séparés par hôte : **`__Host-amg_admin_sid`** et **`__Host-amg_client_sid`**, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, **sans `Max-Age` ni `Expires`** (cookie de session ; l'expiration réelle est côté serveur). Une session est liée à son audience : un cookie client présenté à l'hôte admin est refusé.
- **CSRF** : jeton synchroniseur lié à la session, renvoyé par le client dans l'en-tête **`X-CSRF-Token`** sur toute requête qui modifie l'état, en plus de `SameSite=Strict`, du contrôle `Origin`/`Sec-Fetch-Site` et d'un `Content-Type: application/json` exigé.
- En-têtes posés par l'API sur toute réponse : `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` et `Cross-Origin-Resource-Policy: same-origin`. HSTS est posé au niveau de l'hôte (Traefik). `trustProxy` reste désactivé jusqu'à sa restriction au seul Traefik (lot 3). Corps JSON limité à 64 Kio.
- `GET /api/health` : vivacité seulement (`{"status":"ok"}`), aucune version ni information d'environnement.

### Sessions : durées et ré-authentification

| Audience | Inactivité | Durée absolue | Appareil de confiance |
| -------- | ---------: | ------------: | --------------------- |
| Admin    |     30 min |          12 h | non                   |
| Client   |       24 h |          14 j | non                   |

- **Ré-authentification de moins de 5 minutes** (mot de passe, et TOTP pour l'admin) exigée pour les actions sensibles : changement de mot de passe ou d'email, gestion de la double authentification et des codes de secours, déconnexion des autres appareils, renvoi d'un mot de passe provisoire, export ou suppression de données.
- Rotation de l'identifiant de session à la connexion, à chaque étape d'authentification (mot de passe → TOTP) et à tout changement de droits ; déconnexion révoque la session côté serveur.
- **Écart assumé au niveau 3 de l'ASVS** (OWASP ASVS 5.0, V7 : durées de session courtes à ce niveau) pour les clients : 24 h d'inactivité et 14 jours au plus. Justification : les clients sont des particuliers qui consultent leur projet quelques fois par mois depuis leur téléphone, sur une PWA installée ; une déconnexion fréquente les pousserait vers des mots de passe faibles ou réutilisés et vers les demandes par message ou email (hors de l'espace sécurisé). Les données client sont moins critiques que le compte admin, qui garde des durées strictes, TOTP obligatoire et aucune session longue. Compensations : cookie `__Host-` strict lié à l'hôte, aucun appareil de confiance, ré-authentification récente pour toute action sensible, révocation de toutes les sessions au changement de mot de passe, alerte de nouvelle connexion, journal de sécurité.

### Secours de la double authentification

- **10 codes de secours** à usage unique, générés à l'enrôlement TOTP (aléa ≥ 80 bits chacun, montrés une seule fois), stockés en **HMAC-SHA-256 poivré** (clé `RECOVERY_PEPPER_FILE`, jamais en base ; aléa suffisant pour se passer d'Argon2), régénérables (ré-authentification récente, anciens codes révoqués). Chaque usage est journalisé et alerte le titulaire.
- **Dernier recours : commande serveur `reset-mfa`** (conteneur ponctuel `amg_run`, accès SSH de l'exploitant uniquement, aucune route HTTP), qui supprime le facteur TOTP et les codes, révoque toutes les sessions du compte, impose un nouvel enrôlement à la connexion suivante et journalise l'opération.
- **Vérification d'identité avant `reset-mfa`** : de préférence **en personne** ; à défaut, par **rappel sur un numéro de téléphone déjà connu** de l'exploitant (jamais un numéro fourni dans la demande elle-même), jamais sur la seule foi d'un email ou d'un message.
- **Contact de sécurité de l'exploitant** (facultatif) : adresse lue dans `SECURITY_ALERT_CC_FILE` (fichier sur le serveur, hors dépôt), qui reçoit **en copie les seules alertes de sécurité du compte admin** : nouvelle connexion, code de secours utilisé, double authentification réinitialisée ou désactivée, changement de mot de passe ou d'email, blocage du compte. **Jamais** les emails, alertes ou données des clients. Absente : aucune copie.
- L'exploitant peut conserver une **seconde copie hors ligne des codes de secours de l'admin** (enveloppe scellée ou gestionnaire de mots de passe) ; procédure à écrire dans `docs/EXPLOITATION.md` au lot 4.

### Emails automatiques : Resend

- Envoi par l'**API HTTPS de Resend**, **depuis le worker uniquement** (file BullMQ `mail`, lot 5) ; l'API ne parle jamais à Internet. Seul le worker reçoit une **sortie Internet HTTPS** (réseau Docker de sortie dédié, à concevoir avec `devops` au lot 5).
- Variables : `RESEND_API_KEY_FILE` (clé limitée à l'envoi, secret du worker seul), `MAIL_FROM` (adresse d'envoi sur le domaine du site, domaine vérifié chez Resend par SPF/DKIM), `MAIL_REPLY_TO` (boîte Gmail d'Amandine : les réponses des clients y arrivent) ; `SECURITY_ALERT_CC_FILE` ci-dessus.
- Client HTTP : `fetch` natif ou SDK officiel `resend` (6.40.0 au 2026-11-26), tranché au lot 5 selon la surface de dépendances ; en dev et test, transport « journal » sans envoi.
- Resend devient sous-traitant au sens du RGPD (adresses des destinataires, contenu des emails) : à inscrire dans `docs/CONFORMITE.md` et la politique de confidentialité avant le premier envoi (`conformite`). Les emails ne contiennent jamais de mot de passe provisoire lisible par un tiers autre que le destinataire, ni de données de projet au-delà du nécessaire.

## Conséquences

- **ADR-0019 révisée** (ligne Notifications : Resend au lieu du relais SMTP Gmail) ; ADR-0020 à réviser au lot 2 (migrations par conteneur ponctuel, sortie HTTPS du worker au lot 5) ; ADR-0021 complétée par ce choix du mode TypeScript.
- Le `package-lock.json` change : la clé du cache d'images Astro en CI est invalidée une fois (build froid d'environ 6 min, sans effet visible sur le site).
- `npm run verify` construit, contrôle, linte et teste aussi l'API et la lib de schémas.
- Un test unique protège l'hypothèse la plus fragile (métadonnées de décorateurs) : toute montée de Vite, Vitest ou TypeScript qui la casse échoue en CI. Si elle casse, la solution documentée par NestJS est `unplugin-swc` (nouvelle justification à écrire).
- Actions de l'humain avant le lot 5 : compte Resend, vérification DNS du domaine d'envoi, clé d'API restreinte à l'envoi.
