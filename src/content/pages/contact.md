---
# Source : docs/contenu-source/contact.md. Coordonnées et horaires : src/config/site.ts (jamais ici).
# Mot-clé : contact décoratrice d'intérieur devis.
seo:
  title: 'Contact et devis décoratrice d’intérieur'
  description: 'Un projet de décoration ? Contactez votre décoratrice d’intérieur pour un devis personnalisé : parlez-moi de votre pièce, je vous réponds avec plaisir.'
hero:
  eyebrow: 'Contact et devis'
  heading: 'Demandez un devis à votre décoratrice d’intérieur'
  headingEmphasis: 'votre décoratrice d’intérieur'
  lead: 'Vous avez un projet ou une question ? Écrivez-moi en quelques mots : je prends le temps de comprendre votre besoin, puis je vous propose un devis personnalisé.'
sections:
  formulaire:
    heading: 'Décrivez-moi votre projet'
    headingEmphasis: 'votre projet'
    lead: 'Quelques lignes suffisent pour commencer. Plus vous me donnez de détails (lieu, surface, besoins, budget), plus ma réponse sera précise. Si vous avez déjà des photos de la pièce ou un plan, dites-le-moi : ils me serviront à établir votre devis.'
  coordonnees:
    heading: 'Me joindre directement'
    headingEmphasis: 'directement'
    lead: 'Vous préférez un échange de vive voix ? Appelez-moi ou écrivez-moi directement. Pour une collaboration, une mission en freelance ou de la sous-traitance, je reste également à votre écoute.'
# Formulaire : textes EXACTS de docs/CONFORMITE.md §5. Types, `autocomplete` et champs obligatoires
# sont fixés par le composant ContactForm. `{email}` est remplacé par l’adresse de src/config/site.ts.
# Pas d’adresse postale (minimisation RGPD), pas de case de consentement.
form:
  fields:
    name:
      label: 'Votre nom'
      hint: 'Obligatoire. Votre prénom, votre nom ou les deux, comme vous préférez.'
    email:
      label: 'Votre email'
      hint: 'Obligatoire. Je l’utilise uniquement pour vous répondre.'
    phone:
      label: 'Votre téléphone'
      hint: 'Si vous préférez que je vous rappelle.'
    project:
      label: 'Votre projet'
      hint: 'Choisissez la formule ou l’offre qui vous intéresse. Pas encore d’idée ? Gardez « Je ne sais pas encore ».'
      options:
        - 'Formule Essentiel'
        - 'Formule Confort'
        - 'Formule Signature'
        - 'Formule Studio'
        - 'Meuble sur mesure 3D'
        - 'Offre professionnels'
        - 'Autre demande (collaboration, sous-traitance…)'
        - 'Je ne sais pas encore'
      defaultOption: 'Je ne sais pas encore'
    message:
      label: 'Votre message'
      hint: 'Obligatoire. Lieu, surface, besoins, budget, photos ou plan disponibles : tout ce qui m’aide à comprendre votre projet.'
  optionalMark: '(facultatif)'
  honeypotLabel: 'Ne remplissez pas ce champ'
  submit:
    label: 'Envoyer ma demande'
    sending: 'Envoi en cours…'
  notice:
    text: 'Vos informations servent uniquement à répondre à votre demande et, si vous le souhaitez, à préparer votre devis. Elles sont transmises par un service de formulaire sécurisé et conservées au maximum 3 ans après notre dernier échange. Vous pouvez y accéder, les rectifier ou les faire supprimer en m’écrivant à {email}.'
    mailtoText: 'En cliquant sur « Envoyer ma demande », votre messagerie s’ouvre avec votre demande pré-remplie : il vous reste à l’envoyer. Vos informations servent uniquement à répondre à votre demande et, si vous le souhaitez, à préparer votre devis. Elles sont conservées au maximum 3 ans après notre dernier échange. Vous pouvez y accéder, les rectifier ou les faire supprimer en m’écrivant à {email}.'
    moreLabel: 'En savoir plus :'
    link:
      label: 'politique de confidentialité'
      href: '/confidentialite/'
  # Repli mailto: (aucun service configuré) : indice visible près du bouton, annoncé avant l’envoi.
  mailtoHint: 'Si rien ne s’ouvre, écrivez-moi directement à {email}.'
  errors:
    summary: 'Votre demande n’est pas encore partie : corrigez le ou les champs signalés ci-dessous, puis renvoyez-la.'
    nameRequired: 'Indiquez votre nom pour que je sache comment m’adresser à vous.'
    emailRequired: 'Indiquez votre adresse email pour que je puisse vous répondre.'
    emailInvalid: 'Cette adresse email semble incomplète. Exemple : prenom.nom@exemple.fr'
    phoneInvalid: 'Ce numéro semble incomplet. Exemple : 06 12 34 56 78'
    messageRequired: 'Dites-m’en un peu plus sur votre projet, même en quelques mots.'
  success:
    title: 'Merci, votre message est bien parti !'
    text: 'Je l’ai bien reçu et je vous réponds au plus vite, du lundi au vendredi. Pensez à jeter un œil à vos courriers indésirables.'
  failure: 'Votre message n’a pas pu être envoyé. Vérifiez votre connexion et réessayez, ou écrivez-moi directement à {email}.'
---
