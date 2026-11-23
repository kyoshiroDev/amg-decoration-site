---
# Source : docs/contenu-source/conditions-generales-de-services-cgs.md (CGS en 12 articles du site actuel).
# Reprise FIDÈLE : mêmes engagements, même numérotation. Seules modifications : orthographe et typographie,
# découpage en titres et listes, adresse du site sans « www », renvoi vers la page Contact (art. 12) ;
# 2026-11-21 : « TTC » remplacé par « prix nets » (TVA non applicable, déjà indiqué) et définitions alignées sur la
# commande par devis signé décrite à l’art. 2 (le site ne permet pas de commander en ligne).
# 2026-11-21 (sur demande explicite) : art. 4 reformulé (« Exceptions au délai de rétractation » devient « Droit de
# rétractation ») d’après le Code de la consommation vérifié sur Légifrance (L221-5, L221-18, L221-19, L221-21,
# L221-24, L221-25, L221-28 1°, L221-3 d’après des sources secondaires) ; la renonciation automatique par la signature du devis est retirée (contraire à L221-25 et
# L221-28 1°) ; formulaire type de rétractation ajouté en annexe (texte de l’annexe à l’art. R221-1, version du 28/05/2022).
# 2026-11-21 (consolidation) : définition « Client » alignée sur le devis signé ; art. 3 « prix nets : TVA non applicable, article 293 B
# du CGI » sans doublon ; art. 1 complété par l’immatriculation au RNE (SIREN = 9 premiers chiffres du SIRET, écrit en clair : à garder
# identique à `registration.siret` de src/config/site.ts) ; art. 5 complété par la clause légale réservée aux clients professionnels
# (Code de commerce L441-10 II et D441-5, vérifiés sur Légifrance le 21/11/2026).
# Aucun autre ajout juridique : les points restants sont listés ci-dessous et dans docs/CONFORMITE.md, à trancher par Amandine
# (idéalement avec un juriste) AVANT la mise en production.
# Coordonnées : jetons `{email}`, `{phone}`, `{phoneE164}`, `{siret}`, `{legalAddress}` remplacés au rendu par les valeurs de src/config/site.ts (ADR-0016).
#
# Décision (2026-11-23, confirmée par l’humain d’après l’offre officielle « Offres particuliers » du site actuel, avril 2026) : formules à prix fixe (Essentielle 189 €, Confort 339 €, Signature 489 €, Studio 689 €) et options à la carte à prix fixe (visuel 3D ou modification supplémentaire 99 €, moodboard seul 89 €, shopping-list 179 €, immersion 360° 300 €) ; meuble sur mesure 339 € (ancien site) ; offre Professionnels sur devis. Art. 1, 3 et 5 alignés : prix affichés sur /prestations/, devis récapitulatif avec prix total (L111-1, L112-1).
# Décision (2026-11-23, pratique confirmée par l’humain) : Amandine démarre toujours ses projets 14 jours après la signature du devis. L’art. 4 le dit : aucun démarrage pendant le délai de rétractation, donc ni demande expresse de démarrage anticipé (L221-25), ni case sur le devis, ni montant dû en cas de rétractation (remboursement intégral, L221-24). L’ancienne clause (« pas de rétractation dès que la prestation a commencé », renonciation par la seule signature) n’était pas conforme à L221-28 1° et a été remplacée. Non bloquant, recommandé : relecture par un juriste ; joindre le formulaire de rétractation au devis ou à la confirmation de commande (L221-13) ; si un projet devait un jour démarrer plus tôt, recueillir d’abord une demande expresse et distincte du client sur le devis.
# Décision (2026-11-23, risque accepté par l’humain) : pas encore de médiateur de la consommation (adhésion reportée pour raison de coût). L’obligation (L612-1, coordonnées sur le site et dans les CGS L616-1) demeure, sanction possible jusqu’à 3 000 € (L641-1) ; risque déjà présent sur l’ancien site, qui n’en affichait aucun. À RÉGULARISER dès que possible : adhésion à un médiateur référencé par la CECMC (secteur « aménagement de l’habitat… et activités de décoration »), puis nom, site et adresse à ajouter à l’art. 11 et aux mentions légales (docs/MISE-EN-LIGNE.md § 4). Aucun nom affiché sans adhésion réelle.
# Décision (2026-11-21) : clients professionnels — clause légale ajoutée à l’art. 5 (pénalités de retard au taux de la BCE majoré de 10 points, exigibles sans rappel ; indemnité forfaitaire de 40 € pour frais de recouvrement), réservée aux clients professionnels (Code de commerce L441-10 II et D441-5, Légifrance, versions en vigueur au 21/11/2026). C’est le régime légal applicable à défaut d’accord : aucun engagement commercial nouveau. Rappel (non bloquant) : ces mentions doivent aussi figurer sur les factures adressées aux professionnels.
# Décision (2026-11-21) : art. 6 — l’information précontractuelle sur le délai (L111-1 3°) est satisfaite dès lors que chaque devis indique un délai d’exécution : « délais indiqués sur le devis » est conforme, aucun délai par formule n’est à publier sur le site. Rappel (non bloquant) : chaque devis doit indiquer un délai.
# TODO(contenu): art. 7 publication des projets et des photos transmises par le client : prévoir un accord explicite du client (photos de son logement), en particulier pour les avis et les fiches réalisations.
# Décision (2026-11-21) : art. 12 — l’assurance RC Pro n’est pas obligatoire pour une décoratrice d’intérieur (activité non réglementée) ; la clause est reprise telle quelle. Rappel (non bloquant) : nom de l’assureur et couverture géographique facultatifs, à ajouter si Amandine le souhaite ; la référence à l’article 1240 du Code civil (responsabilité délictuelle, qui ne fonde pas une obligation d’assurance) est à faire vérifier par un juriste ; une assurance décennale ne serait requise que si elle fait de la maîtrise d’œuvre ou du suivi de chantier (à lui demander).
# Décision (2026-11-22) : mention « EI » accolée au nom (entrepreneur individuel, imposée par le décret 2022-725), voir mentions-legales.md.
# Décision (2026-11-22, adresse donnée par l’humain et confirmée par l’annuaire des entreprises, INSEE/RNE) : siège 24 allée du Pré Lambesc, 91190 Gif-sur-Yvette, injecté par le jeton `{legalAddress}` (registration.legalAddress de src/config/site.ts, ADR-0016) : art. 1 et destinataire du formulaire de rétractation.
# Décision (2026-11-21) : aucune obligation légale de dater les CGS (bonne pratique seulement). Rappel (non bloquant) : indiquer une date d’entrée en vigueur le jour de la bascule.
seo:
  title: 'Conditions générales de services'
  description: 'Conditions générales de services d’AMG Décoration d’Intérieur : devis, commande, tarifs, paiement, délais, rétractation, propriété intellectuelle.'
hero:
  eyebrow: 'Informations légales'
  heading: 'Conditions générales de services'
  lead: 'Les règles qui encadrent nos échanges, du devis à la remise de votre projet 3D. Prenez le temps de les lire avant de signer votre devis.'
---

## Préambule et définitions

Les termes employés dans les présentes Conditions générales de services ont la signification indiquée ci-dessous.

- **Conditions générales de services ou CGS** : le présent document, qui s’applique entre le Prestataire et le Client.
- **Commande** : l’engagement du Client portant sur un ou plusieurs services présentés sur le site internet amgdecorationdinterieur.com, formalisé par la signature du devis (article 2).
- **Site internet** : le site accessible à l’adresse [https://amgdecorationdinterieur.com](https://amgdecorationdinterieur.com).
- **Service ou prestation** : les services de décoration d’intérieur proposés par AMG Décoration d’Intérieur et présentés sur le site internet.
- **Client** : la personne physique ou morale qui acquiert un ou plusieurs services du Prestataire par devis signé, à des fins personnelles ou professionnelles, après avoir accepté les présentes CGS.
- **Prestataire** : Amandine Gaury EI, AMG Décoration d’Intérieur, décoratrice d’intérieur.

Tout Client reconnaît avoir pris connaissance de ce document avant de signer un devis avec la mention « bon pour accord », et avoir la capacité de contracter avec AMG Décoration d’Intérieur. Toute signature du devis vaut acceptation des présentes conditions.

## Article 1 – Contenu et champ d’application

Les présentes CGS s’appliquent sans restriction ni réserve à toutes les prestations de services conclues avec AMG Décoration d’Intérieur par devis signé ; les différentes prestations de décoration d’intérieur sont présentées sur le site internet amgdecorationdinterieur.com.

Nous proposons des services de décoration d’intérieur personnalisés, comprenant notamment la conception de planches d’ambiance et de mobilier, de plans d’aménagement et de visuels 3D, ainsi que le choix des matériaux, des couleurs et du mobilier. Les formules de décoration et le meuble sur mesure sont proposés à prix fixe, affiché sur la page [Prestations](/prestations/) du site ; le Client peut y ajouter des options à la carte, elles aussi à prix fixe. Les prestations sans prix affiché, comme l’offre destinée aux professionnels, font l’objet d’un devis personnalisé, établi en fonction des besoins spécifiques du Client.

Avant toute prestation, un devis détaillé est établi et remis au Client. Il précise la nature des prestations, les délais, les modalités de paiement ainsi que toute autre condition particulière.

Le Client déclare avoir pris connaissance des présentes CGS et les avoir acceptées avant de signer le devis. Le choix et l’achat d’un service relèvent de la seule responsabilité du Client. Toute signature du devis avec la mention « bon pour accord » vaut acceptation des CGS.

Le site internet amgdecorationdinterieur.com est géré par Amandine Gaury EI, ci-après dénommée AMG Décoration d’Intérieur, micro-entrepreneur immatriculée au Registre national des entreprises (RNE) sous le numéro SIREN 531 938 868 (SIRET {siret}).

- **Siège social** : {legalAddress}
- **Liste des services** : [https://amgdecorationdinterieur.com](https://amgdecorationdinterieur.com)
- **Email** : [{email}](mailto:{email})
- **Téléphone** : [{phone}](tel:{phoneE164})

## Article 2 – Commande

Il appartient au Client de contacter le Prestataire pour lui présenter son projet et les services qu’il souhaite commander.

Après une première prise de contact, au cours de laquelle le Client explique son projet, il reçoit par email une proposition de devis du Prestataire.

La commande n’est considérée comme définitive qu’après :

- l’acceptation sans réserve des présentes CGS ;
- la réception du devis signé par le Client avec la mention « bon pour accord » ;
- le paiement intégral de la prestation selon les modalités prévues.

Les devis établis par le Prestataire ont une durée de validité d’un mois.

Il appartient au Client de vérifier l’exactitude de sa commande et de signaler immédiatement toute erreur.

## Article 3 – Tarif

Chaque commande fait l’objet d’un devis qui récapitule la formule ou la prestation choisie, les options éventuelles et le prix total.

Les devis établis par le Prestataire sont valables un mois à compter de leur date d’émission.

Les prix sont exprimés en euros (€) ; ce sont des prix nets : TVA non applicable, article 293 B du Code général des impôts.

Les tarifs sont fermes et non révisables pendant leur période de validité.

## Article 4 – Droit de rétractation

### Clients concernés

Le droit de rétractation est ouvert au Client qui agit en qualité de consommateur, c’est-à-dire à des fins qui n’entrent pas dans le cadre de son activité professionnelle. Il ne s’applique pas au Client qui commande pour les besoins de son activité professionnelle, sauf dans les cas où la loi le lui accorde (article L221-3 du Code de la consommation).

### Délai

Conformément aux articles L221-18 et L221-19 du Code de la consommation, le Client dispose d’un délai de 14 jours pour se rétracter, sans avoir à motiver sa décision. Ce délai court à compter du jour de la conclusion du contrat, qui n’est pas compté. S’il expire un samedi, un dimanche ou un jour férié ou chômé, il est prolongé jusqu’au premier jour ouvrable suivant.

### Comment se rétracter

Le Client informe le Prestataire de sa décision avant l’expiration du délai, par email à l’adresse [{email}](mailto:{email}), au moyen :

- soit du [formulaire de rétractation](#annexe--formulaire-de-rétractation) reproduit en annexe ;
- soit de toute autre déclaration, dénuée d’ambiguïté, exprimant sa volonté de se rétracter.

### Démarrage de la prestation

Le Prestataire ne commence la prestation qu’à l’expiration du délai de rétractation de 14 jours. Aucun service n’est donc fourni pendant ce délai, et le Client qui se rétracte ne doit aucune somme au Prestataire.

### Remboursement

En cas de rétractation, le Prestataire rembourse l’intégralité des sommes versées par le Client, sans retard injustifié et au plus tard dans les 14 jours suivant le jour où il est informé de la décision de rétractation (article L221-24 du Code de la consommation).

Le remboursement est effectué par le même moyen de paiement que celui utilisé pour le paiement initial, sauf accord exprès du Client pour un autre moyen n’occasionnant pas de frais pour lui.

## Article 5 – Tarifs et modalités de paiement

Le prix des formules, du meuble sur mesure et des options est celui affiché sur le site au jour du devis. Le prix des prestations sans prix affiché est fixé dans le devis, en fonction de la complexité du projet et des prestations demandées. Le prix total à payer figure sur le devis.

Le paiement est exigible en totalité à la signature du devis et avant le démarrage de la prestation. Aucune prestation ne débute avant réception du paiement intégral.

Le paiement peut être effectué :

- par carte bancaire (paiement sécurisé via PayPal) ;
- par virement sur le compte bancaire du Prestataire.

Les paiements effectués par le Client ne sont considérés comme définitifs qu’après encaissement des sommes dues par le Prestataire.

Tout défaut de paiement entraîne la suspension ou l’annulation de la prestation.

### Clients professionnels

Lorsque le Client agit pour les besoins de son activité professionnelle, tout retard de paiement entraîne de plein droit, conformément à l’article L441-10 du Code de commerce, à compter du jour suivant la date de règlement figurant sur la facture :

- des pénalités de retard, exigibles sans qu’un rappel soit nécessaire, calculées au taux d’intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage ;
- une indemnité forfaitaire pour frais de recouvrement de 40 euros (article D441-5 du Code de commerce). Si les frais de recouvrement exposés sont supérieurs à ce montant, le Prestataire peut demander une indemnisation complémentaire, sur justification.

## Article 6 – Délais de réalisation

Les délais de réalisation sont indiqués sur le devis. Ils courent à compter :

- de la date de planning indiquée sur le devis ;
- et de la réception de l’ensemble des éléments nécessaires (photos, plans, informations).

Tout retard dans la transmission des éléments par le Client peut entraîner un décalage des délais.

## Article 7 – Engagement du Prestataire

Le Prestataire s’engage à mener à bien les services détaillés sur le devis à compter de la réception du dossier complet (photos, plans, détails du projet) et du paiement de la prestation.

Le Prestataire s’engage à fournir ses services avec professionnalisme et compétence.

Enfin, le Prestataire s’engage à respecter la confidentialité des informations fournies par le Client dans le cadre de ses prestations, notamment ses données personnelles et ses projets de décoration.

Le Prestataire peut toutefois partager sur son site internet et ses réseaux sociaux, de façon anonyme, les projets réalisés ainsi que les photos transmises par le Client.

## Article 8 – Obligations du Client

Pour permettre au Prestataire de réaliser sa mission dans de bonnes conditions, le Client s’engage à lui transmettre dans les meilleurs délais tous les documents nécessaires, à savoir :

- les photos de la pièce à aménager ;
- le plan avec les cotes ;
- les contraintes techniques ;
- les photos des meubles qu’il souhaite conserver.

## Article 9 – Propriété intellectuelle

Tous les livrables et visuels 3D remis au Client dans le cadre des prestations demeurent la propriété intellectuelle exclusive d’Amandine Gaury. Les visuels sont destinés à un usage personnel. Toute reproduction ou utilisation commerciale est interdite sans accord écrit.

## Article 10 – Responsabilité

La responsabilité du Prestataire ne peut être mise en cause qu’en cas de manquement à sa mission. Le Client ne peut pas l’invoquer :

- s’il a omis de remettre au Prestataire un document ou une information nécessaire à la mission ;
- en cas de retard imputable au Client ;
- en cas de force majeure ou d’autres causes indépendantes de la volonté du Prestataire.

## Article 11 – Droit applicable et litiges

Les présentes CGS sont soumises au droit français. En cas de litige, les parties s’efforceront de trouver une solution à l’amiable. À défaut, les tribunaux français seront seuls compétents.

## Article 12 – Assurance responsabilité civile professionnelle

Le Prestataire déclare être couvert par une assurance responsabilité civile professionnelle, conformément à l’article 1240 du Code civil.

Cette assurance couvre les dommages causés à des tiers dans le cadre de l’exercice de son activité de décoratrice d’intérieur, conformément aux termes et conditions du contrat d’assurance.

Pour toute information supplémentaire concernant cette assurance, veuillez nous contacter via la [page Contact](/contact/).

## Annexe – Formulaire de rétractation

Ce formulaire reprend le modèle figurant en annexe à l’article R221-1 du Code de la consommation. Le Client qui souhaite se rétracter (article 4) peut le copier dans un email, le compléter et l’envoyer à [{email}](mailto:{email}).

### Modèle de formulaire de rétractation

_(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)_

À l’attention d’AMG Décoration d’Intérieur, Amandine Gaury EI, {legalAddress}, [{email}](mailto:{email}) :

Je/nous (\*) vous notifie/notifions (\*) par la présente ma/notre (\*) rétractation du contrat portant sur la vente du bien (\*)/pour la prestation de services (\*) ci-dessous :

- Commandé le (\*)/reçu le (\*) :
- Nom du (des) consommateur(s) :
- Adresse du (des) consommateur(s) :
- Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :
- Date :

(\*) Rayez la mention inutile.
