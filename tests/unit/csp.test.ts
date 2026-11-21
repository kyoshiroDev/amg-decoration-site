import { describe, expect, it } from 'vitest';
import {
  cspDirectives,
  cspHash,
  formEndpointOrigin,
  INLINE_SCRIPT_HASHES,
  pruneCspHashes,
} from '@/lib/csp';
import { JS_CLASS_SCRIPT } from '@/lib/inline-scripts';

/** Directive par nom (`connect-src` → `connect-src 'self' …`). */
function directive(directives: readonly string[], name: string): string | undefined {
  return directives.find((entry) => entry.split(' ')[0] === name);
}

describe('cspHash', () => {
  it('calcule l’empreinte SHA-256 en base64 préfixée', () => {
    // Vecteur connu : SHA-256 de la chaîne vide.
    expect(cspHash('')).toBe('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });
});

describe('INLINE_SCRIPT_HASHES', () => {
  it('contient l’empreinte du script de classe `js` documentée dans ADR-0010', () => {
    expect(INLINE_SCRIPT_HASHES).toEqual([cspHash(JS_CLASS_SCRIPT)]);
    expect(INLINE_SCRIPT_HASHES).toContain('sha256-oO9dQz2/+Q17QWsmmtXJ9ZNoha86yQvUljQCBOLLu2E=');
  });
});

describe('formEndpointOrigin', () => {
  it('renvoie undefined sans service configuré', () => {
    expect(formEndpointOrigin(undefined)).toBeUndefined();
    expect(formEndpointOrigin('   ')).toBeUndefined();
  });

  it('réduit l’URL du service à son origine', () => {
    expect(formEndpointOrigin(' https://submit-form.com/abc123?x=1 ')).toBe(
      'https://submit-form.com',
    );
  });

  it('refuse une URL non https ou invalide', () => {
    expect(() => formEndpointOrigin('http://submit-form.com/abc')).toThrow(/https/);
    expect(() => formEndpointOrigin('pas une url')).toThrow(/https/);
  });
});

describe('cspDirectives', () => {
  it('politique stricte : tout depuis le site, aucun plugin, aucune base étrangère', () => {
    const directives = cspDirectives(undefined);
    expect(directive(directives, 'default-src')).toBe("default-src 'self'");
    expect(directive(directives, 'img-src')).toBe("img-src 'self' data:");
    expect(directive(directives, 'font-src')).toBe("font-src 'self'");
    expect(directive(directives, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(directives, 'object-src')).toBe("object-src 'none'");
    expect(directive(directives, 'frame-src')).toBe("frame-src 'none'");
    expect(directive(directives, 'worker-src')).toBe("worker-src 'none'");
  });

  it('jamais de script ni de style dans les directives (gérés par Astro), jamais unsafe-*', () => {
    for (const endpoint of [undefined, 'https://submit-form.com/abc']) {
      const directives = cspDirectives(endpoint);
      expect(directives.some((entry) => /^(script|style)-src/.test(entry))).toBe(false);
      expect(directives.join(';')).not.toMatch(/unsafe-/);
    }
  });

  it('sans service : formulaire vers mailto:, aucune connexion externe', () => {
    const directives = cspDirectives(undefined);
    expect(directive(directives, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(directives, 'form-action')).toBe("form-action 'self' mailto:");
  });

  it('avec service : son origine autorisée pour fetch et pour l’envoi HTML, sans mailto:', () => {
    const directives = cspDirectives('https://submit-form.com/abc123');
    expect(directive(directives, 'connect-src')).toBe("connect-src 'self' https://submit-form.com");
    expect(directive(directives, 'form-action')).toBe("form-action 'self' https://submit-form.com");
  });

  it('chaque directive n’apparaît qu’une fois', () => {
    const names = cspDirectives(undefined).map((entry) => entry.split(' ')[0]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('pruneCspHashes', () => {
  const style = 'p{color:red}';
  const script = 'var a=1';
  const unused = cspHash('ailleurs sur le site');
  const policy = (scripts: string, styles: string): string =>
    `default-src 'self';img-src 'self' data:; script-src 'self' ${scripts}; style-src 'self' ${styles}; style-src-attr 'unsafe-inline';`;
  const page = (content: string): string =>
    `<html><head><meta http-equiv="content-security-policy" content="${content}"><style>${style}</style><script>${script}</script>` +
    `<script type="module" src="/_astro/a.js"></script><script type="application/ld+json">{}</script></head><body></body></html>`;

  it('ne garde que les empreintes des éléments inline de la page, par type', () => {
    const html = page(
      policy(
        `'${cspHash(script)}' '${unused}' '${cspHash(style)}'`,
        `'${cspHash(style)}' '${unused}' '${cspHash(script)}'`,
      ),
    );
    expect(pruneCspHashes(html)).toBe(page(policy(`'${cspHash(script)}'`, `'${cspHash(style)}'`)));
  });

  it('laisse intactes les autres sources et directives', () => {
    const html = page(policy(`'${unused}'`, `'${unused}'`));
    const pruned = pruneCspHashes(html);
    expect(pruned).toContain(
      "default-src 'self';img-src 'self' data:; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline';",
    );
  });

  it('ignore les scripts externes et le JSON-LD', () => {
    const html = page(policy(`'${cspHash('')}' '${cspHash('{}')}'`, ''));
    expect(pruneCspHashes(html)).toContain("script-src 'self';");
  });

  it('décode puis réencode l’attribut (apostrophes en entités)', () => {
    const html = page(
      policy(`'${cspHash(script)}' '${unused}'`, `'${cspHash(style)}'`).replaceAll("'", '&#39;'),
    );
    expect(pruneCspHashes(html)).toContain(`script-src 'self' '${cspHash(script)}';`);
  });

  it('page sans balise meta CSP : inchangée', () => {
    const html = '<html><head><style>p{}</style></head></html>';
    expect(pruneCspHashes(html)).toBe(html);
  });
});
