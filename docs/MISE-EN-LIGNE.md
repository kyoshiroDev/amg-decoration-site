# Mise en ligne

Checklist de la bascule de `amgdecorationdinterieur.com` (WordPress) vers le nouveau site, et informations à obtenir d'Amandine avant. Document vivant : à cocher le jour J.

> Le site actuel reste en ligne tant que cette liste n'est pas terminée. **Ne pas rattacher le domaine au projet Vercel avant la section 3.**

## 1. Contenus à obtenir d'Amandine

`npm run check:prod` liste les points **bloquants** (pages légales, ADR-0015) ; le build de production Vercel échoue tant qu'il en reste. Les autres `TODO(contenu)` (`grep -rn "TODO(contenu)" src`) n'empêchent pas la mise en ligne mais dégradent le site.

### Bloquant (légal)

| Information                                                                                                                                             | Où                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Adresse postale complète du siège ou adresse de domiciliation                                                                                           | mentions légales, CGS art. 1, `site.ts`     |
| Mention « Amandine Gaury EI » (ou « entrepreneur individuel ») et numéro RNE                                                                            | mentions légales, CGS                       |
| Médiateur de la consommation : adhésion, puis nom, site et adresse                                                                                      | mentions légales, CGS art. 11               |
| Article 4 des CGS (droit de rétractation, L221-25 / L221-28) validé, idéalement par un juriste ; accord pour ajouter le formulaire type de rétractation | CGS                                         |
| Prix : affichage ferme, « à partir de » ou devis seul ; délai indicatif par formule                                                                     | CGS art. 3, 5, 6 ; `site.ts` (`showPrices`) |
| Clients professionnels facturés ? (pénalités de retard, indemnité de 40 €)                                                                              | CGS                                         |
| Accord des clients pour publier les projets, photos et avis                                                                                             | CGS art. 7, réalisations, témoignages       |
| « TTC » → « prix nets, TVA non applicable » ; commande « passée sur le site » → devis signé                                                             | CGS                                         |
| Assureur RC Pro et couverture (facultatif)                                                                                                              | CGS art. 12                                 |
| Date d'entrée en vigueur des CGS                                                                                                                        | CGS                                         |
| Service de formulaire (Formspark recommandé, ADR-0003) ou maintien du repli `mailto:`                                                                   | confidentialité, `PUBLIC_FORM_ENDPOINT`     |
| Durée de conservation des demandes sans suite ; aucune prospection confirmée                                                                            | confidentialité                             |
| Messagerie professionnelle (facultatif, recommandé)                                                                                                     | confidentialité                             |
| Photos Pexels de l'ancien site (à exclure ou créditer) ; crédit de conception du site (ou retrait de la ligne)                                          | mentions légales                            |
| Affichage de l'hébergeur Vercel sans téléphone (validation)                                                                                             | mentions légales                            |

### Visuels (tous repris de l'ancien site, en attendant les originaux)

Depuis le 2026-11-21, le site n'affiche plus aucun placeholder public : 12 réalisations, héros, portrait, image Open Graph et comparateur utilisent les images de l'ancien site (`src/assets/placeholders/README.md`).

- Originaux HD des 4 réalisations récentes : les fichiers d'origine en ligne ne font que 1200 × 600 ; tant qu'ils ne font pas 1200 × 630, ces pages publient l'image Open Graph par défaut. Lieu de 3 projets ; l'esquisse de cuisine `espace-de-vie-scandinave/05` appartient-elle bien à ce projet ?
- 8 anciens projets (`/projet-1/` à `/projet-7/`, `/projet-marine/`) publiés sans texte : textes rédigés d'après les images, à relire (demande, lieu, formule) ; accord des clients pour les publier.
- Une paire « rendu 3D / photo du résultat » cadrée à l'identique et en HD pour le comparateur de `/visualisation-3d/` (l'actuelle, chambre d'enfant sous combles, a deux points de vue proches et une photo de 676 px).
- Portrait HD (l'actuel vient de l'ancien site) ; logo vectoriel (SVG) : l'ancien site n'a que des PNG.

### Textes et faits à confirmer

Déjà tranchés par l'ancien site (relevé du 2026-11-20) : formation (cursus de 5 ans, certifiée en 2010), rendez-vous à distance en visio ou par téléphone, accompagnement par WhatsApp ou email, prix affichés.

- MJM Design Graphic (cité seul sur l'accueil de l'ancien site) : a-t-il délivré la certification de 2010 ? Intitulé exact ? Peut-on le citer sur `/a-propos/` (retiré en attendant) ?
- Nom de la formule : « Essentiel » ou « Essentielle » ; nombre de vues 3D et de modifications incluses par formule ; prix des options.
- Conserver l'offre « Meuble sur-mesure 3D » et l'« Offre Professionnels » ? Formule réelle de chaque réalisation.
- Attribution des avis clients ; questions fréquentes (FAQ, collection vide aujourd'hui).
- Zone : d'autres projets hors de France acceptés (le chalet en Suisse a été mené à distance) ? déplacements sur place à Paris / Île-de-France ?
- Chambre des enfants du chalet : texte écrit d'après les rendus, idées clés à confirmer ; WhatsApp (canal confirmé) sur le même numéro que le téléphone ; profil LinkedIn actif.
- Robots d'IA (`GPTBot`, `Google-Extended`, `ClaudeBot`…) : autoriser (choix actuel) ou bloquer (ADR-0011).

## 2. Avant la bascule (sur une preview Vercel)

- [ ] `npm run check:prod` : aucun point bloquant.
- [ ] `npm run verify` et CI de la PR vers `main` vertes (vérifications, e2e, Lighthouse 25 URL).
- [ ] Vercel : projet connecté au dépôt, branche de production `main` ; **Settings → Environment Variables → « Automatically expose System Environment Variables » coché** (sans quoi `VERCEL_ENV` est absent et le garde-fou est muet).
- [ ] Si un service de formulaire est choisi : `PUBLIC_FORM_ENDPOINT` défini pour Production (et Preview pour tester), formulaire testé de bout en bout ; la page confidentialité affiche alors les paragraphes « service ».
- [ ] Vercel Pro si le site est considéré comme commercial (conditions d'usage du plan Hobby).
- [ ] En-têtes vérifiés sur la preview : `curl -sI https://<preview>.vercel.app/` → `content-security-policy` (meta) et `x-frame-options`, `strict-transport-security`, `permissions-policy`, `cross-origin-resource-policy`, `x-robots-tag: noindex` (previews uniquement).
- [ ] Redirections vérifiées sur la preview : quelques anciennes URL de `docs/CONTENU-EXISTANT.md` (`/services/`, `/about/`, `/projet-chalet`…) → 308 vers la page finale en un saut.
- [ ] Régression visuelle régénérée avec les vraies photos (`npm run test:visual:update`), après décision sur Git LFS ou des références locales.

## 3. Bascule

- [ ] Merge de la PR `dev → main` par l'humain.
- [ ] Vercel → Domains : ajouter `amgdecorationdinterieur.com` (production) et `www.amgdecorationdinterieur.com` **servi par le projet, sans l'option « Redirect to … »** : la redirection www → domaine nu est faite en un saut par `vercel.json` (`docs/SEO-STRATEGIE.md` §6).
- [ ] DNS chez le registrar : enregistrement `A` du domaine nu et `CNAME` de `www` vers les valeurs indiquées par Vercel ; baisser le TTL la veille.
- [ ] HTTPS : certificat émis par Vercel pour les deux hôtes.
- [ ] Contrôles :
  - `curl -sI https://amgdecorationdinterieur.com/` → 200, sans `x-robots-tag: noindex` ;
  - `curl -sI https://www.amgdecorationdinterieur.com/projet-chalet` → 308, `location: https://amgdecorationdinterieur.com/realisations/chalet-suisse/` ;
  - `curl -sI https://amgdecorationdinterieur.com/services/` → 308 vers `/prestations/` ;
  - `/robots.txt`, `/sitemap-index.xml`, `/llms.txt` en 200.

## 4. Après la bascule

- [ ] Google Search Console : propriété de domaine vérifiée (DNS), sitemap `https://amgdecorationdinterieur.com/sitemap-index.xml` soumis, inspection de l'accueil et de 2–3 pages.
- [ ] Suivi des 404 et de la couverture pendant 4 semaines (aucune ancienne URL indexée ne doit tomber en 404) ; comparer avec la liste de `docs/CONTENU-EXISTANT.md`.
- [ ] Google Business Profile : URL du site, catégorie, zone desservie cohérentes avec `site.ts` ; demander des avis (jamais d'avis inventés).
- [ ] Mettre à jour l'URL du site sur Instagram, Facebook, Pinterest, LinkedIn.
- [ ] Lighthouse sur le domaine réel (mobile) : Performance ≥ 95, autres catégories 100.
- [ ] Mettre à jour les dates « Dernière mise à jour » de la confidentialité et d'entrée en vigueur des CGS.
- [ ] Résilier l'hébergement WordPress seulement après la stabilisation de l'indexation.
