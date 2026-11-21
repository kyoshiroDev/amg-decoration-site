---
# Source : docs/contenu-source/politique-de-confidentialite.md (page « Mentions légales » du site actuel,
# servie à l’URL /politique-de-confidentialite/, redirigée en 301 vers /mentions-legales/).
# Obligations : LCEN (loi n° 2004-575), art. 1-1 depuis la loi SREN n° 2024-449. Synthèse : docs/CONFORMITE.md.
# Hébergeur : https://vercel.com/legal/privacy-policy et https://vercel.com/legal/terms (consultés le 18/11/2026).
# Coordonnées : jetons `{email}`, `{phone}`, `{phoneE164}`, `{siret}` remplacés au rendu par les valeurs de src/config/site.ts (ADR-0016).
#
# TODO(contenu): adresse postale complète du siège — le site actuel n’affiche que « Gif-sur-Yvette (91) », insuffisant pour l’éditrice (LCEN art. 1-1). Si Amandine ne veut pas publier son domicile, elle peut passer par une société de domiciliation et donner cette adresse (à reporter aussi dans les CGS, art. 1).
# Décision (2026-11-21) : il n’existe pas de numéro RNE distinct ; l’identifiant au Registre national des entreprises est le SIREN (9 premiers chiffres du SIRET), affiché en clair ci-dessous (531 938 868, à garder identique à `registration.siret` de src/config/site.ts).
# TODO(contenu): confirmer qu’Amandine n’est pas aussi inscrite au RCS (activité commerciale) ; sinon ajouter « RCS <ville du greffe> » ici et à l’art. 1 des CGS.
# TODO(contenu): depuis le 15/05/2022, la mention « EI » ou « entrepreneur individuel » doit accompagner le nom de l’entrepreneuse individuelle : formulation à valider par Amandine.
# Décision (2026-11-21, validée par l’humain) : Vercel ne publie aucun numéro de téléphone ; la page affiche son adresse postale et son email de contact.
# Décision (2026-11-21) : aucune photo Pexels de l’ancien site n’est reprise (seuls les rendus et photos d’Amandine le sont, src/assets/placeholders/README.md) ; rien à créditer.
# Décision (2026-11-21) : pas de ligne de crédit pour la conception du site.
# TODO(contenu): médiateur de la consommation (obligatoire, Code de la consommation L612-1) : nom, site et adresse à ajouter ici une fois qu’Amandine aura réellement adhéré à un médiateur.
seo:
  title: 'Mentions légales'
  description: 'Mentions légales du site AMG Décoration d’Intérieur : identité de l’éditrice Amandine Gaury, hébergeur, propriété intellectuelle, crédits photos et contact.'
hero:
  eyebrow: 'Informations légales'
  heading: 'Mentions légales'
  lead: 'Qui édite ce site, qui l’héberge et comment me joindre : les informations prévues par la loi pour la confiance dans l’économie numérique.'
---

## Éditrice du site

Le site amgdecorationdinterieur.com est édité par **Amandine Gaury**, AMG Décoration d’Intérieur, décoratrice d’intérieur.

- **Statut** : micro-entrepreneur
- **SIRET** : {siret}
- **Immatriculation** : Registre national des entreprises (RNE), SIREN 531 938 868
- **Code NAF** : 7410Z (activités spécialisées de design)
- **Activité** : conseils et services en décoration d’intérieur
- **Siège** : Gif-sur-Yvette (91), France
- **TVA** : TVA non applicable, article 293 B du Code général des impôts
- **Email** : [{email}](mailto:{email})
- **Téléphone** : [{phone}](tel:{phoneE164})

## Directrice de la publication

Madame Amandine Gaury.

## Hébergeur

Le site est hébergé par **Vercel Inc.**, 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis.

- **Site** : [vercel.com](https://vercel.com)
- **Contact** : [privacy@vercel.com](mailto:privacy@vercel.com)

## Propriété intellectuelle

Le contenu de ce site (textes, images, rendus 3D, plans, vidéos, logo) est protégé par les lois françaises et internationales sur le droit d’auteur et la propriété intellectuelle, et appartient à Amandine Gaury, sauf mention contraire. Toute reproduction ou utilisation sans autorisation préalable est strictement interdite.

## Données personnelles et cookies

Ce site ne dépose aucun cookie et n’utilise aucun outil de mesure d’audience ni de publicité. Les données transmises par le formulaire de contact servent uniquement à répondre à votre demande.

Pour tout savoir sur vos données et vos droits, consultez la [politique de confidentialité](/confidentialite/).

## Liens externes

Ce site contient des liens vers d’autres sites (Instagram, Facebook, Pinterest, Google, WhatsApp…). Je ne suis pas responsable de leur contenu ni de leur façon de traiter vos données. Leurs propres conditions et politiques de confidentialité s’appliquent dès que vous les consultez.

## Droit applicable

Ce site est soumis au droit français. En cas de litige, les tribunaux français seront seuls compétents.

## Contact

Pour toute question ou réclamation concernant ce site, écrivez-moi à [{email}](mailto:{email}) ou passez par la [page Contact](/contact/).

## Crédits

- **Photographies et rendus 3D des réalisations** : Amandine Gaury, sauf mention contraire.
- **Polices de caractères** : Fraunces et Manrope, sous licence SIL Open Font License, hébergées sur ce site.
