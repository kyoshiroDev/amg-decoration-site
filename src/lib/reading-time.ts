/**
 * Temps de lecture d'un corps Markdown / MDX (fonctions PURES, testées dans
 * tests/unit/reading-time.test.ts). Le texte compté exclut la syntaxe : blocs de code, imports
 * et exports MDX, balises JSX/HTML, adresses des liens et des images.
 */

/** Vitesse de lecture d'un texte courant en français, à l'écran (mots par minute). */
export const WORDS_PER_MINUTE = 220;

/** Texte lisible d'un corps Markdown / MDX, sans la syntaxe. */
export function stripMarkdown(source: string): string {
  return (
    source
      // Blocs de code clôturés et imports / exports MDX (une ligne).
      .replace(/^```[\s\S]*?^```/gm, ' ')
      .replace(/^(?:import|export)\s.*$/gm, ' ')
      // Images : on ne lit pas leur texte alternatif.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // Liens : on garde le libellé, pas l'adresse.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Balises JSX / HTML et commentaires.
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
      // Marques de mise en forme restantes.
      .replace(/[#>*_`~|]/g, ' ')
  );
}

/** Nombre de mots (suite de lettres ou de chiffres, apostrophes et tirets compris). */
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Minutes de lecture arrondies à l'entier supérieur, 1 au minimum. */
export function readingTime(source: string, wordsPerMinute = WORDS_PER_MINUTE): number {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
    throw new RangeError('La vitesse de lecture doit être un nombre strictement positif.');
  }
  const words = countWords(stripMarkdown(source));
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
