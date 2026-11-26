// Lecteur réel des fichiers secrets (seule partie de la configuration qui touche le disque).
import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import type { SecretFileReader } from './load-env.js';

/** Taille maximale d'un fichier secret : bien au-delà d'une clé ou d'un mot de passe. */
export const SECRET_FILE_MAX_BYTES = 4096;

/** Lit un fichier régulier d'au plus 4 Kio (pas un tube, un périphérique ni un dossier). */
export const readSecretFile: SecretFileReader = (path) => {
  const fd = openSync(path, 'r');
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > SECRET_FILE_MAX_BYTES) {
      throw new Error('fichier secret refusé');
    }
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
};
