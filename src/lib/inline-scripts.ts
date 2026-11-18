/**
 * Scripts inline de <head> (BaseLayout, ADR-0010). Chaînes exactes : leur empreinte SHA-256
 * devra figurer dans la CSP (Phase 7, `security.csp.scriptDirective.hashes`). Toute
 * modification change l'empreinte : tests/unit/inline-scripts.test.ts la vérifie.
 */

/**
 * Pose la classe `js` sur <html> avant le premier rendu : les styles qui dépendent du JS
 * (filtres, comparateur, bandeau animé) s'appliquent dès la première image, sans décalage.
 */
export const JS_CLASS_SCRIPT = "document.documentElement.classList.add('js')";
