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

### Visuels (le site ne montre encore aucune vraie réalisation)

- Photos HD et rendus 3D des 4 réalisations (`src/assets/projets/<slug>/`), avec la nature de chaque image (rendu 3D ou photo réelle) et le lieu de chaque projet.
- Une vraie paire « rendu 3D / photo du résultat » cadrée à l'identique pour le comparateur de `/visualisation-3d/`.
- Rendus 3D pour les héros de l'accueil et de `/visualisation-3d/`, couvertures des 2 articles, image Open Graph 1200 × 630.
- Portrait d'Amandine (photo HD, format portrait) ; logo vectoriel (SVG).

### Textes et faits à confirmer

- Formation : « certifiée par MJM Design Graphic » et/ou « cursus de 5 ans, certifiée en 2010 » (à propos).
- Nom de la formule : « Essentiel » ou « Essentielle » ; nombre de vues 3D et de modifications incluses par formule ; prix des options.
- Conserver l'offre « Meuble sur-mesure 3D » et l'« Offre Professionnels » ? Formule réelle de chaque réalisation.
- Attribution des avis clients ; questions fréquentes (FAQ, collection vide aujourd'hui).
- Zone : projets en Suisse acceptés ? déplacements sur place à Paris / Île-de-France ? rendez-vous à distance en visio, par téléphone ou au choix ?
- Chambre des enfants du chalet (couleurs, matières) ; WhatsApp sur le même numéro ; profil LinkedIn actif.
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
