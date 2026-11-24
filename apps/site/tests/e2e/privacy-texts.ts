/**
 * Phrases de la politique de confidentialité propres au mode du formulaire (blocs
 * `{formulaire:service}` / `{formulaire:mailto}` de src/content/pages/confidentialite.md,
 * ADR-0016). Partagées par tests/e2e (repli mailto:) et tests/e2e-service (mode service).
 */
export const PRIVACY_PATH = '/confidentialite/';

export const PRIVACY_TEXTS = {
  /** Le service enregistre l'IP (bloc service). */
  serviceIp:
    /Le service qui reçoit le formulaire enregistre aussi la date de l’envoi et votre adresse IP/,
  serviceRecipient: /S’y ajoute le service de formulaire en ligne/,
  /** Le message part de la messagerie du visiteur (bloc mailto). */
  mailtoSending: /Le formulaire n’envoie rien lui-même/,
  mailtoRecipient: /Le formulaire de contact ne passe par aucun service intermédiaire/,
} as const;
