import { describe, expect, it } from 'vitest';
import { loadEnv, type EnvSource, type SecretFileReader } from '../../src/config/load-env.js';
import { API_SECRETS } from '../../src/config/secrets.js';

const BASE: EnvSource = { NODE_ENV: 'production', AMG_ENV: 'prod', HOST: '0.0.0.0', PORT: '3000' };

const noFile: SecretFileReader = () => {
  throw new Error('aucun fichier attendu');
};

/** Disque factice : chemin → contenu ; tout autre chemin est illisible. */
function fakeFiles(files: Readonly<Record<string, string>>): SecretFileReader {
  return (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`ENOENT ${path}`);
    return content;
  };
}

const PEPPER = [{ name: 'TEST_PEPPER', minLength: 32, maxLength: 128 }] as const;
const SECRET_VALUE = 'x'.repeat(40);

function errorsOf(result: ReturnType<typeof loadEnv>): readonly string[] {
  return result.ok ? [] : result.errors;
}

describe('loadEnv : variables non secrètes', () => {
  it('accepte une configuration de production complète', () => {
    const result = loadEnv(BASE, noFile, API_SECRETS);
    expect(result).toEqual({
      ok: true,
      config: {
        env: { NODE_ENV: 'production', AMG_ENV: 'prod', HOST: '0.0.0.0', PORT: 3000 },
        secrets: {},
      },
    });
  });

  it('applique les valeurs par défaut locales (127.0.0.1:3000)', () => {
    const result = loadEnv({ NODE_ENV: 'development', AMG_ENV: 'dev' }, noFile, API_SECRETS);
    expect(result.ok && result.config.env).toEqual({
      NODE_ENV: 'development',
      AMG_ENV: 'dev',
      HOST: '127.0.0.1',
      PORT: 3000,
    });
  });

  it('exige NODE_ENV et AMG_ENV (aucun mode implicite)', () => {
    const errors = errorsOf(loadEnv({}, noFile, API_SECRETS));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^NODE_ENV : /),
        expect.stringMatching(/^AMG_ENV : /),
      ]),
    );
  });

  it.each([
    ['production', 'dev'],
    ['production', 'test'],
    ['development', 'prod'],
    ['test', 'staging'],
  ])('refuse le couple NODE_ENV=%s / AMG_ENV=%s', (nodeEnv, amgEnv) => {
    const errors = errorsOf(
      loadEnv({ ...BASE, NODE_ENV: nodeEnv, AMG_ENV: amgEnv }, noFile, API_SECRETS),
    );
    expect(errors).toEqual([expect.stringMatching(/^AMG_ENV : incompatible avec NODE_ENV/)]);
  });

  it.each(['0', '65536', '3e3', '0x10', ' 3000', '03000', '', '-1', '3000.5'])(
    'refuse PORT=%j',
    (port) => {
      const errors = errorsOf(loadEnv({ ...BASE, PORT: port }, noFile, API_SECRETS));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^PORT : /);
    },
  );

  it.each(['localhost', '::', '256.0.0.1', '0.0.0.0 '])('refuse HOST=%j', (host) => {
    expect(errorsOf(loadEnv({ ...BASE, HOST: host }, noFile, API_SECRETS))).toEqual([
      expect.stringMatching(/^HOST : /),
    ]);
  });

  it('ignore les variables hors liste blanche', () => {
    const result = loadEnv({ ...BASE, PATH: '/usr/bin', EXTRA: 'x' }, noFile, API_SECRETS);
    expect(result.ok && Object.keys(result.config.env)).toEqual([
      'NODE_ENV',
      'AMG_ENV',
      'HOST',
      'PORT',
    ]);
  });

  it('ne cite jamais la valeur reçue dans les erreurs', () => {
    const marker = 'VALEUR-SENSIBLE-123';
    const errors = errorsOf(
      loadEnv(
        { NODE_ENV: marker, AMG_ENV: marker, HOST: marker, PORT: marker },
        noFile,
        API_SECRETS,
      ),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).not.toContain(marker);
  });

  it('gèle la configuration chargée', () => {
    const result = loadEnv(BASE, noFile, API_SECRETS);
    expect(result.ok && Object.isFrozen(result.config) && Object.isFrozen(result.config.env)).toBe(
      true,
    );
  });
});

describe('loadEnv : secrets *_FILE', () => {
  it('lit le secret depuis son fichier et retire un seul saut de ligne final', () => {
    const result = loadEnv(
      { ...BASE, TEST_PEPPER_FILE: '/run/secrets/test_pepper' },
      fakeFiles({ '/run/secrets/test_pepper': `${SECRET_VALUE}\n` }),
      PEPPER,
    );
    expect(result.ok && result.config.secrets.TEST_PEPPER.reveal()).toBe(SECRET_VALUE);
  });

  it('accepte une fin de ligne Windows', () => {
    const result = loadEnv(
      { ...BASE, TEST_PEPPER_FILE: '/s' },
      fakeFiles({ '/s': `${SECRET_VALUE}\r\n` }),
      PEPPER,
    );
    expect(result.ok && result.config.secrets.TEST_PEPPER.reveal()).toBe(SECRET_VALUE);
  });

  it('refuse la forme directe en production', () => {
    const errors = errorsOf(loadEnv({ ...BASE, TEST_PEPPER: SECRET_VALUE }, noFile, PEPPER));
    expect(errors).toEqual([
      'TEST_PEPPER : interdit hors développement et test, utiliser TEST_PEPPER_FILE',
    ]);
  });

  it('refuse la forme directe si NODE_ENV est absent ou inconnu (refus par défaut)', () => {
    const errors = errorsOf(loadEnv({ AMG_ENV: 'dev', TEST_PEPPER: SECRET_VALUE }, noFile, PEPPER));
    expect(errors).toContain(
      'TEST_PEPPER : interdit hors développement et test, utiliser TEST_PEPPER_FILE',
    );
  });

  it('admet la forme directe en développement et en test', () => {
    for (const [nodeEnv, amgEnv] of [
      ['development', 'dev'],
      ['test', 'test'],
    ] as const) {
      const result = loadEnv(
        { NODE_ENV: nodeEnv, AMG_ENV: amgEnv, TEST_PEPPER: SECRET_VALUE },
        noFile,
        PEPPER,
      );
      expect(result.ok && result.config.secrets.TEST_PEPPER.reveal()).toBe(SECRET_VALUE);
    }
  });

  it('refuse X et X_FILE définis ensemble', () => {
    const errors = errorsOf(
      loadEnv(
        { ...BASE, TEST_PEPPER: SECRET_VALUE, TEST_PEPPER_FILE: '/s' },
        fakeFiles({ '/s': SECRET_VALUE }),
        PEPPER,
      ),
    );
    expect(errors).toEqual(['TEST_PEPPER : TEST_PEPPER et TEST_PEPPER_FILE définis ensemble']);
  });

  it('signale un secret manquant', () => {
    expect(errorsOf(loadEnv(BASE, noFile, PEPPER))).toEqual([
      'TEST_PEPPER : manquant (TEST_PEPPER_FILE attendu)',
    ]);
  });

  it('exige un chemin absolu', () => {
    expect(errorsOf(loadEnv({ ...BASE, TEST_PEPPER_FILE: 'secrets/p' }, noFile, PEPPER))).toEqual([
      'TEST_PEPPER_FILE : chemin absolu attendu',
    ]);
  });

  it('signale un fichier illisible sans citer le chemin ni l’erreur système', () => {
    const errors = errorsOf(
      loadEnv({ ...BASE, TEST_PEPPER_FILE: '/absent/secret' }, fakeFiles({}), PEPPER),
    );
    expect(errors).toEqual(['TEST_PEPPER_FILE : fichier illisible']);
  });

  it.each([
    ['trop court', 'x'.repeat(31)],
    ['trop long', 'x'.repeat(129)],
    ['vide', ''],
  ])('refuse un secret %s sans citer sa valeur', (_label, value) => {
    const errors = errorsOf(
      loadEnv({ ...BASE, TEST_PEPPER_FILE: '/s' }, fakeFiles({ '/s': value }), PEPPER),
    );
    expect(errors).toEqual(['TEST_PEPPER : longueur hors bornes (32 à 128 caractères)']);
  });

  it('refuse un caractère de contrôle (deux sauts de ligne, tabulation, NUL)', () => {
    for (const value of [`${SECRET_VALUE}\n\n`, `${SECRET_VALUE}\tz`, `${SECRET_VALUE}\u0000`]) {
      const errors = errorsOf(
        loadEnv({ ...BASE, TEST_PEPPER_FILE: '/s' }, fakeFiles({ '/s': value }), PEPPER),
      );
      expect(errors).toEqual(['TEST_PEPPER : caractère de contrôle interdit']);
    }
  });

  it('refuse un secret déclaré deux fois', () => {
    const twice = [PEPPER[0], PEPPER[0]] as const;
    const errors = errorsOf(
      loadEnv({ ...BASE, TEST_PEPPER_FILE: '/s' }, fakeFiles({ '/s': SECRET_VALUE }), twice),
    );
    expect(errors).toEqual(['TEST_PEPPER : secret déclaré deux fois']);
  });

  it('cumule les erreurs de l’environnement et des secrets, sans aucune valeur', () => {
    const errors = errorsOf(
      loadEnv(
        { NODE_ENV: 'production', AMG_ENV: 'dev', TEST_PEPPER: SECRET_VALUE },
        noFile,
        PEPPER,
      ),
    );
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).not.toContain(SECRET_VALUE);
  });
});
