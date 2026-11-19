import { describe, expect, it } from 'vitest';
import { ICON_SPRITE_URL, iconNames, iconPaths } from '@/components/ui/icons';
import { buildIconSprite, ICON_VIEWBOX, iconSpriteVersion } from '@/lib/icon-sprite';

describe('buildIconSprite', () => {
  const sprite = buildIconSprite(iconPaths);

  it('produit un document SVG autonome', () => {
    expect(sprite.startsWith('<svg xmlns="http://www.w3.org/2000/svg">')).toBe(true);
    expect(sprite.endsWith('</svg>')).toBe(true);
  });

  it('contient un symbole par icône, identifiant = nom, sans doublon', () => {
    const ids = Array.from(sprite.matchAll(/<symbol id="([^"]+)"/g), ([, id]) => id);
    expect(ids).toEqual([...iconNames]);
  });

  it('porte la grille et les attributs de trait sur chaque symbole', () => {
    const symbols = sprite.match(/<symbol [^>]*>/g) ?? [];
    expect(symbols).toHaveLength(iconNames.length);
    for (const symbol of symbols) {
      expect(symbol).toContain(`viewBox="${ICON_VIEWBOX}"`);
      expect(symbol).toContain('fill="none"');
      expect(symbol).toContain('stroke="currentColor"');
      expect(symbol).toContain('stroke-width="1.5"');
    }
  });

  it('reprend les tracés tels quels', () => {
    expect(sprite).toContain(`<symbol id="plus" `);
    expect(sprite).toContain(`>${iconPaths.plus}</symbol>`);
  });
});

describe('iconSpriteVersion', () => {
  it('dérive une version courte et stable du contenu', () => {
    const sprite = buildIconSprite(iconPaths);
    expect(iconSpriteVersion(sprite)).toMatch(/^[0-9a-f]{10}$/);
    expect(iconSpriteVersion(sprite)).toBe(iconSpriteVersion(buildIconSprite(iconPaths)));
  });

  it('change dès qu’un tracé change', () => {
    const sprite = buildIconSprite(iconPaths);
    const edited = buildIconSprite({ ...iconPaths, plus: '<path d="M12 4v16"/>' });
    expect(iconSpriteVersion(edited)).not.toBe(iconSpriteVersion(sprite));
  });

  it('entre dans l’URL du sprite', () => {
    expect(ICON_SPRITE_URL).toBe(`/icons.${iconSpriteVersion(buildIconSprite(iconPaths))}.svg`);
  });
});
