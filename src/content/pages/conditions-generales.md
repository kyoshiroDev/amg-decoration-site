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
# Coordonnées : jetons `{email}`, `{phone}`, `{phoneE164}`, `{siret}` remplacés au rendu par les valeurs de src/config/site.ts (ADR-0016).
#
# TODO(contenu): prix fixes affichés sur /prestations/ (189, 339, 489, 689 €, meuble 339 €) alors que les art. 1, 3 et 5 parlent de « devis personnalisé » et de tarifs « définis dans le devis » : prix catalogue, prix « à partir de » ou devis systématique ? Une fois le choix fait, aligner la page Prestations et les art. 1, 3 et 5 (information sur le prix claire et cohérente, L111-1 et L112-1).
# TODO(contenu): art. 4 reformulé et formulaire type ajouté le 2026-11-21 : à valider par Amandine, idéalement avec un juriste, avant la mise en production (nouvelle clause contractuelle, rédigée sans elle). Bloquant parce que la clause renvoie à des pratiques qu’elle seule peut mettre en place : (1) son modèle de devis doit porter une mention distincte, non pré-cochée, par laquelle le client demande le démarrage avant la fin des 14 jours et reconnaît perdre son droit de rétractation une fois la prestation pleinement exécutée (L221-25 ; sans elle, rien n’est dû en cas de rétractation) ; (2) le formulaire de rétractation doit accompagner le devis ou la confirmation de commande envoyée par email (L221-13) ; (3) l’adresse postale devra être ajoutée dans le destinataire du formulaire quand elle sera connue (voir TODO adresse). À confirmer par le juriste : la « fonctionnalité de rétractation » en ligne (L221-21, en vigueur depuis le 19/06/2026) ne vise que les contrats conclus au moyen d’une interface en ligne, a priori pas un devis signé par email ; cas d’un devis signé chez le client (contrat hors établissement, L221-3 pour les petits professionnels).
# TODO(contenu): médiateur de la consommation absent (obligatoire pour les clients particuliers, L612-1 et L616-1) : Amandine doit adhérer réellement à un médiateur (aucun nom ne peut être affiché sans adhésion), puis fournir son nom, son site et son adresse, à ajouter à l’art. 11 et aux mentions légales.
# Décision (2026-11-21) : clients professionnels — clause légale ajoutée à l’art. 5 (pénalités de retard au taux de la BCE majoré de 10 points, exigibles sans rappel ; indemnité forfaitaire de 40 € pour frais de recouvrement), réservée aux clients professionnels (Code de commerce L441-10 II et D441-5, Légifrance, versions en vigueur au 21/11/2026). C’est le régime légal applicable à défaut d’accord : aucun engagement commercial nouveau. Rappel (non bloquant) : ces mentions doivent aussi figurer sur les factures adressées aux professionnels.
# Décision (2026-11-21) : art. 6 — l’information précontractuelle sur le délai (L111-1 3°) est satisfaite dès lors que chaque devis indique un délai d’exécution : « délais indiqués sur le devis » est conforme, aucun délai par formule n’est à publier sur le site. Rappel (non bloquant) : chaque devis doit indiquer un délai.
# TODO(contenu): art. 7 publication des projets et des photos transmises par le client : prévoir un accord explicite du client (photos de son logement), en particulier pour les avis et les fiches réalisations.
# Décision (2026-11-21) : art. 12 — l’assurance RC Pro n’est pas obligatoire pour une décoratrice d’intérieur (activité non réglementée) ; la clause est reprise telle quelle. Rappel (non bloquant) : nom de l’assureur et couverture géographique facultatifs, à ajouter si Amandine le souhaite ; la référence à l’article 1240 du Code civil (responsabilité délictuelle, qui ne fonde pas une obligation d’assurance) est à faire vérifier par un juriste ; une assurance décennale ne serait requise que si elle fait de la maîtrise d’œuvre ou du suivi de chantier (à lui demander).
# Décision (2026-11-22) : mention « EI » accolée au nom (entrepreneur individuel, imposée par le décret 2022-725), voir mentions-legales.md.
# TODO(contenu): adresse postale complète à l’art. 1 et dans le destinataire du formulaire de rétractation (adresse du siège, ou adresse d’une société de domiciliation : Amandine n’est pas obligée de publier son domicile si elle se fait domicilier).
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

Nous proposons des services de décoration d’intérieur personnalisés, comprenant notamment la conception de planches d’ambiance et de mobilier, de plans d’aménagement et de visuels 3D, ainsi que le choix des matériaux, des couleurs et du mobilier. Nos prestations sont réalisées sur devis personnalisé, établi en fonction des besoins spécifiques de chaque Client.

Avant toute prestation, un devis détaillé est établi et remis au Client. Il précise la nature des prestations, les délais, les modalités de paiement ainsi que toute autre condition particulière.

Le Client déclare avoir pris connaissance des présentes CGS et les avoir acceptées avant de signer le devis. Le choix et l’achat d’un service relèvent de la seule responsabilité du Client. Toute signature du devis avec la mention « bon pour accord » vaut acceptation des CGS.

Le site internet amgdecorationdinterieur.com est géré par Amandine Gaury EI, ci-après dénommée AMG Décoration d’Intérieur, micro-entrepreneur immatriculée au Registre national des entreprises (RNE) sous le numéro SIREN 531 938 868 (SIRET {siret}).

- **Siège social** : Gif-sur-Yvette (91)
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

Les commandes font l’objet d’un devis personnalisé.

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

### Démarrage de la prestation pendant le délai

La prestation étant payée en totalité avant son démarrage (articles 2 et 5), elle ne commence avant la fin du délai de rétractation que si le Client en fait la demande expresse. Cette demande est recueillie par une mention prévue à cet effet sur le devis, que le Client complète s’il le souhaite ; il y reconnaît également qu’il perdra son droit de rétractation une fois la prestation pleinement exécutée (article L221-25).

Si le Client se rétracte après avoir demandé ce démarrage anticipé, il doit un montant correspondant au service fourni jusqu’à la communication de sa décision de se rétracter, proportionné au prix total de la prestation convenu dans le devis.

Sans demande expresse du Client, aucune somme n’est due au Prestataire en cas de rétractation dans le délai.

### Fin du droit de rétractation

Conformément à l’article L221-28 1° du Code de la consommation, le droit de rétractation ne peut plus être exercé lorsque la prestation a été pleinement exécutée avant la fin du délai de rétractation, après la demande expresse du Client et sa reconnaissance de la perte de son droit de rétractation.

### Remboursement

En cas de rétractation, le Prestataire rembourse les sommes versées par le Client, déduction faite, le cas échéant, du montant dû pour le service déjà fourni, sans retard injustifié et au plus tard dans les 14 jours suivant le jour où il est informé de la décision de rétractation (article L221-24).

Le remboursement est effectué par le même moyen de paiement que celui utilisé pour le paiement initial, sauf accord exprès du Client pour un autre moyen n’occasionnant pas de frais pour lui.

## Article 5 – Tarifs et modalités de paiement

Nos tarifs sont définis dans le devis et peuvent varier en fonction de la complexité du projet et des prestations demandées.

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

À l’attention d’AMG Décoration d’Intérieur, Amandine Gaury EI, [{email}](mailto:{email}) :

Je/nous (\*) vous notifie/notifions (\*) par la présente ma/notre (\*) rétractation du contrat portant sur la vente du bien (\*)/pour la prestation de services (\*) ci-dessous :

- Commandé le (\*)/reçu le (\*) :
- Nom du (des) consommateur(s) :
- Adresse du (des) consommateur(s) :
- Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :
- Date :

(\*) Rayez la mention inutile.
