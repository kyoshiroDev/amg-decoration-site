import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCustomProperties } from '@/lib/design-tokens';

// ADR-0013 : la cascade des listes révélées est écrite en pourcentages dans les @keyframes
// reveal-cascade-* (motion.css), qui ne peuvent pas lire les tokens. Ce test les recalcule à
// partir de --dur-base et --stagger : changer un token sans les @keyframes le fait échouer.

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const motion = readFileSync('src/styles/motion.css', 'utf8');
const RANKS = 6;

function msToken(name: string): number {
  const token = parseCustomProperties(tokens, name).find((property) => property.name === name);
  const match = /^(\d+(?:\.\d+)?)ms$/.exec(token?.value ?? '');
  if (!match?.[1]) throw new Error(`${name} doit être une durée en ms`);
  return Number(match[1]);
}

/** Sélecteurs d'images clés (pourcentages) d'un bloc @keyframes, dans l'ordre. */
function keyframeOffsets(name: string): number[][] {
  const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(motion)?.[1];
  if (!block) throw new Error(`@keyframes ${name} introuvable`);
  return Array.from(block.matchAll(/((?:[\d.]+%,?\s*)+)\{/g), ([, selector = '']) =>
    selector
      .split(',')
      .map((part) => Number.parseFloat(part))
      .filter((value) => !Number.isNaN(value)),
  );
}

const round = (value: number): number => Math.round(value * 100) / 100;

describe('cascade des listes révélées (motion.css)', () => {
  const base = msToken('--dur-base');
  const stagger = msToken('--stagger');
  const total = base + (RANKS - 1) * stagger;

  it('la durée partagée reste sous 900 ms (design system §5)', () => {
    expect(total).toBeLessThanOrEqual(900);
    expect(tokens).toContain(
      `--reveal-cascade-duration: calc(var(--dur-base) + ${RANKS - 1} * var(--stagger));`,
    );
  });

  for (let rank = 0; rank < RANKS; rank += 1) {
    it(`rang ${rank} : immobile jusqu’à ${rank} × stagger, puis --dur-base de mouvement`, () => {
      const [start, end] = keyframeOffsets(`reveal-cascade-${rank}`);
      const departure = round(((rank * stagger) / total) * 100);
      const arrival = round(((rank * stagger + base) / total) * 100);
      expect(start).toEqual(rank === 0 ? [0] : [0, departure]);
      expect(end).toEqual(arrival === 100 ? [100] : [arrival, 100]);
    });
  }

  it('chaque rang de 2 à 5 est attribué par :nth-child, le 6e sert de défaut', () => {
    for (let rank = 0; rank < RANKS - 1; rank += 1) {
      expect(motion).toMatch(
        new RegExp(`:nth-child\\(${rank + 1}\\) \\{\\s*animation-name: reveal-cascade-${rank};`),
      );
    }
    expect(motion).toContain(
      `animation: reveal-cascade-${RANKS - 1} var(--reveal-cascade-duration) linear;`,
    );
  });
});
