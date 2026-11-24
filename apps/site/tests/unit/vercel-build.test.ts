import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Monorepo (ADR-0019) : Vercel lit vercel.json à la racine du dépôt et construit le site du
// workspace `@amg/site`. Une faute ici casserait la production sans que la CI le voie.
const vercel = JSON.parse(
  readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8'),
) as {
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
};

describe('vercel.json : build du site dans le monorepo', () => {
  it('construit le workspace @amg/site', () => {
    expect(vercel.buildCommand).toBe('npm run build --workspace=@amg/site');
  });

  it('publie apps/site/dist', () => {
    expect(vercel.outputDirectory).toBe('apps/site/dist');
  });

  it('garde l’installation par défaut (npm ci effacerait le cache d’images Astro)', () => {
    expect(vercel.installCommand).toBeUndefined();
  });

  it('garde le préréglage Astro', () => {
    expect(vercel.framework).toBe('astro');
  });
});
