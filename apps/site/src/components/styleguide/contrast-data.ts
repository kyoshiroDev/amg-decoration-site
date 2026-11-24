/**
 * Données de contraste du styleguide, calculées au build depuis tokens.css
 * (partagées par ContrastTable et ContrastPairs).
 */
import tokensCss from '@amg/shared-tokens/tokens.css?raw';
import {
  contrastLevel,
  contrastRatio,
  formatRatio,
  parseColorTokens,
  requireColorToken,
  type ContrastLevel,
} from '@/lib/color-contrast';

const tokens = parseColorTokens(tokensCss);

export const verdicts: Readonly<Record<ContrastLevel, string>> = {
  AA: 'AA',
  'AA-large': 'Grand texte',
  fail: 'Décor',
};

export interface ContrastCell {
  readonly ratio: string;
  readonly level: ContrastLevel;
}

export function contrastCell(fg: string, bg: string): ContrastCell {
  const ratio = contrastRatio(requireColorToken(tokens, fg), requireColorToken(tokens, bg));
  return { ratio: formatRatio(ratio), level: contrastLevel(ratio) };
}
