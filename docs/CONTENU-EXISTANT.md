# Inventaire du contenu existant (site actuel)

> **Relevé complet du 18/11/2026** sur https://amgdecorationdinterieur.com/ (WordPress + Elementor, SEO par All in One SEO 5.0.5.1, formulaire WPForms Lite, flux Instagram « Smash Balloon Instagram Feed », bandeau cookies avec lien cookiedatabase.org). Premier relevé partiel : 17/11/2026.
>
> **Limite de méthode, à lire avant d'utiliser ce fichier.** L'outil de crawl (WebFetch) refuse de recopier une page en entier et plafonne chaque citation à environ 125 caractères. Ce fichier contient donc :
>
> - les **titres exacts**, les **libellés exacts** (boutons, formules, étapes, articles des CGS), les **données factuelles** (prix, SIRET, URLs, images) ;
> - pour les paragraphes : une **citation exacte courte** entre « » puis un **résumé fidèle** signalé par _(résumé)_. Un résumé n'est **jamais** à publier comme texte d'Amandine.
> - Les **balises `<title>` et meta descriptions** ne sont pas lisibles par l'outil (il ne voit que le corps de page). Les titres notés « title probable » sont ceux affichés en tête du rendu.
>
> Les textes intégraux, `title`, meta descriptions et avis exacts ont été extraits du HTML public le 18/11/2026 : voir `docs/contenu-source/` (une page par fichier). Un export WordPress reste utile pour les contenus non publiés et les originaux des médias.

## Identité

- Marque : AMG Décoration d'Intérieur (le site écrit « Amg décoration d'intérieur ») — Amandine Gaury, designer d'intérieur
- Slogan / H1 de l'accueil : « Visualisez votre intérieur idéal en 3D, avant même qu'il prenne vie »
- Téléphone : 07 82 35 81 32 (affiché en texte, sans lien `tel:`) · Email : am.gaury@gmail.com (lien cassé sur le site : `http://am.gaury@gmail.com`)
- Horaires (accueil) : « lundi au vendredi 9H - 17H »
- Zone : région parisienne ; « dans toute la France » à distance (email, téléphone, visio) ; villes citées sur l'accueil : Paris, Lyon, Marseille ; un projet en Suisse
- Pied de page : « DESIGNER D'INTÉRIEUR – PARIS » (anciennes pages projets : « Région parisienne »)
- Siège (mentions légales) : Gif-sur-Yvette (91)
- Réseaux :
  - Facebook : https://www.facebook.com/amgdecoration/
  - Instagram : https://www.instagram.com/amgdecorationdinterieur/ (bio affichée : « Amandine | Designer d'intérieur 3D | 📍France » ; « Votre intérieur imaginé en 3D »)
  - Pinterest : https://www.pinterest.fr/amgaury/
  - LinkedIn : https://www.linkedin.com/in/amandine-gaury-97a263193/
  - Behance : lien présent uniquement dans le pied de page des anciennes pages projets (URL non relevée) — `TODO(contenu): Amandine a-t-elle toujours un profil Behance à afficher ? URL ?`
- WhatsApp : **aucun bouton ni numéro WhatsApp** sur le site (le type Elementor « Éléments flottants » existe mais est vide). Seule mention : « suivi par email ou WhatsApp ». `TODO(contenu): le numéro WhatsApp est-il le 07 82 35 81 32 ?`
- Fiche Google : identifiant d'établissement `0xd9a7734643e7d7a1` (relevé dans les liens des avis, voir § Avis). URL publique de la fiche non affichée sur le site. `TODO(contenu): URL de la fiche Google Business Profile (lien « Voir tous les avis »).`
- Logo : `wp-content/uploads/2026/04/LOGO-DECO-def.png` (en-tête), `LOGO-DECO-definitif-960x1024.png` (pied de page), variantes `LOGO-DECO-01.png`, `LOGO-DECO-3.png`, `LOGO-DECO-definitif2.png`, favicon `2024/02/LOGO-FAV.png`. Pas de version vectorielle en ligne.

---

## 1. Liste exhaustive des URLs (base des redirections 301)

### Sources consultées

| Source                    | Résultat                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/robots.txt`             | Existe. `Disallow: /wp-admin/`, `Allow: /wp-admin/admin-ajax.php`, déclare `/sitemap.xml` et `/sitemap.rss`           |
| `/sitemap.xml`            | Index de sitemaps (All in One SEO) → `post-sitemap.xml`, `page-sitemap.xml`, `category-sitemap.xml`                   |
| `/sitemap_index.xml`      | Même index (lastmod : pages 2026-04-28, posts et catégories 2024-01-30)                                               |
| `/wp-sitemap.xml`         | Répond avec le même index (3 sous-sitemaps)                                                                           |
| `/sitemap.rss`            | Flux RSS de sitemap, 24 URLs (les 22 pages + les 2 articles)                                                          |
| `/feed/`                  | Flux RSS « Amg décoration d'intérieur », 2 items                                                                      |
| API REST `/wp-json/wp/v2` | 22 pages, 2 articles, 1 catégorie, 0 étiquette, aucun type de contenu personnalisé (pas de CPT projets / témoignages) |
| Menu et pied de page      | Accueil, Prestations, Réalisations, À Propos, Contact · CGS, Mentions légales                                         |
| `/mentions-legales/`      | **404** (n'existe pas : les mentions légales sont à `/politique-de-confidentialite/`)                                 |

### Décompte

| Type                                      | Nombre                  |
| ----------------------------------------- | ----------------------- |
| Pages principales                         | 5                       |
| Pages légales                             | 2                       |
| Pages projets (récentes, reliées au menu) | 4                       |
| Pages projets anciennes (orphelines)      | 11                      |
| Articles                                  | 2 (vides / test)        |
| Catégorie                                 | 1                       |
| Auteur                                    | 1                       |
| Flux et sitemaps                          | 6                       |
| **Total URLs de contenu**                 | **26** (+ 6 techniques) |

Médias : plus de 100 fichiers dans la médiathèque (l'API renvoie 100 éléments par page ; seule la première page a été lue). Aucun `alt` renseigné dans la médiathèque.

### Tableau des URLs

Les destinations marquées _(proposé)_ sont à valider par l'agent `seo` avant d'écrire `vercel.json`.

| Ancienne URL                                                      | Type                    | Titre WordPress                      | Contenu réel                                               | Destination envisagée                                              |
| ----------------------------------------------------------------- | ----------------------- | ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `/`                                                               | Page (id 1318)          | Accueil                              | Accueil                                                    | `/`                                                                |
| `/services/`                                                      | Page (id 1320)          | Prestations                          | Formules, meuble sur-mesure, offre pros, **prix affichés** | `/prestations/`                                                    |
| `/about/`                                                         | Page (id 1669)          | Réalisations                         | Liste des 4 projets récents                                | `/realisations/`                                                   |
| `/a-propos/`                                                      | Page (id 1319)          | A propos                             | Présentation d'Amandine                                    | `/a-propos/` (identique)                                           |
| `/contact/`                                                       | Page (id 1321)          | Contact                              | Formulaire                                                 | `/contact/` (identique)                                            |
| `/politique-de-confidentialite/`                                  | Page légale (id 3)      | Mentions légales                     | **Mentions légales** (malgré le slug)                      | `/mentions-legales/`                                               |
| `/conditions-generales-de-services-cgs/`                          | Page légale (id 4557)   | Conditions générales de services CGS | CGS en 12 articles                                         | `/conditions-generales/`                                           |
| `/projet-chalet/`                                                 | Projet (id 6197)        | Projet chalet                        | Résidence secondaire en Suisse                             | `/realisations/chalet-suisse/` _(proposé)_                         |
| `/projet-lamyae/`                                                 | Projet (id 4481)        | Projet Lamyae                        | Pièce de vie, maison en construction (3D)                  | `/realisations/<slug-lamyae>/` _(slug à choisir)_                  |
| `/projet-iryna/`                                                  | Projet (id 6069)        | Projet Iryna                         | Espace de vie scandinave (3D)                              | `/realisations/<slug-iryna>/` _(slug à choisir)_                   |
| `/projet_magali/`                                                 | Projet (id 6041)        | Projet Magali                        | Sous-sol transformé en suite parentale                     | `/realisations/<slug-magali>/` _(slug à choisir)_                  |
| `/projet-1/`                                                      | Projet ancien (id 2926) | Projet Léo                           | Galerie 3D + avant, meuble sur mesure probable, sans texte | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-2/`                                                      | Projet ancien (id 3073) | Projet Aurélie                       | Galerie 3D + avant, sans texte                             | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-3/`                                                      | Projet ancien (id 3115) | Projet Imanol                        | Chambre d'enfant safari / jungle, 3D + planches + avant    | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-4/`                                                      | Projet ancien (id 3179) | Projet terrasse                      | 5 rendus 3D de terrasse, sans texte                        | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-5/`                                                      | Projet ancien (id 3218) | Projet villa espagnolle              | Salon (fichiers « Sabine »), 3D + avant, sans texte        | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-6/`                                                      | Projet ancien (id 3234) | Projet Guillaume                     | Salon, 3D + avant, sans texte                              | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-7/`                                                      | Projet ancien (id 3313) | Projet Clément                       | Chambre d'enfant dinosaures, 3D + avant + **après**        | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-marine/`                                                 | Projet ancien (id 3417) | Projet Marine                        | 3D + avant, sans texte                                     | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-marine-dupliquer-3417/`                                  | Projet ancien (id 3615) | Projet Anne-Sophie                   | 10 rendus 3D + 8 photos avant, sans texte                  | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-chambre-ado/`                                            | Projet ancien (id 3454) | Projet chambre ado                   | 5 rendus 3D + 1 plan 3D, sans texte                        | `/realisations/` _(ou fiche si conservé)_                          |
| `/projet-chambre-ado-dupliquer-3454/`                             | Projet ancien (id 3597) | Projet Montréal                      | 5 rendus 3D, sans texte                                    | `/realisations/` _(ou fiche si conservé)_                          |
| `/bonjour-tout-le-monde/`                                         | Article (id 1)          | Bonjour tout le monde !              | Article de test WordPress par défaut (22/01/2024)          | `/conseils-deco/` _(proposé ; ou 410)_                             |
| `/2593-2/`                                                        | Article (id 2593)       | Feed Instagram                       | Article vide (30/01/2024)                                  | `/realisations/` _(proposé)_                                       |
| `/category/blog/`                                                 | Catégorie               | Blog                                 | Liste des 2 articles ci-dessus                             | `/conseils-deco/`                                                  |
| `/author/amgdecorationdinterieur-com/`                            | Auteur                  | amgdecorationdinterieur.com          | Archive auteur                                             | `/a-propos/`                                                       |
| `/feed/`                                                          | Flux RSS                | —                                    | 2 items                                                    | flux RSS de `/conseils-deco/` s'il existe, sinon `/conseils-deco/` |
| `/sitemap.xml`, `/sitemap_index.xml`                              | Sitemaps                | —                                    | Index                                                      | `/sitemap-index.xml` (sitemap Astro)                               |
| `/wp-sitemap.xml`, `/sitemap.rss`                                 | Sitemaps                | —                                    | Index / RSS                                                | `/sitemap-index.xml`                                               |
| `/page-sitemap.xml`, `/post-sitemap.xml`, `/category-sitemap.xml` | Sous-sitemaps           | —                                    | —                                                          | `/sitemap-index.xml`                                               |

Notes pour les redirections :

- `/about/` affiche « Projet chalet suisse » avec un lien **cassé** `/projet-iryna/projet-chalet` : le rediriger aussi vers la fiche du chalet par sécurité.
- Les liens internes de l'accueil vers les projets sont sans slash final (`/projet-chalet`, `/projet-lamyae`, `/projet-iryna`) : prévoir les deux variantes.
- Les 11 projets anciens ne sont liés depuis aucune page (orphelins) mais sont dans le sitemap, donc potentiellement indexés. `TODO(contenu): parmi les projets Léo, Aurélie, Imanol, terrasse, villa espagnole (Sabine), Guillaume, Clément, Marine, Anne-Sophie, chambre ado et Montréal, lesquels Amandine veut-elle garder en fiche réalisation (avec quelques lignes de description) ?`
- Médias `/wp-content/uploads/*` : potentiellement indexés dans Google Images. Décision à prendre par l'agent `seo` (pas de redirection individuelle réaliste).

---

## 2. Textes par page

### 2.1 Accueil — `/`

- Title : non lisible (`TODO(contenu)` export AIOSEO). Meta description : non lisible.
- Structure relevée, dans l'ordre :

1. **H1** « Visualisez votre intérieur idéal en 3D, avant même qu'il prenne vie »
   - Bouton « VOUS AVEZ UN PROJET ? » → `/contact/`
   - Texte sous l'image : « AMG DÉCORATION D'INTÉRIEUR »
2. **H2** « Mes missions & mes valeurs »
   - « La force de mon approche repose sur l'équilibre entre esthétique, fonctionnalité et confort. »
   - _(résumé)_ Elle est à l'écoute des besoins de chacun et utilise des visuels 3D pour permettre de se projeter avant d'investir dans du mobilier ou des travaux.
   - Bouton « EN SAVOIR PLUS » → `#qui-suis-je`
3. **H2** « Mes prestations »
   - « Je m'engage à proposer des services alliant qualité, créativité, sens de l'écoute et respect des délais. »
   - Boutons (tous → `/services/`) : « FORMULE ESSENTIEL POUR LES PETITS ESPACES » · « FORMULE CONFORT POUR LES ESPACES DE VIE » · « FORMULE SIGNATURE POUR LES ESPACES OUVERTS » · « FORMULE STUDIO POUR UN STUDIO OU PETIT APPARTEMENT » · « Voir toutes les formules »
4. **H2** « Qui suis-je ? » (titre présent deux fois)
5. **H2** « Amandine, designer d'intérieur »
   - « Amandine, décoratrice d'intérieur certifiée par MJM Design Graphic à Paris, met son expertise au service de vos projets »
   - _(résumé)_ Spécialisée en modélisation 3D. Attentive, elle accompagne chaque étape et conseille sur couleurs, matières et mobilier selon les goûts et le budget. Basée en région parisienne, elle travaille dans toute la France par email, téléphone et visio, et réalise des visuels 3D immersifs à partir de plans et de photos. Clients à Paris, Lyon, Marseille et ailleurs.
   - Bouton « CONTACTEZ-MOI » → `/contact/`
6. **H2** « Mes derniers projets »
   - « Chaque espace raconte une histoire unique, reflétant le style, la personnalité et les aspirations » (suite non relevée)
   - Cartes : **H2** « Résidence secondaire en Suisse » → `/projet-chalet` · **H2** « Projet Lamyae » → `/projet-lamyae` · **H2** « Projet Iryna » → `/projet-iryna` · **H2** « Projet Magali » → `/projet_magali/`
   - Bouton « VOIR TOUTES LES RÉALISATIONS » → `/about/`
7. **H2** « Déroulement de votre projet 3D »
   - **H3** « 1 // PRISE DE CONTACT » — « Présentez-moi votre projet, vos envies, vos contraintes et votre budget. » _(résumé de la suite)_ un questionnaire permet ensuite de préciser les attentes.
   - **H3** « 2 // PHOTOS ET DEVIS » — « Envoyez-moi des photos de votre pièce, un plan avec dimensions et les éléments à conserver. » _(résumé)_ devis personnalisé.
   - **H3** « 3 // VALIDATION DE L'AMBIANCE » — « Le projet débute après paiement. » _(résumé)_ une planche d'ambiance sert de fil conducteur.
   - **H3** « 4 // AMÉNAGEMENT ET CONCEPTION 3D » — « Je conçois votre projet en 3D avec sélection de mobilier, matériaux et agencement »
   - **H3** « 5 // MODIFICATIONS » — « Je vous présente une 1ère version du projet. » _(résumé)_ ajustée selon les retours.
   - **H3** « 6 // VALIDATION PROJET » — « Vous recevez la version finale sous format numérique (visuels 4K). »
   - _(résumé)_ Suivi tout au long du projet par email ou WhatsApp.
8. **H2** « « Les détails ne sont pas les détails. Ils font la conception. » » — Charles Eames
9. **H2** « Les avantages de la 3D » — 8 intitulés en gras (exacts) :
   1. « Se projeter facilement » — « Visualisez votre futur intérieur de manière réaliste et comprenez immédiatement les volumes, les couleurs et l'ambiance. »
   2. « Éviter les erreurs coûteuses » — _(résumé)_ tester différentes options avant de se lancer.
   3. « Gagner du temps » — _(résumé)_ tout est pensé et validé en amont.
   4. « Optimiser chaque espace » — _(résumé)_ exploiter chaque m², y compris les espaces petits ou complexes.
   5. « Personnaliser votre projet » — _(résumé)_ couleurs, matières et mobilier ajustés aux goûts et besoins.
   6. « Faciliter la prise de décision » — _(résumé)_ comparer plusieurs propositions de façon simple et visuelle.
   7. « Un rendu réaliste et immersif » — _(résumé)_ des visuels proches du résultat final.
   8. « Un véritable outil de sérénité » — _(résumé)_ avancer avec clarté, sans mauvaise surprise.
   - Bouton « LANCEZ-VOUS » → `/contact/`
10. **H2** « Prêt à transformer votre espace ? » — bouton « Contactez-moi » → `/contact/`
11. **H4** « Des projets qui prennent vie » — témoignages (voir § 3)
12. **H2** « Contact » — téléphone, email, « lundi au vendredi 9H - 17H »
13. **H2** « Restez-connectés » · **H2** « @amgdecorationdinterieur » — flux Instagram (4 publications, voir § 4.3)

Images de l'accueil (toutes `alt` vide sauf mention) :

| Section              | URL (`/wp-content/uploads/…`)                                                               | Remarque                                     |
| -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Hero                 | `2026/04/Design-sans-titre-82-copie-3-scaled.png`                                           | visuel principal                             |
| Missions & valeurs   | `2026/04/Design-sans-titre-82-copie-scaled-e1775666508573-1151x1536.png`                    |                                              |
| Qui suis-je          | `2024/02/moi-2048x2048.png`                                                                 | portrait d'Amandine                          |
| Carte chalet         | `2026/04/04.png`                                                                            |                                              |
| Carte Lamyae         | `2026/04/03-1.png`                                                                          |                                              |
| Carte Iryna          | `2026/04/02.png`                                                                            |                                              |
| Carte Magali         | `2026/04/01.png`                                                                            |                                              |
| Après citation Eames | `2026/04/Neutral-Minimalist-Decor-Instagram-Post-copie-2-819x1024.png`                      | visuel type Canva                            |
| Avatars avis         | `2024/01/avatar_13847971.png`, `2024/01/person_13979039.png`, `2024/01/avatar_13848064.png` | icônes génériques, pas des photos de clients |

### 2.2 Prestations — `/services/`

- Title probable : « Amg Décoration d'Intérieur : Prestations Sur Mesure pour Votre Intérieur ». Meta description : non lisible.
- **H1** « Prestations »
  - « C'est pourquoi j'ai créé des formules simples et adaptées à vos besoins » _(résumé du début)_ chaque projet est unique, du petit espace au logement entier.
- **H2** « Transformez votre intérieur en un lieu qui vous ressemble »
  - « je vous aide à concevoir un intérieur harmonieux grâce à des visuels 3D réalistes » (extrait)
- **H3** « Formules déco 3D » — sous-titre « VISUALISEZ AVANT DE DÉCIDER » (détail § 6)
  - Bouton « DEMANDER UN DEVIS » → `/contact/`
- **H3** « Meuble Sur-Mesure 3D » — sous-titre « UN MEUBLE UNIQUE POUR VOTRE INTÉRIEUR » (détail § 6)
  - Bouton « DEMANDER UN DEVIS » → `/contact/`
- **H3** « Offre Professionnels » — sous-titre « INVESTISSEURS, AGENTS IMMOBILIERS » (détail § 6)
  - Bouton « DEMANDER UN DEVIS PROFESSIONNEL » → `/contact/`
- Pas de FAQ.
- Images : `2026/04/Offres-particuliers-768x576.png`, `2024/01/Planche-meuble-sur-mesure-Leo-1-768x543.png`, `2024/02/Visuel-5-2-768x432.jpeg` (`alt` vides).

### 2.3 Réalisations — `/about/`

- Title probable : « Réalisations - Amg décoration d'intérieur ». Meta description : non lisible.
- **H1** « Réalisations »
  - « Explorez une sélection de projets qui m'ont été confiés. » … « Je vous souhaite une visite inspirante. »
- Projets (ordre affiché), chacun avec un bouton « Cliquez ici » :
  - **H2** « Projet Lamyae » — « Aménagement et décoration d'une pièce de vie, projet en construction » → `/projet-lamyae/`
  - **H2** « Projet Magali » — « Transformation d'un sous-sol en chambre parentale » → `/projet_magali/`
  - **H2** « Projet Iryna » — « Aménagement et décoration d'un espace de vie, projet en construction » → `/projet-iryna/`
  - **H2** « Projet chalet suisse » — « Appartement moderne et cocooning au coeur des Alpes » → lien cassé `/projet-iryna/projet-chalet`

### 2.4 À propos — `/a-propos/`

- Title / meta description : non lisibles.
- Accroche en haut de page (sans balise de titre) : « Transformez votre espace de vie avec l'expertise d'une décoratrice certifiée »
- **H2** « À propos »
  - « Décoratrice d'intérieur je vous aide à réaliser un espace de vie harmonieux » _(résumé)_ conseils sur l'ambiance, le mobilier, l'éclairage et les couleurs, selon les goûts et le budget.
  - « Que vous soyez particuliers ou professionnels » _(résumé)_ accompagnement avec visuels et plans 3D.
  - « À l'écoute des dernières tendances, j'aime les intérieurs chaleureux » _(résumé)_ et confortables.
  - « j'ai suivi un parcours artistique sur Paris » _(résumé)_ d'abord en graphisme, puis un cursus de 5 ans en décoration d'intérieur.
  - « J'ai été certifiée décoratrice d'intérieur en 2010. »
  - « Aujourd'hui j'exerce ce métier avec passion. »
  - « Je suis quelqu'un de perfectionniste » _(résumé)_ attentive aux petits détails.
  - « Mes points forts sont l'écoute, la créativité et l'imagination. »
- **H4** « “ Si le soleil entre dans la maison, il est un peu dans votre coeur. ” Le Corbusier »
- **H2** « Mes missions »
  - « Optimiser et harmoniser les espaces intérieurs en fonction de votre budget. » _(résumé)_ rendre les espaces plus beaux et fonctionnels, associer matériaux, couleurs et styles.
- **H3** « Mes valeurs »
  - « Écoute, confiance et rigueur sont les valeurs qui m'animent » _(résumé)_ pour comprendre les besoins et livrer un travail conforme aux attentes.
  - Témoignage de Christine C (voir § 3)
- Images : portrait `2024/01/moiii2-e1707078636338.png` (`alt` vide), `2021/11/quotes.svg` (décoratif), avatar `2024/01/avatar_13848064.png`.

### 2.5 Contact — `/contact/`

- Title / meta description : non lisibles.
- **H1** « Contact » ; bandeau : « Besoin d'un Conseiller en Aménagement d'Espace ? Contactez-Nous »
- « N'hésitez pas à me partager les détails (lieu, surface, besoins, budget) » (extrait)
- « Pour toute demande spécifique (collaboration, mission freelance, sous-traitance…) » (extrait)
- Formulaire WPForms Lite :

| Champ                                                                   | Obligatoire |
| ----------------------------------------------------------------------- | ----------- |
| Nom                                                                     | oui         |
| Prénom                                                                  | oui         |
| Adresse                                                                 | oui         |
| Ville                                                                   | oui         |
| Code postal                                                             | oui         |
| Téléphone                                                               | non         |
| Email                                                                   | oui         |
| Message                                                                 | oui         |
| Case « politique de confidentialité »                                   | oui         |
| Case « J'accepte que mes données soient utilisées pour me recontacter » | non indiqué |
| Bouton « Envoyer »                                                      | —           |

> Pour `conformite` : l'adresse postale obligatoire est disproportionnée (minimisation RGPD) et la case renvoie vers une politique de confidentialité qui n'existe pas.

- Pas de FAQ, pas d'horaires, pas de WhatsApp sur cette page.
- Images : `elementor/thumbs/CONTACT-3-…png` (`alt` « CONTACT »), `2024/01/Visuel-18-scaled.jpeg`, `2024/01/Visuel-2-chambre-scaled.jpeg`, `2024/01/698_64089432bfbe5.jpg`, `2024/01/Visuel-scaled.jpeg` (`alt` vides).

### 2.6 Mentions légales — `/politique-de-confidentialite/`

- Accroche (title probable) : « Les mentions légales dans la décoration d'intérieur en ligne »
- **H1** « Mentions légales » ; sections : Identification de l'entreprise · Responsable de publication · Hébergeur · Propriété intellectuelle · Collecte de données personnelles · Cookies · Liens externes · Droit applicable · Contact · Crédits (dont crédits photos)
- Extraits : « Amandine Gaury, le siège social est située à Gif sur yvette (91) » · « Mme Amandine Gaury » · « Hostinger International Ltd. » · « Toute reproduction ou utilisation sans autorisation préalable est strictement interdite. » · « Nous collectons des données personnelles uniquement dans le cadre de nos services. » · « Ce site utilise des cookies pour améliorer votre expérience de navigation. » · « Ce site est soumis au droit français. » · « Conception et réalisation du site : Amandine Gaury » · « Photos libres de droits sur Pexels »
- **Aucune politique de confidentialité distincte** n'existe sur le site (pas de responsable de traitement, durées de conservation, droits RGPD, DPO, date de mise à jour). Données légales : voir § 7.

### 2.7 Conditions générales de services — `/conditions-generales-de-services-cgs/`

- **H1** (probable) « Conditions générales de services : Garanties, obligations et responsabilités » ; **H2** « Conditions générales de services ( CGS ) »
- Articles (intitulés exacts, en gras, non balisés en titres) :

| Article                                                      | Extrait exact                                                                                                           | _(résumé)_                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Article 1 – Contenu et champ d'application                   | « Nos prestations sont réalisées sur devis personnalisé, établi en fonction des besoins spécifiques de chaque Client. » | Planches, plans, visuels 3D, choix matériaux et mobilier ; devis détaillé (nature, délais, paiement). |
| Article 2 – Commande                                         | « La commande ne sera considérée comme définitive qu'après acceptation sans réserve des présentes CGS »                 | Définitive après acceptation des CGS, devis signé et paiement intégral. Devis valable 1 mois.         |
| Article 3 – Tarif                                            | « Les tarifs sont fermes et non révisables pendant leur période de validité. »                                          | Prix en euros TTC, fermes 1 mois ; prestataire non assujetti à la TVA.                                |
| Article 4 – Exceptions au délai de rétractation              | « ce droit ne peut être exercé si la prestation a commencé avec l'accord exprès du Client. »                            | 14 jours en principe ; renonciation à la signature du devis ; prestations réalisées dues.             |
| Article 5 – Tarifs et modalités de paiement                  | « Le paiement est exigible en totalité à la signature du devis et avant le démarrage de la prestation. »                | Paiement intégral, pas d'acompte ; carte (via PayPal) ou virement ; suspension si impayé.             |
| Article 6 – Délais de réalisation                            | « Tout retard dans la transmission des éléments par le Client pourra entraîner un décalage des délais. »                | Délais fixés au devis, à partir du planning et de la réception des éléments.                          |
| Article 7 – Engagement du prestataire                        | « Le Prestataire s'engage à respecter la confidentialité des informations fournies par le Client »                      | Démarrage après dossier complet et paiement ; publication anonyme possible des projets.               |
| Article 8 – Obligations du Client                            | « transmettre tous les documents nécessaires dans les meilleurs délais »                                                | Photos, plan coté, contraintes techniques, photos des meubles à conserver.                            |
| Article 9 – Propriété intellectuelle                         | « Toute reproduction ou utilisation commerciale est interdite sans accord écrit. »                                      | Livrables propriété de l'auteure, usage personnel du client.                                          |
| Article 10 – Responsabilité                                  | « La responsabilité du Prestataire ne pourra être mise en cause qu'en cas de manquement à sa mission. »                 | Exclusions : information manquante, retard client, force majeure.                                     |
| Article 11 – Droit applicable et Litiges                     | « les parties s'efforceront de trouver une solution à l'amiable. »                                                      | Droit français, tribunaux français. **Aucun médiateur de la consommation cité.**                      |
| Article 12 – Assurance Responsabilité Civile Professionnelle | « Le Prestataire déclare être couvert par une assurance responsabilité civile professionnelle »                         | Détails sur demande via le formulaire.                                                                |

- Mention : « TVA non applicable – article 293B du CGI ». Aucun montant cité. Nombre de modifications incluses : non précisé. Date de mise à jour : absente.
- Point d'attention pour `conformite` : les CGS parlent de « devis personnalisé » alors que `/services/` affiche des prix fixes.

---

## 3. Avis clients

> Règle : ne jamais reformuler. Textes **intégraux et exacts**, extraits du HTML public le 18/11/2026 (`docs/contenu-source/accueil.md`, `docs/contenu-source/a-propos.md`).

### Accueil (section « Des projets qui prennent vie »)

Source : avis Google saisis à la main dans Elementor (widget « premium testimonials ») : pas de note, pas de date, pas de note moyenne. Chaque avis renvoie vers Google (même établissement, identifiant `0xd9a7734643e7d7a1`).

**Attribution établie par la structure HTML** : dans chaque bloc `premium-testimonial-box`, le texte (`<p>`) est suivi du nom de son auteur (`premium-testimonial-person-name`) et du lien Google. L'inventaire du 17/11 (et `docs/BRIEF.md`, « cf. avis de Catherine T. ») attribuait à tort l'avis « cuisine » à Catherine T. : il est de **Sébastien T.**

| Auteur       | Lien Google              | Texte exact                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patrick V.   | https://g.co/kgs/9j2HT7H | « Amandine est très professionnelle, très réactive et à l’écoute. Le travail des différentes planches (en 3D et mobiliers) ainsi que les conseils sont exceptionnels et de très grande qualité. Pour ceux qui souhaitent obtenir des idées nouvelles et originales pour une rénovation de son intérieur, je conseille vivement. » |
| Sébastien T. | https://g.co/kgs/e32cpzA | « Une jeune femme tout à fait compétente qui a su bien nous guider dans notre projet de cuisine en nous projetant dans la modélisation 3D en y intégrant nos goûts, mais à laquelle sans elle nous n’aurions jamais su nous mettre d’accord sur le style et les couleurs. Je recommande ses services et son professionnel. »      |
| Catherine T. | https://g.co/kgs/jLNWYSE | « Personne chaleureuse, très professionnelle, sa créativité, sa rigueur et son sens du détail nous ont tout de suite séduit. Nous la recommandons vivement. »                                                                                                                                                                     |

### À propos

| Auteur      | Source                            | Texte exact                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Christine C | non indiquée (pas de lien Google) | « Tout s’est passé par mail (envoi de photos et réponses à nos diverses demandes), Amandine a su nous amener vers d’autres horizons que nous ne pensions pas réalisables et nous a même fourni les références catalogues et peinture. Nous pensons la recontacter en 2024 pour finir la dernière pièce de notre appartement. Recommandation à 100% et beaucoup de réussites pour l’avenir » |

`TODO(contenu): confirmer avec Amandine l'attribution des avis (en particulier l'avis « cuisine » = Sébastien T. d'après le HTML) ; indiquer la source de l'avis de Christine C et l'autorisation de le publier ; URL publique de la fiche Google Business Profile.`

---

## 4. Projets

Aucun projet n'indique de surface, de budget, de durée ni d'étapes détaillées. Aucune image n'a d'`alt` utile (vide ou nom de fichier). Aucune légende. La nature des images (avant / 3D / après) est **déduite** du nom de fichier ou de la section, sauf mention contraire.

`TODO(contenu): pour chaque projet conservé, demander à Amandine : lieu (ville ou région), pièce(s), surface, style, matières, budget indicatif si publiable, ce qui a été réalisé (3D seule ou travaux réalisés), et la nature exacte de chaque image (rendu 3D ou photo réelle), plus les originaux HD.`

### 4.1 Projets récents (reliés au menu)

#### Résidence secondaire en Suisse — `/projet-chalet/`

- Title probable : « Appartement Chalet Moderne en Suisse : Confort et Élégance Montagnarde. »
- Titre : « Appartement moderne et cocooning en Suisse » ; accroche (page Réalisations) : « Appartement moderne et cocooning au coeur des Alpes »
- Lieu : Suisse (station de montagne, ville non précisée) · Type : appartement, résidence secondaire
- Pièces : pièce de vie, chambre parentale, chambre des enfants
- Style : chalet modernisé, montagne et confort contemporain
- Matières / couleurs : bois clair aux murs, luminaire graphique en métal noir, accents rouge vichy, crème, gris, touches dorées ; tête de lit capitonnée, suspensions dorées
- Extraits : « une résidence secondaire nichée en Suisse » · « Concevoir et harmoniser trois espaces distincts » · « le bois clair habille les murs et réchauffe l'atmosphère » · « Les teintes crème et grises, la tête de lit capitonnée et les suspensions dorées »
- _(résumé)_ Lieu de repos après le ski ; séjour chaleureux pour les soirées en famille ; chambre apaisante avec vue sur les sommets enneigés.
- Images (`/wp-content/uploads/2026/04/`) : `chalet2.png`, `chalet3.png`, `chalet4.png`, `chalet4-1.png`, `chalet4-2.png`, `chalet4-3.png`, `chalet5.png` à `chalet9.png` ; carte accueil `04.png`. `alt` : vide ou « chalet2 », « chalet3 »… Nature : **inconnue** (rendus 3D ou photos ? à confirmer).

#### Projet Lamyae — `/projet-lamyae/`

- Title probable : « Projet Lamyae - Amg décoration d'intérieur »
- Titre : « Une pièce de vie élégante et intemporelle » ; accroche : « Aménagement et décoration d'une pièce de vie, projet en construction »
- Lieu : non précisé · Pièce : pièce de vie · Maison en construction (« maison d'exception »), conçue en 3D dès la phase plan
- Style : naturel, lumineux, intemporel · Matières : bois et pierre · Couleurs : « tons doux »
- Extraits : « Ce projet 3D a été conçu pour accompagner la réalisation d'une maison d'exception » · « Le mariage de matières nobles telles que le bois et la pierre apporte profondeur et authenticité » · « Pensé comme un lieu de vie apaisant et intemporel »
- Images (`/wp-content/uploads/2026/04/`) : `lamyae1.png`, `lamyae1-1.png`, `lamyae1-2.png`, `lamyae2.png` à `lamyae5.png`, `lamyae7.png` à `lamyae9.png` (pas de `lamyae6`) ; carte accueil `03-1.png`. Nature : **rendus 3D** (le texte parle de « projet 3D »).

#### Projet Iryna — `/projet-iryna/`

- Title probable : « Projet Iryna - Amg décoration d'intérieur »
- Titre : « Espace de vie scandinave » ; accroche : « Aménagement et décoration d'un espace de vie, projet en construction »
- Client : Iryna et son mari · Lieu : non précisé · Pièce : espace de vie
- Style : scandinave moderne et épuré · Matières : bois clair, tables aux lignes organiques en ciment, fibres naturelles (rideaux, tapis), luminaires
- Extraits : « projet de visualisation 3D réalisé pour l'espace de vie d'Iryna » · « créer un intérieur à la fois apaisant et élégant » · « Bois clair, tables aux lignes organiques en ciment » · « Car c'est là toute la magie des matériaux naturels »
- Images (`/wp-content/uploads/2026/04/`) : `iryna1.png`, `iryna1-1.png`, `iryna2.png`, `iryna3.png`, `iryna4.png`, `iryna6.png`, `iryna7.png`, `iryna8.png`, `iryna9.png` ; carte accueil `02.png`. Nature : **rendus 3D**.

#### Projet Magali — `/projet_magali/`

- Title probable : « Projet Magali - Amg décoration d'intérieur »
- Titre : « Du sous-sol à une chambre parentale lumineuse » ; accroche : « Transformation d'un sous-sol en chambre parentale »
- Lieu : non précisé · Pièces : suite parentale (dressing, salle d'eau, chambre, espace coiffeuse) dans un ancien sous-sol
- Style : contemporain, doux · Matières : tasseaux de bois, éclairage LED, miroir rond rétroéclairé, arches · Couleurs : « palette poudrée, claire et lumineuse »
- Extraits : « transformation complète d'un ancien sous-sol en une suite parentale élégante et lumineuse » · « Dès l'entrée, un grand dressing structure l'accueil » · « tête de lit sur mesure, intégrant des niches encastrées sublimées par un éclairage LED » · « Un espace coiffeuse a également été imaginé, habillé de tasseaux de bois » · « palette poudrée, claire et lumineuse »
- Images (`/wp-content/uploads/2026/04/`) : `magali1.png` à `magali7.png` ; carte accueil `01.png`. Nature : **inconnue** (rendus 3D probables).

### 4.2 Projets anciens (orphelins, pages de février 2024)

Gabarit commun : H2 « Conception 3D », H2 « Avant », parfois « Après réalisation des clients », H2 « By Amandine Gaury ». **Aucun texte descriptif.** Toutes les images ont un `alt` vide. URLs relatives à `/wp-content/uploads/2024/02/` sauf mention.

| Page / titre WP                                                                                                                                 | Indices (noms de fichiers)                            | Rendus 3D                                                                                                                                                                                       | Photos avant                                                                                                                              | Photos après                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/projet-1/` Projet Léo                                                                                                                         | meuble sur mesure (« Planche-meuble-sur-mesure-Leo ») | `2024/01/` : `Visuel-1-1`, `Visuel-2`, `Visuel-3`, `Visuel-5`, `Visuel-6-2` (.jpeg), planche `Planche-meuble-sur-mesure-Leo-1.png`                                                              | `1674479345_102-1`, `_138`, `_248`, `1674479346_235-1`, `1674479345_155`, `_177-2` (.jpg)                                                 | —                                                                                                                                                            |
| `/projet-2/` Projet Aurélie (title probable « Conception 3D : Transformez vos Espaces avec Notre Expertise »)                                   | —                                                     | `Visuel-1` à `Visuel-6` (.jpeg)                                                                                                                                                                 | `1681424210_217`, `1681424214_171`, `1681424218_213`, `1681424279_249`, `1681424292_136`, `1681424302_162` (.jpg)                         | —                                                                                                                                                            |
| `/projet-3/` Projet Imanol                                                                                                                      | chambre enfant safari 3 ans, chambre jungle           | `Rendu-3D-Chambre-enfant-Safari-3-ans`, `…_56`, `…_59`, `Chambre-enfant-Safari-3-ans_Unnamed-Space-58` (.jpeg) ; planches `Moodboard-chambre-jungle.png`, `Planche-mobilier-chambre-jungle.png` | `1676207888_126`, `1676207890_154`, `1676207890_171`, `1676207860_128` (.jpg)                                                             | —                                                                                                                                                            |
| `/projet-4/` Projet terrasse                                                                                                                    | terrasse                                              | `Visuel-terrase-04`, `Visuel-terrasse-02`, `-03`, `-05`, `-06` (.jpeg)                                                                                                                          | —                                                                                                                                         | —                                                                                                                                                            |
| `/projet-5/` Projet villa espagnolle                                                                                                            | salon, prénom « Sabine »                              | `Salon-Sabine-1` à `-4`, `Sabine-5`, `Sabine-8` (.jpeg)                                                                                                                                         | `1668507784_295`, `1668507829_212`, `1668507830_139` (.jpg), `Sans-titre-9-copie.png`                                                     | —                                                                                                                                                            |
| `/projet-6/` Projet Guillaume                                                                                                                   | salon                                                 | `Copy-of-salon-Guillaume_site-web-1`, `…_Unnamed-Space-18`, `-19`, `-21` (.jpeg)                                                                                                                | `1666447718_234`, `1666447720_108`, `1666447720_149`, `1666447721_274`, `1666447723_129`, `1666447725_245` (.jpg)                         | —                                                                                                                                                            |
| `/projet-7/` Projet Clément                                                                                                                     | chambre d'enfant dinosaures                           | `chambre-clement-dino_Kids-Room-56` à `-59` (.jpeg)                                                                                                                                             | `1666448763_172`, `1666448767_183`, `1666448764_175`, `1666448765_188-1`, `1666448765_242` (.jpg)                                         | **oui** (« Après réalisation des clients ») : `698_640894d92569a`, `698_6408940e18491`, `698_64089432bfbe5`, `698_64089493bf3f8`, `698_64089468564e5` (.jpg) |
| `/projet-marine/` Projet Marine                                                                                                                 | —                                                     | `visuel-1-Marine` à `visuel-6-Marine` (.png)                                                                                                                                                    | `1662302284_200`, `1662302395_270`, `1662580665_190`, `1662580667_139`, `1662580677_218`, `1662580680_125` (.jpg)                         | —                                                                                                                                                            |
| `/projet-marine-dupliquer-3417/` Projet Anne-Sophie (title probable « Conception 3D : Explorez les dernières innovations en design intérieur ») | —                                                     | `Visuel-7`, `-8`, `-9`, `-15` à `-20`, `Visuel-91` (.jpeg)                                                                                                                                      | `chat-917_64aed531eaebc`, `…538a6e0e`, `…535888cf`, `…52e4f149`, `…51e52d90`, `1685909714_178`, `1685909719_259`, `1685909708_214` (.jpg) | —                                                                                                                                                            |
| `/projet-chambre-ado/` Projet chambre ado (title probable « Conception 3D : Explorez nos solutions de visualisation intérieure »)               | chambre ado                                           | `Visuel-1-1` à `Visuel-5-1` (.jpeg), `Plan-3D.jpeg` (plan)                                                                                                                                      | —                                                                                                                                         | —                                                                                                                                                            |
| `/projet-chambre-ado-dupliquer-3454/` Projet Montréal                                                                                           | Montréal ?                                            | `Visuel-1-2` à `Visuel-5-2` (.jpeg)                                                                                                                                                             | —                                                                                                                                         | —                                                                                                                                                            |

Note : la page Contact réutilise des images (`2024/01/Visuel-18-scaled.jpeg`, `Visuel-2-chambre-scaled.jpeg`, `698_64089432bfbe5.jpg`) et la page Prestations aussi (`Visuel-5-2`, planche Léo).

### 4.3 Publications Instagram affichées sur l'accueil (flux Smash Balloon)

| Publication                                   | Lien                                     | Texte court (alt du flux, résumé)                                                  |
| --------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| « Chambre naturelle & chaleureuse »           | https://www.instagram.com/p/DcvaY5AgpLF/ | ambiance neutre, bois clair, lin, coton, laine                                     |
| « AVANT / APRÈS — Pièce de vie chez Mathieu » | https://www.instagram.com/p/DcrFqcVAo-k/ | avant/après (relevé du 17/11 : accents terracotta, bois, papier peint panoramique) |
| « Projet 3D pièce de vie moderne »            | https://www.instagram.com/p/DcrCrkTArx-/ | version 3D (probablement du projet de Mathieu)                                     |
| Chambre bébé                                  | https://www.instagram.com/p/DaCy8ImgnFS/ | bois clair, rotin, affiches d'animaux, vert d'eau (relevé du 17/11 : thème surf)   |

`TODO(contenu): le projet « pièce de vie chez Mathieu » (avant/après + 3D) mérite une fiche réalisation : Amandine peut-elle fournir les visuels HD et l'accord de Mathieu ?`

---

## 5. Faits vérifiables sur Amandine (affichés sur le site)

| Fait                                                                                              | Page source            |
| ------------------------------------------------------------------------------------------------- | ---------------------- |
| « décoratrice d'intérieur certifiée par MJM Design Graphic à Paris »                              | Accueil                |
| Spécialisée en modélisation 3D                                                                    | Accueil                |
| « J'ai été certifiée décoratrice d'intérieur en 2010. »                                           | À propos               |
| Parcours artistique à Paris, d'abord en graphisme, puis cursus de 5 ans en décoration d'intérieur | À propos               |
| Points forts : écoute, créativité, imagination ; se dit perfectionniste                           | À propos               |
| Valeurs : écoute, confiance, rigueur (accueil : esthétique, fonctionnalité, confort)              | À propos / Accueil     |
| Accompagne particuliers et professionnels                                                         | À propos               |
| Micro-entrepreneur, SIRET 531 938 868 00019, siège à Gif-sur-Yvette (91)                          | Mentions légales / CGS |
| Assurance RC professionnelle (déclarée)                                                           | CGS, art. 12           |

Non affichés (ne pas inventer) :

- `TODO(contenu): nombre d'années d'expérience à afficher (le site dit seulement « certifiée en 2010 ») ; l'activité a-t-elle été continue depuis ?`
- `TODO(contenu): intitulé exact du diplôme ou de la certification MJM, et lien entre « cursus de 5 ans » et cette certification.`
- `TODO(contenu): nombre de projets réalisés, nombre de clients, logiciels 3D utilisés — à fournir seulement si Amandine souhaite les publier.`
- Incohérence à faire trancher : `TODO(contenu): accueil « certifiée par MJM Design Graphic » vs à propos « parcours artistique… graphisme puis cursus de 5 ans » : quelle formulation est exacte ?`

---

## 6. Prestations (page `/services/`)

**Les prix SONT affichés** sur le site actuel (le relevé du 17/11 indiquait l'inverse, c'est corrigé). Aucune mention TTC ni « à partir de » à côté des prix ; les CGS précisent « euros TTC » et « TVA non applicable – article 293B du CGI ».

### Formules déco 3D — « VISUALISEZ AVANT DE DÉCIDER »

| Formule (nom affiché) | Pièces ciblées (texte exact)                                                   | Prix affiché |
| --------------------- | ------------------------------------------------------------------------------ | ------------ |
| Formule Essentielle   | « entrée, wc,buanderie, salle de bain, dressing »                              | 189 €        |
| Formule Confort       | « salon, salle à manger, cuisine, chambre, bureau »                            | 339 €        |
| Formule Signature     | « salon + cuisine ouverte, salon + séjour, suite parentale, terrasse, balcon » | 489 €        |
| Formule Studio        | « studio, petit appartement jusqu'à 26m² »                                     | 689 €        |

- « La formule confort est la formule la plus demandée. »
- Nom : « Essentielle » sur `/services/`, « ESSENTIEL » sur l'accueil.
- Accroches de l'accueil : Essentiel « pour les petits espaces », Confort « pour les espaces de vie », Signature « pour les espaces ouverts », Studio « pour un studio ou petit appartement ».
- Inclus (commun à toutes les formules) : rendez-vous à distance ; 1 plan d'aménagement ; « Plusieurs vues 3D (perspectives, vues de face) » ; sélection de mobilier et matériaux ; « 1 ou plusieurs modifications en fonction de la formule choisie » ; accompagnement par WhatsApp ou email.
- Options (prix non affichés) : liste de courses détaillée avec liens ; visuel 3D supplémentaire ; modification supplémentaire ; immersion 360°.
- Livrables (accueil) : version finale « sous format numérique (visuels 4K) ».
- Délais : **non affichés**. Surface : seulement « jusqu'à 26m² » pour Studio.

### Meuble Sur-Mesure 3D — « UN MEUBLE UNIQUE POUR VOTRE INTÉRIEUR »

- _(résumé)_ Conception de meubles personnalisés (bibliothèque, meuble TV, bureau, banquette) selon les contraintes du lieu.
- Inclus : analyse des besoins ; 1 planche ambiance de la pièce ; choix des matériaux et finitions ; 1 plan d'élévation détaillé avec toutes les mesures ; 1 visuel réaliste 4K.
- Prix affiché : **339 €**.

### Offre Professionnels — « INVESTISSEURS, AGENTS IMMOBILIERS »

- _(résumé)_ Visuels 3D pour valoriser les biens et accélérer les ventes.
- Inclus : 1 rendez-vous à distance ; 1 plan 3D de l'aménagement ; 1 visuel réaliste 4K ; mise en valeur du potentiel du bien.
- Prix : « Devis professionnel » ; « Tarif dégressif à partir de 3 biens ».

Informations manquantes :

- ~~`TODO(contenu): les prix 189 / 339 / 489 / 689 € (et 339 € pour le meuble sur mesure) sont-ils toujours valables et à afficher sur le nouveau site ? Prix fixes ou « à partir de » ?`~~ réglé le 2026-11-23 (offre officielle « Offres particuliers » d'avril 2026 : prix fixes, 1 / 2 / 3 / illimitées modifications, livraison sous 7 à 14 jours, options de 89 à 300 € ; voir `src/content/prestations/`).
- ~~`TODO(contenu): nombre exact de vues 3D et de modifications incluses par formule.`~~ réglé le 2026-11-23 (offre officielle « Offres particuliers » d'avril 2026 : prix fixes, 1 / 2 / 3 / illimitées modifications, livraison sous 7 à 14 jours, options de 89 à 300 € ; voir `src/content/prestations/`).
- ~~`TODO(contenu): délai de livraison indicatif par formule.`~~ réglé le 2026-11-23 (offre officielle « Offres particuliers » d'avril 2026 : prix fixes, 1 / 2 / 3 / illimitées modifications, livraison sous 7 à 14 jours, options de 89 à 300 € ; voir `src/content/prestations/`).
- ~~`TODO(contenu): prix des options (liste de courses, visuel supplémentaire, modification supplémentaire, immersion 360°).`~~ réglé le 2026-11-23 (offre officielle « Offres particuliers » d'avril 2026 : prix fixes, 1 / 2 / 3 / illimitées modifications, livraison sous 7 à 14 jours, options de 89 à 300 € ; voir `src/content/prestations/`).
- `TODO(contenu): faut-il conserver les offres « Meuble sur-mesure 3D » et « Professionnels » dans le nouveau site (non prévues dans le plan actuel des 4 formules) ?`

---

## 7. Données légales affichées (relevées telles quelles, non vérifiées)

| Donnée                       | Valeur affichée                                                                                                                         | Page                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Éditrice                     | Amandine Gaury                                                                                                                          | Mentions légales      |
| Statut                       | « auto-entrepreneur » (mentions) / « micro-entrepreneur » (CGS)                                                                         | Mentions légales, CGS |
| SIRET                        | 531 938 868 00019                                                                                                                       | Mentions légales, CGS |
| Code NAF                     | 7410Z (Activités spécialisées de design)                                                                                                | Mentions légales      |
| Activité                     | Conseils et services en décoration d'intérieur                                                                                          | Mentions légales      |
| Siège                        | Gif-sur-Yvette (91) — adresse complète non affichée (donnée par l'humain le 2026-11-22 : 24 allée du Pré Lambesc, 91190 Gif-sur-Yvette) | Mentions légales, CGS |
| Directrice de publication    | Mme Amandine Gaury                                                                                                                      | Mentions légales      |
| Hébergeur                    | Hostinger International Ltd., 61 Lordou Vitronos Street, Larcana 6023 (orthographe du site)                                             | Mentions légales      |
| TVA                          | « TVA non applicable – article 293B du CGI »                                                                                            | CGS                   |
| RCS / RM, TVA intracom.      | non affichés                                                                                                                            | —                     |
| Conception du site           | Amandine Gaury                                                                                                                          | Mentions légales      |
| Crédits photos               | Amandine Gaury et « Photos libres de droits sur Pexels »                                                                                | Mentions légales      |
| Médiateur de la consommation | non affiché                                                                                                                             | —                     |
| Politique de confidentialité | **inexistante**                                                                                                                         | —                     |
| Copyright                    | « 2024-2026 » (pages récentes), « Copyright 2024 © » (anciennes)                                                                        | Pied de page          |

- ~~`TODO(contenu): adresse postale complète à publier dans les mentions légales`~~ réglé le 2026-11-22 (24 allée du Pré Lambesc, 91190 Gif-sur-Yvette).
- `TODO(contenu): médiateur de la consommation choisi par Amandine (obligatoire pour une prestation à des particuliers).`
- `TODO(contenu): assureur RC Pro (nom) si Amandine souhaite l'afficher.`
- ~~Photos Pexels de l'ancien site~~ : réglé le 2026-11-21, aucune photo Pexels n'est reprise (seuls les rendus et photos d'Amandine le sont, `src/assets/placeholders/README.md`) ; rien à créditer (décision dans `src/content/pages/mentions-legales.md`).

---

## 8. Médias à demander en HD

Les fichiers en ligne sont des PNG / JPEG compressés (souvent `-1024x576`, `-scaled`). **Demander à Amandine les originaux HD** (rendus 4K et photos) pour : les 4 projets récents (chalet, Lamyae, Iryna, Magali), le projet de Mathieu, les projets anciens conservés, le portrait (`moi-2048x2048.png`, `moiii2-…png`), le logo vectoriel. En attendant : placeholders neutres dans `src/assets/placeholders/`, listés dans les PR.

## 9. Pages lues et échecs du crawl (18/11/2026)

- Lues : les 22 pages, les 2 articles, la catégorie, la page auteur, les flux et sitemaps, l'API REST (pages, articles, types, étiquettes, médias page 1).
- Échecs : `/mentions-legales/` (404, normal) ; `/wp-json/yoast/v1/get_head` (404 : le site utilise All in One SEO, pas Yoast) ; pages Google Maps des avis (écran de consentement Google) ; balises `<title>` et meta descriptions (non exposées par l'outil) ; textes intégraux (citations limitées à environ 125 caractères par l'outil).
