# Mise en ligne

Checklist de la bascule de `amgdecorationdinterieur.com` (WordPress) vers le nouveau site, et informations à obtenir d'Amandine avant. Document vivant : à cocher le jour J.

> Le site actuel reste en ligne tant que cette liste n'est pas terminée. **Ne pas rattacher le domaine au projet Vercel avant la section 3.**
>
> Depuis le 2026-11-21, la production se déploie sur son adresse `*.vercel.app` (en `noindex`) même avec des pages légales incomplètes : le garde-fou ne bloque que le build qui sert le vrai domaine (ADR-0015 révisée). Rattacher le domaine ne relance pas de build : il servirait aussitôt la dernière production, d'où l'ordre impératif de la section 3.

## 1. Contenus à obtenir d'Amandine

`npm run check:prod` liste les points **bloquants** (pages légales, ADR-0015) ; le build de production Vercel qui sert le vrai domaine échoue tant qu'il en reste. Les autres `TODO(contenu)` (`grep -rn "TODO(contenu)" src`) n'empêchent pas la mise en ligne mais dégradent le site.

### Bloquant (légal)

Plus aucun point bloquant dans les pages légales depuis le 2026-11-23 (`npm run check:prod` vert) : le dernier (accord des clients pour publier projets et photos, CGS art. 7) est réglé, les publications étant totalement anonymes (confirmé par l'humain). Reste, hors pages, le passage sur Vercel Pro (`docs/CONFORMITE.md` § 3).

Réglés sans Amandine le 2026-11-21 (décisions tracées en commentaire dans chaque page) : « TTC » → « prix nets » et définitions des CGS alignées sur le devis signé ; mise en ligne avec le repli `mailto:` (pas de service de formulaire) ; aucune photo Pexels reprise ; pas de ligne de crédit pour la conception ; hébergeur Vercel affiché avec son adresse et son email (pas de téléphone publié) ; article 4 des CGS reformulé et formulaire type de rétractation ajouté en annexe (aligné sur sa pratique le 2026-11-23, voir plus bas et `docs/CONFORMITE.md` § 6, point 2). Messagerie professionnelle : simple recommandation, non bloquante. Consolidation du même jour : immatriculation au RNE affichée avec le SIREN (il n'existe pas de numéro RNE distinct ; pas d'inscription au RCS, prestations de services seulement, confirmé le 2026-11-22) ; délais de réalisation renvoyés au devis, conforme à L111-1 3° (chaque devis doit indiquer un délai) ; RC Pro non obligatoire pour une décoratrice (assureur facultatif, article 1240 du Code civil à faire vérifier par un juriste, décennale seulement en cas de maîtrise d'œuvre ou de suivi de chantier) ; dates d'entrée en vigueur des CGS et de mise à jour de la confidentialité sans obligation légale (à ajuster le jour de la bascule, section 4) ; clause légale réservée aux clients professionnels ajoutée à l'art. 5 des CGS (pénalités au taux BCE majoré de 10 points, exigibles sans rappel, indemnité forfaitaire de 40 €, Code de commerce L441-10 et D441-5 ; ces mentions doivent aussi figurer sur les factures pros) ; définition « Client » et mention « prix nets » des CGS corrigées. Le 2026-11-22 : mention « Amandine Gaury EI » appliquée (son site actuel la présente comme auto-entrepreneur, la mention est imposée par le décret 2022-725). Même jour : adresse du siège (24 allée du Pré Lambesc, 91190 Gif-sur-Yvette) donnée par l'humain, injectée par le jeton `{legalAddress}`. Le 2026-11-23 : durée de conservation (3 ans) et absence de prospection passées en non bloquant (validé par l'humain). Même jour : art. 4 des CGS aligné sur sa pratique (démarrage 14 jours après la signature, donc pas de démarrage anticipé ni de case sur le devis ; relecture par un juriste recommandée). Même jour : médiateur de la consommation reporté, **risque accepté par l'humain** (coût ; l'ancien site n'en affichait pas), à régulariser après la mise en ligne (section 4). Même jour : prix fixes confirmés (formules et options, offre officielle d'avril 2026), CGS art. 1, 3 et 5 et page Prestations alignés. Même jour : accord des clients pour les photos réglé (publications totalement anonymes). Plus aucun `TODO(contenu)` bloquant (au 2026-11-23).

### Visuels (tous repris de l'ancien site, en attendant les originaux)

Depuis le 2026-11-21, le site n'affiche plus aucun placeholder public : 12 réalisations, héros, portrait, image Open Graph et comparateur utilisent les images de l'ancien site (`src/assets/placeholders/README.md`).

- Originaux HD des 4 réalisations récentes : les fichiers d'origine en ligne ne font que 1200 × 600 ; tant qu'ils ne font pas 1200 × 630, ces pages publient l'image Open Graph par défaut. Lieu de 3 projets ; l'esquisse de cuisine `espace-de-vie-scandinave/05` appartient-elle bien à ce projet ?
- 8 anciens projets (`/projet-1/` à `/projet-7/`, `/projet-marine/`) publiés sans texte : textes rédigés d'après les images, à relire (demande, lieu, formule) ; publication anonyme couverte par l'art. 7 des CGS (2026-11-23).
- Une paire « rendu 3D / photo du résultat » cadrée à l'identique et en HD pour le comparateur de `/visualisation-3d/` (l'actuelle, chambre d'enfant sous combles, a deux points de vue proches et une photo de 676 px).
- Portrait HD (l'actuel vient de l'ancien site) ; logo vectoriel (SVG) : l'ancien site n'a que des PNG.

### Textes et faits à confirmer

Déjà tranchés par l'ancien site (relevé du 2026-11-20) : formation (cursus de 5 ans, certifiée en 2010), rendez-vous à distance en visio ou par téléphone, accompagnement par WhatsApp ou email, prix affichés.

- MJM Design Graphic (cité seul sur l'accueil de l'ancien site) : a-t-il délivré la certification de 2010 ? Intitulé exact ? Peut-on le citer sur `/a-propos/` (retiré en attendant) ?
- ~~Nom de la formule, modifications incluses, prix des options~~ : réglés le 2026-11-23 d'après l'offre officielle d'avril 2026 (« Essentielle », 1 / 2 / 3 / illimitées, options à 89–300 €). Reste à confirmer : la sélection de mobilier est-elle incluse (ancien texte) ou en option shopping-list (image retenue) ?
- Conserver l'offre « Meuble sur-mesure 3D » et l'« Offre Professionnels » ? Formule réelle de chaque réalisation.
- Attribution des avis clients ; questions fréquentes (FAQ, collection vide aujourd'hui).
- Avis clients affichés (témoignages) : l'article L111-7-2 du Code de la consommation impose d'informer les visiteurs sur les modalités de publication et de traitement des avis, en précisant s'ils font ou non l'objet d'un contrôle. D'où viennent les avis (Google, messages reçus) et sont-ils vérifiés ? Une courte mention près des témoignages suffira (`docs/CONFORMITE.md` § 6, point 12 ; non bloquant pour les pages légales).
- Zone : d'autres projets hors de France acceptés (le chalet en Suisse a été mené à distance) ? déplacements sur place à Paris / Île-de-France ?
- Chambre des enfants du chalet : texte écrit d'après les rendus, idées clés à confirmer ; WhatsApp (canal confirmé) sur le même numéro que le téléphone ; profil LinkedIn actif.
- Robots d'IA (`GPTBot`, `Google-Extended`, `ClaudeBot`…) : autoriser (choix actuel) ou bloquer (ADR-0011).

## 2. Avant la bascule (sur une preview Vercel)

- [ ] `npm run check:prod` : aucun point bloquant.
- [ ] `npm run verify` et CI de la PR vers `main` vertes (vérifications, e2e, Lighthouse 25 URL).
- [ ] Vercel : projet connecté au dépôt, branche de production `main` ; **Settings → Environment Variables → « Automatically expose System Environment Variables » coché** (sans quoi `VERCEL_ENV` est absent et le garde-fou est muet).
- [ ] Si un service de formulaire est choisi : **d'abord** nommer le prestataire, son pays d'établissement, son pays d'hébergement et la garantie de transfert dans les blocs `{formulaire:service}` de `src/content/pages/confidentialite.md`, en remplaçant la phrase marquée `{à-préciser}` (sinon tout build Vercel avec la variable échoue, `src/lib/content-template.ts` ; les builds locaux et de CI restent possibles pour `test:e2e:service`) ; **ensuite** définir `PUBLIC_FORM_ENDPOINT` pour Production (et Preview pour tester) et tester le formulaire de bout en bout ; la page confidentialité affiche alors les paragraphes « service ».
- [ ] **Vercel Pro (obligatoire)** : le site est commercial, ce que le plan Hobby interdit, et Hobby n'inclut pas de contrat de sous-traitance (`docs/CONFORMITE.md` § 3).
- [ ] En-têtes vérifiés sur la preview : `curl -sI https://<preview>.vercel.app/` → `content-security-policy` (meta) et `x-frame-options`, `strict-transport-security`, `permissions-policy`, `cross-origin-resource-policy`, `x-robots-tag: noindex` (previews uniquement).
- [ ] Redirections vérifiées sur la preview : quelques anciennes URL de `docs/CONTENU-EXISTANT.md` (`/services/`, `/about/`, `/projet-chalet`…) → 308 vers la page finale en un saut.
- [ ] Régression visuelle régénérée avec les vraies photos (`npm run test:visual:update`), après décision sur Git LFS ou des références locales.

## 3. Bascule

- [ ] Merge de la PR `dev → main` par l'humain.
- [ ] `npm run check:prod` vert **avant** de toucher aux domaines, lancé sur `main` à jour (même SHA que le déploiement de production en cours, pas sur `dev`) : le rattachement sert immédiatement la dernière production, construite sans garde-fou.
- [ ] Vercel → Domains : ajouter `amgdecorationdinterieur.com` (production) et `www.amgdecorationdinterieur.com` **servi par le projet, sans l'option « Redirect to … »** : la redirection www → domaine nu est faite en un saut par `vercel.json` (`docs/SEO-STRATEGIE.md` §6).
- [ ] **Redéployer la production** (Deployments → Redeploy) **avant la bascule DNS** : tant que le DNS pointe vers WordPress, rien n'est exposé. Vérifier dans le journal de build la ligne « Garde-fou légal : actif (domaine de production amgdecorationdinterieur.com) » (le garde-fou revérifie alors les pages légales) ; si le build échoue, ne pas toucher au DNS et compléter les pages.
- [ ] DNS chez le registrar : enregistrement `A` du domaine nu et `CNAME` de `www` vers les valeurs indiquées par Vercel ; baisser le TTL la veille.
- [ ] HTTPS : certificat émis par Vercel pour les deux hôtes.
- [ ] Contrôles :
  - `curl -sI https://amgdecorationdinterieur.com/` → 200, sans `x-robots-tag: noindex` ;
  - `curl -sI https://www.amgdecorationdinterieur.com/projet-chalet` → 308, `location: https://amgdecorationdinterieur.com/realisations/chalet-suisse/` ;
  - `curl -sI https://amgdecorationdinterieur.com/services/` → 308 vers `/prestations/` ;
  - `/robots.txt`, `/sitemap-index.xml`, `/llms.txt` en 200.

## 4. Après la bascule

- [ ] **Médiateur de la consommation (obligatoire, risque accepté le 2026-11-23)** : adhésion d'Amandine à un médiateur référencé par la CECMC pour le secteur « aménagement de l'habitat… et activités de décoration », puis nom, site et adresse dans les mentions légales et l'art. 11 des CGS (`docs/CONFORMITE.md` § 6, point 1).
- [ ] Google Search Console : propriété de domaine vérifiée (DNS), sitemap `https://amgdecorationdinterieur.com/sitemap-index.xml` soumis, inspection de l'accueil et de 2–3 pages.
- [ ] Suivi des 404 et de la couverture pendant 4 semaines (aucune ancienne URL indexée ne doit tomber en 404) ; comparer avec la liste de `docs/CONTENU-EXISTANT.md`.
- [ ] Google Business Profile : URL du site, catégorie, zone desservie cohérentes avec `site.ts` ; demander des avis (jamais d'avis inventés).
- [ ] Mettre à jour l'URL du site sur Instagram, Facebook, Pinterest, LinkedIn.
- [ ] Lighthouse sur le domaine réel (mobile) : Performance ≥ 95, autres catégories 100.
- [ ] Mettre à jour les dates « Dernière mise à jour » de la confidentialité et d'entrée en vigueur des CGS.
- [ ] Résilier l'hébergement WordPress seulement après la stabilisation de l'indexation.
