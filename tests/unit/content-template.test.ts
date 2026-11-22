import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { site } from '@/config/site';
import {
  contentTemplatePlugin,
  fillTokens,
  renderContentTemplate,
  selectFormBlocks,
  siteTemplateVariables,
  type ContentTemplateContext,
} from '@/lib/content-template';
import { LEGAL_PAGE_IDS } from '@/lib/pages/legal-model';

const variables = siteTemplateVariables(site);

describe('siteTemplateVariables', () => {
  it('reprend les coordonnées de site.ts', () => {
    expect(variables).toEqual({
      email: site.email,
      phone: site.phone.display,
      phoneE164: site.phone.e164,
      siret: site.registration.siret,
      legalAddress: site.registration.legalAddress,
    });
  });
});

describe('fillTokens', () => {
  it('remplace les jetons dans le texte et dans les URL', () => {
    expect(fillTokens('Écrivez à [{email}](mailto:{email}), {phoneE164}.', variables)).toBe(
      `Écrivez à [${site.email}](mailto:${site.email}), ${site.phone.e164}.`,
    );
  });

  it('laisse intact un texte sans jeton et les marqueurs de bloc', () => {
    const text = 'Rien à remplacer.\n{formulaire:service}\n{/formulaire}';
    expect(fillTokens(text, variables)).toBe(text);
  });

  it('refuse un jeton inconnu en indiquant la ligne', () => {
    expect(() => fillTokens('a\nb {emial}', variables)).toThrow(
      /« \{emial\} » \(ligne 2 du corps\)/,
    );
  });

  it('ne lit pas les propriétés héritées (`{constructor}`)', () => {
    expect(() => fillTokens('{constructor}', variables)).toThrow(/Jeton inconnu/);
  });
});

describe('selectFormBlocks', () => {
  const text = [
    'Commun.',
    '',
    '{formulaire:service}',
    'Service.',
    '{/formulaire}',
    '',
    '{formulaire:mailto}',
    'Messagerie.',
    '{/formulaire}',
  ].join('\n');

  it('garde le bloc du mode courant et retire les marqueurs', () => {
    expect(selectFormBlocks(text, 'service')).toBe('Commun.\n\nService.\n');
    expect(selectFormBlocks(text, 'mailto')).toBe('Commun.\n\n\nMessagerie.');
  });

  it('signale un bloc non fermé, imbriqué, orphelin ou un mode inconnu', () => {
    expect(() => selectFormBlocks('{formulaire:service}\nx', 'service')).toThrow(/non fermé/);
    expect(() =>
      selectFormBlocks('{formulaire:service}\n{formulaire:mailto}\n{/formulaire}', 'service'),
    ).toThrow(/imbriqué \(ligne 2 du corps\)/);
    expect(() => selectFormBlocks('{/formulaire}', 'mailto')).toThrow(/sans bloc ouvert/);
    expect(() => selectFormBlocks('{formulaire:courrier}\n{/formulaire}', 'mailto')).toThrow(
      /inconnu « courrier »/,
    );
  });
});

async function render(markdown: string, context: ContentTemplateContext): Promise<string> {
  const result = await markdownToHtml(markdown, { mdastPlugins: [contentTemplatePlugin(context)] });
  return result.html;
}

describe('contentTemplatePlugin (Sätteri)', () => {
  const source = '[{email}](mailto:{email})\n\n{formulaire:service}\nService.\n{/formulaire}\n';

  it('rend les liens avec les vraies coordonnées et le seul bloc du mode', async () => {
    const mailto = await render(source, { variables, formMode: 'mailto' });
    expect(mailto).toContain(`<a href="mailto:${site.email}">${site.email}</a>`);
    expect(mailto).not.toContain('Service.');
    expect(await render(source, { variables, formMode: 'service' })).toContain('<p>Service.</p>');
  });

  it('expose son contexte, sérialisé dans l’empreinte de configuration d’Astro', () => {
    const context: ContentTemplateContext = { variables, formMode: 'mailto' };
    expect(JSON.parse(JSON.stringify(contentTemplatePlugin(context)))).toMatchObject({ context });
  });
});

describe('marqueur {à-préciser}', () => {
  const body = 'Avant.\n{formulaire:service}\n{à-préciser} Prestataire.\n{/formulaire}\nAprès.';
  it('retiré avec son bloc dans l’autre mode', () => {
    expect(renderContentTemplate(body, { variables, formMode: 'mailto' })).toBe('Avant.\nAprès.');
  });
  it('toléré hors Vercel (build de test du mode service)', () => {
    expect(
      renderContentTemplate(body, { variables, formMode: 'service', rejectPending: false }),
    ).toContain('{à-préciser} Prestataire.');
  });
  it('publié, il fait échouer le rendu', () => {
    expect(() => renderContentTemplate(body, { variables, formMode: 'service' })).toThrow(
      /à préciser.*service/,
    );
  });
});

describe('pages légales', () => {
  const read = (id: string): string =>
    readFileSync(join(process.cwd(), `src/content/pages/${id}.md`), 'utf8').replace(
      /^---\n[\s\S]*?\n---\n/,
      '',
    );

  it.each(LEGAL_PAGE_IDS)('%s se rend en mode mailto, sans jeton restant', (id) => {
    const output = renderContentTemplate(read(id), { variables, formMode: 'mailto' });
    expect(output).not.toMatch(/\{[^}\s]*\}/);
  });

  it.each(LEGAL_PAGE_IDS.filter((id) => id !== 'confidentialite'))(
    '%s se rend en mode service, sans jeton restant',
    (id) => {
      const output = renderContentTemplate(read(id), { variables, formMode: 'service' });
      expect(output).not.toMatch(/\{[^}\s]*\}/);
    },
  );

  it('confidentialite bloque le mode service tant que le prestataire n’est pas nommé', () => {
    expect(() =>
      renderContentTemplate(read('confidentialite'), { variables, formMode: 'service' }),
    ).toThrow(/à préciser/);
  });
});
