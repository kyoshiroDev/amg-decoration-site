/**
 * Garde-fou : aucun commentaire HTML ni TODO dans le CORPS des contenus Markdown.
 * Le moteur Markdown d'Astro recopie les commentaires HTML dans la page générée :
 * les questions internes (`TODO(contenu)`) doivent rester en commentaires YAML de l'en-tête.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTENT_DIR = join(process.cwd(), 'src/content');

function listMarkdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

/** Corps du fichier, sans l'en-tête YAML. */
function body(source: string): string {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(source);
  return match ? source.slice(match[0].length) : source;
}

const files = listMarkdown(CONTENT_DIR);

describe('corps des contenus Markdown', () => {
  it('trouve des fichiers à vérifier', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file.replace(`${CONTENT_DIR}/`, ''), file]))(
    '%s ne contient ni commentaire HTML ni TODO (hors brouillon)',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const text = body(source);
      expect(text).not.toContain('<!--');
      // Un brouillon (`draft: true`) n'est jamais publié (filterPublished) : il peut porter des TODO.
      const isDraft = /^draft:\s*true\s*$/m.test(source.slice(0, source.length - text.length));
      if (!isDraft) {
        expect(text).not.toMatch(/TODO/);
      }
    },
  );
});
