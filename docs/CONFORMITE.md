# Conformité légale et RGPD

> Tenu par l'agent `conformite`. Dernière mise à jour : 21/11/2026 (consolidation des pages légales : RNE, délais, RC Pro, dates, clause pros ; avant : CGS art. 4 et formulaire de rétractation).
> L'agent n'est pas avocat : il applique les obligations standard (LCEN, RGPD, loi Informatique et Libertés, recommandations CNIL, Code de la consommation) et signale ce qui demande une validation humaine. **Les points « risque élevé » doivent être tranchés par Amandine, idéalement avec un juriste, avant la mise en production.**

## 1. Checklist

| Statut     | Point                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Fait       | Mentions légales `/mentions-legales/` : éditrice, statut, SIRET, NAF, siège tel qu'affiché, contact, directrice de publication |
| Fait       | Hébergeur Vercel Inc. identifié et sourcé (raison sociale, adresse, contact)                                                   |
| À faire    | Adresse de l'éditrice (ou domiciliation), mention « EI », non-inscription au RCS ; SIREN (RNE) affiché le 2026-11-21           |
| Fait       | Politique de confidentialité `/confidentialite/` créée (le site actuel n'en a aucune)                                          |
| Sans objet | Service de formulaire (§ 6, point 6) : repli mailto: ; un build en mode service échoue tant qu'il n'est pas nommé              |
| Fait       | Aucun cookie ni traceur vérifié dans le code : **pas de bandeau** (§ 4)                                                        |
| Fait       | Formulaire spécifié : champs minimaux, pas d'adresse postale, mention d'information, honeypot, aucune case pré-cochée (§ 5)    |
| À vérifier | Formulaire implémenté conformément au § 5 (agent `designer`), test e2e « zéro cookie » (agent `qa`)                            |
| Fait       | CGS `/conditions-generales/` reprises fidèlement (sauf art. 4 réécrit et clause pros de l'art. 5, voir ci-dessous)             |
| À faire    | CGS : médiateur de la consommation, prix affichés ou devis (§ 6, risque élevé)                                                 |
| À valider  | CGS art. 4 (rétractation) reformulé et formulaire type ajouté en annexe le 2026-11-21 : validation et modèle de devis (§ 6.2)  |
| Fait       | CGS : clause légale clients professionnels (L441-10, D441-5), délais au devis, RNE (réglé le 2026-11-21)                       |
| À faire    | Avis clients affichés : information sur leur contrôle (Code de la consommation, L111-7-2 ; § 6, point 12)                      |
| Fait       | Pages légales liées dans le pied de page (`site.legalNav`, `FooterLegal.astro`) et indexables                                  |
| Fait       | Ancienne URL `/politique-de-confidentialite/` (qui contenait les mentions légales) redirigée en 301 vers `/mentions-legales/`  |
| À faire    | Hébergement Vercel sur une offre **Pro** (usage commercial, DPA) (§ 3)                                                         |

## 2. Fichiers concernés

- `src/content/pages/mentions-legales.md`
- `src/content/pages/confidentialite.md`
- `src/content/pages/conditions-generales.md`
- `src/content/pages/contact.md` (section `formulaire` : libellés et aides des champs)
- `docs/decisions/0003-formulaire-contact.md` (comparatif des services et recommandation)

Les coordonnées (email, téléphone, SIRET) sont injectées dans les trois pages légales par les jetons `{email}`, `{phone}`, `{phoneE164}` et `{siret}` depuis `src/config/site.ts` (ADR-0016). Seul le SIREN (531 938 868, 9 premiers chiffres du SIRET) est écrit en clair, dans les mentions légales et à l'art. 1 des CGS : à corriger à la main si `registration.siret` change.

## 3. Hébergement (Vercel)

- **Identité** : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis ; contact privacy@vercel.com. Aucun numéro de téléphone publié ([politique de confidentialité Vercel](https://vercel.com/legal/privacy-policy), [conditions](https://vercel.com/legal/terms)).
- **Transferts** : Vercel déclare adhérer au EU-U.S. Data Privacy Framework (décision d'adéquation de la Commission européenne du 10/07/2023) et recourir aux clauses contractuelles types.
- **Journaux** : Vercel traite, en sous-traitant du site, l'adresse IP des visiteurs, la localisation déduite (ville, pays), la page demandée et la provenance ; durée non chiffrée dans sa politique (« minimum necessary period »).
- **Point bloquant** : l'offre gratuite **Hobby** est réservée à un usage personnel et non commercial ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)), et le contrat de sous-traitance de Vercel ne couvre que les offres **Pro et Enterprise** ([DPA](https://vercel.com/legal/dpa), section 1, version du 17/03/2026). Le site d'une activité commerciale doit donc être déployé sur un compte Pro pour être en règle avec les conditions de Vercel et avec l'article 28 du RGPD.

## 4. Cookies : bandeau nécessaire ?

**Non.** L'article 82 de la loi Informatique et Libertés (transposition de l'article 5.3 de la directive ePrivacy) n'impose le consentement, donc un bandeau, qu'en cas de lecture ou d'écriture d'informations sur l'appareil de l'utilisateur. Les lignes directrices (délibération CNIL n° 2020-091) et la recommandation (délibération n° 2020-092) du 17/09/2020 ne visent que ces opérations.

Constat dans le code au 18/11/2026 :

- polices Fraunces et Manrope téléchargées au build par la Fonts API d'Astro et servies depuis le site (aucun appel à Google Fonts) ;
- aucun script tiers, aucun `<iframe>`, aucun `document.cookie`, `localStorage` ni `sessionStorage` dans `src/` ;
- aucune mesure d'audience, aucun pixel, aucun fil Instagram intégré (le flux Smash Balloon de l'ancien site n'est pas repris) ;
- les liens vers Instagram, Facebook, Pinterest, WhatsApp et Google sont de simples liens : rien n'est chargé avant le clic.

Le bandeau de l'ancien site ne doit pas être reproduit. Garde-fous :

- test e2e (agent `qa`) : sur chaque page publique, `context.cookies()` vide et `localStorage` vide après chargement ;
- vérifier en production qu'aucun cookie Vercel n'est posé (la barre d'outils et la protection par authentification ne concernent que les déploiements de prévisualisation) ;
- toute future intégration (carte, vidéo, fil Instagram) se charge **au clic**, avec mise à jour de `/confidentialite/` ; une mesure d'audience éventuelle doit être sans cookie et remplir les conditions d'exemption CNIL, et être mentionnée dans la politique.

## 5. Formulaire de contact : spécification

### Champs

| Ordre | Champ           | Type HTML  | Obligatoire | `autocomplete` | Remarque                                                                                              |
| ----- | --------------- | ---------- | ----------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| 1     | Votre nom       | `text`     | oui         | `name`         | Un seul champ (pas de prénom séparé)                                                                  |
| 2     | Votre email     | `email`    | oui         | `email`        |                                                                                                       |
| 3     | Votre téléphone | `tel`      | non         | `tel`          | Libellé suivi de « (facultatif) »                                                                     |
| 4     | Votre projet    | `select`   | oui         | `off`          | Options ci-dessous ; « Je ne sais pas encore » sélectionnée par défaut (ce n'est pas un consentement) |
| 5     | Votre message   | `textarea` | oui         | `off`          |                                                                                                       |
| —     | Honeypot        | `text`     | —           | `off`          | Voir ci-dessous                                                                                       |

**Pas d'adresse postale, pas de ville, pas de code postal** (principe de minimisation, article 5.1.c du RGPD) : l'adresse n'est utile qu'au moment du devis, et le message permet d'indiquer le lieu si la personne le souhaite.

Options du champ « Votre projet » (reprises des offres du site) : Formule Essentiel · Formule Confort · Formule Signature · Formule Studio · Meuble sur mesure 3D · Offre professionnels · Autre demande (collaboration, sous-traitance…) · Je ne sais pas encore.

### Case de consentement : non

Aucune case à cocher n'est nécessaire, et il ne faut pas en ajouter : le traitement repose sur les **mesures précontractuelles** prises à la demande de la personne (article 6.1.b du RGPD) et sur l'**intérêt légitime** à répondre aux messages (article 6.1.f), pas sur le consentement. Une case « J'accepte… » obligatoire laisserait croire à un consentement qui n'en est pas un (il ne serait pas libre). Seule l'**information** (article 13) est requise : c'est la mention ci-dessous. Si Amandine veut un jour envoyer une newsletter, il faudra une case **distincte, facultative et non cochée**.

### Honeypot

- Champ texte supplémentaire (nom exact selon la documentation du service choisi), placé hors écran par une classe utilitaire, **pas** `type="hidden"` (ignoré par les robots).
- `tabindex="-1"`, `autocomplete="off"`, conteneur `aria-hidden="true"`, libellé « Ne remplissez pas ce champ ».
- Aucun captcha (reCAPTCHA, Turnstile, hCaptcha) : sous-traitants supplémentaires, souvent hors UE, et traceurs possibles.

### Mention d'information (sous le bouton, texte prêt à l'emploi)

> Vos informations servent uniquement à répondre à votre demande et, si vous le souhaitez, à préparer votre devis. Elles sont transmises par un service de formulaire sécurisé et conservées au maximum 3 ans après notre dernier échange. Vous pouvez y accéder, les rectifier ou les faire supprimer en m’écrivant à am.gaury@gmail.com. En savoir plus : [politique de confidentialité](/confidentialite/).

(L'email vient de `site.email` ; « un service de formulaire sécurisé » pourra être remplacé par le nom du service une fois choisi.)

### Repli sans service de formulaire (`mailto:`)

Tant que `PUBLIC_FORM_ENDPOINT` n'est pas défini, le formulaire s'envoie via la messagerie du visiteur. La mention et l'indice affichés changent (clés `form.notice.mailtoText` et `form.mailtoHint` de `src/content/pages/contact.md`), et le champ piège n'est pas rendu :

> En cliquant sur « Envoyer ma demande », votre messagerie s’ouvre avec votre demande pré-remplie : il vous reste à l’envoyer. Vos informations servent uniquement à répondre à votre demande et, si vous le souhaitez, à préparer votre devis. Elles sont conservées au maximum 3 ans après notre dernier échange. Vous pouvez y accéder, les rectifier ou les faire supprimer en m’écrivant à {email}.

Indice visible sous le bouton (et annoncé dans `role="status"` avec JS) : « Si rien ne s’ouvre, écrivez-moi directement à {email}. »

### Microcopies

| Situation                    | Texte                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bouton                       | Envoyer ma demande                                                                                                            |
| Bouton pendant l'envoi       | Envoi en cours…                                                                                                               |
| Nom vide                     | Indiquez votre nom pour que je sache comment m’adresser à vous.                                                               |
| Email vide                   | Indiquez votre adresse email pour que je puisse vous répondre.                                                                |
| Email invalide               | Cette adresse email semble incomplète. Exemple : prenom.nom@exemple.fr                                                        |
| Téléphone invalide           | Ce numéro semble incomplet. Exemple : 06 12 34 56 78                                                                          |
| Message vide                 | Dites-m’en un peu plus sur votre projet, même en quelques mots.                                                               |
| Résumé des erreurs (en tête) | Votre demande n’est pas encore partie : corrigez le ou les champs signalés ci-dessous, puis renvoyez-la.                      |
| Succès (titre)               | Merci, votre message est bien parti !                                                                                         |
| Succès (texte)               | Je l’ai bien reçu et je vous réponds au plus vite, du lundi au vendredi. Pensez à jeter un œil à vos courriers indésirables.  |
| Échec de l’envoi             | Votre message n’a pas pu être envoyé. Vérifiez votre connexion et réessayez, ou écrivez-moi directement à am.gaury@gmail.com. |

Toutes ces microcopies (libellés et aides des champs, options, mention, erreurs, succès, échec, bouton) sont dans la clé `form` de `src/content/pages/contact.md`, validée strictement par `src/content.config.ts`. L'adresse email n'y est jamais écrite : le jeton `{email}` est remplacé au rendu par `site.email`. Types, `autocomplete` et caractère obligatoire des champs sont fixés par `src/components/blocks/ContactForm.astro` ; validation pure dans `src/lib/contact-form.ts`.

### Comportement

- Sans JS : `POST` HTML classique vers le service (`PUBLIC_FORM_ENDPOINT`, voir README § Variables d’environnement), redirection vers `/merci/` (champ `_redirect`, noindex, hors sitemap). **Tant que la variable n'est pas définie**, le formulaire reste affiché et son action est un repli `mailto:` vers `site.email` (`enctype="text/plain"`) : le message s'ouvre dans la messagerie du visiteur, aucun service tiers n'est appelé.
- Avec JS : envoi `fetch`, message de succès ou d'échec annoncé dans une région `aria-live="polite"`, focus déplacé sur le message.
- Alternatives visibles à côté du formulaire : téléphone, email, WhatsApp.
- Service recommandé : **Formspark** (Belgique, hébergement en Irlande, DPA d'office) ; comparatif et sources dans l'ADR-0003. Décision humaine.

## 6. Points juridiques ouverts, classés par risque

### Risque élevé (à régler avant la mise en production)

1. **Médiateur de la consommation absent.** Obligatoire dès qu'Amandine vend à des particuliers (Code de la consommation, L612-1) ; ses coordonnées doivent figurer sur le site et dans les CGS (L616-1). Le manquement est passible d'une amende administrative (L641-1). Amandine doit adhérer à un médiateur et fournir son nom, son site et son adresse.
2. **Clause de rétractation (CGS art. 4) : reformulée le 2026-11-21, à faire valider.** L'ancienne clause excluait la rétractation dès le début de la prestation et faisait renoncer le client à ce droit par la seule signature du devis ; or, pour un contrat conclu à distance avec un consommateur (devis signé par email), la rétractation n'est exclue que si la prestation est **pleinement exécutée** avant la fin des 14 jours, après demande expresse et reconnaissance de la perte du droit (L221-28 1°) ; si elle est seulement commencée, le client se rétracte en payant la part fournie (L221-25). Sur demande explicite, l'article 4 a été réécrit (« Droit de rétractation » : clients concernés, délai et décompte L221-18/L221-19, exercice par email avec formulaire ou déclaration dénuée d'ambiguïté L221-21, démarrage anticipé sur demande expresse portée au devis et montant proportionnel L221-25, exclusion L221-28 1°, remboursement sous 14 jours par le même moyen de paiement L221-24, réservé aux consommateurs sauf L221-3) et le **formulaire type** (annexe à l'article R221-1, version du 28/05/2022) ajouté en annexe des CGS, lié depuis l'article 4. Destinataire : AMG Décoration d'Intérieur, Amandine Gaury, email ; l'adresse postale sera ajoutée quand elle sera connue (point 3). Reste bloquant (`TODO(contenu)` de l'art. 4) : validation par Amandine, idéalement par un juriste ; ajout sur son modèle de devis d'une mention distincte et non pré-cochée de demande expresse de démarrage anticipé et de reconnaissance de la perte du droit (sans elle, rien n'est dû en cas de rétractation, L221-25) ; envoi du formulaire avec le devis ou la confirmation de commande (L221-13). Sans information complète sur ce droit, le délai de rétractation est prolongé de 12 mois (L221-20). À confirmer par le juriste : la « fonctionnalité de rétractation » en ligne exigée depuis le 19/06/2026 (L221-21 al. 3, ordonnance n° 2026-2) ne viserait que les contrats conclus au moyen d'une interface en ligne, pas un devis signé par email ; cas d'un devis signé au domicile du client (contrat hors établissement).
3. **Adresse de l'éditrice incomplète.** « Gif-sur-Yvette (91) » ne suffit pas : l'éditrice professionnelle doit publier son adresse et son numéro d'immatriculation (LCEN, art. 1-1 depuis la loi SREN n° 2024-449 ; sanctions à l'art. 1-2). Amandine n'est pas obligée de publier son domicile : elle peut passer par une société de domiciliation et donner cette adresse (mentions légales, CGS art. 1 et destinataire du formulaire de rétractation). Immatriculation réglée le 2026-11-21 : il n'existe pas de numéro RNE distinct, l'identifiant au Registre national des entreprises est le SIREN (9 premiers chiffres du SIRET), écrit en clair dans les mentions légales et à l'art. 1 des CGS (à garder identique à `registration.siret` de `src/config/site.ts`) ; reste à confirmer qu'elle n'est pas aussi inscrite au RCS (activité commerciale), sinon ajouter `RCS <ville du greffe>`.
4. **Offre Vercel.** Hobby interdit l'usage commercial et n'inclut pas le DPA : passer sur Pro (§ 3).
5. **Prix affichés et CGS « sur devis ».** La page Prestations affiche 189, 339, 489, 689 € (et 339 € pour le meuble), alors que les CGS (art. 1, 3, 5) parlent de « devis personnalisé » et de tarifs « définis dans le devis ». L'information précontractuelle sur le prix doit être claire et cohérente (L111-1, L112-1). Amandine doit choisir : prix fermes, prix « à partir de », ou devis systématique, puis aligner la page et les CGS.

### Risque moyen

6. **Service de formulaire non choisi** (mise en ligne avec le repli `mailto:`, décidée le 2026-11-21 : point sans objet tant qu'aucun service n'est configuré) : la politique de confidentialité ne nomme pas de sous-traitant ni de pays (article 13.1.e et f du RGPD). **Bloquant uniquement si un service est configuré** : la phrase d'attente des « Transferts » porte le marqueur `{à-préciser}`, et tout build avec `PUBLIC_FORM_ENDPOINT` échoue tant que les blocs `{formulaire:service}` ne nomment pas le prestataire, son pays d'établissement, son pays d'hébergement et la garantie de transfert (`src/lib/content-template.ts`, ADR-0016).
7. **Messagerie Gmail grand public** : les demandes arrivent sur am.gaury@gmail.com, sans contrat de sous-traitance avec Google. Envisager une messagerie professionnelle couverte par un DPA (Google Workspace ou fournisseur européen).
8. ~~**Clients professionnels**~~ (réglé le 2026-11-21 : clause légale ajoutée à l'art. 5 des CGS, réservée aux clients professionnels : pénalités de retard au taux de la BCE majoré de 10 points, exigibles sans rappel, indemnité forfaitaire de 40 € pour frais de recouvrement, Code de commerce L441-10 II et D441-5 ; c'est le régime légal, sans engagement commercial nouveau. Rappel non bloquant : ces mentions doivent aussi figurer sur les factures adressées aux professionnels) : l'« Offre professionnels » implique des factures B2B ; les pénalités de retard et l'indemnité forfaitaire de 40 € doivent figurer dans les conditions (Code de commerce, L441-10).
9. **Publication des projets (CGS art. 7)** : les photos transmises par le client montrent son logement. Prévoir un accord explicite pour toute publication (site, réseaux, fiches réalisations), comme pour les avis clients publiés.
10. **Mention « EI »** : depuis le 15/05/2022, le nom de l'entrepreneuse individuelle doit être accompagné de « EI » ou « entrepreneur individuel » sur ses documents et sa communication. Formulation à valider par Amandine (bloquant).
11. ~~**Crédits Pexels**~~ (réglé le 2026-11-21 : aucune photo Pexels reprise) : l'ancien site crédite « Photos libres de droits sur Pexels » sans préciser lesquelles. Les exclure du nouveau site ou les créditer.
12. **Avis clients (témoignages)** : si des témoignages clients sont affichés, l'article L111-7-2 du Code de la consommation impose une information loyale, claire et transparente sur les modalités de publication et de traitement des avis, en précisant s'ils font ou non l'objet d'un contrôle (et, si oui, ses principales caractéristiques). À ajouter près des témoignages ou sur une page liée, avec la provenance des avis (texte à faire rédiger par l'agent `redacteur`, à valider par Amandine). Non bloquant pour les pages légales ; voir aussi le point 9 (accord des clients).

### Risque faible

13. **Téléphone de l'hébergeur** (décision validée le 2026-11-21) : Vercel n'en publie pas ; l'adresse postale et l'email sont donnés.
14. ~~**CGS art. 3**~~ (réglé le 2026-11-21 : « prix nets : TVA non applicable, article 293 B du Code général des impôts ») : « prix TTC » alors que la TVA n'est pas applicable ; préférer « prix nets, TVA non applicable, art. 293 B du CGI ».
15. ~~**CGS art. 6**~~ (réglé le 2026-11-21 : l'obligation L111-1 3° est satisfaite si chaque devis indique un délai ; « délais indiqués sur le devis » est conforme. Rappel non bloquant : chaque devis doit indiquer un délai) : délais renvoyés au devis ; un délai indicatif par formule doit être connu avant la commande (L111-1 3°).
16. ~~**CGS art. 12**~~ (réglé le 2026-11-21 : l'assurance RC Pro n'est pas obligatoire pour une décoratrice, activité non réglementée ; clause reprise telle quelle. Rappels non bloquants : nom de l'assureur facultatif ; référence à l'article 1240 du Code civil, qui ne fonde pas une obligation d'assurance, à faire vérifier par un juriste ; assurance décennale seulement si Amandine fait de la maîtrise d'œuvre ou du suivi de chantier, à lui demander) : la référence à l'article 1240 du Code civil (responsabilité délictuelle) ne fonde pas une obligation d'assurance ; nom de l'assureur et couverture géographique à indiquer si Amandine le souhaite.
17. ~~**CGS, définitions**~~ (réglé le 2026-11-21 : commande = devis signé ; « Client » = personne qui acquiert un ou plusieurs services par devis signé) : « commande passée sur le site » alors qu'aucune commande en ligne n'est possible (commande par devis signé).
18. **Durée de conservation** des demandes sans suite fixée à 3 ans maximum après le dernier échange (repère du référentiel CNIL « gestion des activités commerciales », délibération n° 2021-131), valeur publiée par défaut : Amandine peut choisir plus court. À confirmer avec l'absence de toute prospection (un seul `TODO(contenu)` dans la confidentialité, bloquant).
19. ~~**Date d'entrée en vigueur**~~ (réglé le 2026-11-21 : aucune obligation légale, bonne pratique seulement ; rappel non bloquant) : date d'entrée en vigueur des CGS et date de mise à jour de la politique de confidentialité à ajuster le jour de la bascule (`docs/MISE-EN-LIGNE.md` § 4).

## 7. Informations à fournir par Amandine (pour la PR)

Liste minimale au 2026-11-21 (les autres points ont été réglés sans elle, voir § 6). Les points 1 à 7 correspondent aux 10 `TODO(contenu)` restants des pages légales (`npm run check:prod`).

1. Adresse postale complète du siège, ou adresse d'une société de domiciliation si elle ne veut pas publier son domicile (mentions légales, CGS art. 1, formulaire de rétractation).
2. Formulation avec la mention « EI » ou « entrepreneur individuel ».
3. Est-elle aussi inscrite au RCS (activité commerciale) ? Si oui, ville du greffe.
4. Adhésion à un médiateur de la consommation : nom, site internet, adresse.
5. Choix sur les prix : prix fermes, « à partir de » ou devis seul (alignement de la page Prestations et des CGS, art. 1, 3, 5).
6. Validation de l'article 4 des CGS (rétractation) et du formulaire type en annexe, idéalement par un juriste ; mention de demande expresse de démarrage anticipé ajoutée à son modèle de devis ; formulaire joint au devis ou à la confirmation de commande.
7. Accord des clients pour la publication de leurs projets et photos (CGS art. 7) ; durée de conservation des demandes sans suite (3 ans après le dernier échange par défaut) et confirmation de l'absence de toute prospection.
8. Passage du compte Vercel sur l'offre Pro (§ 3).

Questions non bloquantes, à poser en même temps : fait-elle de la maîtrise d'œuvre ou du suivi de chantier (assurance décennale) ? souhaite-t-elle afficher son assureur RC Pro ? ses devis indiquent-ils toujours un délai, et ses factures aux professionnels les pénalités et l'indemnité de 40 € ? d'où viennent les avis affichés et sont-ils contrôlés (point 12) ? Recommandations facultatives : messagerie professionnelle couverte par un contrat de sous-traitance ; service de formulaire un jour (Formspark recommandé, ADR-0003).

## 8. Sources (consultées le 18/11/2026)

- Vercel : [politique de confidentialité](https://vercel.com/legal/privacy-policy), [conditions d'utilisation](https://vercel.com/legal/terms), [DPA](https://vercel.com/legal/dpa), [fair use](https://vercel.com/docs/limits/fair-use-guidelines), [limites des journaux](https://vercel.com/docs/observability/limits-and-pricing)
- CNIL : [lignes directrices cookies et autres traceurs](https://www.cnil.fr/sites/cnil/files/atoms/files/lignes_directrices_de_la_cnil_sur_les_cookies_et_autres_traceurs.pdf), [recommandation cookies](https://www.cnil.fr/sites/cnil/files/atoms/files/recommandation-cookies-et-autres-traceurs.pdf), [référentiel gestion des activités commerciales](https://www.cnil.fr/sites/cnil/files/atoms/files/referentiel_traitements-donnees-caractere-personnel_gestion-activites-commerciales.pdf), [adresser une plainte](https://www.cnil.fr/fr/adresser-une-plainte)
- LCEN après la loi SREN : [CMS Francis Lefebvre, mentions légales](https://cms.law/fr/fra/legal-updates/le-defaut-de-mentions-legales-peut-conduire-a-la-condamnation-penale-de-l-rsquo-editeur-du-site) (vérifier le texte de l'article 1-1 sur Légifrance)
- Services de formulaire : voir l'ADR-0003.
- Code de la consommation, droit de rétractation (consulté le 21/11/2026) : [L221-5](https://www.legifrance.gouv.fr/affichCodeArticle.do?cidTexte=LEGITEXT000006069565&idArticle=LEGIARTI000032221333), [L221-18](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226842), [L221-19](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226840), [L221-20](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226836), [L221-21](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226834), [L221-24](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226828), [L221-25](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179), [L221-28](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170), [annexe à l'article R221-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045418600) (formulaire type) ; L221-3 connu seulement par des sources secondaires, dont la [fiche DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/petits-professionnels-vous-avez-14-jours-pour-vous-retracter-en-cas-de-contrat-conclu-hors-etablissement) (texte à relire sur Légifrance).
- Code de commerce, clients professionnels (consulté le 21/11/2026, versions en vigueur) : [L441-10](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392) (II : taux BCE majoré de 10 points, plancher de trois fois le taux légal, exigibles sans rappel, indemnité forfaitaire), [D441-5](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043197457) (indemnité de 40 €, version du 27/02/2021).
