import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  DatabaseConfigError,
  buildDatabaseUrl,
  loadCliDatabaseConnection,
  type DatabaseConnection,
} from '../../src/database-config.js';
import type { SecretFileReader } from '../../src/secret-file.js';

const PASSWORD = 'p'.repeat(40);
const BASE = {
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'amg',
  DB_USER: 'amg_migrator',
  DB_PASSWORD_FILE: '/run/secrets/pg_migrator_password',
} as const;

/** Disque factice : chemin → contenu ; tout autre chemin est illisible. */
function fakeFiles(files: Readonly<Record<string, string>>): SecretFileReader {
  return (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`ENOENT ${path}`);
    return content;
  };
}

const files = fakeFiles({ [BASE.DB_PASSWORD_FILE]: `${PASSWORD}\n` });

function connection(password: string): DatabaseConnection {
  return {
    host: 'postgres',
    port: 5432,
    database: 'amg',
    user: 'amg_migrator',
    password: { reveal: () => password },
  };
}

function errorsOf(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof DatabaseConfigError) return error.errors;
    throw error;
  }
  return [];
}

describe('buildDatabaseUrl', () => {
  it('construit une URL PostgreSQL complète', () => {
    expect(buildDatabaseUrl(connection(PASSWORD))).toBe(
      `postgresql://amg_migrator:${PASSWORD}@postgres:5432/amg`,
    );
  });

  it('encode chaque caractère réservé du mot de passe, % compris', () => {
    const tricky = 'a@evil.example:1/x?y#z%41 é';
    const url = new URL(buildDatabaseUrl(connection(tricky)));
    expect(url.hostname).toBe('postgres');
    expect(url.port).toBe('5432');
    expect(url.pathname).toBe('/amg');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(decodeURIComponent(url.password)).toBe(tricky);
  });
});

describe('loadCliDatabaseConnection', () => {
  it('ne définit aucune source de données sans variable de base (prisma generate)', () => {
    expect(loadCliDatabaseConnection({ PATH: '/usr/bin' }, files)).toBeUndefined();
  });

  it('lit la connexion et le mot de passe depuis son fichier', () => {
    const result = loadCliDatabaseConnection(BASE, files);
    expect(result).toMatchObject({
      host: 'postgres',
      port: 5432,
      database: 'amg',
      user: 'amg_migrator',
    });
    expect(result?.password.reveal()).toBe(PASSWORD);
  });

  it('prend le port 5432 par défaut', () => {
    const withoutPort = {
      DB_HOST: BASE.DB_HOST,
      DB_NAME: BASE.DB_NAME,
      DB_USER: BASE.DB_USER,
      DB_PASSWORD_FILE: BASE.DB_PASSWORD_FILE,
    };
    expect(loadCliDatabaseConnection(withoutPort, files)?.port).toBe(5432);
  });

  it('masque le mot de passe à toute sérialisation', () => {
    const result = loadCliDatabaseConnection(BASE, files);
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(inspect(result, { depth: 5 })).not.toContain(PASSWORD);
  });

  it('refuse un mot de passe passé directement dans l’environnement', () => {
    expect(
      errorsOf(() => loadCliDatabaseConnection({ ...BASE, DB_PASSWORD: PASSWORD }, files)),
    ).toEqual(['DB_PASSWORD : interdit ici, utiliser DB_PASSWORD_FILE']);
  });

  it('signale une configuration incomplète', () => {
    expect(errorsOf(() => loadCliDatabaseConnection({ DB_HOST: 'postgres' }, files))).toEqual([
      'DB_NAME : absente ou invalide (invalid_type)',
      'DB_USER : absente ou invalide (invalid_type)',
      'DB_PASSWORD_FILE : manquant',
    ]);
  });

  it.each([
    ['DB_HOST', 'user@evil.example'],
    ['DB_HOST', 'evil.example:6543'],
    ['DB_HOST', 'evil.example/amg'],
    ['DB_HOST', ''],
    ['DB_PORT', '0'],
    ['DB_PORT', '5432 '],
    ['DB_NAME', 'amg; DROP'],
    ['DB_NAME', 'Amg'],
    ['DB_USER', 'amg-app'],
    ['DB_USER', 'a'.repeat(64)],
  ])('refuse %s=%j sans citer la valeur', (name, value) => {
    const errors = errorsOf(() => loadCliDatabaseConnection({ ...BASE, [name]: value }, files));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^${name} : absente ou invalide`));
    if (value !== '') expect(errors.join('\n')).not.toContain(value);
  });

  it('exige un chemin absolu', () => {
    expect(
      errorsOf(() => loadCliDatabaseConnection({ ...BASE, DB_PASSWORD_FILE: 'secrets/pg' }, files)),
    ).toEqual(['DB_PASSWORD_FILE : chemin absolu attendu']);
  });

  it('signale un fichier illisible sans citer le chemin', () => {
    expect(
      errorsOf(() => loadCliDatabaseConnection({ ...BASE, DB_PASSWORD_FILE: '/absent' }, files)),
    ).toEqual(['DB_PASSWORD_FILE : fichier illisible']);
  });

  it.each([
    ['trop court', 'p'.repeat(31)],
    ['trop long', 'p'.repeat(257)],
  ])('refuse un mot de passe %s sans le citer', (_label, value) => {
    const errors = errorsOf(() =>
      loadCliDatabaseConnection(BASE, fakeFiles({ [BASE.DB_PASSWORD_FILE]: value })),
    );
    expect(errors).toEqual(['DB_PASSWORD : longueur hors bornes (32 à 256 caractères)']);
  });

  it('refuse un caractère de contrôle (deux sauts de ligne)', () => {
    const errors = errorsOf(() =>
      loadCliDatabaseConnection(BASE, fakeFiles({ [BASE.DB_PASSWORD_FILE]: `${PASSWORD}\n\n` })),
    );
    expect(errors).toEqual(['DB_PASSWORD : caractère de contrôle interdit']);
  });

  it('cumule les erreurs dans le message, sans aucune valeur', () => {
    try {
      loadCliDatabaseConnection({ ...BASE, DB_NAME: 'X-SENSIBLE', DB_PASSWORD: PASSWORD }, files);
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DatabaseConfigError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toContain('DB_NAME');
      expect(message).toContain('DB_PASSWORD');
      expect(message).not.toContain('X-SENSIBLE');
      expect(message).not.toContain(PASSWORD);
    }
  });
});
