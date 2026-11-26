// Lecteur réel des fichiers secrets (seule partie de la configuration qui touche le disque).
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import type { SecretFileReader } from './load-env.js';

/** Taille maximale d'un fichier secret : bien au-delà d'une clé ou d'un mot de passe. */
export const SECRET_FILE_MAX_BYTES = 4096;

/**
 * - `O_NOFOLLOW` : le chemin désigné ne peut pas être un lien symbolique (vers /proc, un autre secret) ;
 * - `O_NONBLOCK` : l'ouverture d'un tube nommé sans écrivain rend la main au lieu de bloquer le
 *   démarrage (le tube est ensuite refusé par `fstat`).
 */
const OPEN_FLAGS = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;

/** Décodage strict : un octet UTF-8 invalide lève une erreur au lieu de devenir U+FFFD. */
const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Lit un fichier régulier d'au plus 4 Kio, en UTF-8 valide. Refuse : lien symbolique, tube,
 * périphérique, dossier, fichier plus gros que la limite, et fichier dont le contenu lu ne
 * correspond pas à la taille annoncée (pseudo-fichiers de /proc ou /sys, annoncés à 0 octet).
 * La lecture est bornée au tampon de MAX + 1 octets : un tampon plein signifie « trop gros ».
 */
export const readSecretFile: SecretFileReader = (path) => {
  const fd = openSync(path, OPEN_FLAGS);
  const buffer = Buffer.alloc(SECRET_FILE_MAX_BYTES + 1);
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > SECRET_FILE_MAX_BYTES) {
      throw new Error('fichier secret refusé');
    }
    let length = 0;
    for (;;) {
      const read = readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      if (length === buffer.length) throw new Error('fichier secret refusé');
    }
    if (length !== stats.size) {
      throw new Error('fichier secret refusé');
    }
    return STRICT_UTF8.decode(buffer.subarray(0, length));
  } finally {
    // Le tampon ne garde pas de copie du secret (la chaîne décodée est la seule restante).
    buffer.fill(0);
    closeSync(fd);
  }
};
