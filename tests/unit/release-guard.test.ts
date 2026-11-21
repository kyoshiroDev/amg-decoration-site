import { describe, expect, it } from 'vitest';
import {
  findContentTodos,
  formatReleaseBlockers,
  isProductionBuild,
  RELEASE_BLOCKING_FILES,
} from '@/lib/release-guard';
import { readReleaseBlockers } from '@/lib/release-guard-files';

describe('findContentTodos', () => {
  it('renvoie chaque ligne marquée avec son numéro, sans le marqueur de commentaire', () => {
    const text = [
      '---',
      '# Note ordinaire',
      '# TODO(contenu): adresse du siège',
      'seo:',
      '  // TODO(contenu): médiateur',
      '---',
    ].join('\n');
    expect(findContentTodos(text)).toEqual([
      { line: 3, text: 'TODO(contenu): adresse du siège' },
      { line: 5, text: 'TODO(contenu): médiateur' },
    ]);
  });

  it('gère les fins de ligne Windows', () => {
    expect(findContentTodos('a\r\n# TODO(contenu): x')).toEqual([
      { line: 2, text: 'TODO(contenu): x' },
    ]);
  });

  it('ignore les autres TODO et un texte complet', () => {
    expect(findContentTodos('# TODO: technique\n# Rappel : contenu')).toEqual([]);
    expect(findContentTodos('')).toEqual([]);
  });
});

describe('isProductionBuild', () => {
  it('ne s’active que pour le build de production Vercel', () => {
    expect(isProductionBuild({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isProductionBuild({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProductionBuild({ VERCEL_ENV: 'development' })).toBe(false);
    expect(isProductionBuild({ CI: 'true' })).toBe(false);
    expect(isProductionBuild({})).toBe(false);
  });
});

describe('formatReleaseBlockers', () => {
  it('liste chaque TODO en fichier:ligne', () => {
    const message = formatReleaseBlockers([
      { file: 'src/content/pages/mentions-legales.md', line: 8, text: 'TODO(contenu): adresse' },
      { file: 'src/content/pages/confidentialite.md', line: 9, text: 'TODO(contenu): durée' },
    ]);
    expect(message).toContain('2 TODO(contenu)');
    expect(message).toContain('src/content/pages/mentions-legales.md:8  TODO(contenu): adresse');
    expect(message).toContain('src/content/pages/confidentialite.md:9  TODO(contenu): durée');
  });
});

describe('readReleaseBlockers', () => {
  it('lit les trois pages légales et rattache chaque TODO à son fichier', () => {
    const blockers = readReleaseBlockers();
    expect(RELEASE_BLOCKING_FILES).toHaveLength(3);
    for (const blocker of blockers) {
      expect(RELEASE_BLOCKING_FILES).toContain(blocker.file);
      expect(blocker.text).toMatch(/^TODO\(contenu\)/);
    }
  });
});
