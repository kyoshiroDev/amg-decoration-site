# ADR-0003 — Formulaire de contact sur un site statique

- **Statut** : proposée (à valider par l'humain)
- **Date** : 2026-11-17

## Contexte

Le site est 100 % statique : pas de serveur pour traiter un formulaire. Il faut recevoir les demandes par email, de façon fiable, conforme RGPD et sans cookie tiers.

## Options envisagées

1. **Service de formulaire externe** (Web3Forms, Formspree, Basin…) — `action` HTML simple, fonctionne sans JS, amélioré en JS (envoi `fetch` + message de succès). Vérifier le pays d'hébergement et la politique de données au moment du choix.
2. **Vercel Function** unique (`/api/contact`) avec un fournisseur d'emails (Resend…) — plus de contrôle, mais sort du « 100 % statique » et nécessite une clé d'API.
3. Lien `mailto:` seul — zéro infrastructure, mais conversion plus faible.

## Décision provisoire

Option 1, avec honeypot anti-spam, `mailto:` et téléphone/WhatsApp en alternative visible. Clé publique du service dans une variable d'environnement `PUBLIC_FORM_ENDPOINT`. **En attendant la validation humaine**, le formulaire est développé contre un endpoint factice et testé avec un mock.

## Conséquences

- Mention du sous-traitant dans la politique de confidentialité (`conformite`).
- Rien à maintenir côté serveur.
