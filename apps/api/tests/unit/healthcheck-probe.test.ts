import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PORT,
  DRAIN_FILE,
  PROBE_HEALTHY,
  PROBE_TIMEOUT_MS,
  PROBE_UNHEALTHY,
  PROBE_USAGE,
  probePort,
  runProbe,
  type ProbeDeps,
} from '../../src/healthcheck/probe.js';

function deps(overrides: Partial<ProbeDeps> = {}): ProbeDeps {
  return {
    exists: () => false,
    writeFile: () => undefined,
    get: () => Promise.resolve(200),
    ...overrides,
  };
}

describe('probePort', () => {
  it('prend 3000 par défaut et accepte un port décimal strict', () => {
    expect(probePort(undefined)).toBe(DEFAULT_PORT);
    expect(probePort('8080')).toBe(8080);
    expect(probePort('65535')).toBe(65_535);
  });

  it.each(['', '0', '03000', '3e3', '0x10', ' 3000', '65536', '123456'])(
    'refuse « %s »',
    (value) => {
      expect(probePort(value)).toBeUndefined();
    },
  );
});

describe('runProbe', () => {
  it('interroge la route de vivacité en local avec un délai borné', async () => {
    const get = vi.fn<ProbeDeps['get']>(() => Promise.resolve(200));
    await expect(runProbe([], { PORT: '3000' }, deps({ get }))).resolves.toBe(PROBE_HEALTHY);
    expect(get).toHaveBeenCalledWith('http://127.0.0.1:3000/api/health', PROBE_TIMEOUT_MS);
  });

  it('est malsaine si la réponse n’est pas 200, ou en cas d’erreur réseau', async () => {
    await expect(runProbe([], {}, deps({ get: () => Promise.resolve(503) }))).resolves.toBe(
      PROBE_UNHEALTHY,
    );
    await expect(
      runProbe([], {}, deps({ get: () => Promise.reject(new Error('ECONNREFUSED')) })),
    ).resolves.toBe(PROBE_UNHEALTHY);
  });

  it('est malsaine pendant le drainage, sans requête', async () => {
    const get = vi.fn<ProbeDeps['get']>(() => Promise.resolve(200));
    const exists = (path: string): boolean => path === DRAIN_FILE;
    await expect(runProbe([], {}, deps({ exists, get }))).resolves.toBe(PROBE_UNHEALTHY);
    expect(get).not.toHaveBeenCalled();
  });

  it('est malsaine si PORT est invalide', async () => {
    await expect(runProbe([], { PORT: 'abc' }, deps())).resolves.toBe(PROBE_UNHEALTHY);
  });

  it('pose le fichier de drainage sur demande', async () => {
    const writeFile = vi.fn<ProbeDeps['writeFile']>();
    await expect(runProbe(['drain'], {}, deps({ writeFile }))).resolves.toBe(PROBE_HEALTHY);
    expect(writeFile).toHaveBeenCalledWith(DRAIN_FILE, '');
  });

  it('refuse tout autre argument', async () => {
    await expect(runProbe(['drain', 'x'], {}, deps())).resolves.toBe(PROBE_USAGE);
    await expect(runProbe(['--help'], {}, deps())).resolves.toBe(PROBE_USAGE);
  });
});
