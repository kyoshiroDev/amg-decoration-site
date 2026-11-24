import { describe, expect, it } from 'vitest';
import {
  describeReleaseGuard,
  findContentTodos,
  formatReleaseBlockers,
  isProductionBuild,
  isReleaseGuarded,
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

describe('isReleaseGuarded', () => {
  const SITE = 'https://amgdecorationdinterieur.com';
  const production = (url?: string) =>
    url === undefined
      ? { VERCEL_ENV: 'production' }
      : { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: url };

  it('bloque la production qui sert le vrai domaine (avec ou sans www, protocole, casse)', () => {
    expect(isReleaseGuarded(production('amgdecorationdinterieur.com'), SITE)).toBe(true);
    expect(isReleaseGuarded(production('www.amgdecorationdinterieur.com'), SITE)).toBe(true);
    expect(isReleaseGuarded(production('https://AMGdecorationdinterieur.com/'), SITE)).toBe(true);
  });

  it('laisse passer la production sur son adresse vercel.app', () => {
    expect(isReleaseGuarded(production('amg-decoration-site.vercel.app'), SITE)).toBe(false);
  });

  it('bloque par prudence si le domaine de production est inconnu', () => {
    expect(isReleaseGuarded(production(), SITE)).toBe(true);
    expect(isReleaseGuarded(production(''), SITE)).toBe(true);
  });

  it('ne s’applique jamais hors production', () => {
    const preview = {
      VERCEL_ENV: 'preview',
      VERCEL_PROJECT_PRODUCTION_URL: 'amgdecorationdinterieur.com',
    };
    expect(isReleaseGuarded(preview, SITE)).toBe(false);
    expect(isReleaseGuarded({}, SITE)).toBe(false);
  });
});

describe('describeReleaseGuard', () => {
  const SITE = 'https://amgdecorationdinterieur.com';
  it('indique l’état et le domaine lu', () => {
    expect(
      describeReleaseGuard(
        { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'amgdecorationdinterieur.com' },
        SITE,
      ),
    ).toBe('Garde-fou légal : actif (domaine de production amgdecorationdinterieur.com).');
    expect(
      describeReleaseGuard(
        {
          VERCEL_ENV: 'production',
          VERCEL_PROJECT_PRODUCTION_URL: 'amg-decoration-site.vercel.app',
        },
        SITE,
      ),
    ).toBe('Garde-fou légal : inactif (domaine de production amg-decoration-site.vercel.app).');
    expect(describeReleaseGuard({ VERCEL_ENV: 'production' }, SITE)).toBe(
      'Garde-fou légal : actif (domaine de production (absent)).',
    );
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
