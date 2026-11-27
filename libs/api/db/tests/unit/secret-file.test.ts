// Lecteur de fichiers secrets sur de vrais fichiers (dossier temporaire) : chaque refus est
// éprouvé sur l'objet réel qu'il vise (lien, tube, périphérique, pseudo-fichier de /proc).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SECRET_FILE_MAX_BYTES, readSecretFile } from '../../src/secret-file.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'amg-secret-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function file(name: string, content: string | Uint8Array): string {
  const path = join(dir, name);
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}

describe('readSecretFile : fichiers acceptés', () => {
  it('lit un fichier régulier en UTF-8', () => {
    expect(readSecretFile(file('ok', 'clé-secrète-é\n'))).toBe('clé-secrète-é\n');
  });

  it('accepte exactement la taille maximale', () => {
    const content = 'a'.repeat(SECRET_FILE_MAX_BYTES);
    expect(readSecretFile(file('max', content))).toBe(content);
  });
});

describe('readSecretFile : refus', () => {
  it('refuse un fichier dépassant la taille maximale', () => {
    expect(() => readSecretFile(file('big', 'a'.repeat(SECRET_FILE_MAX_BYTES + 1)))).toThrow();
  });

  it('refuse un UTF-8 invalide (au lieu de le remplacer par U+FFFD)', () => {
    expect(() => readSecretFile(file('latin1', Uint8Array.from([0x63, 0x6c, 0xe9])))).toThrow();
  });

  it('refuse un lien symbolique, même vers un fichier valide', () => {
    const target = file('target', 'secret-valide');
    const link = join(dir, 'link');
    symlinkSync(target, link);
    expect(() => readSecretFile(link)).toThrow();
  });

  it('refuse un dossier', () => {
    const sub = join(dir, 'sub');
    mkdirSync(sub);
    expect(() => readSecretFile(sub)).toThrow();
  });

  it('refuse un fichier absent', () => {
    expect(() => readSecretFile(join(dir, 'absent'))).toThrow();
  });

  it.runIf(process.platform === 'linux')(
    'refuse un tube nommé sans écrivain, immédiatement (aucun blocage)',
    { timeout: 2000 },
    () => {
      const fifo = join(dir, 'fifo');
      execFileSync('mkfifo', [fifo]);
      const started = performance.now();
      expect(() => readSecretFile(fifo)).toThrow();
      expect(performance.now() - started).toBeLessThan(1000);
    },
  );

  it.runIf(existsSync('/dev/zero'))('refuse un périphérique (/dev/zero)', () => {
    expect(() => readSecretFile('/dev/zero')).toThrow();
  });

  it.runIf(existsSync('/proc/self/environ'))(
    'refuse un pseudo-fichier de /proc (annoncé à 0 octet)',
    () => {
      expect(() => readSecretFile('/proc/self/environ')).toThrow();
    },
  );

  it.runIf(existsSync('/proc/self/status'))('refuse /proc/self/status (texte, < 4 Kio)', () => {
    expect(() => readSecretFile('/proc/self/status')).toThrow();
  });
});
