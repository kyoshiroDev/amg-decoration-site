/**
 * Variables d'environnement publiques lues au build (voir README § Variables d’environnement).
 */
interface ImportMetaEnv {
  /** Endpoint du service de formulaire (ADR-0003). Absent : repli `mailto:` vers site.email. */
  readonly PUBLIC_FORM_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
