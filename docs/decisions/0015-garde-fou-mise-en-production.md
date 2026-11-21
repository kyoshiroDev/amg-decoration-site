# ADR-0015 — Garde-fou de mise en production des pages légales

- **Statut** : acceptée, révisée le 2026-11-21 (voir « Révision »)
- **Date** : 2026-11-20

## Contexte

Les pages légales (`src/content/pages/mentions-legales.md`, `conditions-generales.md`, `confidentialite.md`) sont publiées avec des informations manquantes : adresse du siège, immatriculation, mention « EI », médiateur de la consommation, clause de rétractation à reformuler, prestataire du formulaire… Chaque manque est tracé par un `TODO(contenu)` (CLAUDE.md §11), mais ces TODO sont des **commentaires YAML** de l'en-tête : invisibles sur le site, ils n'arrêtent rien. Le jour où l'humain merge `dev → main`, Vercel publierait en production des pages non conformes (LCEN art. 1-1, RGPD art. 13, Code de la consommation L111-1, L221-5, L612-1), sans que personne ne soit prévenu.

Contraintes : les builds locaux, la CI et les previews Vercel doivent continuer de passer tant que le contenu est incomplet (c'est l'état normal du projet jusqu'au retour d'Amandine) ; pas de dépendance ; le contrôle doit être lisible et exécutable avant de rattacher le domaine.

## Options envisagées

1. **Liste de vérification manuelle** (PR, `docs/CONFORMITE.md` §7) — rien à coder, mais repose sur la mémoire de l'humain au moment du merge.
2. **Rendre les TODO visibles sur la page** (bandeau « page provisoire ») — prévient le visiteur, pas l'éditrice ; publie quand même une page non conforme.
3. **Faire échouer le build de production Vercel** tant qu'un `TODO(contenu)` reste dans les fichiers légalement bloquants ; même contrôle disponible en local — le déploiement fautif devient impossible, la production précédente reste en ligne.

## Décision

**Option 3.**

- `src/lib/release-guard.ts` (pur, testé dans `tests/unit/release-guard.test.ts`) : `findContentTodos(text)` (lignes contenant `TODO(contenu)`, avec leur numéro), `isProductionBuild(env)` (`env.VERCEL_ENV === 'production'`), `formatReleaseBlockers(todos)` (message `fichier:ligne`), et la liste `RELEASE_BLOCKING_FILES`.
- `src/lib/release-guard-files.ts` : `readReleaseBlockers()` lit les fichiers bloquants (Node, sans alias, extensions `.ts` explicites ; même statut que `article-files.ts`).
- Intégration `amg:garde-fou-production` dans `astro.config.mjs`, hook `astro:build:start` : en production Vercel seulement, lève une erreur qui liste chaque TODO restant. Le build échoue avant toute génération.
- `npm run check:prod` (`node scripts/check-prod.ts`, types effacés nativement par Node ≥ 22.18) : même contrôle, sans condition d'environnement, code de sortie 1 s'il reste un TODO. À lancer avant de rattacher le domaine. Hors de `npm run verify` : il échoue volontairement tant que le contenu est incomplet.

**Activation : `VERCEL_ENV`.** Variable système Vercel, disponible au build et au runtime, valant `production`, `preview` ou `development` ([documentation](https://vercel.com/docs/environment-variables/system-environment-variables)). Elle est lue dans `process.env` uniquement (pas dans les fichiers `.env`, qu'un `vercel env pull` pourrait remplir). Absente en local et en CI GitHub : contrôle inactif.

**Champ d'application : les trois pages légales, et rien d'autre.** Chaque `TODO(contenu)` qui s'y trouve touche une obligation légale d'information, ou une affirmation de la page à confirmer (durées, prospection, date de mise à jour). Lever un TODO ne veut pas forcément dire compléter : une décision tracée (« pas de clients professionnels », « mise en ligne avec le repli `mailto:` ») suffit, à condition de retirer le TODO. Sont exclus :

- `src/config/site.ts` : ses TODO (WhatsApp, Suisse, LinkedIn, prix affichés) ne sont pas des obligations légales ; le seul manque légal, l'adresse du siège, est déjà tracé dans `mentions-legales.md`, et la cohérence prix / CGS dans `conditions-generales.md`.
- `src/config/seo.ts`, `src/config/media.ts`, `SiteLogo.astro`, placeholders : visuels à remplacer, sans enjeu légal.

Une simple note de maintenance qui ne signale pas d'information manquante ne doit pas porter le marqueur : celle de `confidentialite.md` sur les futures intégrations tierces est devenue un « Rappel (maintenance, non bloquant) ».

## Conséquences

- Positif : une page légale incomplète ne peut plus partir en production par inadvertance ; le message d'échec, lisible dans les journaux de build Vercel, liste le travail restant en `fichier:ligne` ; `check:prod` donne la même liste en local.
- Négatif : le premier merge `dev → main` échouera tant qu'Amandine n'a pas fourni les informations (comportement voulu, mais à savoir : la production précédente reste servie).
- À surveiller : selon la documentation, Vercel n'expose les variables système que si la case « Automatically expose System Environment Variables » est cochée (_Settings → Environment Variables_) ; la vérifier en rattachant le domaine, sinon le garde-fou est muet. Lancer `npm run check:prod` avant le premier merge reste la vérification de référence. Un fichier légal ajouté (ex. CGV) doit rejoindre `RELEASE_BLOCKING_FILES`. Ne jamais écrire le marqueur `TODO(contenu)` dans un commentaire explicatif de ces fichiers : il serait compté. Depuis la révision du 2026-11-21 (section « Révision » ci-dessous) : `VERCEL_PROJECT_PRODUCTION_URL` désigne le domaine personnalisé **le plus court** ; rattacher un autre domaine plus court (alias, ancien domaine) ferait servir le vrai domaine sans garde-fou. N'ajouter aucun autre domaine de production sans adapter `isReleaseGuarded`.

## Révision du 2026-11-21 : production `vercel.app` autorisée, vrai domaine protégé

**Contexte.** Au merge de la PR #3, le build de production a échoué comme prévu (23 `TODO(contenu)`). L'humain demande de déployer la production **sans attendre** les informations d'Amandine, pour disposer du site en ligne sur son adresse Vercel. Le domaine `amgdecorationdinterieur.com` n'est pas rattaché au projet : il sert toujours l'ancien site WordPress.

**Décision.** Le garde-fou ne bloque plus que le build de production qui **servirait le vrai domaine** : `isReleaseGuarded(env, SITE)` (`src/lib/release-guard.ts`) vaut vrai si `VERCEL_ENV === 'production'` et que `VERCEL_PROJECT_PRODUCTION_URL` (variable système Vercel : domaine de production personnalisé le plus court, sinon l'adresse `vercel.app`, sans protocole, [documentation](https://vercel.com/docs/environment-variables/system-environment-variables)) désigne `amgdecorationdinterieur.com` (avec ou sans `www.`). Variable absente alors que `VERCEL_ENV` est fourni : blocage par prudence. `npm run check:prod` est inchangé. Chaque build de production écrit son état dans le journal (« Garde-fou légal : actif / inactif (domaine de production …) », `describeReleaseGuard`) : un build vert ne suffit pas à prouver que le garde-fou était actif.

**Pourquoi c'est acceptable.** Sur `*.vercel.app`, toutes les réponses portent `X-Robots-Tag: noindex` (`vercel.json`) : la production provisoire n'est pas indexée, les URL canoniques désignent le vrai domaine, et aucun visiteur n'y arrive par la recherche ou par l'ancien domaine. Les obligations légales visent le site exploité sous le domaine de l'entreprise.

**Risque à connaître, et parade.** Rattacher un domaine sur Vercel **ne relance pas de build** : le domaine sert aussitôt le dernier déploiement de production, construit sans garde-fou. Avant de rattacher le domaine (`docs/MISE-EN-LIGNE.md` §3) :

1. `npm run check:prod` doit être vert (aucun `TODO(contenu)` légal) ;
2. après le rattachement, **redéployer** la production : le build revérifie alors les pages légales avec le vrai domaine, et tout build ultérieur reste protégé.
