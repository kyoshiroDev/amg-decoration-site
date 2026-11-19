/**
 * Scripts inline de <head> (BaseLayout, ADR-0010). Chaînes exactes : leur empreinte SHA-256
 * devra figurer dans la CSP (Phase 7, `security.csp.scriptDirective.hashes`). Toute
 * modification change l'empreinte : tests/unit/inline-scripts.test.ts la vérifie.
 */

/**
 * Pose la classe `js` sur <html> avant le premier rendu : les styles qui dépendent du JS
 * (filtres, comparateur, bandeau animé) s'appliquent dès la première image, sans décalage.
 * Filet de sécurité : si un script ne se charge pas (`error` sur un <script>) ou lève une
 * exception (`error` sur window), la classe est retirée et le site revient à sa version
 * sans JS, complète et honnête (pas de filtres ni de comparateur inertes).
 * Les erreurs d'images ne sont pas concernées (cible <img>).
 */
export const JS_CLASS_SCRIPT =
  "var d=document.documentElement;d.classList.add('js');addEventListener('error',function(e){var t=e.target;if(t==window||t.tagName=='SCRIPT')d.classList.remove('js')},true)";
