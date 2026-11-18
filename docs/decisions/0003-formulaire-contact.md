# ADR-0003 — Formulaire de contact sur un site statique

- **Statut** : proposée (à valider par l'humain : le choix du service reste une décision d'Amandine)
- **Date** : 2026-11-17 · **Mise à jour** : 2026-11-18 (comparatif RGPD des services, spécification conformité)

## Contexte

Le site est 100 % statique : pas de serveur pour traiter un formulaire. Il faut recevoir les demandes par email, de façon fiable, conforme RGPD et sans cookie tiers.

Le formulaire actuel (WPForms) exige l'adresse postale complète et renvoie vers une politique de confidentialité inexistante : le nouveau formulaire doit corriger ces deux points (spécification complète : `docs/CONFORMITE.md` § Formulaire).

## Options envisagées

1. **Service de formulaire externe** (Formspark, Basin, Formspree, Web3Forms…) — `action` HTML simple, fonctionne sans JS, amélioré en JS (envoi `fetch` + message de succès).
2. **Vercel Function** unique (`/api/contact`) avec un fournisseur d'emails (Resend, ou un fournisseur établi dans l'UE) — plus de contrôle, mais sort du « 100 % statique », nécessite une clé d'API et une ADR dédiée.
3. Lien `mailto:` seul — zéro infrastructure, mais conversion plus faible.

## Comparatif RGPD des services externes (relevé du 18/11/2026)

| Service   | Éditeur (pays)                               | Hébergement des envois                                                                 | Contrat de sous-traitance (DPA)                                                                                                                     | Prix relevé                                                                     | Points d'attention                                                                                                                                                                                                            |
| --------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formspark | Trampoline Software SRL (Mazy, **Belgique**) | AWS **Irlande** (EEE)                                                                  | Intégré aux CGU, **s'applique à tous les clients, offre gratuite comprise, sans signature** ; transferts hors EEE encadrés (adéquation, CCT ou DPF) | Gratuit : 250 envois · 25 $ en **paiement unique** pour 50 000 envois           | Sous-traitants hors UE toujours actifs : Sentry (États-Unis, rapports d'erreurs), Mapbox (États-Unis, cartes de l'écran statistiques). Envois conservés jusqu'à suppression (30 j de corbeille), IP 12 mois. Honeypot inclus. |
| Basin     | non vérifié                                  | Plusieurs hébergeurs possibles : AWS (États-Unis), DigitalOcean (Canada), Hetzner (UE) | Intégré aux CGU                                                                                                                                     | Gratuit : 1 formulaire, 50 envois/mois · Starter 12,50 $/mois (paiement annuel) | 15 sous-traitants, dont OpenAI, New Relic, Twilio ; région par défaut non indiquée.                                                                                                                                           |
| Formspree | Formspree, Inc. (**États-Unis**)             | Infrastructure aux États-Unis                                                          | Ni DPA ni Data Privacy Framework mentionnés dans la politique de confidentialité (à vérifier auprès de l'éditeur)                                   | non relevé                                                                      | Transfert hors UE systématique.                                                                                                                                                                                               |
| Web3Forms | Web3Creative (Kerala, **Inde**)              | Hors UE, selon les infrastructures des sous-traitants                                  | DPA v1.0 du 13/07/2026, rédigé au regard de la loi indienne (DPDP Act 2023)                                                                         | non relevé (offre gratuite annoncée)                                            | L'Inde n'a pas de décision d'adéquation : transfert à encadrer par des clauses contractuelles types, non vérifiées dans le DPA.                                                                                               |

Sources :

- Formspark : [sous-traitants](https://www.formspark.io/legal/subprocessors/), [DPA](https://www.formspark.io/legal/dpa/), [tarifs](https://www.formspark.io/pricing/)
- Basin : [RGPD](https://usebasin.com/gdpr), [tarifs](https://usebasin.com/pricing)
- Formspree : [politique de confidentialité](https://formspree.io/legal/privacy-policy/)
- Web3Forms : [FAQ](https://docs.web3forms.com/getting-started/faq), [DPA](https://web3forms.com/dpa) (page non lisible par l'outil le 18/11/2026, contenu relevé via un moteur de recherche)

## Recommandation (agent `conformite`)

**Formspark**, pour quatre raisons : éditeur établi dans l'UE, envois hébergés dans l'EEE, DPA applicable d'office (même gratuit) et honeypot intégré. Le paiement unique évite un abonnement pour un volume de demandes modeste.

Conditions de mise en œuvre :

- n'activer **aucun captcha** (reCAPTCHA, Turnstile, hCaptcha : sous-traitants supplémentaires, souvent hors UE, et traceurs possibles) : honeypot seul, plus le filtrage de mots ;
- en envoi sans JS, rediriger vers une page de remerciement **du site** (pas la page hébergée par le service) ;
- supprimer régulièrement les envois de l'espace Formspark une fois traités, pour respecter les durées annoncées dans `/confidentialite/` ;
- vérifier le nom exact du champ honeypot dans la documentation Formspark au moment de l'intégration.

**La décision finale reste humaine** (coût, compte à créer par Amandine). Une fois le service choisi : compléter la section « Qui reçoit vos données » et « Transferts » de `src/content/pages/confidentialite.md` (TODO en en-tête).

## Décision provisoire

Option 1, avec honeypot anti-spam, `mailto:` et téléphone/WhatsApp en alternative visible. Endpoint du service dans une variable d'environnement `PUBLIC_FORM_ENDPOINT`. **En attendant la validation humaine**, le formulaire est développé contre un endpoint factice et testé avec un mock.

## Conséquences

- Mention du sous-traitant, de son pays et des garanties de transfert dans la politique de confidentialité (`conformite`).
- Champs limités à : nom, email, téléphone (facultatif), type de projet, message. Pas d'adresse postale, pas de case de consentement (base légale : mesures précontractuelles et intérêt légitime, voir `docs/CONFORMITE.md`).
- Rien à maintenir côté serveur.
