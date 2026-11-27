import { describe, expect, it } from 'vitest';
import { loadEnv, type EnvSource, type SecretFileReader } from '../../src/config/load-env.js';
import { API_SECRETS } from '../../src/config/secrets.js';

/** Variables non secrètes obligatoires hors de celles éprouvées par chaque test. */
const DB: EnvSource = {
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'amg',
  DB_USER: 'amg_app',
  ADMIN_ORIGIN: 'https://admin.example.test',
  CLIENT_ORIGIN: 'https://espace.example.test',
  REDIS_HOST: 'redis',
  REDIS_USER: 'amg_api',
};
const BASE: EnvSource = {
  NODE_ENV: 'production',
  AMG_ENV: 'prod',
  HOST: '0.0.0.0',
  PORT: '3000',
  TRUSTED_PROXY: '172.30.0.0/24',
  ...DB,
};
const DB_ENV = {
  DB_HOST: 'postgres',
  DB_PORT: 5432,
  DB_NAME: 'amg',
  DB_USER: 'amg_app',
  DB_JOURNAL_USER: 'amg_journal',
  ADMIN_ORIGIN: 'https://admin.example.test',
  CLIENT_ORIGIN: 'https://espace.example.test',
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379,
  REDIS_USER: 'amg_api',
};
const PROXY = { family: 'ipv4', address: '172.30.0.0', prefix: 24 };

/** Copie sans la variable `name`. */
function omit(source: EnvSource, name: string): EnvSource {
  return Object.fromEntries(Object.entries(source).filter(([key]) => key !== name));
}

/** Les trois secrets de l'API, par fichier. */
const SECRET_FILES: EnvSource = {
  DB_PASSWORD_FILE: '/run/secrets/pg_app_password',
  DB_JOURNAL_PASSWORD_FILE: '/run/secrets/pg_journal_password',
  REDIS_PASSWORD_FILE: '/run/secrets/redis_password',
};

/** Variables non secrètes seules (les secrets de l'API sont éprouvés plus bas). */
const NO_SECRETS = [] as const;

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
    const result = loadEnv(BASE, noFile, NO_SECRETS);
    expect(result).toEqual({
      ok: true,
      config: {
        env: {
          NODE_ENV: 'production',
          AMG_ENV: 'prod',
          HOST: '0.0.0.0',
          PORT: 3000,
          ...DB_ENV,
          TRUSTED_PROXY: PROXY,
        },
        secrets: {},
      },
    });
  });

  it('applique les valeurs par défaut locales (127.0.0.1:3000)', () => {
    const result = loadEnv(
      {
        NODE_ENV: 'development',
        AMG_ENV: 'dev',
        DB_HOST: 'localhost',
        DB_NAME: 'amg_dev',
        DB_USER: 'amg_app',
        ADMIN_ORIGIN: 'http://localhost:4200',
        CLIENT_ORIGIN: 'http://localhost:4300',
        REDIS_HOST: 'localhost',
        REDIS_USER: 'amg_api',
      },
      noFile,
      NO_SECRETS,
    );
    expect(result.ok && result.config.env).toEqual({
      NODE_ENV: 'development',
      AMG_ENV: 'dev',
      HOST: '127.0.0.1',
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'amg_dev',
      DB_USER: 'amg_app',
      DB_JOURNAL_USER: 'amg_journal',
      ADMIN_ORIGIN: 'http://localhost:4200',
      CLIENT_ORIGIN: 'http://localhost:4300',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_USER: 'amg_api',
    });
  });

  it('exige NODE_ENV et AMG_ENV (aucun mode implicite)', () => {
    const errors = errorsOf(loadEnv({}, noFile, NO_SECRETS));
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
      loadEnv({ ...BASE, NODE_ENV: nodeEnv, AMG_ENV: amgEnv }, noFile, NO_SECRETS),
    );
    expect(errors).toEqual([expect.stringMatching(/^AMG_ENV : incompatible avec NODE_ENV/)]);
  });

  it.each(['0', '65536', '3e3', '0x10', ' 3000', '03000', '', '-1', '3000.5'])(
    'refuse PORT=%j',
    (port) => {
      const errors = errorsOf(loadEnv({ ...BASE, PORT: port }, noFile, NO_SECRETS));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^PORT : /);
    },
  );

  it.each(['localhost', '::', '256.0.0.1', '0.0.0.0 '])('refuse HOST=%j', (host) => {
    expect(errorsOf(loadEnv({ ...BASE, HOST: host }, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(/^HOST : /),
    ]);
  });

  it('ignore les variables hors liste blanche', () => {
    const result = loadEnv({ ...BASE, PATH: '/usr/bin', EXTRA: 'x' }, noFile, NO_SECRETS);
    expect(result.ok && Object.keys(result.config.env)).toEqual([
      'NODE_ENV',
      'AMG_ENV',
      'HOST',
      'PORT',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_JOURNAL_USER',
      'ADMIN_ORIGIN',
      'CLIENT_ORIGIN',
      'TRUSTED_PROXY',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_USER',
    ]);
  });

  it('ne cite jamais la valeur reçue dans les erreurs', () => {
    const marker = 'VALEUR-SENSIBLE-123';
    const errors = errorsOf(
      loadEnv(
        {
          NODE_ENV: marker,
          AMG_ENV: marker,
          HOST: marker,
          PORT: marker,
          DB_HOST: marker,
          DB_PORT: marker,
          DB_NAME: marker,
          DB_USER: marker,
          DB_JOURNAL_USER: marker,
          ADMIN_ORIGIN: marker,
          CLIENT_ORIGIN: marker,
          TRUSTED_PROXY: marker,
          REDIS_HOST: marker,
          REDIS_PORT: marker,
          REDIS_USER: marker,
        },
        noFile,
        NO_SECRETS,
      ),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).not.toContain(marker);
  });

  it('gèle la configuration chargée', () => {
    const result = loadEnv(BASE, noFile, NO_SECRETS);
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
        { NODE_ENV: nodeEnv, AMG_ENV: amgEnv, ...DB, TEST_PEPPER: SECRET_VALUE },
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
        {
          NODE_ENV: 'production',
          AMG_ENV: 'dev',
          TRUSTED_PROXY: '172.30.0.2',
          ...DB,
          TEST_PEPPER: SECRET_VALUE,
        },
        noFile,
        PEPPER,
      ),
    );
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).not.toContain(SECRET_VALUE);
  });
});

describe('loadEnv : base de données', () => {
  const DB_PASSWORD = 'mot-de-passe-du-role-amg-app-0123456789';

  it('exige les quatre variables de connexion', () => {
    const errors = errorsOf(
      loadEnv({ NODE_ENV: 'production', AMG_ENV: 'prod' }, noFile, NO_SECRETS),
    );
    for (const name of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
      expect(errors).toContainEqual(expect.stringMatching(new RegExp(`^${name} : `)));
    }
  });

  it.each(['amg', 'amg_migrator', 'postgres'])(
    'refuse que l’API se connecte avec le rôle réservé %s',
    (user) => {
      expect(errorsOf(loadEnv({ ...BASE, DB_USER: user }, noFile, NO_SECRETS))).toEqual([
        expect.stringMatching(/^DB_USER : rôle réservé/),
      ]);
    },
  );

  it.each([
    ['DB_HOST', 'amg_app:secret@postgres'],
    ['DB_PORT', '5432/amg'],
    ['DB_NAME', 'amg?sslmode=disable'],
  ])('refuse %s=%j', (name, value) => {
    expect(errorsOf(loadEnv({ ...BASE, [name]: value }, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(new RegExp(`^${name} : `)),
    ]);
  });

  /** Fichiers secrets valides des trois secrets de l'API. */
  const files = fakeFiles({
    '/run/secrets/pg_app_password': `${DB_PASSWORD}\n`,
    '/run/secrets/pg_journal_password': `${DB_PASSWORD}-journal\n`,
    '/run/secrets/redis_password': `${DB_PASSWORD}-redis\n`,
  });

  it('lit les secrets de l’API depuis leurs fichiers', () => {
    const result = loadEnv({ ...BASE, ...SECRET_FILES }, files, API_SECRETS);
    expect(result.ok && result.config.secrets.DB_PASSWORD.reveal()).toBe(DB_PASSWORD);
    expect(result.ok && result.config.secrets.DB_JOURNAL_PASSWORD.reveal()).toBe(
      `${DB_PASSWORD}-journal`,
    );
    expect(result.ok && result.config.secrets.REDIS_PASSWORD.reveal()).toBe(`${DB_PASSWORD}-redis`);
  });

  it.each(['DB_PASSWORD', 'DB_JOURNAL_PASSWORD', 'REDIS_PASSWORD'])(
    'refuse %s dans l’environnement en production',
    (name) => {
      const others = omit(SECRET_FILES, `${name}_FILE`);
      expect(
        errorsOf(loadEnv({ ...BASE, ...others, [name]: DB_PASSWORD }, files, API_SECRETS)),
      ).toEqual([`${name} : interdit hors développement et test, utiliser ${name}_FILE`]);
    },
  );

  it('refuse un mot de passe de moins de 32 caractères', () => {
    const errors = errorsOf(
      loadEnv(
        { ...BASE, ...SECRET_FILES, DB_PASSWORD_FILE: '/s' },
        (path) => (path === '/s' ? 'court' : files(path)),
        API_SECRETS,
      ),
    );
    expect(errors).toEqual(['DB_PASSWORD : longueur hors bornes (32 à 256 caractères)']);
  });

  it('n’accepte aucune URL de connexion (DATABASE_URL est ignorée)', () => {
    const result = loadEnv(
      { ...BASE, DATABASE_URL: 'postgresql://amg:secret@postgres/amg' },
      noFile,
      NO_SECRETS,
    );
    expect(result.ok && Object.keys(result.config.env)).not.toContain('DATABASE_URL');
  });
});

describe('loadEnv : hôtes, proxy de confiance, Redis et journal', () => {
  it.each([
    ['ADMIN_ORIGIN', 'https://admin.example.test/'],
    ['ADMIN_ORIGIN', 'https://admin.example.test/api'],
    ['ADMIN_ORIGIN', 'https://admin.example.test:8443'],
    ['ADMIN_ORIGIN', 'https://user@admin.example.test'],
    ['ADMIN_ORIGIN', 'https://ADMIN.example.test'],
    ['ADMIN_ORIGIN', 'admin.example.test'],
    ['ADMIN_ORIGIN', 'null'],
    ['CLIENT_ORIGIN', 'ftp://espace.example.test'],
    ['CLIENT_ORIGIN', 'http://localhost:99999'],
    ['CLIENT_ORIGIN', 'https://localhost'],
  ])('refuse %s=%j', (name, value) => {
    const errors = errorsOf(loadEnv({ ...BASE, [name]: value }, noFile, NO_SECRETS));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((error) => error.startsWith(`${name} : `))).toBe(true);
  });

  it.each(['ADMIN_ORIGIN', 'CLIENT_ORIGIN'])('exige https:// pour %s en production', (name) => {
    expect(
      errorsOf(loadEnv({ ...BASE, [name]: 'http://localhost:4200' }, noFile, NO_SECRETS)),
    ).toEqual([`${name} : https:// exigé en production`]);
  });

  it('exige deux hôtes distincts', () => {
    expect(
      errorsOf(
        loadEnv({ ...BASE, CLIENT_ORIGIN: 'https://admin.example.test' }, noFile, NO_SECRETS),
      ),
    ).toEqual(['CLIENT_ORIGIN : hôte identique à ADMIN_ORIGIN (deux hôtes distincts exigés)']);
  });

  it('exige le proxy de confiance en production', () => {
    const withoutProxy = omit(BASE, 'TRUSTED_PROXY');
    expect(errorsOf(loadEnv(withoutProxy, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(/^TRUSTED_PROXY : obligatoire en production/),
    ]);
  });

  it.each([
    ['172.30.0.2', { family: 'ipv4', address: '172.30.0.2', prefix: 32 }],
    ['172.30.0.0/16', { family: 'ipv4', address: '172.30.0.0', prefix: 16 }],
    ['fd00:1::/64', { family: 'ipv6', address: 'fd00:1::', prefix: 64 }],
  ])('accepte TRUSTED_PROXY=%s', (value, expected) => {
    const result = loadEnv({ ...BASE, TRUSTED_PROXY: value }, noFile, NO_SECRETS);
    expect(result.ok && result.config.env.TRUSTED_PROXY).toEqual(expected);
  });

  it.each([
    'true',
    '*',
    '0.0.0.0/0',
    '10.0.0.0/8',
    '172.30.0.0/15',
    '::/0',
    'fd00::/32',
    '172.30.0.0/33',
    '172.30.0.0/024',
    '172.30.0.0/16/1',
    '172.30.0.0, 10.0.0.1',
    'traefik',
    'fe80::1%eth0',
  ])('refuse TRUSTED_PROXY=%j', (value) => {
    expect(errorsOf(loadEnv({ ...BASE, TRUSTED_PROXY: value }, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(/^TRUSTED_PROXY : /),
    ]);
  });

  it.each(['default', 'Amg', 'amg api', ''])('refuse REDIS_USER=%j', (value) => {
    expect(errorsOf(loadEnv({ ...BASE, REDIS_USER: value }, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(/^REDIS_USER : /),
    ]);
  });

  it.each(['amg_app', 'amg', 'amg_migrator', 'postgres'])(
    'refuse DB_JOURNAL_USER=%s (rôle dédié au journal attendu)',
    (value) => {
      expect(errorsOf(loadEnv({ ...BASE, DB_JOURNAL_USER: value }, noFile, NO_SECRETS))).toEqual([
        expect.stringMatching(/^DB_JOURNAL_USER : /),
      ]);
    },
  );

  it.each(['redis:6379', 'redis/0'])('refuse REDIS_HOST=%j', (value) => {
    expect(errorsOf(loadEnv({ ...BASE, REDIS_HOST: value }, noFile, NO_SECRETS))).toEqual([
      expect.stringMatching(/^REDIS_HOST : /),
    ]);
  });
});
